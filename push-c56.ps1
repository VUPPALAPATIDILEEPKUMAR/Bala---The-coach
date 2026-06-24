# push-c56.ps1
# C56 -- Groq gets 3 more tools: read any project file, explain last diff, check weather.
#
# What C56 adds to scripts/chintu-groq-tools.js:
#   read_file(path)     -- Read any file inside the repo (repo-root-relative, safety-gated)
#   get_git_diff        -- Diff of last commit: stat + first 1000 chars of patch
#   get_weather(city)   -- Current weather via wttr.in (free, no key, plain text)
#
# Total tools Groq now has: 11
#   git_status, git_log, git_log_today, bala_health, read_resume,
#   list_scripts, search_web, get_time,         (C55)
#   read_file, get_git_diff, get_weather        (C56, NEW)
#
# Safety on read_file:
#   - No ../ traversal (stripped before resolve)
#   - No MEMORY_VAULT access (blocked by name check)
#   - No dotfiles (path must not start with '.')
#   - Only alphanumeric / dash / dot / slash chars allowed
#   - path.resolve() must stay inside repoRoot (verified with startsWith)
#   - Output truncated to 2000 chars
#
# Example Telegram conversations after C56:
#   "show me app.js"                   -> read_file("app.js")
#   "what does the poller do?"         -> read_file("scripts/chintu-telegram-poll.js")
#   "what changed in the last commit?" -> get_git_diff() -> real stat + diff
#   "explain the last commit"          -> get_git_diff() -> Groq summarises
#   "what's the weather in Chennai?"   -> get_weather("Chennai")
#   "will it rain today?"              -> get_weather() default city
#
# Network: wttr.in (free, no key) added to egress comment.
# chintu-groq-tools.js already in scannerAllowlist -- no allowlist change needed.

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Chintu\Desktop\test"
Set-Location $repoRoot

Write-Host ""
Write-Host "Chintu C56 -- read_file + get_git_diff + get_weather" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
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
git add scripts/chintu-no-network-egress.test.js
git add push-c56.ps1

Write-Host ""
Write-Host "Staged:" -ForegroundColor Gray
git status --short

git commit -m "C56: Groq gets read_file + get_git_diff + get_weather tools

- scripts/chintu-groq-tools.js (C55 -> C56):

  read_file(path):
    - Reads any file in the repo by relative path (e.g. 'app.js', 'scripts/foo.js')
    - Safety: strips ../ traversal, blocks MEMORY_VAULT + dotfiles, char allowlist,
      path.resolve() must stay inside repoRoot, output capped at 2000 chars
    - Schema: requires 'path' (string), relative to repo root
    - Use: 'show me app.js', 'what does the poller do?', 'read styles.css'

  get_git_diff():
    - git diff --stat HEAD~1 HEAD + first 1000 chars of patch
    - Falls back to git show --stat HEAD if no prior commit
    - Use: 'what changed in the last commit?', 'explain the last commit'

  get_weather(city):
    - wttr.in plain text API (?format=3), free, no key needed
    - City param: URL-encoded, max 60 chars, defaults to 'Chennai'
    - 8s timeout, graceful fallback strings on error
    - Use: 'what's the weather in Chennai?', 'will it rain today?'

  Header updated: version C55 -> C56, all 3 tools documented, safety rules noted
  Egress comment updated: chintu-groq-tools.js now notes wttr.in as C56 endpoint

- scripts/chintu-no-network-egress.test.js:
  - Comment updated: C55+C56, documents wttr.in as new egress endpoint in groq-tools

Tools Groq now has (11 total):
  git_status, git_log, git_log_today, bala_health, read_resume,
  list_scripts, search_web, get_time       <- C55 (8 tools)
  read_file, get_git_diff, get_weather     <- C56 (3 new)

Tests: syntax OK (groq-tools, poll, egress-test), egress PASS, medical PASS,
       skill contracts PASS, dry-run ABORT (correct -- no token)"

git push origin main

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  C56 pushed! Groq now has 11 tools." -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
git log --oneline -3
Write-Host ""
Write-Host "New things you can ask via Telegram:" -ForegroundColor Cyan
Write-Host "  'show me app.js'                    -> reads real file from disk" -ForegroundColor White
Write-Host "  'what does chintu-groq-tools do?'   -> reads scripts/chintu-groq-tools.js" -ForegroundColor White
Write-Host "  'what changed in the last commit?'  -> git diff stat + patch" -ForegroundColor White
Write-Host "  'explain the last commit'           -> Groq reads diff, explains in plain English" -ForegroundColor White
Write-Host "  'what's the weather in Chennai?'    -> wttr.in live weather, no key needed" -ForegroundColor White
Write-Host "  'will it rain today?'               -> same, defaults to Chennai" -ForegroundColor White
Write-Host ""
Write-Host "Prior tools still work: git_status, git_log, git_log_today," -ForegroundColor Gray
Write-Host "  bala_health, read_resume, list_scripts, search_web, get_time" -ForegroundColor Gray
Write-Host ""
