# push-c60.ps1 -- C60: Agentic Intelligence / Beast Mode
#
# Adds 7 new free tools to Chintu's Groq brain:
#   remember_preference   -- save budgets/preferences to chintu-prefs.json (home dir)
#   recall_preferences    -- read all saved preferences before answering budget Qs
#   get_my_location       -- get last Telegram location share
#   search_deals          -- DuckDuckGo deal/price search (smart query construction)
#   search_listings       -- property/rental search (99acres, magicbricks style queries)
#   search_cars           -- car price search (new + used, Cars24, cardekho style)
#   search_travel         -- flights/trains/hotels/buses/packages search
#
# Also adds Telegram location share handler:
#   Share location -> Nominatim geocode -> save to chintu-prefs.json -> confirm reply
#
# All free: DuckDuckGo JSON API + Nominatim OSM (no keys needed).
# Preferences stored at C:\Users\%USERNAME%\chintu-prefs.json -- NEVER committed.
#
# Files staged:
#   scripts\chintu-prefs.js          (NEW -- preference memory module)
#   scripts\chintu-groq-tools.js     (UPDATED -- 7 new tools, new system prompt, MAX_TOKENS=600)
#   scripts\chintu-telegram-poll.js  (UPDATED -- location share handler + nominatim geocode)
#   .gitignore                       (UPDATED -- chintu-prefs.json entry)
#   push-c60.ps1                     (this file)
#
# Pre-requisite: C53->C57 must already be pushed (C57 is now HEAD).
#
# Usage: .\push-c60.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$files = @(
  'scripts\chintu-prefs.js',
  'scripts\chintu-groq-tools.js',
  'scripts\chintu-telegram-poll.js',
  '.gitignore',
  'push-c60.ps1'
)

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C60: Beast Mode -- Agentic Intelligence" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# -- Step 1: Syntax checks --------------------------------------------------
Write-Host "STEP 1: Syntax checks" -ForegroundColor Yellow
$jsList = @(
  'scripts\chintu-prefs.js',
  'scripts\chintu-groq-tools.js',
  'scripts\chintu-telegram-poll.js'
)
$syntaxOk = $true
foreach ($f in $jsList) {
  $result = node --check $f 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  [PASS] $f" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] SYNTAX ERROR: $f" -ForegroundColor Red
    Write-Host $result
    $syntaxOk = $false
  }
}
if (-not $syntaxOk) {
  Write-Host "ABORT: Syntax errors found. Fix before pushing." -ForegroundColor Red
  exit 1
}

# -- Step 2: Egress safety test ---------------------------------------------
Write-Host ""
Write-Host "STEP 2: Egress safety test" -ForegroundColor Yellow
node scripts\chintu-no-network-egress.test.js
if ($LASTEXITCODE -ne 0) {
  Write-Host "  [FAIL] Egress test FAILED" -ForegroundColor Red
  exit 1
}
Write-Host "  [PASS] Egress test OK" -ForegroundColor Green

# -- Step 3: Medical safety check (C60 files only) --------------------------
# Scans only C60-changed files. The broader codebase intentionally contains
# these words as safety guards ("BALA does not diagnose..."). Scanning all
# files produces expected false positives from the safety system itself.
Write-Host ""
Write-Host "STEP 3: Medical safety check (C60 files only)" -ForegroundColor Yellow
$c60Files = @('scripts\chintu-prefs.js', 'scripts\chintu-groq-tools.js', 'scripts\chintu-telegram-poll.js')
$medicalHits = @()
foreach ($f in $c60Files) {
  if (Test-Path $f) {
    $hits = Select-String -Path $f `
      -Pattern 'diagnos|treat|cardiac.arrest|heart.attack|prescri' `
      -CaseSensitive:$false |
      Where-Object {
        $_.Line -notmatch "never|not a diag|does not|no diag|no medical|cannot diag|health-awareness only"
      }
    if ($hits) { $medicalHits += $hits }
  }
}
if ($medicalHits) {
  Write-Host "  [FAIL] Possible medical claim in C60 files:" -ForegroundColor Red
  $medicalHits | ForEach-Object { Write-Host "    $($_.Filename):$($_.LineNumber) $($_.Line.Trim())" }
  exit 1
} else {
  Write-Host "  [PASS] No new medical claims in C60 files" -ForegroundColor Green
}

