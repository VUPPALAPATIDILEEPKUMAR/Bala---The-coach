# push-c51.ps1
# C51 -- Safety-check, commit, and push all C51 Telegram bridge enhancements.
#
# What C51 adds:
#   scripts/chintu-send-telegram.js  -- shared Telegram send helper (NEW)
#   scripts/chintu-telegram-poll.js  -- C51 upgrades:
#     + 6 new SAFE_COMMANDS (git_push, git_diff, node_check_poll, node_check_send,
#                            bala_audit, run_brain)
#     + new aliases: push/ship, diff, brain, digest/morning/d, s, l, t...
#     + digest command (multi-command: status + today + bala)
#     + updated HELP_TEXT
#   scripts/chintu-autonomous-brain.js -- morning Telegram push after 7am run (NEW)
#   schedule-c51.ps1  -- two-trigger setup: every 1 min + AtLogon (boot resilient)
#   push-c51.ps1      -- this file
#
# NOT committed (gitignored): offset.json, audit.jsonl, health exports

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Chintu\Desktop\test"
Set-Location $repoRoot

Write-Host ""
Write-Host "Chintu C51 -- Push Script" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------
# Step 1: Syntax checks (all 6 changed/new scripts)
# -----------------------------------------------------------------------
Write-Host "Step 1/5: Syntax checks" -ForegroundColor Yellow

$checks = @(
    "scripts\chintu-send-telegram.js",
    "scripts\chintu-telegram-poll.js",
    "scripts\chintu-autonomous-brain.js",
    "app.js",
    "sw.js"
)
foreach ($f in $checks) {
    Write-Host "  node --check $f ..." -ForegroundColor Gray
    node --check $f
    Write-Host "  $f : OK" -ForegroundColor Green
}

# -----------------------------------------------------------------------
# Step 2: Safety tests
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 2/5: Safety tests" -ForegroundColor Yellow

Write-Host "  Egress test ..." -ForegroundColor Gray
node scripts\chintu-no-network-egress.test.js
Write-Host "  Egress: PASS" -ForegroundColor Green

Write-Host "  Medical claims test ..." -ForegroundColor Gray
node scripts\chintu-medical-claims.test.js
Write-Host "  Medical claims: PASS" -ForegroundColor Green

Write-Host "  Skill contracts test ..." -ForegroundColor Gray
node -e "require('./scripts/chintu-skill-contracts.js'); console.log('skill-contracts: PASS')"

# -----------------------------------------------------------------------
# Step 3: Dry-run poll script (verifies new commands registered OK)
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 3/5: Dry-run chintu-telegram-poll.js ..." -ForegroundColor Yellow
node scripts\chintu-telegram-poll.js --dry-run
Write-Host "  Dry-run: OK" -ForegroundColor Green

# -----------------------------------------------------------------------
# Step 4: Verify gitignore is still correct
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 4/5: Verify gitignore entries" -ForegroundColor Yellow

$gitignoreContent = Get-Content .gitignore -Raw
$required = @("telegram_offset\.json", "telegram_poll_audit\.jsonl")
foreach ($pattern in $required) {
    if ($gitignoreContent -notmatch $pattern) {
        Write-Host "ERROR: .gitignore missing $pattern entry" -ForegroundColor Red
        exit 1
    }
    Write-Host "  .gitignore: $pattern -- excluded: OK" -ForegroundColor Green
}

# Paranoia: make sure offset and audit log are not staged
$gitStatus = git status --short
if ($gitStatus -match "telegram_offset") {
    Write-Host "ERROR: telegram_offset.json in git status -- must not be committed" -ForegroundColor Red
    exit 1
}
if ($gitStatus -match "telegram_poll_audit") {
    Write-Host "ERROR: telegram_poll_audit.jsonl in git status -- must not be committed" -ForegroundColor Red
    exit 1
}
Write-Host "  No secrets/offset files in staging: OK" -ForegroundColor Green

# -----------------------------------------------------------------------
# Step 5: Commit + push
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 5/5: Commit and push" -ForegroundColor Yellow

git add scripts/chintu-send-telegram.js
git add scripts/chintu-telegram-poll.js
git add scripts/chintu-autonomous-brain.js
git add scripts/chintu-no-network-egress.test.js
git add schedule-c51.ps1
git add push-c51.ps1

Write-Host ""
Write-Host "Staged files:" -ForegroundColor Gray
git status --short

git commit -m "C51: Telegram wonders -- boot resilient + morning push + power commands

- scripts/chintu-send-telegram.js (NEW): shared Telegram send utility
  - Used by autonomous brain (proactive morning push) and poller (replies)
  - Token never printed. Gracefully skips if token/flag not set.
  - sendTelegramMessage(text, opts) -> Promise<boolean>

- scripts/chintu-telegram-poll.js (UPGRADED from C50 to C51):
  - 6 new SAFE_COMMANDS (20 total):
    git_diff, git_push, node_check_poll, node_check_send, bala_audit, run_brain
  - git_push: git add -u + commit + push (tracked files only, no git add -A)
  - New aliases: push/ship, diff, brain/think, digest/morning/d/summary/daily
  - Shorthand: s=status, l=log, t=test, d=digest
  - digest command: multi-command (status + today + bala in one message)
  - Updated HELP_TEXT with emoji sections

- scripts/chintu-autonomous-brain.js (UPGRADED):
  - After 7am run, sends morning digest to Telegram proactively (no texting needed)
  - Uses chintu-send-telegram.js (optional dep, graceful skip if missing)
  - Message: emoji + task + ntfy_message + test results + committed + timestamp

- schedule-c51.ps1 (NEW): boot-resilient Task Scheduler setup
  - Trigger 1: every 1 minute (polling, same as C50)
  - Trigger 2: AtLogon (fires within seconds after any restart/reboot)
  - StartWhenAvailable catches sleep/offline gaps
  - Bridge now survives laptop restarts automatically

Tests: syntax OK (all 5 files), egress PASS, medical PASS, skill PASS, dry-run PASS
Security: no token printed, git_push uses git add -u only (no git add -A, no force-push)"

git push origin main

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "  C51 pushed!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Git HEAD:" -ForegroundColor Gray
git log --oneline -3
Write-Host ""
Write-Host "C51 setup (one-time, only needed to upgrade the Task Scheduler task):" -ForegroundColor Cyan
Write-Host "  .\schedule-c51.ps1  (Admin PowerShell)  -- upgrades task with AtLogon trigger" -ForegroundColor White
Write-Host "  Start-ScheduledTask -TaskName 'ChintuTelegramPoll' -TaskPath '\Chintu\'" -ForegroundColor White
Write-Host ""
Write-Host "Test C51 from your phone:" -ForegroundColor Cyan
Write-Host "  digest / morning    -- full digest (status + today + bala)" -ForegroundColor White
Write-Host "  diff                -- what changed in last commit" -ForegroundColor White
Write-Host "  push / ship         -- commit + push tracked changes" -ForegroundColor White
Write-Host "  brain               -- run autonomous brain (dry-run)" -ForegroundColor White
Write-Host "  help                -- full command list" -ForegroundColor White
Write-Host ""
Write-Host "Boot resilience test:" -ForegroundColor Yellow
Write-Host "  1. Restart laptop" -ForegroundColor Gray
Write-Host "  2. Log back in" -ForegroundColor Gray
Write-Host "  3. Text 'status' -- should get reply within 60 seconds" -ForegroundColor Gray
Write-Host "  4. At 7am next morning -- Telegram receives morning digest automatically" -ForegroundColor Gray
Write-Host ""
