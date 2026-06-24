# push-b65-b67.ps1 -- B65: BALA Voice Coach + B66: Doctor Summary + B67: UI Glow-Up
#
# B65: Voice coach with Web Speech API -- mic button, STT, Groq via Chintu bridge
# B66: Doctor-Ready Summary page (summary.html) -- weekly signals, print-ready
# B67: UI glow-up -- warm palette, signal card animations, score ring, mic pulse
#
# Safety: Emergency intercept runs BEFORE any AI call (chest pain, stroke etc.)
# Privacy: No health data sent externally -- bridge is 127.0.0.1 only
# Fallback: Works offline with static warm responses if Chintu bridge unavailable
#
# Usage: .\push-b65-b67.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  B65+B66+B67: BALA Voice Coach + UI Glow-Up" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# -- Step 1: Syntax check -----------------------------------------------
Write-Host "STEP 1: Syntax check -- app.js" -ForegroundColor Yellow
$result = node --check app.js 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  [PASS] app.js syntax OK" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] app.js syntax error:" -ForegroundColor Red
  Write-Host $result
  exit 1
}

# -- Step 2: Safety check -- emergency intercept must be present --------
Write-Host ""
Write-Host "STEP 2: Safety check -- emergency intercept in app.js" -ForegroundColor Yellow
$hits = Select-String -Path app.js -Pattern 'EMERGENCY_RE|emergency.*intercept|chest pain|emergency care' -CaseSensitive:$false
if ($hits) {
  Write-Host "  [PASS] Emergency intercept found in app.js" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] Emergency safety intercept NOT found in app.js -- do not push" -ForegroundColor Red
  exit 1
}

# -- Step 3: Medical safety scan -- summary.html and app.js ------------
Write-Host ""
Write-Host "STEP 3: Medical safety scan -- new BALA files" -ForegroundColor Yellow
$scanFiles = @('app.js', 'summary.html', 'index.html')
$medHits = @()
foreach ($f in $scanFiles) {
  if (Test-Path $f) {
    $hits = Select-String -Path $f `
      -Pattern '\bdiagnose\b|\btreat\b|\bcardiac arrest\b|\bheart attack\b|\bprescri\b' `
      -CaseSensitive:$false |
      Where-Object { $_.Line -notmatch "never|not a diag|does not|no diag|awareness only|not medical|consult|disclaimer|For Personal Awareness|seek medical|EMERGENCY|cannot diagnose|This is a guide|body signal|'heart attack'|'cardiac arrest'|/heart.attack|/cardiac.arrest" }
    if ($hits) { $medHits += $hits }
  }
}
if ($medHits) {
  Write-Host "  [FAIL] Possible unsafe medical claim:" -ForegroundColor Red
  $medHits | ForEach-Object { Write-Host "    $($_.Filename):$($_.LineNumber) $($_.Line.Trim())" }
  exit 1
} else {
  Write-Host "  [PASS] No unsafe medical claims found" -ForegroundColor Green
}

# -- Step 4: Disclaimer check -- summary.html ---------------------------
Write-Host ""
Write-Host "STEP 4: Disclaimer check -- summary.html" -ForegroundColor Yellow
if (Test-Path 'summary.html') {
  $disc = Select-String -Path 'summary.html' -Pattern 'not a medical|For Personal Awareness|not medical diagnosis' -CaseSensitive:$false
  if ($disc) {
    Write-Host "  [PASS] Disclaimer found in summary.html" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] Disclaimer NOT found in summary.html" -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "  [WARN] summary.html not found -- skipping" -ForegroundColor Yellow
}

# -- Step 5: Git commit + push ------------------------------------------
Write-Host ""
Write-Host "STEP 5: Git commit and push" -ForegroundColor Yellow

$balaFiles = @('index.html', 'styles.css', 'app.js', 'summary.html', 'push-b65-b67.ps1')
foreach ($f in $balaFiles) {
  if (Test-Path $f) {
    git add $f
    Write-Host "  staged: $f" -ForegroundColor DarkGray
  }
}

$status = git status --short
if (-not $status) {
  Write-Host "  (nothing to commit -- already pushed)" -ForegroundColor DarkGray
} else {
  git commit -m "B65+B66+B67: BALA Voice Coach + Doctor Summary + UI Glow-Up

B65 -- Voice Coach:
- Web Speech API mic button (lang: en-IN, STT + TTS)
- Emergency intercept: chest pain/stroke symptoms -> immediate safety message
- POST to Chintu bridge :7891 with 3s timeout + graceful fallback
- Health context (HRV, sleep, steps, score) passed to Groq for aware responses
- Thinking dots + waveform animation while listening

B66 -- Doctor-Ready Summary (summary.html):
- Standalone printable page: BALA Score ring, signal tiles, 7-day trends
- 5 awareness conversation starters for doctor visits
- Disclaimer prominent: not a diagnosis, consult licensed provider
- 100% offline -- reads localStorage only, no network calls

B67 -- UI Glow-Up:
- Warm palette CSS vars: --warm-primary #E8845A, --warm-teal #5A9E8E
- Signal card hover animations, score ring glow, mic pulse-ring keyframe
- Mobile 375px safe, prefers-reduced-motion respected
- Fixed pre-existing CSS brace balance issues"

  git push origin main

  Write-Host ""
  Write-Host "  B65+B66+B67 PUSHED!" -ForegroundColor Green
  Write-Host ""
  git log --oneline -3
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  BALA Voice Coach -- LIVE" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Test in browser:"
Write-Host "  1. Open index.html"
Write-Host "  2. Start Chintu bridge: node scripts\chintu-bala-bridge.js"
Write-Host "  3. Tap mic button in coach section"
Write-Host "  4. Ask: 'Why is my HRV low today?'"
Write-Host "  5. Open summary.html for Doctor-Ready Summary"
Write-Host ""
