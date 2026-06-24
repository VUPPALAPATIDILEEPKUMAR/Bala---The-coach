# push-c69.ps1 -- C69: Fix flashing window + Brain offline fallback
#
# Fixes two bugs reported by founder:
#
#   BUG 1 -- Flashing terminal window
#     Task Scheduler ran node.exe directly, causing a cmd window to
#     pop up and vanish every minute (distracting).
#     Fix: fix-flash.ps1 re-registers ChintuTelegramPoll to use
#          wscript.exe -> VBS hidden launcher -> node (window style 0).
#          After pushing, run fix-flash.ps1 as Admin to apply.
#
#   BUG 2 -- "Brain offline" for natural language / unrecognized commands
#     Typing "what can you do", "hi", "hello", etc. fell through to
#     Groq chat. If CHINTU_GROQ_API_KEY was absent in Task Scheduler,
#     reply was "Brain offline (CHINTU_GROQ_API_KEY not set)."
#     Fix: 12 natural language phrases now map to __help__ in
#          COMMAND_ALIASES -> resolveCommand returns help text directly,
#          no Groq call needed. When Groq IS absent, fallback now sends
#          the full HELP_TEXT instead of a dead-end error.
#
# Usage: .\push-c69.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C69: Fix Flash + Brain Offline Fallback" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# -- Step 1: Syntax check -- poll -------------------------------------------
Write-Host "STEP 1: Syntax check -- chintu-telegram-poll.js" -ForegroundColor Yellow
$result = node --check scripts\chintu-telegram-poll.js 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  [PASS] Poll syntax OK" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] Syntax error:" -ForegroundColor Red
  Write-Host $result
  exit 1
}

# -- Step 2: Help aliases present -------------------------------------------
Write-Host ""
Write-Host "STEP 2: Help aliases in COMMAND_ALIASES" -ForegroundColor Yellow
$helpAliases = Select-String -Path scripts\chintu-telegram-poll.js -Pattern "'hi'|'hello'|'what can you do'|'commands'" -CaseSensitive:$false
if ($helpAliases.Count -ge 2) {
  Write-Host "  [PASS] $($helpAliases.Count) help alias lines found" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] Help aliases not found in COMMAND_ALIASES" -ForegroundColor Red
  exit 1
}

# -- Step 3: resolveCommand handles __help__ --------------------------------
Write-Host ""
Write-Host "STEP 3: resolveCommand handles __help__" -ForegroundColor Yellow
$helpBranch = Select-String -Path scripts\chintu-telegram-poll.js -Pattern "alias === '__help__'" -CaseSensitive:$true
if ($helpBranch) {
  Write-Host "  [PASS] __help__ branch present in resolveCommand" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] __help__ branch missing from resolveCommand" -ForegroundColor Red
  exit 1
}

# -- Step 4: Brain offline fallback sends HELP_TEXT -------------------------
Write-Host ""
Write-Host "STEP 4: Brain offline fallback sends HELP_TEXT (not dead-end message)" -ForegroundColor Yellow
$helpFallback = Select-String -Path scripts\chintu-telegram-poll.js -Pattern "replyText.*HELP_TEXT" -CaseSensitive:$false |
  Where-Object { $_.Line -match 'Groq brain not available' }
if ($helpFallback) {
  Write-Host "  [PASS] Brain offline fallback sends HELP_TEXT" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] Brain offline fallback not updated" -ForegroundColor Red
  exit 1
}

# -- Step 5: fix-flash.ps1 exists -------------------------------------------
Write-Host ""
Write-Host "STEP 5: fix-flash.ps1 present" -ForegroundColor Yellow
if (Test-Path 'fix-flash.ps1') {
  Write-Host "  [PASS] fix-flash.ps1 exists (run as Admin after push)" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] fix-flash.ps1 missing" -ForegroundColor Red
  exit 1
}

# -- Step 6: Egress scan -----------------------------------------------------
Write-Host ""
Write-Host "STEP 6: No-network-egress safety scan" -ForegroundColor Yellow
$egressResult = node scripts\chintu-no-network-egress.test.js 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  [PASS] $egressResult" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] Egress scan failed:" -ForegroundColor Red
  Write-Host $egressResult
  exit 1
}

# -- Step 7: Git commit + push ----------------------------------------------
Write-Host ""
Write-Host "STEP 7: Git commit and push" -ForegroundColor Yellow

$c69Files = @(
  'scripts\chintu-telegram-poll.js',
  'fix-flash.ps1',
  'push-c69.ps1'
)
foreach ($f in $c69Files) {
  if (Test-Path $f) {
    git add $f
    Write-Host "  staged: $f" -ForegroundColor DarkGray
  }
}

# Also stage C68 and B68+B69 files if unpushed
$extraFiles = @(
  'scripts\chintu-health-brief.js',
  'scripts\chintu-no-network-egress.test.js',
  'push-c68.ps1',
  'schedule-c68.ps1',
  'app.js',
  'index.html',
  'push-b68-b69.ps1'
)
foreach ($f in $extraFiles) {
  if (Test-Path $f) {
    $staged = git diff --cached --name-only 2>$null
    if ($staged -notcontains $f.Replace('\', '/')) {
      # Only add if modified vs HEAD
      $modified = git diff --name-only HEAD -- $f 2>$null
      $untracked = git ls-files --others --exclude-standard -- $f 2>$null
      if ($modified -or $untracked) {
        git add $f
        Write-Host "  staged (extra): $f" -ForegroundColor DarkGray
      }
    }
  }
}

$status = git status --short
if (-not $status) {
  Write-Host "  (nothing to commit -- already pushed)" -ForegroundColor DarkGray
} else {
  git commit -m "C69: Fix flash + brain offline -- VBS launcher + help aliases

BUG 1 -- Flashing terminal window:
- fix-flash.ps1: re-registers ChintuTelegramPoll as wscript.exe + VBS
- VBS uses window style 0 (node runs completely hidden, no flash)
- Preserves all triggers (every 1 min + AtLogon boot resilience)
- Run fix-flash.ps1 as Admin to apply (task re-registration required)

BUG 2 -- Brain offline for natural language commands:
- Added 12 help aliases to COMMAND_ALIASES (hi, hello, what can you do, etc.)
- resolveCommand now handles __help__ -> { type: 'help' } without Groq call
- When Groq IS absent, fallback now sends full HELP_TEXT instead of dead-end error

Safety: no secrets logged. No new network egress. Egress scan: PASS."

  git push origin main

  Write-Host ""
  Write-Host "  C69 PUSHED!" -ForegroundColor Green
  Write-Host ""
  git log --oneline -3
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C69 LIVE -- Two bugs fixed" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  BUG 1 -- Flash fix: run this next (Admin PowerShell):"
Write-Host ""
Write-Host "    .\fix-flash.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "  BUG 2 -- Brain offline: already fixed (no admin needed)"
Write-Host "    hi, hello, 'what can you do' -> now returns help text"
Write-Host "    Groq offline -> now shows HELP_TEXT, not dead-end"
Write-Host ""
Write-Host "  BONUS -- CHINTU_GROQ_API_KEY for Task Scheduler:"
Write-Host "    If brain STILL shows offline, key is not at Machine scope."
Write-Host "    Run this in Admin PowerShell once, then restart:"
Write-Host ""
Write-Host "    [Environment]::SetEnvironmentVariable('CHINTU_GROQ_API_KEY','YOUR_KEY','Machine')" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Then run push-c68.ps1, push-b68-b69.ps1, and schedule-c68.ps1 (Admin)"
Write-Host ""
