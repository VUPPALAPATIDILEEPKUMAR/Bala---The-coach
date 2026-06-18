<#
.SYNOPSIS
    Chintu daily operator.

.DESCRIPTION
    Local-only morning/startup operator layer for Chintu OS. It inspects repo
    state, validation, bridge readiness, current blockers, and parked systems,
    then writes CHINTU_OPERATOR_STATUS.md with one exact next action.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER SharedDir
    Shared bridge folder. Defaults to:
    C:\Users\<user>\Desktop\CHINTU_SHARED_BRIDGE

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-daily-operator.ps1
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
        MissingFlat    = $flatCheck.Missing
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

    if ($items.Count -eq 0) {
        $items.Add("Telegram - parked") | Out-Null
        $items.Add("Discord - parked") | Out-Null
        $items.Add("Webhooks - parked") | Out-Null
        $items.Add("Cloud sync automation - parked") | Out-Null
    }

    return @($items)
}

function Get-PreviousReportMeta {
    param([string]$Path)

    $meta = [pscustomobject]@{
        Exists      = $false
        Generated   = ""
        CommitHash  = ""
        CommitLine  = ""
    }

    if (-not (Test-Path -LiteralPath $Path)) {
        return $meta
    }

    $meta.Exists = $true
    try {
        $lines = @(Get-Content -LiteralPath $Path)
        $meta.Generated = Find-FirstLine -Lines $lines -Pattern '^\*\*Generated:\*\*'
        $meta.CommitLine = Find-FirstLine -Lines $lines -Pattern '^- Latest commit:'
        if ($meta.CommitLine -match '\b[0-9a-f]{7,40}\b') {
            $meta.CommitHash = $Matches[0]
        }
    } catch {}

    return $meta
}

