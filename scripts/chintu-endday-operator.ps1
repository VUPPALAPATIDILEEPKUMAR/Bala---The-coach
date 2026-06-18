<#
.SYNOPSIS
    Chintu end-day operator.

.DESCRIPTION
    Local-only evening operator layer for Chintu OS. It summarizes repo state,
    validation, bridge state, changed work, blockers, and parked systems, then
    writes CHINTU_TOMORROW_START.md and a dated daily log entry.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER SharedDir
    Shared bridge folder. Defaults to:
    C:\Users\<user>\Desktop\CHINTU_SHARED_BRIDGE

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-endday-operator.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$SharedDir = "$env:USERPROFILE\Desktop\CHINTU_SHARED_BRIDGE"
)

$ErrorActionPreference = "Continue"

function Say {
    param([string]$Text)
    Write-Host $Text
}

function Run-LocalScript {
    param(
        [string]$RelPath,
        [string]$Label
    )
    $full = Join-Path $RepoRoot $RelPath
    if (-not (Test-Path -LiteralPath $full)) {
        return [pscustomobject]@{
            Label  = $Label
            Status = "MISSING"
            Exit   = -1
            Output = @("(missing: $RelPath)")
        }
    }

    $out = @()
    $exitCode = -1
    $status = "ERROR"
    try {
        $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $full 2>&1
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) { $exitCode = 0 }
        if ($exitCode -eq 0) { $status = "OK" } else { $status = "FAIL" }
    } catch {
        $out = @("(error running ${Label}: $($_.Exception.Message))")
        $status = "ERROR"
    }

    $outText = @($out | ForEach-Object { [string]$_ })
    return [pscustomobject]@{
        Label  = $Label
        Status = $status
        Exit   = $exitCode
        Output = $outText
    }
}

function Find-FirstLine {
    param(
        [string[]]$Lines,
        [string]$Pattern
    )
    $hit = @($Lines | Where-Object { $_ -match $Pattern } | Select-Object -First 1)
    if ($hit.Count -gt 0) { return [string]$hit[0] }
    return ""
}

function Test-ExpectedFlatFiles {
    param([string]$FlatDir)
    $expected = @(
        "latest_status.md",
        "latest_bala_validation.md",
        "latest_git_status.md",
        "latest_codex_handoff.md",
        "latest_openclaw_report.md",
        "latest_next_actions.md",
        "BRIDGE_TRANSFER_README.md"
    )
    $missing = @()
    foreach ($name in $expected) {
        if (-not (Test-Path -LiteralPath (Join-Path $FlatDir $name))) {
            $missing += $name
        }
    }
    return [pscustomobject]@{
        Missing = $missing
        Ok      = ($missing.Count -eq 0)
    }
}

function Get-SharedBridgeState {
    param([string]$Path)

    $exists = Test-Path -LiteralPath $Path
    $zipPath = Join-Path $Path "CHINTU_BRIDGE_LATEST.zip"
    $manifestPath = Join-Path $Path "MANIFEST.txt"
    $flatDir = Join-Path $Path "LATEST_FLAT"
    $zipExists = $exists -and (Test-Path -LiteralPath $zipPath)
    $manifestExists = $exists -and (Test-Path -LiteralPath $manifestPath)
    $flatExists = $exists -and (Test-Path -LiteralPath $flatDir)
    $flatCheck = if ($flatExists) {
        Test-ExpectedFlatFiles -FlatDir $flatDir
    } else {
        [pscustomobject]@{ Missing = @(); Ok = $false }
    }

    return [pscustomobject]@{
        Exists         = $exists
        ZipExists      = $zipExists
        ManifestExists = $manifestExists
        FlatExists     = $flatExists
        FlatOk         = $flatCheck.Ok
        Ready          = ($exists -and $zipExists -and $manifestExists -and $flatExists -and $flatCheck.Ok)
    }
}

function Get-MarkdownBulletLines {
    param([string]$Path)

    $items = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $Path) {
        try {
            foreach ($line in Get-Content -LiteralPath $Path) {
                $trim = $line.Trim()
                if ($trim.StartsWith("- ")) {
                    $items.Add($trim.Substring(2)) | Out-Null
                }
            }
        } catch {}
    }
    return @($items)
}

function Get-ParkedSystems {
    param([string]$Path)

    $items = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $Path) {
        try {
            foreach ($line in Get-Content -LiteralPath $Path) {
                if ($line -match '^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|') {
                    $name = $Matches[1].Trim()
                    $status = $Matches[2].Trim()
                    if ($name -ne "System" -and $name -notmatch '^-+$') {
                        $items.Add("$name - $status") | Out-Null
                    }
                }
            }
        } catch {}
    }
    return @($items)
}

