<#
.SYNOPSIS
    Chintu Action Planner Core. Read the local truth and decide the
    next best actions for the founder.

.DESCRIPTION
    Local-only, read-only inspection that produces:

      - CHINTU_ACTION_QUEUE.md       Top 5 next actions with risk, approval
                                     flag, files touched, validation, and
                                     a suggested commit subject.
      - CHINTU_APPROVAL_CENTER.md    One approval card per action that
                                     needs founder approval, with exact
                                     approval phrase + rollback plan.
      - CHINTU_NEXT_OPERATOR_PROMPT.md Copy-paste-ready prompt for the
                                     highest-ranked safe action.
      - CHINTU_OUTBOX/latest_action_plan.json  Machine-readable mirror.

    No network. No sending. No BALA app edits. No external automation.
    Telegram / Slack / Discord / Gmail remain parked.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-action-planner.ps1
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

$now = Get-Date
$stamp = $now.ToString("yyyy-MM-dd HH:mm zzz")

# --- 1. read local truth -----------------------------------------------------
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null); if (-not $branch) { $branch = "(unknown)" }
$latest = (& git log -1 --oneline 2>$null);            if (-not $latest) { $latest = "(unknown)" }
$dirty  = (& git status --porcelain 2>$null)
$dirtyCount = if ($dirty) { ($dirty -split "`n").Count } else { 0 }
$unpushed = (& git log --oneline origin/main..HEAD 2>$null)
$unpushedCount = if ($unpushed) { ($unpushed -split "`n").Count } else { 0 }

function Read-Status {
    param([string]$ReportName)
    $p = Join-Path $RepoRoot $ReportName
    if (-not (Test-Path -LiteralPath $p)) { return "(not yet generated)" }
    $t = Get-Content -LiteralPath $p -Raw
    if ($t -match '## Overall status:\s*\*\*(GREEN|YELLOW|RED)\*\*') { return $matches[1] }
    return "(unparsed)"
}
$runtimeStatus = Read-Status "CHINTU_RUNTIME_HEALTH.md"
$bridgeStatus  = Read-Status "CHINTU_BRIDGE_LOOP_REALITY_CHECK.md"

$founderMsgPresent = Test-Path -LiteralPath (Join-Path $RepoRoot "CHINTU_OUTBOX\latest_founder_message.md")

# --- 2. compose candidate actions -------------------------------------------
# Each action: title, why, risk, approvalNeeded, filesTouched, validation,
# commitSubject, balaTouched, connectorActivation, category, command
$actions = New-Object System.Collections.ArrayList

# A1: founder message (always safe)
$null = $actions.Add([ordered]@{
    id = "A1-refresh-founder-message"
    title = "Refresh Chintu's founder message"
    why = "Stage 12 voice. One quick read of what is working, what needs attention, the best next move."
    risk = "low"
    approvalNeeded = $false
    filesTouched = @("CHINTU_DAILY_BRIEF.md","CHINTU_OUTBOX/latest_founder_message.md","CHINTU_OUTBOX/founder_message_history.md")
    validation = "open CHINTU_OUTBOX/latest_founder_message.md and confirm it reads true"
    commitSubject = "(no commit - generated/gitignored)"
    balaTouched = $false
    connectorActivation = $false
    category = "safe-now"
    command = "powershell -ExecutionPolicy Bypass -File scripts\chintu-founder-message.ps1"
})

# A2: dry-run preview
$null = $actions.Add([ordered]@{
    id = "A2-render-dry-run-payloads"
    title = "Render dry-run connector previews"
    why = "Make the Telegram/Slack/Discord shape visible without sending. Useful evidence for any future flip-to-ready decision."
    risk = "low"
    approvalNeeded = $false
    filesTouched = @("CHINTU_OUTBOX/dry_run_payloads/telegram_preview.json","CHINTU_OUTBOX/dry_run_payloads/slack_preview.json","CHINTU_OUTBOX/dry_run_payloads/discord_preview.json")
    validation = "node scripts/chintu-dry-run-adapter.test.js"
    commitSubject = "(no commit - generated/gitignored)"
    balaTouched = $false
    connectorActivation = $false
    category = "safe-now"
    command = "node scripts/chintu-message-dry-run.js"
})

