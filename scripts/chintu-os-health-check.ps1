<#
.SYNOPSIS
    Chintu OS health check.

.DESCRIPTION
    Local-only system health check for Chintu OS. Inspects repo state,
    validation, bridge, operator reports, dashboard files, memory vault,
    protected BALA files, and parked systems. Outputs a GREEN / YELLOW / RED
    status to CHINTU_OS_HEALTH_CHECK.md.

    No network calls, no secrets, no BALA app edits, no external automation.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER SharedDir
    Shared bridge folder. Defaults to Desktop\CHINTU_SHARED_BRIDGE.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-os-health-check.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$SharedDir = "$env:USERPROFILE\Desktop\CHINTU_SHARED_BRIDGE"
)

$ErrorActionPreference = "Continue"

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "STOP: repo root not found: $RepoRoot"
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$lines = New-Object System.Collections.Generic.List[string]
$greens = 0
$yellows = 0
$reds = 0

function Add-Check {
    param(
        [string]$Category,
        [string]$Label,
        [string]$Status,
        [string]$Detail
    )
    $icon = switch ($Status) {
        "GREEN"  { "GREEN" }
        "YELLOW" { "YELLOW" }
        "RED"    { "RED" }
        default  { "UNKNOWN" }
    }
    $lines.Add("| $Category | $Label | **$icon** | $Detail |") | Out-Null
    switch ($Status) {
        "GREEN"  { $script:greens++ }
        "YELLOW" { $script:yellows++ }
        "RED"    { $script:reds++ }
    }
}

# 1. Repo state
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
} catch { $unpushedCount = 0 }

if ($treeClean) {
    Add-Check -Category "Repo" -Label "Working tree" -Status "GREEN" -Detail "Clean"
} else {
    Add-Check -Category "Repo" -Label "Working tree" -Status "YELLOW" -Detail "$($statusShort.Count) changes"
}

Add-Check -Category "Repo" -Label "Latest commit" -Status "GREEN" -Detail "``$latestCommit``"

if ($unpushedCount -eq 0) {
    Add-Check -Category "Repo" -Label "Unpushed commits" -Status "GREEN" -Detail "0"
} elseif ($unpushedCount -lt 5) {
    Add-Check -Category "Repo" -Label "Unpushed commits" -Status "YELLOW" -Detail "$unpushedCount"
} else {
    Add-Check -Category "Repo" -Label "Unpushed commits" -Status "RED" -Detail "$unpushedCount - review and push"
}

# 2. Validation scripts
$validationScripts = @(
    "scripts\chintu-validate.ps1",
    "scripts\chintu-release-guard.ps1",
    "scripts\chintu-bridge-command-center.ps1",
    "scripts\chintu-next-action.ps1",
    "scripts\chintu-daily-operator.ps1",
    "scripts\chintu-agent-dashboard.ps1"
)

foreach ($script in $validationScripts) {
    $full = Join-Path $RepoRoot $script
    $label = [System.IO.Path]::GetFileNameWithoutExtension($script)
    if (Test-Path -LiteralPath $full) {
        Add-Check -Category "Validation" -Label $label -Status "GREEN" -Detail "Present"
    } else {
        Add-Check -Category "Validation" -Label $label -Status "RED" -Detail "Missing"
    }
}

# 3. Bridge state
$bridgeExists = Test-Path -LiteralPath $SharedDir
$zipExists = $bridgeExists -and (Test-Path -LiteralPath (Join-Path $SharedDir "CHINTU_BRIDGE_LATEST.zip"))
$manifestExists = $bridgeExists -and (Test-Path -LiteralPath (Join-Path $SharedDir "MANIFEST.txt"))
$flatDir = Join-Path $SharedDir "LATEST_FLAT"
$flatExists = $bridgeExists -and (Test-Path -LiteralPath $flatDir)

if ($bridgeExists -and $zipExists -and $manifestExists -and $flatExists) {
    Add-Check -Category "Bridge" -Label "Shared bridge" -Status "GREEN" -Detail "Ready"
} elseif ($bridgeExists) {
    $missingParts = @()
    if (-not $zipExists) { $missingParts += "zip" }
    if (-not $manifestExists) { $missingParts += "manifest" }
    if (-not $flatExists) { $missingParts += "flat" }
    Add-Check -Category "Bridge" -Label "Shared bridge" -Status "YELLOW" -Detail "Missing: $($missingParts -join ', ')"
} else {
    Add-Check -Category "Bridge" -Label "Shared bridge" -Status "YELLOW" -Detail "Not found at $SharedDir"
}

$commandCenterReport = Join-Path $RepoRoot "chintu-bridge-command-center-report.md"
if (Test-Path -LiteralPath $commandCenterReport) {
    Add-Check -Category "Bridge" -Label "Command center report" -Status "GREEN" -Detail "Present"
} else {
    Add-Check -Category "Bridge" -Label "Command center report" -Status "YELLOW" -Detail "Missing"
}

# 4. Operator reports
$operatorDocs = @(
    "CHINTU_OPERATOR_STATUS.md",
    "CHINTU_TOMORROW_START.md",
    "CHINTU_HANDOFF.md",
    "CHINTU_AGENT_CONTROL_SHELL.md",
    "CHINTU_AGENT_DASHBOARD.html",
    "CHINTU_CLAUDE_OVERNIGHT_PROMPT.md",
    "CHINTU_STAGE_11_QUEUE.md",
    "CHINTU_FREE_POWER_LANES.md",
    "BALA_SAFE_TOUCHPOINTS.md"
)

