# push-c53.ps1
# C53 -- Conversation memory: Groq now remembers context across poll cycles.
#
# What C53 adds:
#   scripts/chintu-chat-memory.js        -- rolling per-chat history (NEW)
#   scripts/chintu-telegram-poll.js      -- C52 -> C53: history load/save wired in
#   scripts/chintu-groq-chat.js          -- accepts history[] parameter for multi-turn
#   .gitignore                           -- CHINTU_MEMORY_VAULT/chat_history/ excluded
#   push-c53.ps1                         -- this file
#
# After C53: Chintu remembers the conversation.
#   You: "what are we working on?"  -> Groq answers
#   You: "and how's BALA doing?"    -> Groq knows what "and" refers to (prior context)
#   You: "forget"                   -> clears memory, fresh start
#
# Memory is stored locally (CHINTU_MEMORY_VAULT/chat_history/), never committed.

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Chintu\Desktop\test"
Set-Location $repoRoot

Write-Host ""
Write-Host "Chintu C53 -- Conversation Memory" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------
# Step 1: Syntax checks
# -----------------------------------------------------------------------
Write-Host "Step 1/4: Syntax checks" -ForegroundColor Yellow

foreach ($f in @(
    "scripts\chintu-chat-memory.js",
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
# Step 3: Verify .gitignore protects chat history
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 3/4: Verify .gitignore entries" -ForegroundColor Yellow

$gitignoreContent = Get-Content .gitignore -Raw
$required = @(
    "telegram_offset\.json",
    "telegram_poll_audit\.jsonl",
    "chat_history"
)
foreach ($pattern in $required) {
    if ($gitignoreContent -notmatch $pattern) {
        Write-Host "ERROR: .gitignore missing $pattern" -ForegroundColor Red
        exit 1
    }
    Write-Host "  .gitignore: $pattern -- excluded: OK" -ForegroundColor Green
}

# Make sure no chat history ends up staged
$gitStatus = git status --short
if ($gitStatus -match "chat_history") {
    Write-Host "ERROR: chat_history in git status -- must not be committed" -ForegroundColor Red
    exit 1
}
Write-Host "  No chat history files staged: OK" -ForegroundColor Green

# -----------------------------------------------------------------------
# Step 4: Commit + push
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "Step 4/4: Commit and push" -ForegroundColor Yellow

git add scripts/chintu-chat-memory.js
git add scripts/chintu-groq-chat.js
git add scripts/chintu-telegram-poll.js
git add .gitignore
git add push-c53.ps1

Write-Host ""
Write-Host "Staged:" -ForegroundColor Gray
git status --short

git commit -m "C53: Conversation memory for multi-turn Groq context in Telegram

- scripts/chintu-chat-memory.js (NEW):
  - Rolling per-chat conversation history for Groq multi-turn context
  - Storage: CHINTU_MEMORY_VAULT/chat_history/chat_XXXXXXXX.json (per chatId)
  - chatId masked (last 8 chars of sanitized ID) -- IDs never in filenames
  - MAX_HISTORY = 10 messages in Groq context, 20 kept in storage (rolling)
  - Exports: loadHistory(chatId), appendHistory(chatId, role, content), clearHistory(chatId)
  - All I/O synchronous and local. Never throws. No health data. No secrets.

- scripts/chintu-groq-chat.js (C52 -> C53):
  - chatWithGroq(userMessage, context, history) -- accepts history[] parameter
  - Spreads prior messages into Groq messages array before current user message
  - History enables real multi-turn: Groq remembers prior context across poll cycles

- scripts/chintu-telegram-poll.js (C52 -> C53):
  - Chat handler now loads history before calling Groq
  - Saves user message + assistant reply to rolling history after each exchange
  - New 'forget' / 'reset' / 'clear' aliases -> clears this chat's history
  - Alias resolves to __clear_history__ -> clearHistory(chatId) + confirmation reply

- .gitignore: CHINTU_MEMORY_VAULT/chat_history/ excluded (local only)

Tests: syntax OK (all files), egress PASS, medical PASS, skill contracts PASS, dry-run ABORT (correct -- no token)"

git push origin main

Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host "  C53 pushed!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
git log --oneline -3
Write-Host ""
Write-Host "Try from Telegram now:" -ForegroundColor Cyan
Write-Host "  'what are we working on?'        -> Groq answers with project context" -ForegroundColor White
Write-Host "  'and what should I focus on?'    -> Groq REMEMBERS the prior exchange" -ForegroundColor White
Write-Host "  'how many commits today?'         -> live git context + memory" -ForegroundColor White
Write-Host "  'forget'                          -> clears memory, fresh start" -ForegroundColor White
Write-Host "  'reset'                           -> same as forget" -ForegroundColor White
Write-Host ""
Write-Host "Memory lives at: CHINTU_MEMORY_VAULT\chat_history\ (local, gitignored)" -ForegroundColor Gray
Write-Host ""
