<#
.SYNOPSIS
    Chintu Alive Brain Reader + Natural Founder Message Engine.

.DESCRIPTION
    Reads the local truth - bridge flat files, git state, validation /
    health reports - and produces:

      - CHINTU_DAILY_BRIEF.md           a one-page brief
      - CHINTU_OUTBOX/latest_founder_message.md  the natural message
      - CHINTU_OUTBOX/founder_message_history.md append-only log

    The message is warm, plain, and tells the founder: what happened,
    what is working, what needs attention, the single best next move,
    what is parked, and whether anything needs founder approval.

    Local-only. No network. No tokens. No sending. The "outbox" is a
    folder. Sending is a separate, founder-approved step that does not
    happen here.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER SharedDir
    Shared bridge folder. Defaults to:
    $env:USERPROFILE\Desktop\CHINTU_SHARED_BRIDGE.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-founder-message.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$SharedDir = ""
)

$ErrorActionPreference = "Continue"

if (-not $SharedDir) {
    $SharedDir = Join-Path $env:USERPROFILE "Desktop\CHINTU_SHARED_BRIDGE"
}
if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    Write-Host "FAIL: repo root not found: $RepoRoot"
    exit 2
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
Set-Location -LiteralPath $RepoRoot

$now = Get-Date
$stamp = $now.ToString("yyyy-MM-dd HH:mm zzz")
$dateOnly = $now.ToString("yyyy-MM-dd")

# --- 1. read local truth -----------------------------------------------------
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$latest = (& git log -1 --oneline 2>$null)
if (-not $latest) { $latest = "(unknown)" }
$dirty = (& git status --porcelain 2>$null)
$dirtyCount = if ($dirty) { ($dirty -split "`n").Count } else { 0 }
$unpushed = (& git log --oneline origin/main..HEAD 2>$null)
$unpushedCount = if ($unpushed) { ($unpushed -split "`n").Count } else { 0 }

function Read-FlatHead {
    param([string]$Name, [int]$Lines = 3)
    $p = Join-Path $SharedDir "LATEST_FLAT\$Name"
    if (-not (Test-Path -LiteralPath $p)) { return "(missing)" }
    $t = Get-Content -LiteralPath $p -TotalCount $Lines -ErrorAction SilentlyContinue
    if (-not $t) { return "(empty)" }
    return ($t -join " ").Trim()
}

$flatNames = @(
    "latest_status.md",
    "latest_bala_validation.md",
    "latest_git_status.md",
    "latest_codex_handoff.md",
    "latest_openclaw_report.md",
    "latest_next_actions.md",
    "BRIDGE_TRANSFER_README.md"
)
$flatPresent = 0
foreach ($n in $flatNames) {
    if (Test-Path -LiteralPath (Join-Path $SharedDir "LATEST_FLAT\$n")) { $flatPresent++ }
}

# Pull a short headline from latest_status.md if present
$statusHead = Read-FlatHead "latest_status.md" 5
$nextActionsHead = Read-FlatHead "latest_next_actions.md" 5

# Health / runtime reports
$runtimeReport = Join-Path $RepoRoot "CHINTU_RUNTIME_HEALTH.md"
$runtimeStatus = "(not yet generated)"
if (Test-Path -LiteralPath $runtimeReport) {
    $rt = Get-Content -LiteralPath $runtimeReport -Raw
    if ($rt -match '## Overall status:\s*\*\*(GREEN|YELLOW|RED)\*\*') {
        $runtimeStatus = $matches[1]
    }
}

$bridgeReport = Join-Path $RepoRoot "CHINTU_BRIDGE_LOOP_REALITY_CHECK.md"
$bridgeStatus = "(not yet generated)"
if (Test-Path -LiteralPath $bridgeReport) {
    $br = Get-Content -LiteralPath $bridgeReport -Raw
    if ($br -match '## Overall status:\s*\*\*(GREEN|YELLOW|RED)\*\*') {
        $bridgeStatus = $matches[1]
    }
}

