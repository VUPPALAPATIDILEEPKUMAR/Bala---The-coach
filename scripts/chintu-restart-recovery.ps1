<#
.SYNOPSIS
    Chintu Restart Recovery. One command to re-orient after laptop
    restart, sleep, or Claude session drop.

.DESCRIPTION
    Inspects the repo, the survival handoff, the open-first doc, the
    morning brief, and (if present) the runtime health snapshot. Prints
    one exact resume action to the console and writes a small markdown
    summary at CHINTU_RESTART_RECOVERY.md.

    No network. No edits to BALA app files. No pushes.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-restart-recovery.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test"
)

$ErrorActionPreference = "Continue"

if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    Write-Host "FAIL: repo root not found: $RepoRoot"
    exit 2
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
Set-Location -LiteralPath $RepoRoot

$stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm zzz")
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$latest = (& git log -1 --oneline 2>$null)
if (-not $latest) { $latest = "(unknown)" }
$dirty  = (& git status --porcelain 2>$null)
$dirtyCount = if ($dirty) { ($dirty -split "`n").Count } else { 0 }
$unpushed = (& git log --oneline origin/main..HEAD 2>$null)
$unpushedCount = if ($unpushed) { ($unpushed -split "`n").Count } else { 0 }

$keyFiles = @{
    "CHINTU_OPEN_FIRST.md"                  = "single-page orientation"
    "CHINTU_TOMORROW_MORNING_BRIEF.md"      = "what changed overnight"
    "CHINTU_CLAUDE_SURVIVAL_HANDOFF.md"     = "cycle handoff for next builder"
    "CHINTU_RUNTIME_HEALTH.md"              = "is Chintu alive right now"
    "CHINTU_HEARTBEAT.md"                   = "last heartbeat written"
    "CHINTU_PUSH_REVIEW_CHECKLIST.md"       = "founder pre-push gate"
}
$presence = @{}
foreach ($k in $keyFiles.Keys) {
    $presence[$k] = Test-Path -LiteralPath (Join-Path $RepoRoot $k)
}

# Decide the exact resume action
$resume = "Run: powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1"
if (-not $presence["CHINTU_OPEN_FIRST.md"]) {
    $resume = "OPEN_FIRST.md missing. Run: powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1, then investigate."
} elseif ($dirtyCount -gt 0) {
    $resume = "Working tree dirty ($dirtyCount file(s)). Run: git status --short, then decide commit or discard."
} elseif ($unpushedCount -gt 0) {
    $resume = "Tree clean, $unpushedCount unpushed commit(s). Walk CHINTU_PUSH_REVIEW_CHECKLIST.md, then push by hand."
} else {
    $resume = "Repo clean, nothing unpushed. Run: powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1 to confirm, then open CHINTU_OPEN_FIRST.md."
}

# Console output (the immediate value of this script)
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Chintu Restart Recovery" -ForegroundColor Cyan
Write-Host " $stamp" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Branch:           $branch"
Write-Host "Latest commit:    $latest"
Write-Host "Working tree:     $dirtyCount uncommitted file(s)"
Write-Host "Unpushed commits: $unpushedCount"
Write-Host ""
Write-Host "Key files:"
foreach ($k in $keyFiles.Keys) {
    $tag = if ($presence[$k]) { "[OK]" } else { "[--]" }
    Write-Host ("  {0} {1,-40} {2}" -f $tag, $k, $keyFiles[$k])
}
Write-Host ""
Write-Host "RESUME ACTION:" -ForegroundColor Green
Write-Host "  $resume"
Write-Host ""

# Write the recovery doc
$lines = New-Object System.Collections.ArrayList
$null = $lines.Add("# Chintu Restart Recovery")
$null = $lines.Add("")
$null = $lines.Add("**Generated:** $stamp")
$null = $lines.Add("**Branch:** $branch")
$null = $lines.Add("**Latest commit:** ``$latest``")
$null = $lines.Add("**Working tree:** $dirtyCount uncommitted file(s)")
$null = $lines.Add("**Unpushed commits:** $unpushedCount")
$null = $lines.Add("")
$null = $lines.Add("## Resume action")
$null = $lines.Add("")
$null = $lines.Add($resume)
$null = $lines.Add("")
$null = $lines.Add("## Key file presence")
$null = $lines.Add("")
$null = $lines.Add("| File | Purpose | Present |")
$null = $lines.Add("|---|---|---|")
foreach ($k in $keyFiles.Keys) {
    $p = if ($presence[$k]) { "yes" } else { "no" }
    $null = $lines.Add(("| ``{0}`` | {1} | {2} |" -f $k, $keyFiles[$k], $p))
}
$null = $lines.Add("")
$null = $lines.Add("## What this script does NOT do")
$null = $lines.Add("")
$null = $lines.Add("- Does not push.")
$null = $lines.Add("- Does not edit BALA app files.")
$null = $lines.Add("- Does not call the network.")
$null = $lines.Add("- Does not read tokens or secrets.")
$null = $lines.Add("- Does not send any message anywhere.")
$null = $lines.Add("")
$null = $lines.Add("## BALA safety footer")
$null = $lines.Add("")
$null = $lines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

$out = Join-Path $RepoRoot "CHINTU_RESTART_RECOVERY.md"
[System.IO.File]::WriteAllText($out, ($lines -join "`r`n"), [System.Text.Encoding]::UTF8)

Write-Host "Recovery summary written: $out"
exit 0
