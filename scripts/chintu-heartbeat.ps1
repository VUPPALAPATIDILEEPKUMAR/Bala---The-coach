<#
.SYNOPSIS
    Chintu heartbeat loop. Refresh the local founder operator cycle.

.DESCRIPTION
    Runs the safe local Chintu loop in order:
      1. founder message generator
      2. action planner
      3. dry-run connector previews
      4. control-room dashboard generator
      5. heartbeat report + JSON mirror

    Produces:
      - CHINTU_HEARTBEAT.md
      - CHINTU_OUTBOX/latest_heartbeat.json

    No network. No sending. No secrets. No BALA app edits. All
    connector-shaped outputs remain DRY RUN ONLY.

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

function Get-FileStatus {
    param([string]$RelativePath)
    $path = Join-Path $RepoRoot $RelativePath
    if (Test-Path -LiteralPath $path -PathType Leaf) { return "present" }
    return "missing"
}

function Get-StatusWord {
    param([int]$ExitCode)
    if ($ExitCode -eq 0) { return "PASS" }
    return "FAIL (exit $ExitCode)"
}

function Read-StatusFromReport {
    param([string]$RelativePath)
    $path = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return "(missing)" }
    $text = Get-Content -LiteralPath $path -Raw
    if ($text -match '## Overall status:\s*\*\*(GREEN|YELLOW|RED)\*\*') { return $matches[1] }
    return "(present)"
}

function Run-LocalStep {
    param(
        [string]$Label,
        [ValidateSet("powershell","node")]
        [string]$Runner,
        [string]$Target,
        [string[]]$Arguments = @()
    )

    if ($Runner -eq "powershell") {
        & powershell -ExecutionPolicy Bypass -File $Target @Arguments | Out-Null
    } else {
        & node $Target @Arguments | Out-Null
    }
    return [ordered]@{
        label = $Label
        runner = $Runner
        target = $Target
        exitCode = $LASTEXITCODE
        status = Get-StatusWord $LASTEXITCODE
    }
}

$stepResults = New-Object System.Collections.ArrayList
$null = $stepResults.Add((Run-LocalStep -Label "Founder message" -Runner "powershell" -Target "scripts\chintu-founder-message.ps1"))
$null = $stepResults.Add((Run-LocalStep -Label "Action planner" -Runner "powershell" -Target "scripts\chintu-action-planner.ps1"))
$null = $stepResults.Add((Run-LocalStep -Label "Dry-run connector previews" -Runner "node" -Target "scripts\chintu-message-dry-run.js"))
$null = $stepResults.Add((Run-LocalStep -Label "Control room dashboard" -Runner "powershell" -Target "scripts\chintu-control-room-index.ps1"))

$founderMessageStatus = Get-FileStatus "CHINTU_OUTBOX/latest_founder_message.md"
$plannerQueueStatus = Get-FileStatus "CHINTU_ACTION_QUEUE.md"
$approvalCenterStatus = Get-FileStatus "CHINTU_APPROVAL_CENTER.md"
$dryRunStatus = Get-FileStatus "CHINTU_OUTBOX/dry_run_payloads/telegram_preview.json"
$dashboardStatus = Get-FileStatus "CHINTU_CONTROL_ROOM_INDEX.html"
$trackedPlannerStatus = Get-FileStatus "CHINTU_ACTION_QUEUE_TRACKED.md"
$heartbeatJsonStatus = "pending write"
$runtimeStatus = Read-StatusFromReport "CHINTU_RUNTIME_HEALTH.md"
$bridgeStatus = Read-StatusFromReport "CHINTU_BRIDGE_LOOP_REALITY_CHECK.md"

$nextActionTitle = "(unavailable)"
$nextHumanCommand = "powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1"
$queuePath = Join-Path $RepoRoot "CHINTU_ACTION_QUEUE.md"
if (Test-Path -LiteralPath $queuePath -PathType Leaf) {
    $queueText = Get-Content -LiteralPath $queuePath -Raw
    if ($queueText -match '## 1\.\s+([^\r\n]+)') {
        $nextActionTitle = $matches[1].Trim()
    }
    if ($queueText -match '(?s)## 1\..*?- \*\*command:\*\*\s+`([^`]+)`') {
        $nextHumanCommand = $matches[1].Trim()
    }
}
$promptPath = Join-Path $RepoRoot "CHINTU_NEXT_OPERATOR_PROMPT.md"
if (Test-Path -LiteralPath $promptPath -PathType Leaf) {
    $promptText = Get-Content -LiteralPath $promptPath -Raw
    if ($promptText -match '(?s)## Exact command\s+````powershell\s+([^\r\n]+)') {
        $nextHumanCommand = $matches[1].Trim()
    }
}

$parkedLine = "Telegram, Discord, webhooks, cloud sync, phone notifications, voice calling, voice cloning, paid APIs, external automation, network egress, memory-wiki, health-data transfer."