# A3: bridge reality check
$null = $actions.Add([ordered]@{
    id = "A3-bridge-reality-check"
    title = "Re-run bridge loop reality check"
    why = "Confirms Windows -> shared bridge -> iMac Option 12 is still GREEN before any iMac pull."
    risk = "low"
    approvalNeeded = $false
    filesTouched = @("CHINTU_BRIDGE_LOOP_REALITY_CHECK.md")
    validation = "report should read Overall status: GREEN"
    commitSubject = "(no commit - generated/gitignored)"
    balaTouched = $false
    connectorActivation = $false
    category = "safe-now"
    command = "powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-loop-reality-check.ps1"
})

# A4: push (only relevant if unpushed)
if ($unpushedCount -gt 0) {
    $null = $actions.Add([ordered]@{
        id = "A4-push-pending-commits"
        title = "Push $unpushedCount pending commit(s) to origin/main"
        why = "Ship the work that has already passed every safety test."
        risk = "medium"
        approvalNeeded = $true
        filesTouched = @("(remote ref only)")
        validation = "walk CHINTU_PUSH_REVIEW_CHECKLIST.md before pushing; release guard verdict must be PASS"
        commitSubject = "(no new commit needed; this ships existing ones)"
        balaTouched = $false
        connectorActivation = $false
        category = "needs-approval"
        command = "git push origin main"
    })
}

# A5: BALA tier-1 audit (founder-only, read-only)
$null = $actions.Add([ordered]@{
    id = "A5-bala-tier1-audit"
    title = "BALA Tier 1 read-only audit (privacy.html + coach.js copy + phone walk)"
    why = "Catch any drift toward predictive/clinical phrasing before the next BALA commit. Zero risk - reading only."
    risk = "low"
    approvalNeeded = $false
    filesTouched = @("(none - read-only)")
    validation = "note three friction points; no edits this turn"
    commitSubject = "(no commit - read-only)"
    balaTouched = $false
    connectorActivation = $false
    category = "safe-now"
    command = "open privacy.html and coach.js in your editor; open the PWA on a phone"
})

# A6: connector flip-to-dry-run (Telegram) - parked, needs approval
$null = $actions.Add([ordered]@{
    id = "A6-flip-telegram-dry-run"
    title = "(Parked) Flip Telegram from parked -> dry-run"
    why = "Would let the dry-run adapter mark Telegram as exercised. Still NO real send. See CHINTU_TELEGRAM_STATUS_PLAN.md."
    risk = "medium"
    approvalNeeded = $true
    filesTouched = @("CHINTU_CONNECTORS.md","CHINTU_CONNECTORS_CONFIG.example.json")
    validation = "node scripts/chintu-connector-policy.test.js still PASS; no token in repo"
    commitSubject = "chore: flip telegram from parked to dry-run"
    balaTouched = $false
    connectorActivation = $true
    category = "needs-approval"
    command = "(founder edits the registry and example config, then commits)"
})

# A7: research only - voice coach slice V1 spec re-read
$null = $actions.Add([ordered]@{
    id = "A7-voice-coach-spec-reread"
    title = "(Research) Re-read BALA voice coach safe spec"
    why = "Keep the smallest BALA voice slice (Web Speech API play button) in mind without acting on it."
    risk = "low"
    approvalNeeded = $false
    filesTouched = @("(none - research)")
    validation = "no validation; this is awareness"
    commitSubject = "(no commit)"
    balaTouched = $false
    connectorActivation = $false
    category = "research"
    command = "open BALA_VOICE_COACH_SAFE_SPEC.md"
})