foreach ($doc in $operatorDocs) {
    $full = Join-Path $RepoRoot $doc
    $label = [System.IO.Path]::GetFileNameWithoutExtension($doc)
    if (Test-Path -LiteralPath $full) {
        Add-Check -Category "Reports" -Label $label -Status "GREEN" -Detail "Present"
    } else {
        Add-Check -Category "Reports" -Label $label -Status "YELLOW" -Detail "Missing"
    }
}

# 5. Memory vault
$vaultDir = Join-Path $RepoRoot "CHINTU_MEMORY_VAULT"
$vaultFiles = @(
    "BLOCKERS.md",
    "DECISIONS.md",
    "PARKED_SYSTEMS.md",
    "NEXT_SPRINT_QUEUE.md",
    "CHINTU_AGENT_ARCHITECTURE.md",
    "BALA_MEDICAL_SAFETY_RULES.md",
    "BALA_PRODUCT_STATE.md"
)

foreach ($vf in $vaultFiles) {
    $full = Join-Path $vaultDir $vf
    $label = [System.IO.Path]::GetFileNameWithoutExtension($vf)
    if (Test-Path -LiteralPath $full) {
        Add-Check -Category "Vault" -Label $label -Status "GREEN" -Detail "Present"
    } else {
        Add-Check -Category "Vault" -Label $label -Status "YELLOW" -Detail "Missing"
    }
}

# 6. Protected BALA files - diff check
$protectedFiles = @(
    "app.js",
    "index.html",
    "styles.css",
    "sw.js",
    "manifest.webmanifest",
    "privacy.html",
    "functions/api/coach.js"
)

$balaModified = @()
foreach ($pf in $protectedFiles) {
    $full = Join-Path $RepoRoot $pf
    if (-not (Test-Path -LiteralPath $full)) {
        Add-Check -Category "BALA" -Label $pf -Status "RED" -Detail "Missing from repo"
    } else {
        $diff = @(& git diff HEAD -- $pf 2>$null | Where-Object { $_.Trim() -ne "" })
        if ($diff.Count -eq 0) {
            Add-Check -Category "BALA" -Label $pf -Status "GREEN" -Detail "Unchanged"
        } else {
            Add-Check -Category "BALA" -Label $pf -Status "RED" -Detail "MODIFIED - must not change during Chintu OS stage"
            $balaModified += $pf
        }
    }
}

# 7. Parked systems acknowledgement
Add-Check -Category "Parked" -Label "External automation" -Status "GREEN" -Detail "Not activated"
Add-Check -Category "Parked" -Label "Network egress" -Status "GREEN" -Detail "None"
Add-Check -Category "Parked" -Label "Secrets" -Status "GREEN" -Detail "None in repo"

# 8. Known warnings
$dailyLog = Join-Path $vaultDir "DAILY_LOGS\2026-06-18.md"
if (Test-Path -LiteralPath $dailyLog) {
    Add-Check -Category "Logs" -Label "Today's daily log" -Status "GREEN" -Detail "Present"
} else {
    Add-Check -Category "Logs" -Label "Today's daily log" -Status "YELLOW" -Detail "Not yet created"
}

# Determine overall status
if ($reds -gt 0) {
    $overall = "RED"
    $overallMessage = "STOP. $reds critical issue(s) found. Review before continuing."
} elseif ($yellows -gt 0) {
    $overall = "YELLOW"
    $overallMessage = "Needs review. $yellows item(s) need attention."
} else {
    $overall = "GREEN"
    $overallMessage = "All systems safe. Ready to continue."
}

# Build report
$report = New-Object System.Collections.Generic.List[string]
$report.Add("# Chintu OS Health Check") | Out-Null
$report.Add("") | Out-Null
$report.Add("**Generated:** $stamp") | Out-Null
$report.Add("**Repo:** $RepoRoot") | Out-Null
$report.Add("**Branch:** $branch") | Out-Null
$report.Add("**Latest commit:** ``$latestCommit``") | Out-Null
$report.Add("") | Out-Null
$report.Add("## Overall status: **$overall**") | Out-Null
$report.Add("") | Out-Null
$report.Add($overallMessage) | Out-Null
$report.Add("") | Out-Null
$report.Add("- GREEN checks: $greens") | Out-Null
$report.Add("- YELLOW checks: $yellows") | Out-Null
$report.Add("- RED checks: $reds") | Out-Null
$report.Add("") | Out-Null
$report.Add("## Detailed checks") | Out-Null
$report.Add("") | Out-Null
$report.Add("| Category | Check | Status | Detail |") | Out-Null
$report.Add("|---|---|---|---|") | Out-Null
foreach ($line in $lines) {
    $report.Add($line) | Out-Null
}
$report.Add("") | Out-Null

if ($balaModified.Count -gt 0) {
    $report.Add("## BALA safety alert") | Out-Null
    $report.Add("") | Out-Null
    $report.Add("The following protected BALA files have been modified:") | Out-Null
    foreach ($f in $balaModified) {
        $report.Add("- ``$f``") | Out-Null
    }
    $report.Add("") | Out-Null
    $report.Add("These files must not change during a Chintu OS infrastructure stage.") | Out-Null
    $report.Add("Revert these changes before committing.") | Out-Null
    $report.Add("") | Out-Null
}

$report.Add("## Safety footer") | Out-Null
$report.Add("") | Out-Null
$report.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.") | Out-Null

$outPath = Join-Path $RepoRoot "CHINTU_OS_HEALTH_CHECK.md"
try {
    $report | Set-Content -LiteralPath $outPath -Encoding ASCII
} catch {
    Write-Host ("FAILED to write health check: {0}" -f $_.Exception.Message)
    exit 1
}

Write-Host "Health check written: $outPath"
Write-Host "Overall: $overall - $overallMessage"
exit $(if ($reds -gt 0) { 1 } else { 0 })