$reportLines = New-Object System.Collections.ArrayList
$null = $reportLines.Add("# Chintu Heartbeat")
$null = $reportLines.Add("")
$null = $reportLines.Add("Local founder heartbeat loop. Refreshed from safe local generators only. Nothing sent.")
$null = $reportLines.Add("")
$null = $reportLines.Add("**Timestamp:** $stamp")
$null = $reportLines.Add("**Branch:** $branch")
$null = $reportLines.Add("**Latest commit:** ``$latest``")
$null = $reportLines.Add("**Working tree:** $treeState")
$null = $reportLines.Add("**Unpushed commits:** $unpushedCount")
$null = $reportLines.Add("**Runtime health:** $runtimeStatus")
$null = $reportLines.Add("**Bridge loop:** $bridgeStatus")
$null = $reportLines.Add("")
$null = $reportLines.Add("## Loop status")
$null = $reportLines.Add("")
foreach ($step in $stepResults) {
    $null = $reportLines.Add("- $($step.label): **$($step.status)** via ``$($step.runner) $($step.target)``")
}
$null = $reportLines.Add("")
$null = $reportLines.Add("## Artifact status")
$null = $reportLines.Add("")
$null = $reportLines.Add("| Artifact | Status |")
$null = $reportLines.Add("|---|---|")
$null = $reportLines.Add("| Founder message | $founderMessageStatus |")
$null = $reportLines.Add("| Planner queue | $plannerQueueStatus |")
$null = $reportLines.Add("| Tracked planner snapshot | $trackedPlannerStatus |")
$null = $reportLines.Add("| Approval center | $approvalCenterStatus |")
$null = $reportLines.Add("| Dry-run preview | $dryRunStatus |")
$null = $reportLines.Add("| Dashboard | $dashboardStatus |")
$null = $reportLines.Add("| Heartbeat JSON mirror | $heartbeatJsonStatus |")
$null = $reportLines.Add("")
$null = $reportLines.Add("## Next best action")
$null = $reportLines.Add("")
$null = $reportLines.Add("- Queue item: $nextActionTitle")
$null = $reportLines.Add("- Exact next human command: ``$nextHumanCommand``")
$null = $reportLines.Add("")
$null = $reportLines.Add("## Parked (do not activate)")
$null = $reportLines.Add("")
$null = $reportLines.Add($parkedLine)
$null = $reportLines.Add("")
$null = $reportLines.Add("## No health data sent")
$null = $reportLines.Add("")
$null = $reportLines.Add("This heartbeat is local-only. It does not send anything. It does not")
$null = $reportLines.Add("read tokens or secrets. It does not include BALA user data or any")
$null = $reportLines.Add("health metric. Connector-shaped outputs remain DRY RUN ONLY.")
$null = $reportLines.Add("")
$null = $reportLines.Add("## BALA safety footer")
$null = $reportLines.Add("")
$null = $reportLines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

$outboxDir = Join-Path $RepoRoot "CHINTU_OUTBOX"
if (-not (Test-Path -LiteralPath $outboxDir)) {
    New-Item -ItemType Directory -Path $outboxDir | Out-Null
}

$reportPath = Join-Path $RepoRoot "CHINTU_HEARTBEAT.md"

$heartbeatJson = [ordered]@{
    _dry_run = $true
    _label = "DRY RUN ONLY"
    generated = $stamp
    branch = $branch
    latest_commit = $latest
    working_tree = $treeState
    unpushed = $unpushedCount
    runtime_status = $runtimeStatus
    bridge_status = $bridgeStatus
    founder_message_status = $founderMessageStatus
    planner_status = $plannerQueueStatus
    tracked_planner_status = $trackedPlannerStatus
    approval_center_status = $approvalCenterStatus
    dry_run_preview_status = $dryRunStatus
    dashboard_status = $dashboardStatus
    next_action_title = $nextActionTitle
    next_human_command = $nextHumanCommand
    parked = @("telegram","discord","webhooks","cloud_sync","phone","voice","gmail","paid_apis","network_egress","memory_wiki","health_data_transfer")
    steps = $stepResults
    bala_safety_footer = "BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring."
}
$heartbeatJsonPath = Join-Path $outboxDir "latest_heartbeat.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($heartbeatJsonPath, ($heartbeatJson | ConvertTo-Json -Depth 6), $utf8NoBom)
$heartbeatJsonStatus = "present"

for ($i = 0; $i -lt $reportLines.Count; $i++) {
    if ($reportLines[$i] -eq "| Heartbeat JSON mirror | pending write |") {
        $reportLines[$i] = "| Heartbeat JSON mirror | $heartbeatJsonStatus |"
    }
}
[System.IO.File]::WriteAllText($reportPath, ($reportLines -join "`r`n"), [System.Text.Encoding]::UTF8)

Write-Host "Heartbeat report written: $reportPath"
Write-Host "Heartbeat JSON mirror:    $heartbeatJsonPath"
Write-Host "No network calls made. No secrets read. No data sent."
exit 0
