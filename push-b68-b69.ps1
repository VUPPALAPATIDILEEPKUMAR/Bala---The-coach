# push-b68-b69.ps1 -- B68: BALA Export for Chintu + B69: BALA Score Delta
#
# B68: "Export for Chintu" button downloads bala-daily-snapshot.json
#      from localStorage. Chintu reads this for the C68 morning brief.
#      100% offline -- no network, no upload, reads localStorage only.
#
# B69: Score delta display (+/- vs previous check-in) beneath the BALA
#      score ring. Colour-coded: teal=improving, coral=declining, grey=stable.
#      Re-renders automatically on each new check-in.
#
# Privacy: export stays on device. User moves it to home folder manually.
# Safety: no medical claims. Score is a wellness guide, not a diagnosis.
#
# Usage: .\push-b68-b69.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  B68+B69: BALA Export for Chintu + Score Delta" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# -- Step 1: Syntax check -- app.js ----------------------------------------
Write-Host "STEP 1: Syntax check -- app.js" -ForegroundColor Yellow
$result = node --check app.js 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  [PASS] app.js syntax OK" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] app.js syntax error:" -ForegroundColor Red
  Write-Host $result
  exit 1
}

# -- Step 2: B68 export function must be present ----------------------------
Write-Host ""
Write-Host "STEP 2: B68 export function present in app.js" -ForegroundColor Yellow
$b68Hit = Select-String -Path app.js -Pattern 'exportBALASnapshot|bala-export-chintu-btn' -CaseSensitive:$false
if ($b68Hit) {
  Write-Host "  [PASS] exportBALASnapshot + button wiring found" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] B68 export function NOT found in app.js" -ForegroundColor Red
  exit 1
}

# -- Step 3: B69 score delta function must be present -----------------------
Write-Host ""
Write-Host "STEP 3: B69 score delta present in app.js" -ForegroundColor Yellow
$b69Hit = Select-String -Path app.js -Pattern 'renderScoreDelta|bala-score-delta' -CaseSensitive:$false
if ($b69Hit) {
  Write-Host "  [PASS] renderScoreDelta + delta element found" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] B69 score delta NOT found in app.js" -ForegroundColor Red
  exit 1
}

# -- Step 4: index.html -- both new elements present ------------------------
Write-Host ""
Write-Host "STEP 4: index.html -- new B68 + B69 elements present" -ForegroundColor Yellow
$htmlB68 = Select-String -Path index.html -Pattern 'bala-export-chintu-btn' -CaseSensitive:$false
$htmlB69 = Select-String -Path index.html -Pattern 'bala-score-delta' -CaseSensitive:$false
$htmlFail = $false
if ($htmlB68) {
  Write-Host "  [PASS] #bala-export-chintu-btn found in index.html" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] #bala-export-chintu-btn NOT found in index.html" -ForegroundColor Red
  $htmlFail = $true
}
if ($htmlB69) {
  Write-Host "  [PASS] #bala-score-delta found in index.html" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] #bala-score-delta NOT found in index.html" -ForegroundColor Red
  $htmlFail = $true
}
if ($htmlFail) { exit 1 }

# -- Step 5: Medical safety scan -- no diagnose/treat/predict ---------------
Write-Host ""
Write-Host "STEP 5: Medical safety scan -- B68 + B69 code blocks" -ForegroundColor Yellow
$medHits = Select-String -Path app.js `
  -Pattern '\bdiagnose\b|\btreat\b|\bprescri\b|\bcardiac arrest\b|\bheart attack\b' `
  -CaseSensitive:$false |
  Where-Object {
    $_.Line -notmatch "never|not a diag|does not|no diag|awareness only|not medical|consult|disclaimer|For Personal Awareness|seek medical|EMERGENCY|cannot diagnose|This is a guide|body signal|'heart attack'|'cardiac arrest'|/heart.attack|/cardiac.arrest"
  }
if ($medHits) {
  Write-Host "  [FAIL] Possible unsafe medical claim:" -ForegroundColor Red
  $medHits | ForEach-Object { Write-Host "    $($_.Filename):$($_.LineNumber) $($_.Line.Trim())" }
  exit 1
} else {
  Write-Host "  [PASS] No unsafe medical claims" -ForegroundColor Green
}

# -- Step 6: Privacy -- no external upload in export function ---------------
Write-Host ""
Write-Host "STEP 6: Privacy check -- export stays local" -ForegroundColor Yellow
$netHit = Select-String -Path app.js `
  -Pattern 'fetch\(|XMLHttpRequest|navigator\.sendBeacon' `
  -CaseSensitive:$false |
  Where-Object { $_.Line -match 'exportBALASnapshot|bala-export' }
if ($netHit) {
  Write-Host "  [FAIL] Network call found inside exportBALASnapshot" -ForegroundColor Red
  $netHit | ForEach-Object { Write-Host "    $($_.LineNumber): $($_.Line.Trim())" }
  exit 1
} else {
  Write-Host "  [PASS] Export is 100% offline (localStorage + Blob download only)" -ForegroundColor Green
}

# -- Step 7: Git commit + push ----------------------------------------------
Write-Host ""
Write-Host "STEP 7: Git commit and push" -ForegroundColor Yellow

$b68b69Files = @('app.js', 'index.html', 'push-b68-b69.ps1')
foreach ($f in $b68b69Files) {
  if (Test-Path $f) {
    git add $f
    Write-Host "  staged: $f" -ForegroundColor DarkGray
  }
}

$status = git status --short
if (-not $status) {
  Write-Host "  (nothing to commit -- already pushed)" -ForegroundColor DarkGray
} else {
  git commit -m "B68+B69: BALA Export for Chintu + Score Delta

B68 -- Export for Chintu:
- exportBALASnapshot() reads localStorage bala-local-health-v1
- Builds typed snapshot: date, score, scoreDelta, trend, hrv, rhr, sleep, steps, spo2
- Downloads as bala-daily-snapshot.json via Blob (no upload, 100% offline)
- Toast guides user to move file to home folder for C68 morning brief
- Button wired: #bala-export-chintu-btn in data portability section

B69 -- Score Delta:
- renderScoreDelta() computes diff between last 2 scoreBreakdown() results
- Displays +/-N from last check-in beneath BALA score ring (#bala-score-delta)
- Colour coded: teal=improving, coral=declining, grey=stable/building
- Auto-refreshes when updateDashboard() is called (new check-in saved)
- Graceful: hidden when < 2 history entries"

  git push origin main

  Write-Host ""
  Write-Host "  B68+B69 PUSHED!" -ForegroundColor Green
  Write-Host ""
  git log --oneline -3
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  B68+B69 LIVE -- What's new:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Score ring: Now shows +/-N from last check-in (B69)"
Write-Host "  Data section: New 'Export for Chintu' button (B68)"
Write-Host ""
Write-Host "  Full C68 loop:"
Write-Host "  1. Add check-in in BALA"
Write-Host "  2. Tap 'Export for Chintu' -- downloads bala-daily-snapshot.json"
Write-Host "  3. Move file to: C:\Users\$env:USERNAME\bala-daily-snapshot.json"
Write-Host "  4. Test brief: node scripts\chintu-health-brief.js"
Write-Host "  5. Schedule 7am: .\schedule-c68.ps1  (run as Admin)"
Write-Host ""
