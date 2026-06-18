<#
.SYNOPSIS
    Chintu alive briefing generator.

.DESCRIPTION
    Generates a founder-facing briefing in Chintu's approved text style.
    Reads local repo state, operator reports, and parked systems, then
    writes CHINTU_ALIVE_BRIEFING.md answering: What changed? What is safe?
    What is blocked? What is parked? What should I/Claude/Codex do next?
    What should not be touched?

    Tone: direct, warm, brother-style, operator-focused, not fake.
    No voice cloning, audio, phone calls, or live speech.
    No network calls, no secrets, no BALA app edits.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-alive-briefing.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test"
)

$ErrorActionPreference = "Continue"

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "STOP: repo root not found: $RepoRoot"
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"

# Gather state
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$latestCommit = (& git log --oneline -1 2>$null)
if (-not $latestCommit) { $latestCommit = "(unknown)" }
$recentCommits = @(& git log --oneline -5 2>$null)
$statusShort = @(& git status --short 2>$null | Where-Object { $_.Trim() -ne "" })
$treeClean = ($statusShort.Count -eq 0)
$unpushedCount = 0
try {
    $countText = (& git rev-list --count origin/main..HEAD 2>$null)
    if ($countText) { $unpushedCount = [int]$countText }
} catch { $unpushedCount = 0 }

# Read blockers
$blockers = @()
$blockersPath = Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\BLOCKERS.md"
if (Test-Path -LiteralPath $blockersPath) {
    $blockers = @(Get-Content -LiteralPath $blockersPath | Where-Object { $_.Trim().StartsWith("- ") } | ForEach-Object { $_.Trim().Substring(2) })
}

# Read parked systems
$parked = @()
$parkedPath = Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\PARKED_SYSTEMS.md"
if (Test-Path -LiteralPath $parkedPath) {
    $parked = @(Get-Content -LiteralPath $parkedPath | Where-Object {
        $_ -match '^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|' -and $Matches[1].Trim() -ne "System" -and $Matches[1].Trim() -notmatch '^-+$'
    } | ForEach-Object {
        if ($_ -match '^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|') {
            "$($Matches[1].Trim()) - $($Matches[2].Trim())"
        }
    })
}
if ($parked.Count -eq 0) {
    $parked = @("Telegram - parked", "Discord - parked", "Webhooks - parked", "Cloud sync - parked")
}

# Read next action from operator status
$nextAction = "Run the daily operator and review the system."
$operatorPath = Join-Path $RepoRoot "CHINTU_OPERATOR_STATUS.md"
if (Test-Path -LiteralPath $operatorPath) {
    $opLines = @(Get-Content -LiteralPath $operatorPath)
    $inNextSection = $false
    foreach ($line in $opLines) {
        if ($line -match '^##\s+(?:7\.)?\s*Next exact action') { $inNextSection = $true; continue }
        if ($inNextSection -and $line -match '^##\s+') { break }
        if ($inNextSection -and $line -match '^\s*-\s+(.+)') {
            $nextAction = $Matches[1]
            break
        }
    }
}

# Protected files
$protectedFiles = @("app.js", "index.html", "styles.css", "sw.js", "coach.js", "manifest.webmanifest", "privacy.html", "functions/api/coach.js")
$protectedSafe = $true
foreach ($pf in $protectedFiles) {
    $full = Join-Path $RepoRoot $pf
    if (Test-Path -LiteralPath $full) {
        $diff = @(& git diff HEAD -- $pf 2>$null | Where-Object { $_.Trim() -ne "" })
        if ($diff.Count -gt 0) { $protectedSafe = $false; break }
    }
}

# Build briefing
$report = New-Object System.Collections.Generic.List[string]
$report.Add("# Chintu Alive Briefing") | Out-Null
$report.Add("") | Out-Null
$report.Add("**Generated:** $stamp") | Out-Null
$report.Add("**Branch:** $branch") | Out-Null
$report.Add("") | Out-Null
$report.Add("---") | Out-Null
$report.Add("") | Out-Null

