<#
.SYNOPSIS
    Chintu heartbeat. Writes a local file that proves Chintu ran.

.DESCRIPTION
    Local, read-only, write-one-file. Updates CHINTU_HEARTBEAT.md with:
      - timestamp
      - latest commit
      - working tree clean/dirty
      - unpushed commit count
      - next action hint (one short sentence)
      - parked systems reminder
      - explicit "no health data sent" footer

    Never sends any network traffic. Never reads tokens. Never includes
    any BALA user data, medical claim, or health value.

    A "Telegram heartbeat candidate" section is rendered ONLY as a
    text block describing what a future safe heartbeat message could
    contain. It is NOT sent. No tokens are read or printed.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-heartbeat.ps1
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
$treeState = if ($dirtyCount -eq 0) { "clean" } else { "$dirtyCount uncommitted file(s)" }
$unpushed = (& git log --oneline origin/main..HEAD 2>$null)
$unpushedCount = if ($unpushed) { ($unpushed -split "`n").Count } else { 0 }

# Next action heuristic
$nextAction = "Run scripts\chintu-master-launcher.ps1, then open CHINTU_OPEN_FIRST.md."
if ($dirtyCount -gt 0) {
    $nextAction = "Working tree dirty - review with git status, then continue with master launcher."
}
if ($unpushedCount -gt 0 -and $dirtyCount -eq 0) {
    $nextAction = "Walk CHINTU_PUSH_REVIEW_CHECKLIST.md, then push by hand."
}

$lines = New-Object System.Collections.ArrayList
$null = $lines.Add("# Chintu Heartbeat")
$null = $lines.Add("")
$null = $lines.Add("Proof Chintu ran. Local-only. Nothing sent.")
$null = $lines.Add("")
$null = $lines.Add("**Timestamp:** $stamp")
$null = $lines.Add("**Branch:** $branch")
$null = $lines.Add("**Latest commit:** ``$latest``")
$null = $lines.Add("**Working tree:** $treeState")
$null = $lines.Add("**Unpushed commits:** $unpushedCount")
$null = $lines.Add("")
$null = $lines.Add("## Next action")
$null = $lines.Add("")
$null = $lines.Add($nextAction)
$null = $lines.Add("")
$null = $lines.Add("## Parked (do not activate)")
$null = $lines.Add("")
$null = $lines.Add("- Telegram, Discord, webhooks, cloud sync, phone notifications,")
$null = $lines.Add("  voice calling, voice cloning, paid APIs, external automation,")
$null = $lines.Add("  network egress, memory-wiki, health-data transfer.")
$null = $lines.Add("")
$null = $lines.Add("## No health data sent")
$null = $lines.Add("")
$null = $lines.Add("This heartbeat is local. It does not send anything. It does not")
$null = $lines.Add("read tokens. It does not include any BALA user data or any health")
$null = $lines.Add("metric. The script that produced it has no network calls.")
$null = $lines.Add("")
$null = $lines.Add("## Telegram heartbeat candidate (NOT SENT)")
$null = $lines.Add("")
$null = $lines.Add("If, and only if, the founder later configures a Telegram channel")
$null = $lines.Add("explicitly for Chintu OS heartbeats (NOT for BALA, NOT for any")
$null = $lines.Add("health data), a safe message body would look like this:")
$null = $lines.Add("")
$null = $lines.Add("````text")
$null = $lines.Add("Chintu heartbeat")
$null = $lines.Add("$stamp | branch $branch")
$null = $lines.Add("Tree: $treeState. Unpushed: $unpushedCount.")
$null = $lines.Add("Next: $nextAction")
$null = $lines.Add("````")
$null = $lines.Add("")
$null = $lines.Add("This block is text-only. Nothing in this script sends it. To")
$null = $lines.Add("actually send a Telegram heartbeat would require a founder-")
$null = $lines.Add("approved spec; see CHINTU_TELEGRAM_STATUS_PLAN.md.")
$null = $lines.Add("")
$null = $lines.Add("## BALA safety footer")
$null = $lines.Add("")
$null = $lines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

$out = Join-Path $RepoRoot "CHINTU_HEARTBEAT.md"
[System.IO.File]::WriteAllText($out, ($lines -join "`r`n"), [System.Text.Encoding]::UTF8)

Write-Host "Heartbeat written: $out"
Write-Host "No network calls made. No secrets read. No data sent."
exit 0
