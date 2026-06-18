<#
.SYNOPSIS
    Chintu Control Room Index generator.

.DESCRIPTION
    Generates CHINTU_CONTROL_ROOM_INDEX.html, a local static hub that links
    to all Chintu OS reports, dashboards, and operator docs. It reads the
    repo to discover which files exist and builds an honest index.

    No network calls, no secrets, no BALA app edits, no external automation.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-control-room-index.ps1
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

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm zzz"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$latestCommit = (& git log --oneline -1 2>$null)
if (-not $latestCommit) { $latestCommit = "(unknown)" }

# Define all known control room files
$sections = @(
    @{ Title = "Open First Hub"; Files = @(
        @{ Path = "CHINTU_OPEN_FIRST.md"; Label = "Open First (single-page orientation)" },
        @{ Path = "CHINTU_TOMORROW_MORNING_BRIEF.md"; Label = "Tomorrow Morning Brief" },
        @{ Path = "CHINTU_START_HERE.md"; Label = "Start Here (longer reference)" },
        @{ Path = "CHINTU_WHEN_STUCK.md"; Label = "When Stuck (troubleshooting)" },
        @{ Path = "CHINTU_PUSH_REVIEW_CHECKLIST.md"; Label = "Push Review Checklist (founder pre-push)" }
    )},
    @{ Title = "Safety + Hygiene"; Files = @(
        @{ Path = "CHINTU_SAFETY_INVARIANTS.md"; Label = "Safety Invariants (canonical)" },
        @{ Path = "CHINTU_OPERATOR_FAQ.md"; Label = "Operator FAQ" },
        @{ Path = "CHINTU_ARTIFACT_POLICY.md"; Label = "Artifact Policy" },
        @{ Path = "CHINTU_GENERATED_FILES_MAP.md"; Label = "Generated Files Map" },
        @{ Path = "CHINTU_REPO_HYGIENE_REPORT.md"; Label = "Repo Hygiene Report" },
        @{ Path = "CHINTU_REPO_AUDIT_REPORT.md"; Label = "Repo Audit Report (polish pass)" },
        @{ Path = "CHINTU_CONTROL_ROOM_TROUBLESHOOTING.md"; Label = "Control Room Troubleshooting" }
    )},
    @{ Title = "Runtime + Restart Recovery"; Files = @(
        @{ Path = "CHINTU_RUNTIME_HEALTH.md"; Label = "Runtime Health (GREEN/YELLOW/RED)" },
        @{ Path = "CHINTU_HEARTBEAT.md"; Label = "Heartbeat (local proof Chintu ran)" },
        @{ Path = "CHINTU_RESTART_RECOVERY.md"; Label = "Restart Recovery summary" },
        @{ Path = "CHINTU_RUNTIME_PLAYBOOK.md"; Label = "Runtime Playbook" },
        @{ Path = "CHINTU_TELEGRAM_STATUS_PLAN.md"; Label = "Telegram Status Plan (parked)" },
        @{ Path = "CHINTU_ALIVE_NEXT_LEVEL_PLAN.md"; Label = "Alive Next-Level Plan" }
    )},
    @{ Title = "Bridge Loop (iMac Option 12)"; Files = @(
        @{ Path = "CHINTU_BRIDGE_LOOP_REALITY_CHECK.md"; Label = "Bridge Loop Reality Check (GREEN/YELLOW/RED)" },
        @{ Path = "CHINTU_IMAC_OPTION_12_INSTALL_NOW.md"; Label = "iMac Option 12 Install Now (founder guide)" },
        @{ Path = "CHINTU_BRIDGE_LOOP_TEST_LOG.md"; Label = "Bridge Loop Test Log (founder fill template)" },
        @{ Path = "CHINTU_BRIDGE_CONTRACT.md"; Label = "Bridge Contract" },
        @{ Path = "CHINTU_BRIDGE_ROLLBACK.md"; Label = "Bridge Rollback" },
        @{ Path = "CHINTU_IMAC_BRIDGE_TROUBLESHOOTING.md"; Label = "iMac Bridge Troubleshooting" },
        @{ Path = "CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/README.md"; Label = "Option 12 Package README" }
    )},
    @{ Title = "Dashboards"; Files = @(
        @{ Path = "CHINTU_AGENT_DASHBOARD.html"; Label = "Agent Control Shell Dashboard" },
        @{ Path = "CHINTU_CONTROL_ROOM_INDEX.html"; Label = "Control Room Index (this page)" }
    )},
    @{ Title = "Founder Command Map"; Files = @(
        @{ Path = "CHINTU_FOUNDER_COMMAND_MAP.md"; Label = "Founder Command Map" },
        @{ Path = "scripts/chintu-master-launcher.ps1"; Label = "Master Launcher Script" }
    )},
    @{ Title = "Operator Reports"; Files = @(
        @{ Path = "CHINTU_OPERATOR_STATUS.md"; Label = "Operator Status" },
        @{ Path = "CHINTU_ALIVE_BRIEFING.md"; Label = "Alive Briefing" },
        @{ Path = "CHINTU_OS_HEALTH_CHECK.md"; Label = "OS Health Check" },
        @{ Path = "CHINTU_TOMORROW_START.md"; Label = "Tomorrow Start" },
        @{ Path = "CHINTU_HANDOFF.md"; Label = "Handoff" }
    )},
    @{ Title = "Architecture Docs"; Files = @(
        @{ Path = "CHINTU_AGENT_CONTROL_SHELL.md"; Label = "Agent Control Shell" },
        @{ Path = "CHINTU_STAGE_11_QUEUE.md"; Label = "Stage 11 Queue" },
        @{ Path = "CHINTU_FREE_POWER_LANES.md"; Label = "Free Power Lanes" },
        @{ Path = "CHINTU_FREE_POWER_LANES_EXPANDED.md"; Label = "Free Power Lanes Expanded" },
        @{ Path = "CHINTU_INTELLIGENCE_LAYERS.md"; Label = "Intelligence Layers" },
        @{ Path = "CHINTU_BRIDGE_CONTRACT.md"; Label = "Bridge Contract" },
        @{ Path = "CHINTU_MULTI_BRAIN_REVIEW_PROTOCOL.md"; Label = "Multi-Brain Review Protocol" }
    )},
    @{ Title = "BALA Planning"; Files = @(
        @{ Path = "BALA_SAFE_TOUCHPOINTS.md"; Label = "BALA Safe Touchpoints" },
        @{ Path = "BALA_NEXT_SAFE_SPRINT_PLAN.md"; Label = "BALA Next Safe Sprint Plan" },
        @{ Path = "docs/BALA_PRODUCT_RESEARCH.md"; Label = "BALA Product Research" },
        @{ Path = "docs/BALA_SECURITY_RULES.md"; Label = "BALA Security Rules" },
        @{ Path = "CHINTU_MEMORY_VAULT/BALA_MEDICAL_SAFETY_RULES.md"; Label = "BALA Medical Safety Rules" },
        @{ Path = "CHINTU_MEMORY_VAULT/BALA_PRODUCT_STATE.md"; Label = "BALA Product State" }
    )},
    @{ Title = "BALA Planning Specs (parked, founder-gated)"; Files = @(
        @{ Path = "BALA_VOICE_COACH_SAFE_SPEC.md"; Label = "BALA Voice Coach Safe Spec" },
        @{ Path = "BALA_TESTER_FEEDBACK_PLAN.md"; Label = "BALA Tester Feedback Plan" },
        @{ Path = "BALA_PRIVACY_TRUST_POLISH_PLAN.md"; Label = "BALA Privacy + Trust Polish Plan" },
        @{ Path = "BALA_DOCTOR_SUMMARY_POLISH_SPEC.md"; Label = "BALA Doctor Summary Polish Spec" },
        @{ Path = "BALA_LOCAL_FIRST_AI_COACH_SPEC.md"; Label = "BALA Local-First AI Coach Spec" }
    )},
    @{ Title = "Parked Research"; Files = @(
        @{ Path = "CHINTU_FUTURE_AGENT_ARCHITECTURE.md"; Label = "Future Agent Architecture" },
        @{ Path = "CHINTU_LOCAL_LLM_RESEARCH_PARKED.md"; Label = "Local LLM Research (parked)" },
        @{ Path = "CHINTU_VOICE_LAYER_RESEARCH_PARKED.md"; Label = "Voice Layer Research (parked)" },
        @{ Path = "CHINTU_PHONE_LAYER_RESEARCH_PARKED.md"; Label = "Phone Layer Research (parked)" }
    )},
    @{ Title = "Claude / Codex Builder Lanes"; Files = @(
        @{ Path = "CHINTU_CLAUDE_OVERNIGHT_PROMPT.md"; Label = "Claude Overnight Prompt" },
        @{ Path = "CHINTU_CLAUDE_BUILDER_REPORT.md"; Label = "Claude Builder Report" },
        @{ Path = "CHINTU_CLAUDE_SURVIVAL_HANDOFF.md"; Label = "Claude Survival Handoff" },
        @{ Path = "CHINTU_CLAUDE_CONTINUATION_PROMPT.md"; Label = "Claude Continuation Prompt" },
        @{ Path = "CHINTU_CODEX_REVIEW_PROMPT.md"; Label = "Codex Review Prompt (read-only)" },
        @{ Path = "CHINTU_NEXT_THREAD_STARTER.md"; Label = "Next Thread Starter (short)" },
        @{ Path = "CHINTU_NEXT_THREAD_STARTER_DETAILED.md"; Label = "Next Thread Starter (detailed)" }
    )},
    @{ Title = "Bridge Reports"; Files = @(
        @{ Path = "chintu-bridge-command-center-report.md"; Label = "Bridge Command Center" },
        @{ Path = "chintu-bridge-daily-export-report.md"; Label = "Bridge Daily Export" }
    )},
    @{ Title = "Memory Vault"; Files = @(
        @{ Path = "CHINTU_MEMORY_VAULT/BLOCKERS.md"; Label = "Blockers" },
        @{ Path = "CHINTU_MEMORY_VAULT/DECISIONS.md"; Label = "Decisions" },
        @{ Path = "CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md"; Label = "Parked Systems" },
        @{ Path = "CHINTU_MEMORY_VAULT/NEXT_SPRINT_QUEUE.md"; Label = "Next Sprint Queue" },
        @{ Path = "CHINTU_MEMORY_VAULT/CHINTU_AGENT_ARCHITECTURE.md"; Label = "Agent Architecture" }
    )},
    @{ Title = "Validation Scripts"; Files = @(
        @{ Path = "scripts/chintu-master-launcher.ps1"; Label = "Master Launcher (one-command sweep)" },
        @{ Path = "scripts/chintu-validate.ps1"; Label = "Validator" },
        @{ Path = "scripts/chintu-command-map.test.js"; Label = "Command Map Integrity Test" },
        @{ Path = "scripts/chintu-memory-vault.test.js"; Label = "Memory Vault Integrity Test" },
        @{ Path = "scripts/chintu-snapshot-consistency.test.js"; Label = "Snapshot Consistency Test" },
        @{ Path = "scripts/chintu-agent-control-shell.test.js"; Label = "Agent Control Shell Test" },
        @{ Path = "scripts/chintu-no-network-egress.test.js"; Label = "No Network Egress Test" },
        @{ Path = "scripts/chintu-medical-claims.test.js"; Label = "Medical Claims Test" },
        @{ Path = "scripts/chintu-safety-boundary.test.js"; Label = "Safety Boundary Test" },
        @{ Path = "scripts/chintu-doc-link-integrity.test.js"; Label = "Doc Link Integrity Test" },
        @{ Path = "scripts/chintu-generated-files-map.test.js"; Label = "Generated Files Map Test" },
        @{ Path = "scripts/chintu-bala-safe-docs.test.js"; Label = "BALA Safe Docs Test" },
        @{ Path = "scripts/chintu-parked-systems.test.js"; Label = "Parked Systems Test" },
        @{ Path = "scripts/chintu-continuation-prompts.test.js"; Label = "Continuation Prompts Test" },
        @{ Path = "scripts/chintu-runtime-health.ps1"; Label = "Runtime Health Generator" },
        @{ Path = "scripts/chintu-heartbeat.ps1"; Label = "Heartbeat Generator" },
        @{ Path = "scripts/chintu-restart-recovery.ps1"; Label = "Restart Recovery Generator" },
        @{ Path = "scripts/chintu-runtime-health.test.js"; Label = "Runtime Health Test" },
        @{ Path = "scripts/chintu-heartbeat.test.js"; Label = "Heartbeat Test" },
        @{ Path = "scripts/chintu-restart-recovery.test.js"; Label = "Restart Recovery Test" },
        @{ Path = "scripts/chintu-telegram-status-plan.test.js"; Label = "Telegram Status Plan Test" },
        @{ Path = "scripts/chintu-bridge-loop-reality-check.ps1"; Label = "Bridge Loop Reality Check Generator" },
        @{ Path = "scripts/chintu-bridge-loop-reality-check.test.js"; Label = "Bridge Loop Reality Check Test" },
        @{ Path = "scripts/chintu-release-guard.ps1"; Label = "Release Guard" },
        @{ Path = "scripts/chintu-bridge-command-center.ps1"; Label = "Bridge Command Center Script" },
        @{ Path = "scripts/chintu-next-action.ps1"; Label = "Next Action" },
        @{ Path = "scripts/chintu-daily-operator.ps1"; Label = "Daily Operator" },
        @{ Path = "scripts/chintu-endday-operator.ps1"; Label = "End-Day Operator" },
        @{ Path = "scripts/chintu-agent-dashboard.ps1"; Label = "Agent Dashboard Generator" },
        @{ Path = "scripts/chintu-claude-overnight-package.ps1"; Label = "Claude Overnight Package" },
        @{ Path = "scripts/chintu-alive-briefing.ps1"; Label = "Alive Briefing Generator" },
        @{ Path = "scripts/chintu-os-health-check.ps1"; Label = "OS Health Check" },
        @{ Path = "scripts/chintu-control-room-index.ps1"; Label = "Control Room Index Generator" }
    )}
)