# --- 2. decide tone + next action -------------------------------------------
$attention = New-Object System.Collections.ArrayList
if ($dirtyCount -gt 0) {
    $null = $attention.Add("$dirtyCount uncommitted file(s) in the working tree.")
}
if ($unpushedCount -gt 0) {
    $null = $attention.Add("$unpushedCount commit(s) waiting for a founder push.")
}
if ($flatPresent -ne $flatNames.Count) {
    $null = $attention.Add("Bridge LATEST_FLAT has $flatPresent/$($flatNames.Count) files. Re-run the bridge command center.")
}
if ($runtimeStatus -eq "RED") {
    $null = $attention.Add("Runtime health is RED. Investigate before continuing.")
}
if ($bridgeStatus -eq "RED") {
    $null = $attention.Add("Bridge loop reality check is RED. Don't run Option 12 until green.")
}

$nextAction = "Run scripts\chintu-master-launcher.ps1, then open CHINTU_OPEN_FIRST.md."
if ($dirtyCount -gt 0) {
    $nextAction = "Review the working tree with git status, decide commit vs discard, then re-run the master launcher."
} elseif ($unpushedCount -gt 0) {
    $nextAction = "Walk CHINTU_PUSH_REVIEW_CHECKLIST.md, then push the $unpushedCount waiting commit(s) by hand."
} elseif ($bridgeStatus -eq "GREEN") {
    $nextAction = "Bridge is green. If you haven't tested iMac Option 12 today, open CHINTU_IMAC_OPTION_12_INSTALL_NOW.md."
}

$founderApprovalNeeded = $false
$approvalNotes = New-Object System.Collections.ArrayList
if ($unpushedCount -gt 0) {
    $founderApprovalNeeded = $true
    $null = $approvalNotes.Add("`git push origin main` to ship the $unpushedCount waiting commit(s).")
}

# --- 3. compose natural message ---------------------------------------------
$opener = "Bro, here is the read on Chintu right now."
$workingLines = New-Object System.Collections.ArrayList
$null = $workingLines.Add("- Branch ``$branch`` at ``$latest``.")
$null = $workingLines.Add("- Runtime health: $runtimeStatus. Bridge loop reality: $bridgeStatus.")
$null = $workingLines.Add("- Bridge LATEST_FLAT: $flatPresent/$($flatNames.Count) files present.")

$happenedLines = New-Object System.Collections.ArrayList
if ($statusHead -ne "(missing)" -and $statusHead -ne "(empty)") {
    $null = $happenedLines.Add("- From latest_status.md: $statusHead")
}
if ($nextActionsHead -ne "(missing)" -and $nextActionsHead -ne "(empty)") {
    $null = $happenedLines.Add("- From latest_next_actions.md: $nextActionsHead")
}
if ($happenedLines.Count -eq 0) {
    $null = $happenedLines.Add("- Bridge flat files are present but no headline was readable. Open them directly if you want detail.")
}

$attentionLines = if ($attention.Count -eq 0) {
    @("- Nothing red. The system looks calm.")
} else {
    $attention | ForEach-Object { "- $_" }
}

$parkedLine = "Telegram, Discord, webhooks, cloud sync, phone, voice, paid APIs, network egress, memory-wiki, health-data transfer."

$msgLines = New-Object System.Collections.ArrayList
$null = $msgLines.Add("# Chintu founder message")
$null = $msgLines.Add("")
$null = $msgLines.Add("**Generated:** $stamp")
$null = $msgLines.Add("**Date:** $dateOnly")
$null = $msgLines.Add("")
$null = $msgLines.Add($opener)
$null = $msgLines.Add("")
$null = $msgLines.Add("## What happened")
$null = $msgLines.Add("")
$happenedLines | ForEach-Object { $null = $msgLines.Add($_) }
$null = $msgLines.Add("")
$null = $msgLines.Add("## What is working")
$null = $msgLines.Add("")
$workingLines | ForEach-Object { $null = $msgLines.Add($_) }
$null = $msgLines.Add("")
$null = $msgLines.Add("## What needs attention")
$null = $msgLines.Add("")
$attentionLines | ForEach-Object { $null = $msgLines.Add($_) }
$null = $msgLines.Add("")
$null = $msgLines.Add("## Best next action")
$null = $msgLines.Add("")
$null = $msgLines.Add($nextAction)
$null = $msgLines.Add("")
$null = $msgLines.Add("## Parked (no activation needed)")
$null = $msgLines.Add("")
$null = $msgLines.Add($parkedLine)
$null = $msgLines.Add("")
$null = $msgLines.Add("## Founder approval needed")
$null = $msgLines.Add("")
if ($founderApprovalNeeded) {
    $approvalNotes | ForEach-Object { $null = $msgLines.Add("- $_") }
} else {
    $null = $msgLines.Add("- Nothing this turn. Chintu is just standing by.")
}
$null = $msgLines.Add("")
$null = $msgLines.Add("---")
$null = $msgLines.Add("")
$null = $msgLines.Add("This message is local-only. Nothing was sent.")
$null = $msgLines.Add("")
$null = $msgLines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