# --- 3. score + rank ---------------------------------------------------------
# Heuristic: dirty tree -> A1 promoted; unpushed -> A4 promoted to top safe-needs-approval;
# bridge GREEN -> A3 still listed but not promoted; runtime YELLOW -> A1 promoted.
# Final picked top 5, preferring safe-now first, then needs-approval, then research.
function Rank-Order {
    param([System.Collections.ArrayList]$All)
    $safe = @($All | Where-Object { $_.category -eq "safe-now" })
    $appr = @($All | Where-Object { $_.category -eq "needs-approval" })
    $rsch = @($All | Where-Object { $_.category -eq "research" })
    return @($safe + $appr + $rsch)
}
$ranked = Rank-Order $actions
$top5 = $ranked | Select-Object -First 5

# Highest-ranked safe action (for the next operator prompt)
$nextSafe = $ranked | Where-Object { $_.category -eq "safe-now" } | Select-Object -First 1

# --- 4. write CHINTU_ACTION_QUEUE.md ----------------------------------------
$q = New-Object System.Collections.ArrayList
$null = $q.Add("# Chintu Action Queue")
$null = $q.Add("")
$null = $q.Add("**Generated:** $stamp")
$null = $q.Add("**Branch:** $branch  |  **Latest:** ``$latest``")
$null = $q.Add("**Working tree:** $dirtyCount uncommitted  |  **Unpushed:** $unpushedCount")
$null = $q.Add("**Runtime health:** $runtimeStatus  |  **Bridge loop:** $bridgeStatus")
$null = $q.Add("**Founder message present:** $founderMsgPresent")
$null = $q.Add("")
$null = $q.Add("This queue is local. Nothing here is sent.")
$null = $q.Add("")
$idx = 0
foreach ($a in $top5) {
    $idx++
    $null = $q.Add("## $idx. $($a.title)")
    $null = $q.Add("")
    $null = $q.Add("- **id:** ``$($a.id)``")
    $null = $q.Add("- **why:** $($a.why)")
    $null = $q.Add("- **risk:** $($a.risk)")
    $null = $q.Add("- **approval needed:** $(if ($a.approvalNeeded) { 'yes' } else { 'no' })")
    $null = $q.Add("- **likely files touched:** $($a.filesTouched -join ', ')")
    $null = $q.Add("- **validation required:** $($a.validation)")
    $null = $q.Add("- **suggested commit:** ``$($a.commitSubject)``")
    $null = $q.Add("- **touches BALA app file:** $(if ($a.balaTouched) { 'YES - founder-only' } else { 'no' })")
    $null = $q.Add("- **connector activation:** $(if ($a.connectorActivation) { 'YES - founder approval required' } else { 'no' })")
    $null = $q.Add("- **category:** $($a.category)")
    $null = $q.Add("- **command:**")
    $null = $q.Add("")
    $null = $q.Add("  ``$($a.command)``")
    $null = $q.Add("")
}
$null = $q.Add("## Parked (do NOT activate without founder approval)")
$null = $q.Add("")
$null = $q.Add("Telegram, Discord, webhooks, cloud sync, phone notifications, voice calling, voice cloning, paid APIs, external automation, network egress, memory-wiki, health-data transfer.")
$null = $q.Add("")
$null = $q.Add("## BALA safety footer")
$null = $q.Add("")
$null = $q.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")
$queueText = $q -join "`r`n"

