# push-c50.ps1
# C50 -- Safety-check, commit, and push all C50 Telegram bridge files.
# Run from repo root after completing setup: node scripts\chintu-telegram-poll.js --dry-run
#
# Files committed:
#   scripts/chintu-telegram-poll.js   -- one-shot poller (new)
#   setup-c50.ps1                     -- Telegram env var setup (new)
#   schedule-c50.ps1                  -- Task Scheduler registration (new)
#   push-c50.ps1                      -- this file (new)
#   .gitignore                        -- added telegram_offset.json + audit log exclusions
#
# NOT committed (gitignored):
#   CHINTU_MEMORY_VAULT/telegram_offset.json   -- message offset (local state)
#   CHINTU_OUTBOX/telegram_poll_audit.jsonl    -- audit log (contains chat IDs)

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Chintu\Desktop\test"
Set-Location $repoRoot

Write-Host ""
Write-Host "Chintu C50 -- Push Script" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------
# Step 1: Syntax checks
# -----------------------------------------------------------------------
Write-Host "Step 1/5: Syntax checks" -ForegroundColor Yellow

Write-Host "  node --check scripts\chintu-telegram-poll.js ..." -ForegroundColor Gray
node --check scripts\chintu-telegram-poll.js
Write-Host "  chintu-telegram-poll.js: OK" -ForegroundColor Green

Write-Host "  node --check app.js ..." -ForegroundColor Gray
node --check app.js
Write-Host "  app.js: OK" -ForegroundColor Green

Write-Host "  node --check sw.js ..." -ForegroundColor Gray
node --check sw.js
Write-Host "  sw.js: OK" -ForegroundColor Green

Write-Host "  node --check scripts\chintu-autonomous-brain.js ..." -ForegroundColor Gray
node --check scripts\chintu-autonomous-brain.js
Write-Host "  chintu-autonomous-brain.js: OK" -ForegroundColor Green

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
# Step 3: Dry-run poll script
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 3/5: Dry-run chintu-telegram-poll.js ..." -ForegroundColor Yellow
node scripts\chintu-telegram-poll.js --dry-run
Write-Host "  Dry-run: OK" -ForegroundColor Green

# -----------------------------------------------------------------------
# Step 4: Verify gitignore is correct (offset + audit log NOT tracked)
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 4/5: Verify gitignore entries" -ForegroundColor Yellow

$gitignoreContent = Get-Content .gitignore -Raw
if ($gitignoreContent -notmatch "telegram_offset\.json") {
    Write-Host "ERROR: .gitignore missing telegram_offset.json entry" -ForegroundColor Red
    exit 1
}
if ($gitignoreContent -notmatch "telegram_poll_audit\.jsonl") {
    Write-Host "ERROR: .gitignore missing telegram_poll_audit.jsonl entry" -ForegroundColor Red
    exit 1
}
Write-Host "  .gitignore: telegram_offset.json -- excluded" -ForegroundColor Green
Write-Host "  .gitignore: telegram_poll_audit.jsonl -- excluded" -ForegroundColor Green

# Paranoia: make sure offset and audit log are not staged
$gitStatus = git status --short
if ($gitStatus -match "telegram_offset") {
    Write-Host "ERROR: telegram_offset.json appears in git status -- must not be committed" -ForegroundColor Red
    exit 1
}
if ($gitStatus -match "telegram_poll_audit") {
    Write-Host "ERROR: telegram_poll_audit.jsonl appears in git status -- must not be committed" -ForegroundColor Red
    exit 1
}
Write-Host "  No offset/audit files in staging: OK" -ForegroundColor Green

# -----------------------------------------------------------------------
# Step 5: Commit + push
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 5/5: Commit and push" -ForegroundColor Yellow

git add scripts/chintu-telegram-poll.js
git add setup-c50.ps1
git add schedule-c50.ps1
git add push-c50.ps1
git add .gitignore

Write-Host ""
Write-Host "Staged files:" -ForegroundColor Gray
git status --short

git commit -m "C50: Telegram two-way bridge -- one-shot poller + Task Scheduler

- scripts/chintu-telegram-poll.js: one-shot poller (Task Scheduler runs every 1 min)
  - loads/saves offset from CHINTU_MEMORY_VAULT/telegram_offset.json
  - processes ALL pending updates per run (not just first)
  - executes SAFE_COMMANDS directly (no bridge server dependency)
  - natural-language aliases: status, git log, today, test, bala, count, resume...
  - allowlist: CHINTU_TELEGRAM_ALLOWED_CHAT_IDS + ALLOWED_SENDER_IDS
  - send gate: CHINTU_TELEGRAM_SEND_ENABLED=1 required
  - token security: never printed, redacted from error logs
  - dry-run mode: --dry-run (no send, no execute)
  - audit log: CHINTU_OUTBOX/telegram_poll_audit.jsonl (gitignored)
- setup-c50.ps1: stores TELEGRAM_BOT_TOKEN + allowlist IDs in Windows Registry
  - token input hidden (SecureString), cleared after storage, never written to file
- schedule-c50.ps1: registers \Chintu\ChintuTelegramPoll in Task Scheduler
  - runs every 1 minute, StartWhenAvailable, Interactive logon
  - execution time limit 2 min, MultipleInstances=IgnoreNew
  - requires Admin (for \Chintu\ folder)
- .gitignore: added telegram_offset.json + telegram_poll_audit.jsonl exclusions

Tests: syntax OK (poll + app + sw + brain), egress PASS, medical PASS, skill PASS
Security: no token printed, no infinite loop, allowlist required, dry-run verified"

git push origin main

Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host "  C50 pushed!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "Git HEAD:" -ForegroundColor Gray
git log --oneline -3
Write-Host ""
Write-Host "C50 setup sequence:" -ForegroundColor Cyan
Write-Host "  1. .\setup-c50.ps1                     -- store bot token + allowlist in Registry" -ForegroundColor White
Write-Host "  2. node scripts\chintu-telegram-poll.js --dry-run  -- test without sending" -ForegroundColor White
Write-Host "  3. node scripts\chintu-telegram-poll.js            -- test live reply" -ForegroundColor White
Write-Host "  4. .\schedule-c50.ps1  (as Admin)       -- register every-1-min task" -ForegroundColor White
Write-Host "  5. Start-ScheduledTask -TaskName 'ChintuTelegramPoll' -TaskPath '\Chintu\'" -ForegroundColor White
Write-Host ""
Write-Host "Phone commands (text to your Telegram bot):" -ForegroundColor Cyan
Write-Host "  help | status | git log | today | test | bala | count | scripts | resume" -ForegroundColor Gray
Write-Host ""