$message = $msgLines -join "`r`n"

# --- 4. daily brief ---------------------------------------------------------
$briefLines = New-Object System.Collections.ArrayList
$null = $briefLines.Add("# Chintu Daily Brief")
$null = $briefLines.Add("")
$null = $briefLines.Add("**Generated:** $stamp")
$null = $briefLines.Add("**Repo:** $RepoRoot")
$null = $briefLines.Add("")
$null = $briefLines.Add("## Snapshot")
$null = $briefLines.Add("")
$null = $briefLines.Add("| Field | Value |")
$null = $briefLines.Add("|---|---|")
$null = $briefLines.Add("| Branch | ``$branch`` |")
$null = $briefLines.Add("| Latest commit | ``$latest`` |")
$null = $briefLines.Add("| Uncommitted | $dirtyCount file(s) |")
$null = $briefLines.Add("| Unpushed | $unpushedCount commit(s) |")
$null = $briefLines.Add("| Runtime health | $runtimeStatus |")
$null = $briefLines.Add("| Bridge loop reality | $bridgeStatus |")
$null = $briefLines.Add("| Bridge LATEST_FLAT | $flatPresent/$($flatNames.Count) |")
$null = $briefLines.Add("")
$null = $briefLines.Add("## Today's best next action")
$null = $briefLines.Add("")
$null = $briefLines.Add($nextAction)
$null = $briefLines.Add("")
$null = $briefLines.Add("## Founder message")
$null = $briefLines.Add("")
$null = $briefLines.Add("See ``CHINTU_OUTBOX/latest_founder_message.md`` for the natural-language version. Same data, conversational tone.")
$null = $briefLines.Add("")
$null = $briefLines.Add("## What this file is NOT")
$null = $briefLines.Add("")
$null = $briefLines.Add("- Not sent anywhere.")
$null = $briefLines.Add("- Not a medical assessment.")
$null = $briefLines.Add("- Not a substitute for the master launcher.")
$null = $briefLines.Add("")
$null = $briefLines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

$brief = $briefLines -join "`r`n"

# --- 5. write files ---------------------------------------------------------
$outboxDir = Join-Path $RepoRoot "CHINTU_OUTBOX"
if (-not (Test-Path -LiteralPath $outboxDir)) {
    New-Item -ItemType Directory -Path $outboxDir | Out-Null
}

$briefPath = Join-Path $RepoRoot "CHINTU_DAILY_BRIEF.md"
$latestPath = Join-Path $outboxDir "latest_founder_message.md"
$historyPath = Join-Path $outboxDir "founder_message_history.md"

[System.IO.File]::WriteAllText($briefPath, $brief, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($latestPath, $message, [System.Text.Encoding]::UTF8)

# Append to history (or initialize)
$historyHeader = if (Test-Path -LiteralPath $historyPath) { "" } else {
@"
# Chintu founder message history

Append-only log of every founder message Chintu has generated locally.
Nothing in this file was ever sent. This is a local outbox record.

BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.

---
"@
}

$historyEntry = @"

## $stamp

$message

---
"@

[System.IO.File]::AppendAllText($historyPath, $historyHeader + $historyEntry, [System.Text.Encoding]::UTF8)

Write-Host "Daily brief written:    $briefPath"
Write-Host "Latest message written: $latestPath"
Write-Host "Appended to history:    $historyPath"
Write-Host "No network. No sending. Local outbox only."
exit 0