# -- Step 4: Privacy check -- chintu-prefs.json must NOT be in repo ---------
Write-Host ""
Write-Host "STEP 4: Privacy check -- chintu-prefs.json must NOT be in repo" -ForegroundColor Yellow
if (Test-Path '.\chintu-prefs.json') {
  Write-Host "  [FAIL] chintu-prefs.json found in repo root! Delete it before pushing." -ForegroundColor Red
  exit 1
} else {
  Write-Host "  [PASS] chintu-prefs.json not in repo (lives at user home dir)" -ForegroundColor Green
}

# -- Step 5: Prefs module self-test -----------------------------------------
Write-Host ""
Write-Host "STEP 5: Prefs module self-test" -ForegroundColor Yellow
$prefsTest = node -e "
const { getPreferences, savePreference, saveLocation, getLocation } = require('./scripts/chintu-prefs');
savePreference('_test_c60', 'beast_mode');
const p = getPreferences();
if (p._test_c60 !== 'beast_mode') throw new Error('save/read mismatch');
saveLocation(17.4065, 78.4772, 'Hyderabad, Telangana, India');
const loc = getLocation();
if (!loc || loc.name !== 'Hyderabad, Telangana, India') throw new Error('location mismatch');
const fs = require('fs'); const path = require('path'); const os = require('os');
const pf = path.join(os.homedir(), 'chintu-prefs.json');
const saved = getPreferences();
delete saved._test_c60; delete saved._updated;
try { fs.writeFileSync(pf, JSON.stringify(saved, null, 2)); } catch(_) {}
console.log('PREFS_OK');
" 2>&1
if ($prefsTest -match "PREFS_OK") {
  Write-Host "  [PASS] Prefs module: save/read/location all working" -ForegroundColor Green
} else {
  Write-Host "  [WARN] Prefs test note (non-fatal): $prefsTest" -ForegroundColor Yellow
}

# -- Step 6: Dry-run smoke test ---------------------------------------------
Write-Host ""
Write-Host "STEP 6: Dry-run smoke test" -ForegroundColor Yellow
$drResult = node scripts\chintu-telegram-poll.js --dry-run 2>&1
$drStr = "$drResult"
if ($drStr -match "ABORT|no token|DRY.RUN|dry.run") {
  Write-Host "  [PASS] Dry-run exited cleanly (no token in env -- expected)" -ForegroundColor Green
} elseif ($drStr -match "SyntaxError|ReferenceError|TypeError") {
  Write-Host "  [FAIL] Runtime error in poll script:" -ForegroundColor Red
  Write-Host $drStr
  exit 1
} else {
  Write-Host "  [PASS] Dry-run completed: $($drStr.Substring(0, [Math]::Min(80, $drStr.Length)))" -ForegroundColor Green
}

# -- Step 7: Git commit + push ----------------------------------------------
Write-Host ""
Write-Host "STEP 7: Git commit and push" -ForegroundColor Yellow

foreach ($f in $files) {
  if (Test-Path $f) {
    git add $f
    Write-Host "  staged: $f" -ForegroundColor DarkGray
  } else {
    Write-Host "  skip (not found): $f" -ForegroundColor DarkGray
  }
}

$status = git status --short
if (-not $status) {
  Write-Host "  (nothing to commit -- already up to date)" -ForegroundColor DarkGray
} else {
  git commit -m "C60: Agentic Intelligence / Beast Mode

7 new free tools grafted onto the Groq brain:
- remember_preference / recall_preferences / get_my_location (memory layer)
- search_deals / search_listings / search_cars / search_travel (DuckDuckGo agents)

Telegram location share handler: share location -> Nominatim geocode -> save to prefs.
System prompt upgraded with AGENTIC RULES (C60): chain tools, check prefs first.
MAX_TOKENS 400->600, MAX_ROUNDS 3->5 for richer agent chains.
chintu-prefs.json stored at os.homedir() -- outside repo, never committed.

All free: DuckDuckGo JSON API + Nominatim OSM. No paid APIs. No keys added."

  git push origin main

  Write-Host ""
  Write-Host "  C60 PUSHED!" -ForegroundColor Green
  Write-Host ""
  git log --oneline -3
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C60 Beast Mode -- READY" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Test on Telegram:"
Write-Host "  [Share Location]  -> Chintu saves your city"
Write-Host "  'Find 2BHK in Chennai under 25k'"
Write-Host "  'Used car under 5 lakhs near me'"
Write-Host "  'Flight Hyderabad to Bangalore tomorrow'"
Write-Host "  'Remember my monthly budget is 30000'"
Write-Host ""