function Get-ChangedSinceLastRun {
    param(
        [pscustomobject]$Previous,
        [string]$CurrentHash,
        [bool]$TreeClean
    )

    $items = New-Object System.Collections.Generic.List[string]

    if (-not $Previous.Exists) {
        $items.Add("No previous operator report found.") | Out-Null
        if (-not $TreeClean) {
            $items.Add("Working tree contains local changes for this run.") | Out-Null
        }
        return @($items)
    }

    if ($Previous.Generated) {
        $items.Add("Previous operator report: $($Previous.Generated -replace '^\*\*Generated:\*\*\s*', '')") | Out-Null
    }

    if ($Previous.CommitHash -and $Previous.CommitHash -ne $CurrentHash) {
        $delta = @(& git log --oneline "$($Previous.CommitHash)..HEAD" 2>$null | Where-Object { $_.Trim() -ne "" })
        if ($delta.Count -gt 0) {
            $items.Add("Commits since the previous operator report:") | Out-Null
            $limit = [Math]::Min(5, $delta.Count)
            for ($i = 0; $i -lt $limit; $i++) {
                $items.Add("  $($delta[$i])") | Out-Null
            }
        } else {
            $items.Add("HEAD differs from the previous operator report.") | Out-Null
        }
    } else {
        $items.Add("No new commit since the previous operator report.") | Out-Null
    }

    if (-not $TreeClean) {
        $items.Add("Working tree changed after the previous operator report.") | Out-Null
    }

    return @($items)
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Say "STOP: repo root not found: $RepoRoot"
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$reportPath = Join-Path $RepoRoot "CHINTU_OPERATOR_STATUS.md"
$previous = Get-PreviousReportMeta -Path $reportPath
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$headHash = (& git rev-parse --short HEAD 2>$null)
if (-not $headHash) { $headHash = "(unknown)" }
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
$bridgeOutputAction = Find-FirstLine -Lines $bridge.Output -Pattern '^Next action:'
if (-not $bridgeOutputAction) { $bridgeOutputAction = "Next action: (not available)" }
$exactNextAction = Find-FirstLine -Lines $nextAction.Output -Pattern '^NEXT ACTION:'
if (-not $exactNextAction) { $exactNextAction = "NEXT ACTION: (not available)" }

$shared = Get-SharedBridgeState -Path $SharedDir
$commandCenterReportPath = Join-Path $RepoRoot "chintu-bridge-command-center-report.md"
$commandCenterReportExists = Test-Path -LiteralPath $commandCenterReportPath
$option12PackageDir = Join-Path $RepoRoot "CHINTU_IMAC_PACKAGES\OPTION_12_PULL_SHARED"
$option12Ready = (Test-Path -LiteralPath (Join-Path $option12PackageDir "install-option-12.sh")) -and
    (Test-Path -LiteralPath (Join-Path $option12PackageDir "README.md")) -and
    (Test-Path -LiteralPath (Join-Path $option12PackageDir "IMAC_TEST_PLAN.md"))
$blockers = Get-MarkdownBulletLines -Path (Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\BLOCKERS.md")
$parked = Get-ParkedSystems -Path (Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\PARKED_SYSTEMS.md")
$changes = Get-ChangedSinceLastRun -Previous $previous -CurrentHash $headHash -TreeClean:$treeClean

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Chintu Operator Status")
$lines.Add("")
$lines.Add("Chintu checked the system. Here is the state.")
$lines.Add("")
$lines.Add("**Generated:** $stamp")
$lines.Add("**Repo:** $RepoRoot")
$lines.Add("**Branch:** $branch")
$lines.Add("")
$lines.Add("## 1. Repo state")
$lines.Add("")
$lines.Add("- Latest commit: ``$latestCommit``")
$lines.Add("- Working tree clean: **$(if ($treeClean) { 'YES' } else { 'NO' })**")
$lines.Add("- Unpushed commits count: **$unpushedCount**")
if ($statusShort.Count -eq 0) {
    $lines.Add("- git status --short: (working tree clean)")
} else {
    $lines.Add("- git status --short:")
    foreach ($line in $statusShort) {
        $lines.Add("  - ``$line``")
    }
}
$lines.Add("")
$lines.Add("## 2. Validation state")
$lines.Add("")
$lines.Add("- chintu-validate: **$($validator.Status)** | $validatorVerdict")
$lines.Add("- chintu-release-guard: **$($guard.Status)** | $guardRecommendation")
$lines.Add("- chintu-bridge-command-center: **$($bridge.Status)** | $bridgeOutputAction")
$lines.Add("- chintu-next-action: **$($nextAction.Status)** | $exactNextAction")
$lines.Add("")
$lines.Add("## 3. Bridge state")
$lines.Add("")
$lines.Add("- Shared bridge path: ``$SharedDir``")
$lines.Add("- Shared bridge ready: **$(if ($shared.Ready) { 'YES' } else { 'NO' })**")
$lines.Add("- CHINTU_BRIDGE_LATEST.zip present: **$(if ($shared.ZipExists) { 'YES' } else { 'NO' })**")
$lines.Add("- MANIFEST.txt present: **$(if ($shared.ManifestExists) { 'YES' } else { 'NO' })**")
$lines.Add("- LATEST_FLAT ready: **$(if ($shared.FlatOk) { 'YES' } else { 'NO' })**")
if (-not $shared.FlatOk -and $shared.FlatExists) {
    $lines.Add("- Missing flat files: $($shared.MissingFlat -join ', ')")
}
$lines.Add("- Bridge Command Center report exists: **$(if ($commandCenterReportExists) { 'YES' } else { 'NO' })**")
$lines.Add("- iMac Option 12 package ready in repo: **$(if ($option12Ready) { 'YES' } else { 'NO' })**")
$lines.Add("- iMac Option 12 test status from Windows: **PENDING FOUNDER CONFIRMATION**")
$lines.Add("")
$lines.Add("## 4. What changed since last run")
$lines.Add("")
foreach ($line in $changes) {
    if ($line.StartsWith("  ")) {
        $lines.Add($line)
    } else {
        $lines.Add("- $line")
    }
}
$lines.Add("")
$lines.Add("## 5. Blockers")
$lines.Add("")
if ($blockers.Count -eq 0) {
    $lines.Add("- No blockers doc found. Treat iMac Option 12 and shared-loop verification as pending.")
} else {
    foreach ($line in $blockers) {
        $lines.Add("- $line")
    }
}
$lines.Add("")
$lines.Add("## 6. Parked systems")
$lines.Add("")
foreach ($line in $parked) {
    $lines.Add("- $line")
}
$lines.Add("")
$lines.Add("## 7. Next exact action")
$lines.Add("")
$lines.Add("- $($exactNextAction -replace '^NEXT ACTION:\s*', '')")
$lines.Add("")
$lines.Add("## 8. Safety footer")
$lines.Add("")
$lines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

try {
    $lines | Set-Content -LiteralPath $reportPath -Encoding ASCII
} catch {
    Say ("FAILED to write report: {0}" -f $_.Exception.Message)
    exit 1
}

Say "Daily operator report written: $reportPath"
Say ("Next action: {0}" -f ($exactNextAction -replace '^NEXT ACTION:\s*', ''))
exit 0