# Build section HTML
$sectionHtml = ""
foreach ($section in $sections) {
    $items = ""
    foreach ($file in $section.Files) {
        $fullPath = Join-Path $RepoRoot $file.Path
        $exists = Test-Path -LiteralPath $fullPath
        $statusClass = if ($exists) { "present" } else { "missing" }
        $statusText = if ($exists) { "present" } else { "not yet created" }
        $link = if ($exists -and $file.Path -match '\.html$') {
            "<a href=`"$(Esc $file.Path)`">$(Esc $file.Label)</a>"
        } else {
            Esc $file.Label
        }
        $items += "        <li class=`"$statusClass`"><span class=`"file-status`">$statusText</span> $link <code>$(Esc $file.Path)</code></li>`n"
    }
    $sectionHtml += @"
    <section class="card">
      <h2>$(Esc $section.Title)</h2>
      <ul>
$items      </ul>
    </section>

"@
}

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Chintu Control Room Index</title>
  <style>
    :root { color-scheme: dark; --bg:#08111f; --panel:#101d30; --line:#263b55; --text:#edf4ff; --muted:#9eb1c9; --safe:#56d69b; --park:#f1bf65; --accent:#79a9ff; --red:#f47171; }
    * { box-sizing: border-box; margin: 0; }
    body { font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; background:radial-gradient(circle at top right,#18335c 0,#08111f 38rem); color:var(--text); line-height:1.55; }
    header, main, footer { width:min(1100px,calc(100% - 2rem)); margin-inline:auto; }
    header { padding:3rem 0 1.5rem; }
    h1 { font-size:clamp(2rem,5vw,3.5rem); letter-spacing:-.04em; }
    .eyebrow { color:var(--muted); margin-bottom:.5rem; font-size:.85rem; letter-spacing:.08em; text-transform:uppercase; }
    .meta { color:var(--muted); margin-top:.5rem; }
    main { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:1rem; padding-bottom:2rem; }
    .card { background:rgba(16,29,48,.94); border:1px solid var(--line); border-radius:18px; padding:1.2rem; }
    .card h2 { font-size:1rem; margin-bottom:.8rem; color:var(--accent); }
    ul { list-style:none; padding:0; }
    li { padding:.35rem 0; border-bottom:1px solid rgba(38,59,85,.4); font-size:.9rem; }
    li:last-child { border-bottom:none; }
    code { color:var(--muted); font-size:.78rem; display:block; margin-top:.15rem; }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .file-status { display:inline-block; font-size:.72rem; font-weight:700; padding:.1rem .4rem; border-radius:999px; margin-right:.3rem; }
    .present .file-status { background:rgba(86,214,155,.15); color:var(--safe); }
    .missing .file-status { background:rgba(244,113,113,.15); color:var(--red); }
    footer { padding:0 0 3rem; color:var(--muted); font-size:.85rem; }
    @media (max-width:700px) { main { grid-template-columns:1fr; } }
    @media print { body { background:#fff; color:#111; } .card { box-shadow:none; background:#fff; border-color:#bbb; } }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">CHINTU OS / LOCAL CONTROL ROOM</p>
    <h1>Control Room Index</h1>
    <p>Every Chintu OS report, dashboard, doc, and script in one place. Open locally. Nothing phones home.</p>
    <p class="meta">Generated $(Esc $stamp) | Branch: $(Esc $branch) | Latest: $(Esc $latestCommit)</p>
    <p class="meta"><strong>Static snapshot.</strong> Re-run <code>scripts/chintu-control-room-index.ps1</code> to refresh.</p>
  </header>
  <main>
$sectionHtml  </main>
  <footer>
    <p><strong>Local-only.</strong> This page is a generated snapshot. It does not read files live, send data, call a backend, track activity, or activate automation.</p>
    <p>BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.</p>
  </footer>
</body>
</html>
"@

$outPath = Join-Path $RepoRoot "CHINTU_CONTROL_ROOM_INDEX.html"
$html | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Host "Control Room Index written: $outPath"
Write-Host "Mode: local-only static snapshot"
exit 0