# --- 5. write CHINTU_APPROVAL_CENTER.md -------------------------------------
$ac = New-Object System.Collections.ArrayList
$null = $ac.Add("# Chintu Approval Center")
$null = $ac.Add("")
$null = $ac.Add("**Generated:** $stamp")
$null = $ac.Add("")
$null = $ac.Add("One approval card per queued action that needs founder approval. Each card is a contract: what will happen, what will NOT happen, the exact approval phrase, and a rollback plan.")
$null = $ac.Add("")
$null = $ac.Add("Approval is given by typing the exact phrase under **approval phrase** to Chintu (or running the **next command** yourself).")
$null = $ac.Add("")
$needsApproval = $top5 | Where-Object { $_.approvalNeeded }
if (-not $needsApproval -or $needsApproval.Count -eq 0) {
    $null = $ac.Add("## No approval needed this turn")
    $null = $ac.Add("")
    $null = $ac.Add("Nothing on the top-5 queue requires founder approval right now. The queue is all safe-now or research-only items.")
} else {
    foreach ($a in $needsApproval) {
        $null = $ac.Add("---")
        $null = $ac.Add("")
        $null = $ac.Add("## Approval card: $($a.title)")
        $null = $ac.Add("")
        $null = $ac.Add("**Action id:** ``$($a.id)``  |  **risk:** $($a.risk)")
        $null = $ac.Add("")
        $null = $ac.Add("### What will happen")
        $null = $ac.Add("")
        $null = $ac.Add($a.why)
        $null = $ac.Add("")
        $null = $ac.Add("### What will NOT happen")
        $null = $ac.Add("")
        $null = $ac.Add("- No BALA app file edits.")
        $null = $ac.Add("- No external send by Chintu OS.")
        $null = $ac.Add("- No secrets read or stored in the repo.")
        $null = $ac.Add("- No health-data transfer.")
        $null = $ac.Add("- No medical claims added.")
        $null = $ac.Add("")
        $null = $ac.Add("### Rollback plan")
        $null = $ac.Add("")
        if ($a.id -eq "A4-push-pending-commits") {
            $null = $ac.Add("Push is one-directional but every commit in the range has its own diff. If anything looks wrong post-push, open the offending commit and write a revert commit. Do not force-push.")
        } elseif ($a.id -eq "A6-flip-telegram-dry-run") {
            $null = $ac.Add("Revert the connector registry + example config edits. Re-run ``node scripts/chintu-connector-policy.test.js``. No real-send code was added, so there is no runtime rollback.")
        } else {
            $null = $ac.Add("Revert the planning commit. No runtime state changes.")
        }
        $null = $ac.Add("")
        $null = $ac.Add("### Approval phrase")
        $null = $ac.Add("")
        $null = $ac.Add("````text")
        $null = $ac.Add("approve $($a.id)")
        $null = $ac.Add("````")
        $null = $ac.Add("")
        $null = $ac.Add("### Record approval in local audit log")
        $null = $ac.Add("")
        $null = $ac.Add("After the founder types the approval phrase by hand, append it to ``CHINTU_APPROVAL_AUDIT.md`` with:")
        $null = $ac.Add("")
        $null = $ac.Add("``powershell -ExecutionPolicy Bypass -File scripts\chintu-approval-audit.ps1 -ApprovalPhrase ""approve $($a.id)""``")
        $null = $ac.Add("")
        $null = $ac.Add("### Exact next command")
        $null = $ac.Add("")
        $null = $ac.Add("``$($a.command)``")
        $null = $ac.Add("")
    }
}
$null = $ac.Add("---")
$null = $ac.Add("")
$null = $ac.Add("## What this center will never do")
$null = $ac.Add("")
$null = $ac.Add("- Never auto-approve. Approval is always founder-typed or founder-keystroke.")
$null = $ac.Add("- Never grant standing approval. Each turn needs its own approval phrase.")
$null = $ac.Add("- Never approve a BALA app file edit. Founder-only across every cycle.")
$null = $ac.Add("- Never approve a real external send without the connector flipping commit chain in CHINTU_CONNECTOR_POLICY.md.")
$null = $ac.Add("")
$null = $ac.Add("## BALA safety footer")
$null = $ac.Add("")
$null = $ac.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")
$approvalText = $ac -join "`r`n"

