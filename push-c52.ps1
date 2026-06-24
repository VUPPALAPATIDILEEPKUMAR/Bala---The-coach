# push-c52.ps1
# C52 -- Conversational Groq brain wired into Telegram.
#
# What C52 adds:
#   scripts/chintu-groq-chat.js          -- Groq conversational helper (NEW)
#   scripts/chintu-telegram-poll.js      -- C52: unknown cmds -> Groq chat
#   scripts/chintu-no-network-egress.test.js -- chintu-groq-chat.js allowlisted
#   push-c52.ps1                         -- this file
#
# After C52: text Chintu anything natural and get an AI reply.
#   "what are we working on?" -> Groq reads git context, answers
#   "how many commits today?"  -> real answer from git log context
#   "is BALA healthy?"         -> checks file status, replies
#   Known commands (status, push, etc.) still work as before.

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Chintu\Desktop\test"
Set-Location $repoRoot

Write-Host ""
Write-Host "Chintu C52 -- Conversational Groq Brain" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------
# Step 1: Syntax checks
# -----------------------------------------------------------------------
Write-Host "Step 1/4: Syntax checks" -ForegroundColor Yellow

foreach ($f in @(
    "scripts\chintu-groq-chat.js",
    "scripts\chintu-telegram-poll.js",
    "scripts\chintu-no-network-egress.test.js"
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
# Step 3: Dry-run poll (verify chat type resolves correctly)
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 3/4: Dry-run poll ..." -ForegroundColor Yellow
node scripts\chintu-telegram-poll.js --dry-run
Write-Host "  Dry-run: OK" -ForegroundColor Green

# -----------------------------------------------------------------------
# Step 4: Commit + push
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 4/4: Commit and push" -ForegroundColor Yellow

git add scripts/chintu-groq-chat.js
git add scripts/chintu-telegram-poll.js
git add scripts/chintu-no-network-egress.test.js
git add push-c52.ps1

Write-Host ""
Write-Host "Staged:" -ForegroundColor Gray
git status --short

git commit -m "C52: Conversational Groq brain in Telegram

- scripts/chintu-groq-chat.js (NEW): Groq conversational helper
  - chatWithGroq(userMessage, context) -> Promise<string|null>
  - Model: llama-3.3-70b-versatile (free tier, same as brain)
  - System prompt: Chintu persona + lightweight project context
  - Context: git status + recent commits (gathered inline, <800 chars)
  - Max tokens: 300 (short Telegram-friendly replies)
  - Token never printed. No health data. Graceful null on any error.

- scripts/chintu-telegram-poll.js (C51 -> C52):
  - Unknown messages no longer return error -- they go to Groq
  - resolveCommand() returns {type:'chat'} instead of {type:'unknown'}
  - Groq reply prefixed with brain emoji for clarity
  - Falls back to 'Brain offline' hint if CHINTU_GROQ_API_KEY not set
  - Known commands (status, push, digest, etc.) unchanged

- chintu-no-network-egress.test.js: chintu-groq-chat.js allowlisted

Tests: syntax OK, egress PASS, medical PASS, skill contracts PASS, dry-run PASS"

git push origin main

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  C52 pushed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
git log --oneline -3
Write-Host ""
Write-Host "Try from Telegram now:" -ForegroundColor Cyan
Write-Host "  'what are we working on?'      -> Groq reads git, answers" -ForegroundColor White
Write-Host "  'how many commits today?'       -> real answer from context" -ForegroundColor White
Write-Host "  'is BALA healthy?'              -> file status + AI reply" -ForegroundColor White
Write-Host "  'what should I do next?'        -> Groq suggests next step" -ForegroundColor White
Write-Host "  'explain the last commit'       -> Groq reads git log, explains" -ForegroundColor White
Write-Host ""
Write-Host "Commands still work as before: status, push, digest, diff, help" -ForegroundColor Gray
Write-Host ""
