<#
.SYNOPSIS
    Generates the local Chintu Operator Console.

.DESCRIPTION
    Reads the latest generated Chintu reports and JSON mirrors, then
    writes a calm local-first static HTML console plus an optional JSON
    mirror.

    Inputs may include:
      - CHINTU_HEARTBEAT.md
      - CHINTU_DAILY_BRIEF.md
      - CHINTU_ACTION_QUEUE.md
      - CHINTU_APPROVAL_CENTER.md
      - CHINTU_APPROVAL_AUDIT.md
      - CHINTU_NEXT_OPERATOR_PROMPT.md
      - CHINTU_OUTBOX/latest_founder_message.md
      - CHINTU_OUTBOX/latest_action_plan.json
      - CHINTU_OUTBOX/latest_heartbeat.json
      - CHINTU_OUTBOX/latest_connector_readiness.json
      - CHINTU_OUTBOX/dry_run_payloads/*.json

    Outputs:
      - CHINTU_OPERATOR_CONSOLE.html
      - CHINTU_OUTBOX/latest_operator_console.json

    No network calls. No external sends. No secrets. No BALA app file
    edits. All connector-shaped outputs remain DRY RUN ONLY.

.PARAMETER RepoRoot
    Repo root. Defaults to the parent of this script folder.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-operator-console.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    Write-Host "FAIL: repo root not found: $RepoRoot"
    exit 2
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
Set-Location -LiteralPath $RepoRoot

function Esc {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) { return "" }
    return [System.Security.SecurityElement]::Escape([string]$Value)
}

function Read-Text {
    param([string]$RelativePath)
    $path = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
    return Get-Content -LiteralPath $path -Raw
}

function Read-JsonFile {
    param([string]$RelativePath)
    $text = Read-Text $RelativePath
    if (-not $text) { return $null }
    try {
        return $text | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Get-GitText {
    param([string[]]$Arguments)
    $result = @(& git -C $RepoRoot @Arguments 2>$null)
    if ($LASTEXITCODE -ne 0) { return @() }
    return @($result | ForEach-Object { [string]$_ })
}

function Get-TextExcerpt {
    param(
        [AllowNull()][string]$Text,
        [int]$MaxCharacters = 900
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return "Not present."
    }

    $lines = @($Text -split "`r?`n" | Where-Object {
        $_.Trim() -ne "" -and
        $_ -notmatch '^#' -and
        $_ -notmatch '^\*\*Generated:' -and
        $_ -notmatch '^\*\*Timestamp:' -and
        $_ -notmatch '^##\s+BALA safety footer'
    })
    $joined = ($lines -join "`n").Trim()
    if (-not $joined) { return "Present, but no readable summary text was found." }
    if ($joined.Length -gt $MaxCharacters) {
        return $joined.Substring(0, $MaxCharacters).Trim() + "..."
    }
    return $joined
}

function Get-MarkdownBulletsAfterHeading {
    param(
        [AllowNull()][string]$Text,
        [string]$HeadingPattern
    )

    if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
    $items = New-Object System.Collections.Generic.List[string]
    $inside = $false
    foreach ($line in ($Text -split "`r?`n")) {
        if (-not $inside -and $line -match $HeadingPattern) {
            $inside = $true
            continue
        }
        if ($inside -and $line -match '^##\s+') { break }
        if ($inside -and $line -match '^\s*-\s+(.+?)\s*$') {
            $items.Add($Matches[1].Trim()) | Out-Null
        }
    }
    return @($items)
}

function Get-ApprovalAuditSummary {
    param([AllowNull()][string]$Text)

    $summary = [ordered]@{
        Count = 0
        Latest = "No founder approvals recorded yet."
    }
    if ([string]::IsNullOrWhiteSpace($Text)) { return $summary }

    $rows = @($Text -split "`r?`n" | Where-Object {
        $_ -match '^\|\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+[+-]\d{2}:\d{2}\s*\|'
    })
    $summary.Count = $rows.Count
    if ($rows.Count -gt 0) {
        $parts = $rows[-1].Split('|') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
        if ($parts.Count -ge 3) {
            $summary.Latest = "$($parts[1]) approved at $($parts[0])"
        } else {
            $summary.Latest = $rows[-1].Trim()
        }
    }
    return $summary
}

function Get-StatusTone {
    param(
        [AllowNull()][string]$HeartbeatRuntime,
        [AllowNull()][string]$HeartbeatBridge,
        [AllowNull()][object[]]$HeartbeatSteps,
        [bool]$MissingCoreFiles,
        [int]$ApprovalCount
    )

    if ($MissingCoreFiles) { return "Blocked" }
    if ($HeartbeatSteps) {
        foreach ($step in $HeartbeatSteps) {
            if ([string]$step.status -match '^FAIL') { return "Blocked" }
        }
    }
    if ($HeartbeatRuntime -eq "RED" -or $HeartbeatBridge -eq "RED") { return "Blocked" }
    if ($ApprovalCount -gt 0 -or $HeartbeatRuntime -eq "YELLOW" -or $HeartbeatBridge -eq "YELLOW") {
        return "Needs attention"
    }
    return "Awake"
}

function To-ListItems {
    param([string[]]$Items)
    if (-not $Items -or $Items.Count -eq 0) {
        return "<li>None.</li>"
    }
    return ($Items | ForEach-Object { "<li>$(Esc $_)</li>" }) -join "`n"
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm zzz"
$branch = (Get-GitText -Arguments @("rev-parse", "--abbrev-ref", "HEAD") | Select-Object -First 1)
if (-not $branch) { $branch = "(unknown)" }
$latestCommit = (Get-GitText -Arguments @("log", "-1", "--oneline") | Select-Object -First 1)
if (-not $latestCommit) { $latestCommit = "(unknown)" }
$statusLines = Get-GitText -Arguments @("status", "--short")
$workingTree = if ($statusLines.Count -eq 0) { "clean" } else { "$($statusLines.Count) changed file(s)" }

$heartbeatText = Read-Text "CHINTU_HEARTBEAT.md"
$dailyBriefText = Read-Text "CHINTU_DAILY_BRIEF.md"
$queueText = Read-Text "CHINTU_ACTION_QUEUE.md"
$approvalCenterText = Read-Text "CHINTU_APPROVAL_CENTER.md"
$approvalAuditText = Read-Text "CHINTU_APPROVAL_AUDIT.md"
$nextPromptText = Read-Text "CHINTU_NEXT_OPERATOR_PROMPT.md"
$founderMessageText = Read-Text "CHINTU_OUTBOX/latest_founder_message.md"
$actionPlan = Read-JsonFile "CHINTU_OUTBOX/latest_action_plan.json"
$heartbeatJson = Read-JsonFile "CHINTU_OUTBOX/latest_heartbeat.json"
$connectorReadiness = Read-JsonFile "CHINTU_OUTBOX/latest_connector_readiness.json"

$previewFiles = @(
    "CHINTU_OUTBOX/dry_run_payloads/telegram_preview.json",
    "CHINTU_OUTBOX/dry_run_payloads/slack_preview.json",
    "CHINTU_OUTBOX/dry_run_payloads/discord_preview.json"
)
$previewPresent = @($previewFiles | Where-Object {
    Test-Path -LiteralPath (Join-Path $RepoRoot $_) -PathType Leaf
})

$topActions = @()
if ($actionPlan -and $actionPlan.top5) {
    $topActions = @($actionPlan.top5)
}

$nextAction = if ($topActions.Count -gt 0) { $topActions[0] } else { $null }
$nextActionTitle = if ($nextAction) { [string]$nextAction.title } else { "Unavailable" }
$nextActionCommand = if ($heartbeatJson -and $heartbeatJson.next_human_command) {
    [string]$heartbeatJson.next_human_command
} elseif ($nextAction -and $nextAction.command) {
    [string]$nextAction.command
} else {
    "powershell -ExecutionPolicy Bypass -File scripts\chintu-heartbeat.ps1"
}

$parkedItems = @()
if ($actionPlan -and $actionPlan.parked) {
    $parkedItems = @($actionPlan.parked | ForEach-Object { [string]$_ })
} else {
    $parkedItems = Get-MarkdownBulletsAfterHeading -Text $queueText -HeadingPattern '^##\s+Parked'
}

$approvalCardCount = 0
if ($approvalCenterText) {
    $approvalCardCount = ([regex]::Matches($approvalCenterText, '^##\s+Approval card:', [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count
}
$approvalAuditSummary = Get-ApprovalAuditSummary -Text $approvalAuditText

$promptCommand = "Open CHINTU_NEXT_OPERATOR_PROMPT.md and copy the exact block."
if ($nextPromptText -match '(?s)## Exact command\s+````powershell\s+([^\r\n]+)') {
    $promptCommand = $Matches[1].Trim()
}

$missingCoreFiles = @(
    $heartbeatText,
    $queueText,
    $approvalCenterText,
    $founderMessageText
) -contains $null

$runtimeStatus = if ($heartbeatJson) { [string]$heartbeatJson.runtime_status } else { "(missing)" }
$bridgeStatus = if ($heartbeatJson) { [string]$heartbeatJson.bridge_status } else { "(missing)" }
$statusTone = Get-StatusTone -HeartbeatRuntime $runtimeStatus -HeartbeatBridge $bridgeStatus -HeartbeatSteps $heartbeatJson.steps -MissingCoreFiles $missingCoreFiles -ApprovalCount $approvalCardCount
$statusClass = switch ($statusTone) {
    "Awake" { "awake" }
    "Needs attention" { "attention" }
    default { "blocked" }
}

$heartbeatSummary = if ($heartbeatJson) {
    "Runtime $runtimeStatus. Bridge $bridgeStatus. Working tree $($heartbeatJson.working_tree). Unpushed commits $($heartbeatJson.unpushed)."
} else {
    "Heartbeat JSON mirror missing. Run scripts\chintu-heartbeat.ps1 to refresh."
}

$founderExcerpt = Get-TextExcerpt -Text $founderMessageText -MaxCharacters 1200
$briefExcerpt = Get-TextExcerpt -Text $dailyBriefText -MaxCharacters 700

$topActionItems = New-Object System.Collections.Generic.List[string]
foreach ($action in $topActions | Select-Object -First 5) {
    $approvalTag = if ($action.approvalNeeded) { "needs approval" } else { "safe now" }
    $line = "{0} [{1}] - {2} - command: {3}" -f $action.title, $action.category, $approvalTag, $action.command
    $topActionItems.Add($line) | Out-Null
}

$approvalSummaryText = if ($approvalCardCount -eq 0) {
    "No founder approval cards are queued right now."
} else {
    "$approvalCardCount approval card(s) queued. Review CHINTU_APPROVAL_CENTER.md before any founder-gated change."
}

$dryRunStatus = "{0} of {1} preview files present. DRY RUN ONLY." -f $previewPresent.Count, $previewFiles.Count
$dryRunList = $previewPresent | ForEach-Object { $_ -replace '^CHINTU_OUTBOX/dry_run_payloads/', '' }
$connectorSummary = "Readiness snapshot missing. Run node scripts\\chintu-connector-send.js --check."
$connectorItems = @()
if ($connectorReadiness -and $connectorReadiness.connectors) {
    $readyStates = @($connectorReadiness.connectors | ForEach-Object {
        "{0}: can_send_now={1}; missing_env={2}" -f $_.connector, $_.can_send_now, (@($_.missing_env_vars).Count)
    })
    $connectorItems = $readyStates
    $connectorSummary = "Mode $($connectorReadiness.connector_mode). Approval phrase, allowlist, preview, and active mode are all required before any real send."
}

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Chintu Operator Console</title>
  <style>
    :root {
      color-scheme: light;
      --bg:#f2efe7;
      --ink:#182229;
      --muted:#5a686f;
      --panel:#fffdfa;
      --line:#d9d2c3;
      --accent:#2f6c63;
      --accent-soft:#dcece8;
      --warn:#9b6a2b;
      --warn-soft:#f6ead7;
      --danger:#8f3a32;
      --danger-soft:#f4dfdb;
      --safe:#1d6a52;
      --safe-soft:#d9eee7;
      --badge:#24313a;
    }
    * { box-sizing:border-box; }
    body {
      margin:0;
      font-family:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
      color:var(--ink);
      background:
        radial-gradient(circle at top right, rgba(47,108,99,0.12), transparent 32rem),
        linear-gradient(180deg, #faf7f1 0%, var(--bg) 100%);
      line-height:1.55;
    }
    header, main, footer {
      width:min(1180px, calc(100% - 1.4rem));
      margin-inline:auto;
    }
    header { padding:2rem 0 1.2rem; }
    h1 {
      margin:0;
      font-size:clamp(2rem, 4.6vw, 3.5rem);
      letter-spacing:-0.04em;
    }
    h2 {
      margin:0 0 .8rem;
      font-size:1rem;
      letter-spacing:.01em;
    }
    p { margin:.45rem 0; }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    code {
      font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
      font-size:.94em;
      overflow-wrap:anywhere;
    }
    pre {
      margin:0;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
      font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;
      color:#24313a;
    }
    .eyebrow {
      color:var(--muted);
      text-transform:uppercase;
      letter-spacing:.08em;
      font-size:.82rem;
      margin-bottom:.4rem;
    }
    .summary {
      max-width:760px;
      font-size:1.08rem;
      color:#324149;
    }
    .meta {
      color:var(--muted);
      font-size:.92rem;
    }
    .badge-row {
      display:flex;
      gap:.6rem;
      flex-wrap:wrap;
      margin-top:1rem;
    }
    .badge {
      display:inline-flex;
      align-items:center;
      gap:.35rem;
      border-radius:999px;
      padding:.35rem .75rem;
      background:#eef2f3;
      border:1px solid var(--line);
      color:var(--badge);
      font-weight:600;
      font-size:.84rem;
    }
    .layout {
      display:grid;
      grid-template-columns:repeat(12, 1fr);
      gap:1rem;
      padding-bottom:1.6rem;
    }
    .card {
      grid-column:span 6;
      background:rgba(255,253,250,0.96);
      border:1px solid var(--line);
      border-radius:20px;
      padding:1.1rem;
      box-shadow:0 16px 40px rgba(28,39,46,0.07);
      min-width:0;
    }
    .wide { grid-column:1 / -1; }
    .third { grid-column:span 4; }
    .hero {
      grid-column:1 / -1;
      display:grid;
      grid-template-columns:2.2fr 1fr;
      gap:1rem;
      background:linear-gradient(135deg, rgba(255,253,250,0.96), rgba(220,236,232,0.8));
    }
    .status-pill {
      display:inline-block;
      padding:.28rem .7rem;
      border-radius:999px;
      font-weight:700;
      font-size:.86rem;
      margin-bottom:.6rem;
    }
    .status-pill.awake { color:var(--safe); background:var(--safe-soft); }
    .status-pill.attention { color:var(--warn); background:var(--warn-soft); }
    .status-pill.blocked { color:var(--danger); background:var(--danger-soft); }
    ul { margin:.4rem 0 0; padding-left:1.1rem; }
    li { margin:.35rem 0; }
    .mini {
      color:var(--muted);
      font-size:.88rem;
    }
    .link-list {
      display:flex;
      flex-wrap:wrap;
      gap:.65rem 1rem;
      margin-top:.5rem;
    }
    .callout {
      border-left:4px solid var(--accent);
      background:#f5fbf9;
      padding:.8rem .9rem;
      border-radius:12px;
    }
    footer {
      padding:0 0 2.5rem;
      color:var(--muted);
      font-size:.9rem;
    }
    @media (max-width: 900px) {
      .card, .third, .hero { grid-column:1 / -1; }
      .hero { grid-template-columns:1fr; }
    }
    @media print {
      body { background:#fff; }
      .card { box-shadow:none; }
    }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">CHINTU OS / LOCAL FOUNDER COMMAND CENTER</p>
    <h1>Operator Console</h1>
    <p class="summary">One calm local screen for the heartbeat, founder message, planner, approvals, dry-run previews, and the next safe move.</p>
    <p class="meta">Generated $(Esc $stamp) | Branch $(Esc $branch) | Latest $(Esc $latestCommit) | Working tree $(Esc $workingTree)</p>
    <div class="badge-row">
      <span class="badge">No external messages sent</span>
      <span class="badge">No BALA app files touched unless founder approves</span>
      <span class="badge">DRY RUN ONLY connector previews</span>
    </div>
  </header>
  <main class="layout">
    <section class="card hero">
      <div>
        <div class="status-pill $statusClass">Chintu status: $(Esc $statusTone)</div>
        <h2>Latest heartbeat summary</h2>
        <p>$(Esc $heartbeatSummary)</p>
        <div class="callout">
          <p><strong>Next best action:</strong> $(Esc $nextActionTitle)</p>
          <p><strong>Exact next human command:</strong> <code>$(Esc $nextActionCommand)</code></p>
        </div>
      </div>
      <div>
        <h2>Console links</h2>
        <p><a href="CHINTU_HEARTBEAT.md">Heartbeat report</a></p>
        <p><a href="CHINTU_ACTION_QUEUE.md">Action queue</a></p>
        <p><a href="CHINTU_APPROVAL_CENTER.md">Approval center</a></p>
        <p><a href="CHINTU_APPROVAL_AUDIT.md">Approval audit</a></p>
        <p><a href="CHINTU_NEXT_OPERATOR_PROMPT.md">Next Codex prompt file</a></p>
      </div>
    </section>
    <section class="card third">
      <h2>Founder message</h2>
      <pre>$(Esc $founderExcerpt)</pre>
    </section>
    <section class="card third">
      <h2>Daily brief</h2>
      <pre>$(Esc $briefExcerpt)</pre>
    </section>
    <section class="card third">
      <h2>Connector dry-run status</h2>
      <p>$(Esc $dryRunStatus)</p>
      <ul>
$(To-ListItems -Items $dryRunList)
      </ul>
    </section>
    <section class="card">
      <h2>Connector readiness</h2>
      <p>$(Esc $connectorSummary)</p>
      <ul>
$(To-ListItems -Items $connectorItems)
      </ul>
    </section>
    <section class="card">
      <h2>Top 5 action queue</h2>
      <ul>
$(To-ListItems -Items $topActionItems)
      </ul>
    </section>
    <section class="card">
      <h2>Approval cards summary</h2>
      <p>$(Esc $approvalSummaryText)</p>
      <p><strong>Approval audit status:</strong> <a href="CHINTU_APPROVAL_AUDIT.md">CHINTU_APPROVAL_AUDIT.md</a> - $(Esc $approvalAuditSummary.Latest)</p>
      <p class="mini">Total recorded approvals: $(Esc $approvalAuditSummary.Count)</p>
    </section>
    <section class="card">
      <h2>Parked items</h2>
      <ul>
$(To-ListItems -Items $parkedItems)
      </ul>
    </section>
    <section class="card">
      <h2>Exact next Codex prompt</h2>
      <p><a href="CHINTU_NEXT_OPERATOR_PROMPT.md">CHINTU_NEXT_OPERATOR_PROMPT.md</a></p>
      <p><strong>Suggested command from prompt:</strong> <code>$(Esc $promptCommand)</code></p>
    </section>
    <section class="card wide">
      <h2>Safety boundaries</h2>
      <ul>
        <li>No real Telegram, Slack, Discord, Gmail, webhook, or external send.</li>
        <li>No secrets, no API keys, no network egress, no hidden background automation.</li>
        <li>No health data transfer and no unsafe medical claims.</li>
        <li>No BALA app file edits unless the founder explicitly approves that separate lane.</li>
        <li>BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.</li>
      </ul>
      <div class="link-list">
        <a href="CHINTU_OPEN_FIRST.md">Open First</a>
        <a href="CHINTU_FOUNDER_COMMAND_MAP.md">Founder Command Map</a>
        <a href="CHINTU_GENERATED_FILES_MAP.md">Generated Files Map</a>
        <a href="CHINTU_CONTROL_ROOM_INDEX.html">Control Room Index</a>
      </div>
    </section>
  </main>
  <footer>
    <p><strong>Local-only disclaimer:</strong> This console is a generated static snapshot. It does not read files live after render, does not call a backend, does not send data, and does not activate connectors.</p>
    <p>BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.</p>
  </footer>
</body>
</html>
"@

$consoleJson = [ordered]@{
    _dry_run = $true
    _label = "DRY RUN ONLY"
    generated = $stamp
    branch = $branch
    latest_commit = $latestCommit
    working_tree = $workingTree
    status = $statusTone
    heartbeat_summary = $heartbeatSummary
    next_best_action = $nextActionTitle
    next_human_command = $nextActionCommand
    next_prompt_file = "CHINTU_NEXT_OPERATOR_PROMPT.md"
    prompt_command = $promptCommand
    approval_cards = $approvalCardCount
    approval_audit_entries = $approvalAuditSummary.Count
    dry_run_preview_count = $previewPresent.Count
    parked = $parkedItems
    source_files = @(
        "CHINTU_HEARTBEAT.md",
        "CHINTU_DAILY_BRIEF.md",
        "CHINTU_ACTION_QUEUE.md",
        "CHINTU_APPROVAL_CENTER.md",
        "CHINTU_APPROVAL_AUDIT.md",
        "CHINTU_NEXT_OPERATOR_PROMPT.md",
        "CHINTU_OUTBOX/latest_founder_message.md",
        "CHINTU_OUTBOX/latest_action_plan.json",
        "CHINTU_OUTBOX/latest_heartbeat.json",
        "CHINTU_OUTBOX/latest_connector_readiness.json"
    )
    outputs = @(
        "CHINTU_OPERATOR_CONSOLE.html",
        "CHINTU_OUTBOX/latest_operator_console.json"
    )
    badges = @(
        "No external messages sent",
        "No BALA app files touched unless founder approves"
    )
    bala_safety_footer = "BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring."
}

$outboxDir = Join-Path $RepoRoot "CHINTU_OUTBOX"
if (-not (Test-Path -LiteralPath $outboxDir -PathType Container)) {
    New-Item -ItemType Directory -Path $outboxDir | Out-Null
}

$htmlPath = Join-Path $RepoRoot "CHINTU_OPERATOR_CONSOLE.html"
$jsonPath = Join-Path $outboxDir "latest_operator_console.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($htmlPath, $html, $utf8NoBom)
[System.IO.File]::WriteAllText($jsonPath, ($consoleJson | ConvertTo-Json -Depth 6), $utf8NoBom)

Write-Host "Operator console written: $htmlPath"
Write-Host "Operator console JSON:    $jsonPath"
Write-Host "Mode: local-only static snapshot. No external messages sent."
exit 0