# What changed
$report.Add("## Bro, here is what changed") | Out-Null
$report.Add("") | Out-Null
if ($recentCommits.Count -gt 0) {
    $report.Add("Latest commits:") | Out-Null
    foreach ($c in $recentCommits) {
        $report.Add("- ``$c``") | Out-Null
    }
} else {
    $report.Add("No recent commits found.") | Out-Null
}
$report.Add("") | Out-Null
if ($treeClean) {
    $report.Add("Working tree is clean. Nothing uncommitted.") | Out-Null
} else {
    $report.Add("Working tree has $($statusShort.Count) uncommitted change(s). Review before continuing.") | Out-Null
}
if ($unpushedCount -gt 0) {
    $report.Add("$unpushedCount commit(s) not yet pushed. Founder owns every push.") | Out-Null
}
$report.Add("") | Out-Null

# What is safe
$report.Add("## What is safe") | Out-Null
$report.Add("") | Out-Null
if ($protectedSafe) {
    $report.Add("All protected BALA files are unchanged. The boundary is holding.") | Out-Null
} else {
    $report.Add("**WARNING:** A protected BALA file has been modified. Review and revert before committing.") | Out-Null
}
$report.Add("No secrets in repo. No network egress. No external automation active.") | Out-Null
$report.Add("") | Out-Null

# What is blocked
$report.Add("## What is blocked") | Out-Null
$report.Add("") | Out-Null
if ($blockers.Count -gt 0) {
    foreach ($b in $blockers) {
        $report.Add("- $b") | Out-Null
    }
} else {
    $report.Add("- No blockers file found. Treat iMac Option 12 test as pending.") | Out-Null
}
$report.Add("") | Out-Null

# What is parked
$report.Add("## What is parked") | Out-Null
$report.Add("") | Out-Null
$topParked = @($parked | Select-Object -First 8)
foreach ($p in $topParked) {
    $report.Add("- $p") | Out-Null
}
if ($parked.Count -gt 8) {
    $report.Add("- ...and $($parked.Count - 8) more") | Out-Null
}
$report.Add("") | Out-Null

# What should I do next
$report.Add("## What you should do next") | Out-Null
$report.Add("") | Out-Null
$report.Add("$nextAction") | Out-Null
$report.Add("") | Out-Null

# What should Claude do next
$report.Add("## What Claude should do next") | Out-Null
$report.Add("") | Out-Null
$report.Add("Continue hardening Chintu OS: improve control room, health checks, briefings, tests, and documentation. Do not touch BALA app files. Validate and commit if safe. Stop before push.") | Out-Null
$report.Add("") | Out-Null

# What should Codex do next
$report.Add("## What Codex should do next") | Out-Null
$report.Add("") | Out-Null
$report.Add("Validate the latest changes, prove protected BALA files are unchanged, confirm no secrets or network behavior, and commit if safe. Stop before push.") | Out-Null
$report.Add("") | Out-Null

# What should not be touched
$report.Add("## Do not touch") | Out-Null
$report.Add("") | Out-Null
foreach ($pf in $protectedFiles) {
    $report.Add("- ``$pf``") | Out-Null
}
$report.Add("- Telegram / Discord / webhooks / cloud sync / phone / voice") | Out-Null
$report.Add("- Health data transfer or medical claims") | Out-Null
$report.Add("- Secrets, tokens, or external APIs") | Out-Null
$report.Add("") | Out-Null

$report.Add("---") | Out-Null
$report.Add("") | Out-Null
$report.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.") | Out-Null

$outPath = Join-Path $RepoRoot "CHINTU_ALIVE_BRIEFING.md"
try {
    $report | Set-Content -LiteralPath $outPath -Encoding ASCII
} catch {
    Write-Host ("FAILED to write briefing: {0}" -f $_.Exception.Message)
    exit 1
}

Write-Host "Alive briefing written: $outPath"
exit 0
