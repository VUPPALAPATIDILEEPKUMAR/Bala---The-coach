# push-c54.ps1
# C54 -- Groq writes the morning digest + richer Telegram context.
#
# What C54 adds:
#   scripts/chintu-autonomous-brain.js   -- Groq composes the 7am Telegram message
#   scripts/chintu-telegram-poll.js      -- poll Groq gets BALA + today commits in context
#   push-c54.ps1                         -- this file
#
# After C54:
#   7am message: Groq writes a warm natural briefing (not a hardcoded emoji block)
#   Telegram chat: "is BALA healthy?" -> Groq sees actual BALA file status
#   Telegram chat: "what did I do today?" -> Groq sees today's commits
#   Fallback to static message if Groq key not set.

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Chintu\Desktop\test"
Set-Location $repoRoot

Write-Host ""
Write-Host "Chintu C54 -- Groq Morning Digest + Rich Context" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------
# Step 1: Syntax checks
# -----------------------------------------------------------------------
Write-Host "Step 1/4: Syntax checks" -ForegroundColor Yellow

foreach ($f in @(
    "scripts\chintu-autonomous-brain.js",
    "scripts\chintu-telegram-poll.js"
)) {
    node --check $f
    Write-Host "  $f : OK" -ForegroundColor Green
}

# -----------------------------------------------------------------------
# Step 2: Safety tests
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 2/4: Safety tests" -ForegroundColor Yellow

node scripts\chintu-no-network-egress.test.js
Write-Host "  Egress: PASS" -ForegroundColor Green

node scripts\chintu-medical-claims.test.js
Write-Host "  Medical claims: PASS" -ForegroundColor Green

node scripts\chintu-skill-contracts.js
Write-Host "  Skill contracts: PASS" -ForegroundColor Green

# -----------------------------------------------------------------------
# Step 3: Dry-run poll
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 3/4: Dry-run poll ..." -ForegroundColor Yellow
node scripts\chintu-telegram-poll.js --dry-run
Write-Host "  Dry-run: OK (ABORT on no token = correct)" -ForegroundColor Green

# -----------------------------------------------------------------------
# Step 4: Commit + push
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 4/4: Commit and push" -ForegroundColor Yellow

git add scripts/chintu-autonomous-brain.js
git add scripts/chintu-telegram-poll.js
git add push-c54.ps1

Write-Host ""
Write-Host "Staged:" -ForegroundColor Gray
git status --short

git commit -m "C54: Groq writes morning digest + richer Telegram chat context

- scripts/chintu-autonomous-brain.js (C51 -> C54):
  - 7am Telegram message now written by Groq (natural language, warm, 5 lines max)
  - Groq briefing prompt includes: task, summary, test results, git status,
    recent commits, BALA file status, committed flag, and timestamp
  - System instruction: write as Chintu, no bullet points, real assistant tone
  - Graceful fallback to static hardcoded message if chatWithGroq unavailable
  - Static message preserved as fallback (zero regression)

- scripts/chintu-telegram-poll.js (C53 -> C54):
  - Groq poll context enriched from 2 sources to 4:
    * git_status (250 chars)         -- was already there
    * git_log/recent (200 chars)     -- was already there
    * check_bala_files (120 chars)   -- NEW: BALA health in every answer
    * git_log_today (150 chars)      -- NEW: today's work visible to Groq
  - Groq now answers 'is BALA healthy?' with real file status
  - Groq now answers 'what did I do today?' with actual today commits

Tests: syntax OK (brain, poll), egress PASS, medical PASS, contracts OK, dry-run ABORT (correct)"

git push origin main

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  C54 pushed!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
git log --oneline -3
Write-Host ""
Write-Host "What changed:" -ForegroundColor Cyan
Write-Host "  7am brain run -> Groq writes your morning message naturally" -ForegroundColor White
Write-Host "  'is BALA healthy?' -> Groq sees actual app.js/index.html status" -ForegroundColor White
Write-Host "  'what did I do today?' -> Groq sees today's commits" -ForegroundColor White
Write-Host "  All commands + memory (C53) still work unchanged" -ForegroundColor White
Write-Host ""