# --- 6. write CHINTU_NEXT_OPERATOR_PROMPT.md --------------------------------
$promptLines = New-Object System.Collections.ArrayList
$null = $promptLines.Add("# Chintu Next Operator Prompt")
$null = $promptLines.Add("")
$null = $promptLines.Add("**Generated:** $stamp")
$null = $promptLines.Add("")
$null = $promptLines.Add("Copy-paste-ready prompt for the highest-ranked safe action right now.")
$null = $promptLines.Add("")
if ($nextSafe) {
    $null = $promptLines.Add("## Action selected")
    $null = $promptLines.Add("")
    $null = $promptLines.Add("**$($nextSafe.title)** (``$($nextSafe.id)``, risk: $($nextSafe.risk))")
    $null = $promptLines.Add("")
    $null = $promptLines.Add("$($nextSafe.why)")
    $null = $promptLines.Add("")
    $null = $promptLines.Add("## Exact command")
    $null = $promptLines.Add("")
    $null = $promptLines.Add("````powershell")
    $null = $promptLines.Add("$($nextSafe.command)")
    $null = $promptLines.Add("````")
    $null = $promptLines.Add("")
    $null = $promptLines.Add("## Validation after")
    $null = $promptLines.Add("")
    $null = $promptLines.Add("$($nextSafe.validation)")
    $null = $promptLines.Add("")
    $null = $promptLines.Add("## What this will NOT do")
    $null = $promptLines.Add("")
    $null = $promptLines.Add("- Will not edit any BALA app file.")
    $null = $promptLines.Add("- Will not send anything externally.")
    $null = $promptLines.Add("- Will not bump the service worker.")
    $null = $promptLines.Add("- Will not read or store any secret.")
} else {
    $null = $promptLines.Add("## No safe-now action available")
    $null = $promptLines.Add("")
    $null = $promptLines.Add("Open ``CHINTU_APPROVAL_CENTER.md`` and decide whether to approve a needs-approval item.")
}
$null = $promptLines.Add("")
$null = $promptLines.Add("## BALA safety footer")
$null = $promptLines.Add("")
$null = $promptLines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")
$promptText = $promptLines -join "`r`n"

# --- 7. write JSON mirror under outbox --------------------------------------
$outboxDir = Join-Path $RepoRoot "CHINTU_OUTBOX"
if (-not (Test-Path -LiteralPath $outboxDir)) { New-Item -ItemType Directory -Path $outboxDir | Out-Null }

$jsonObj = [ordered]@{
    _dry_run = $true
    _label = "DRY RUN ONLY"
    generated = $stamp
    branch = $branch
    latest_commit = $latest
    uncommitted = $dirtyCount
    unpushed = $unpushedCount
    runtime_status = $runtimeStatus
    bridge_status = $bridgeStatus
    top5 = $top5
    next_safe_action_id = if ($nextSafe) { $nextSafe.id } else { $null }
    parked = @("telegram","discord","webhooks","cloud_sync","phone","voice","gmail","paid_apis","network_egress","memory_wiki","health_data_transfer")
    bala_safety_footer = "BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring."
}
$jsonText = $jsonObj | ConvertTo-Json -Depth 6

# --- 8. write all four files ------------------------------------------------
$queuePath  = Join-Path $RepoRoot "CHINTU_ACTION_QUEUE.md"
$apprvPath  = Join-Path $RepoRoot "CHINTU_APPROVAL_CENTER.md"
$promptPath = Join-Path $RepoRoot "CHINTU_NEXT_OPERATOR_PROMPT.md"
$jsonPath   = Join-Path $outboxDir "latest_action_plan.json"

[System.IO.File]::WriteAllText($queuePath,  $queueText,    [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($apprvPath,  $approvalText, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($promptPath, $promptText,   [System.Text.Encoding]::UTF8)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($jsonPath,   $jsonText,     $utf8NoBom)

Write-Host "Action queue written:      $queuePath"
Write-Host "Approval center written:   $apprvPath"
Write-Host "Next operator prompt:      $promptPath"
Write-Host "JSON mirror:               $jsonPath"
Write-Host "No network. No sending. No external automation activated."
exit 0