function Get-TodayChanges {
    $items = New-Object System.Collections.Generic.List[string]
    $dayStart = (Get-Date).Date
    $sinceText = $dayStart.ToString("yyyy-MM-ddTHH:mm:ss")
    $todayCommits = @(& git log --oneline --since="$sinceText" 2>$null | Where-Object { $_.Trim() -ne "" })
    if ($todayCommits.Count -gt 0) {
        $items.Add("Commits recorded today:") | Out-Null
        foreach ($line in $todayCommits) {
            $items.Add("  $line") | Out-Null
        }
    } else {
        $items.Add("No commit recorded today yet.") | Out-Null
    }

    $dirty = @(& git status --short 2>$null | Where-Object { $_.Trim() -ne "" })
    if ($dirty.Count -gt 0) {
        $items.Add("Working tree changes still present:") | Out-Null
        foreach ($line in $dirty) {
            $items.Add("  $line") | Out-Null
        }
    } else {
        $items.Add("Working tree is clean at end-of-day.") | Out-Null
    }

    return @($items)
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Say "STOP: repo root not found: $RepoRoot"
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$dateSlug = Get-Date -Format "yyyy-MM-dd"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$latestCommit = (& git log --oneline -1 2>$null)
if (-not $latestCommit) { $latestCommit = "(unknown)" }
$statusShort = @(& git status --short 2>$null | Where-Object { $_.Trim() -ne "" })
$treeClean = ($statusShort.Count -eq 0)
$unpushedCount = 0
try {
    $countText = (& git rev-list --count origin/main..HEAD 2>$null)
    if ($countText) { $unpushedCount = [int]$countText }
} catch {
    $unpushedCount = @(& git log --oneline origin/main..HEAD 2>$null | Where-Object { $_.Trim() -ne "" }).Count
}

$validator = Run-LocalScript -RelPath "scripts\chintu-validate.ps1" -Label "chintu-validate"
$guard = Run-LocalScript -RelPath "scripts\chintu-release-guard.ps1" -Label "chintu-release-guard"
$bridge = Run-LocalScript -RelPath "scripts\chintu-bridge-command-center.ps1" -Label "chintu-bridge-command-center"
$nextAction = Run-LocalScript -RelPath "scripts\chintu-next-action.ps1" -Label "chintu-next-action"

$validatorVerdict = Find-FirstLine -Lines $validator.Output -Pattern '^VERDICT:'
if (-not $validatorVerdict) { $validatorVerdict = "VERDICT: (unknown)" }
$guardRecommendation = Find-FirstLine -Lines $guard.Output -Pattern '^RECOMMENDATION:'
if (-not $guardRecommendation) { $guardRecommendation = "RECOMMENDATION: (unknown)" }
$exactNextAction = Find-FirstLine -Lines $nextAction.Output -Pattern '^NEXT ACTION:'
if (-not $exactNextAction) { $exactNextAction = "NEXT ACTION: (not available)" }

$shared = Get-SharedBridgeState -Path $SharedDir
$blockers = Get-MarkdownBulletLines -Path (Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\BLOCKERS.md")
$parked = Get-ParkedSystems -Path (Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\PARKED_SYSTEMS.md")
$todayChanges = Get-TodayChanges

$dailyLogsDir = Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\DAILY_LOGS"
if (-not (Test-Path -LiteralPath $dailyLogsDir)) {
    New-Item -ItemType Directory -Path $dailyLogsDir -Force | Out-Null
}

$tomorrowPath = Join-Path $RepoRoot "CHINTU_TOMORROW_START.md"
$dailyLogPath = Join-Path $dailyLogsDir "$dateSlug.md"

$whereStopped = ""
if (-not $treeClean) {
    $whereStopped = "We stopped with local Chintu OS changes in the working tree awaiting review and commit."
} elseif ($unpushedCount -gt 0) {
    $whereStopped = "We stopped after a clean local commit. Human push review is next."
} else {
    $whereStopped = "We stopped clean and caught up with origin/main."
}

$pushState = if ($unpushedCount -gt 0) {
    "$unpushedCount commit(s) are ahead of origin/main and still need a human push."
} else {
    "HEAD is caught up with origin/main."
}

$whatNotToTouch = @(
    "app.js",
    "index.html",
    "styles.css",
    "sw.js",
    "coach.js",
    "manifest.webmanifest",
    "privacy.html",
    "functions/api/coach.js",
    "Telegram / Discord / webhooks / memory-wiki / cloud sync / phone notifications / voice calling",
    "BALA app feature work without explicit founder instruction"
)

$tomorrowLines = New-Object System.Collections.Generic.List[string]
$tomorrowLines.Add("# Chintu Tomorrow Start")
$tomorrowLines.Add("")
$tomorrowLines.Add("Chintu closed the loop. Here is where we stopped.")
$tomorrowLines.Add("")
$tomorrowLines.Add("**Generated:** $stamp")
$tomorrowLines.Add("**Repo:** $RepoRoot")
$tomorrowLines.Add("**Branch:** $branch")
$tomorrowLines.Add("")
$tomorrowLines.Add("## 1. Where we stopped")
$tomorrowLines.Add("")
$tomorrowLines.Add("- $whereStopped")
$tomorrowLines.Add("")
$tomorrowLines.Add("## 2. Latest safe commit")
$tomorrowLines.Add("")
$tomorrowLines.Add("- ``$latestCommit``")
$tomorrowLines.Add("")
$tomorrowLines.Add("## 3. What is pushed / not pushed")
$tomorrowLines.Add("")
$tomorrowLines.Add("- $pushState")
$tomorrowLines.Add("")
$tomorrowLines.Add("## 4. First action tomorrow")
$tomorrowLines.Add("")
$tomorrowLines.Add("- $($exactNextAction -replace '^NEXT ACTION:\s*', '')")
$tomorrowLines.Add("")
$tomorrowLines.Add("## 5. What not to touch")
$tomorrowLines.Add("")
foreach ($item in $whatNotToTouch) {
    $tomorrowLines.Add("- $item")
}
$tomorrowLines.Add("")
$tomorrowLines.Add("## 6. Parked systems")
$tomorrowLines.Add("")
foreach ($item in $parked) {
    $tomorrowLines.Add("- $item")
}
$tomorrowLines.Add("")
$tomorrowLines.Add("## 7. BALA safety reminder")
$tomorrowLines.Add("")
$tomorrowLines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")
$tomorrowLines.Add("")
$tomorrowLines.Add("## 8. One-line restart prompt")
$tomorrowLines.Add("")
$tomorrowLines.Add("Read CHINTU_TOMORROW_START.md and CHINTU_OPERATOR_STATUS.md, run scripts/chintu-daily-operator.ps1, then follow the one exact next action.")

$dailyLogLines = New-Object System.Collections.Generic.List[string]
$dailyLogLines.Add("# Daily Log - $dateSlug")
$dailyLogLines.Add("")
$dailyLogLines.Add("**Generated:** $stamp")
$dailyLogLines.Add("**Repo:** $RepoRoot")
$dailyLogLines.Add("**Branch:** $branch")
$dailyLogLines.Add("")
$dailyLogLines.Add("## Where we stopped")
$dailyLogLines.Add("")
$dailyLogLines.Add("- $whereStopped")
$dailyLogLines.Add("")
$dailyLogLines.Add("## Repo state")
$dailyLogLines.Add("")
$dailyLogLines.Add("- Latest commit: ``$latestCommit``")
$dailyLogLines.Add("- Working tree clean: **$(if ($treeClean) { 'YES' } else { 'NO' })**")
$dailyLogLines.Add("- Unpushed commits count: **$unpushedCount**")
$dailyLogLines.Add("")
$dailyLogLines.Add("## Validation state")
$dailyLogLines.Add("")
$dailyLogLines.Add("- chintu-validate: **$($validator.Status)** | $validatorVerdict")
$dailyLogLines.Add("- chintu-release-guard: **$($guard.Status)** | $guardRecommendation")
$dailyLogLines.Add("- chintu-bridge-command-center: **$($bridge.Status)**")
$dailyLogLines.Add("")
$dailyLogLines.Add("## Bridge state")
$dailyLogLines.Add("")
$dailyLogLines.Add("- Shared bridge ready: **$(if ($shared.Ready) { 'YES' } else { 'NO' })**")
$dailyLogLines.Add("- Shared path: ``$SharedDir``")
$dailyLogLines.Add("- iMac Option 12 still needs founder-side install/test confirmation.")
$dailyLogLines.Add("")
$dailyLogLines.Add("## What changed today")
$dailyLogLines.Add("")
foreach ($line in $todayChanges) {
    if ($line.StartsWith("  ")) {
        $dailyLogLines.Add($line)
    } else {
        $dailyLogLines.Add("- $line")
    }
}
$dailyLogLines.Add("")
$dailyLogLines.Add("## Blockers")
$dailyLogLines.Add("")
foreach ($item in $blockers) {
    $dailyLogLines.Add("- $item")
}
$dailyLogLines.Add("")
$dailyLogLines.Add("## Parked systems")
$dailyLogLines.Add("")
foreach ($item in $parked) {
    $dailyLogLines.Add("- $item")
}
$dailyLogLines.Add("")
$dailyLogLines.Add("## Tomorrow first action")
$dailyLogLines.Add("")
$dailyLogLines.Add("- $($exactNextAction -replace '^NEXT ACTION:\s*', '')")
$dailyLogLines.Add("")
$dailyLogLines.Add("## Safety footer")
$dailyLogLines.Add("")
$dailyLogLines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

try {
    $tomorrowLines | Set-Content -LiteralPath $tomorrowPath -Encoding ASCII
    $dailyLogLines | Set-Content -LiteralPath $dailyLogPath -Encoding ASCII
} catch {
    Say ("FAILED to write end-day files: {0}" -f $_.Exception.Message)
    exit 1
}

Say "Tomorrow start handoff written: $tomorrowPath"
Say "Daily log written: $dailyLogPath"
Say ("Next action: {0}" -f ($exactNextAction -replace '^NEXT ACTION:\s*', ''))
exit 0
