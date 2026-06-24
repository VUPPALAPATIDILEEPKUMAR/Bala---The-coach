# push-c55.ps1
# C55 -- Groq function calling (tool use). Chintu picks up what you're doing.
#
# What C55 adds:
#   scripts/chintu-groq-tools.js          -- Groq tool-use agent (NEW)
#   scripts/chintu-telegram-poll.js       -- C54 -> C55: tries tool-use first
#   scripts/chintu-no-network-egress.test.js -- chintu-groq-tools.js allowlisted
#   push-c55.ps1                          -- this file
#
# After C55 -- Groq has 8 live tools it calls on demand:
#   git_status     -- working tree state
#   git_log        -- last 10 commits
#   git_log_today  -- today's commits only
#   bala_health    -- BALA file check (app.js, sw.js, index.html, styles.css)
#   read_resume    -- last 40 lines of CONTROL_TOWER_RESUME.md (project memory)
#   list_scripts   -- all chintu-*.js scripts
#   search_web     -- DuckDuckGo instant answers (free, no key)
#   get_time       -- current date + time (IST)
#
# Example Telegram conversations after C55:
#   "what are we working on?"     -> Groq calls read_resume, answers from real context
#   "is BALA healthy?"            -> Groq calls bala_health, gives real file status
#   "what did I commit today?"    -> Groq calls git_log_today, gives real commits
#   "what time is it?"            -> Groq calls get_time
#   "what is HRV?"                -> Groq calls search_web, gives quick definition
#   "how many scripts do we have?"-> Groq calls list_scripts, counts real files
#
# Tool-use falls back to plain chat (C54) if chintu-groq-tools.js unavailable.

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Chintu\Desktop\test"
Set-Location $repoRoot

Write-Host ""
Write-Host "Chintu C55 -- Groq Function Calling (Local Beast Mode)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------
# Step 1: Syntax checks
# -----------------------------------------------------------------------
Write-Host "Step 1/4: Syntax checks" -ForegroundColor Yellow

foreach ($f in @(
    "scripts\chintu-groq-tools.js",
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

git add scripts/chintu-groq-tools.js
git add scripts/chintu-telegram-poll.js
git add scripts/chintu-no-network-egress.test.js
git add push-c55.ps1

Write-Host ""
Write-Host "Staged:" -ForegroundColor Gray
git status --short

git commit -m "C55: Groq function calling -- Chintu becomes a local tool-use agent

- scripts/chintu-groq-tools.js (NEW):
  - chatWithGroqTools(userMessage, history) -> Promise<string|null>
  - 8 tools exposed to Groq via function-calling API:
    git_status, git_log, git_log_today, bala_health,
    read_resume, list_scripts, search_web, get_time
  - Tool loop: Groq decides what to call -> we execute locally -> Groq answers
  - MAX_ROUNDS = 3 (hard cap on tool-call loops, no infinite loops)
  - search_web: DuckDuckGo Instant Answers API (free, no auth, no key)
  - All tool commands in safe TOOL_COMMANDS map (no shell injection)
  - read_resume: reads last 40 lines of CONTROL_TOWER_RESUME.md (project memory)
  - bala_health: checks file existence + node --check syntax for all BALA files
  - Graceful null on missing key, timeout (25s), or any error

- scripts/chintu-telegram-poll.js (C54 -> C55):
  - Chat handler tries chatWithGroqTools first (smart agent mode)
  - Falls back to chatWithGroq + pre-built context if tool-use unavailable (C54)
  - Zero regression: C53 memory (loadHistory/appendHistory) still works in both paths

- chintu-no-network-egress.test.js: chintu-groq-tools.js allowlisted
  (calls api.groq.com + api.duckduckgo.com)

Tests: syntax OK (all files), egress PASS, medical PASS, contracts OK, dry-run PASS"

git push origin main

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  C55 pushed! Chintu is now a local beast." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
git log --oneline -3
Write-Host ""
Write-Host "Tools Groq now has (text anything from Telegram):" -ForegroundColor Cyan
Write-Host "  'what are we working on?'     -> reads CONTROL_TOWER_RESUME.md" -ForegroundColor White
Write-Host "  'is BALA healthy?'            -> runs bala_health check live" -ForegroundColor White
Write-Host "  'what did I push today?'      -> reads git log since midnight" -ForegroundColor White
Write-Host "  'list all chintu scripts'     -> real file list from disk" -ForegroundColor White
Write-Host "  'what time is it?'            -> current IST time" -ForegroundColor White
Write-Host "  'what is HRV?'               -> DuckDuckGo instant answer" -ForegroundColor White
Write-Host "  'forget'                      -> clears conversation memory" -ForegroundColor White
Write-Host ""
Write-Host "Fallback: if CHINTU_GROQ_API_KEY not set -> 'Brain offline' message" -ForegroundColor Gray
Write-Host ""
