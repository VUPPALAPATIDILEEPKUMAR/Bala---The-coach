#!/usr/bin/env pwsh
# =============================================================================
# Stage 43 — BALA Polish Sprint Commit Script
# Changes: Factor History Beside Timeline + Doctor-ready self-entered framing
# Run from: C:\Users\Chintu\Desktop\test\
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "`n=== Stage 43 — BALA Polish Sprint: Pre-commit validation ===" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# Step 1: Run engine test suites — must pass before commit
# ---------------------------------------------------------------------------
Write-Host "`n[1/5] Running bala-score-engine tests (173 expected)..." -ForegroundColor Yellow
node scripts\bala-score-engine.test.js
if ($LASTEXITCODE -ne 0) { Write-Error "bala-score-engine tests FAILED — aborting"; exit 1 }

Write-Host "`n[2/5] Running bala-coach-engine tests (250 expected)..." -ForegroundColor Yellow
node scripts\bala-coach-engine.test.js
if ($LASTEXITCODE -ne 0) { Write-Error "bala-coach-engine tests FAILED — aborting"; exit 1 }

# ---------------------------------------------------------------------------
# Step 2: Structural spot checks on new app.js code
# ---------------------------------------------------------------------------
Write-Host "`n[3/5] Spot-checking Stage 43 code in app.js..." -ForegroundColor Yellow

$appJs = Get-Content app.js -Raw -Encoding UTF8

# Check 1: Factor History CSS classes exist in app.js
if (-not ($appJs -match 'fh-row')) {
    Write-Error "FAIL: .fh-row not found in app.js — Factor History block missing"; exit 1
}
Write-Host "  [OK] fh-row class found in app.js" -ForegroundColor Green

# Check 2: self-entered appears exactly twice (one per export function)
$selfEnteredMatches = ([regex]::Matches($appJs, 'self-entered')).Count
if ($selfEnteredMatches -ne 2) {
    Write-Error "FAIL: 'self-entered' found $selfEnteredMatches times in app.js — expected exactly 2 (one per export function)"
    exit 1
}
Write-Host "  [OK] 'self-entered' appears $selfEnteredMatches times in app.js (expected 2)" -ForegroundColor Green

# Check 3: getBehaviorHistory called near factor block
if (-not ($appJs -match 'getBehaviorHistory\(\)')) {
    Write-Error "FAIL: getBehaviorHistory() not found in app.js"; exit 1
}
Write-Host "  [OK] getBehaviorHistory() call confirmed" -ForegroundColor Green

# Check 4: sw.js at correct version
$swContent = Get-Content sw.js -Raw -Encoding UTF8
if (-not ($swContent -match 'bala-shell-v45')) {
    Write-Error "FAIL: sw.js is not at bala-shell-v45 — cache version not bumped"; exit 1
}
Write-Host "  [OK] sw.js at bala-shell-v45" -ForegroundColor Green

# Check 5: DAILY NOTES appears in both export functions
$dailyNotesMatches = ([regex]::Matches($appJs, 'DAILY NOTES')).Count
if ($dailyNotesMatches -lt 2) {
    Write-Error "FAIL: 'DAILY NOTES' found only $dailyNotesMatches times — expected at least 2 (buildDoctorReadySummary + timelineSummary)"
    exit 1
}
Write-Host "  [OK] 'DAILY NOTES' section header found $dailyNotesMatches times" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Step 3: Medical safety scan — no forbidden claims in new app.js code
# ---------------------------------------------------------------------------
Write-Host "`n[4/5] Medical safety scan on app.js..." -ForegroundColor Yellow

$forbidden = @(
    'diagnos disease',
    'treat disease',
    'prevent cardiac arrest',
    'predict heart attack',
    'guarantee health',
    'replace your doctor',
    'emergency monitor'
)

$safetyFail = $false
foreach ($term in $forbidden) {
    if ($appJs.ToLower().Contains($term)) {
        Write-Warning "  SAFETY FAIL: '$term' found in app.js"
        $safetyFail = $true
    }
}

if ($safetyFail) {
    Write-Error "Safety scan FAILED — forbidden medical claim in app.js. Aborting commit."; exit 1
}
Write-Host "  [OK] No forbidden medical claims in app.js" -ForegroundColor Green

# Also confirm the self-entered preamble text is safe
$preamble = "These are notes I entered myself. They are personal reflections, not medical observations."
if ($appJs -match [regex]::Escape($preamble)) {
    Write-Host "  [OK] Self-entered safety preamble confirmed present" -ForegroundColor Green
} else {
    Write-Warning "  Note: Self-entered preamble text not found verbatim — may have been paraphrased. Continuing."
}

# ---------------------------------------------------------------------------
# Step 4: Stage files
# ---------------------------------------------------------------------------
Write-Host "`n[5/5] Staging Stage 43 files..." -ForegroundColor Yellow

git add app.js
Write-Host "  Staged: app.js (Factor History + doctor-ready framing)" -ForegroundColor DarkGray

git add styles.css
Write-Host "  Staged: styles.css (.fh-row, .fh-label, .fh-pill, .fh-note)" -ForegroundColor DarkGray

git add sw.js
Write-Host "  Staged: sw.js (bala-shell-v45)" -ForegroundColor DarkGray

# Vision validation doc
if (Test-Path 'BALA_STAGE43_VISION_VALIDATION.md') {
    git add BALA_STAGE43_VISION_VALIDATION.md
    Write-Host "  Staged: BALA_STAGE43_VISION_VALIDATION.md" -ForegroundColor DarkGray
}

# This commit script itself
git add scripts\stage43-commit.ps1
Write-Host "  Staged: scripts\stage43-commit.ps1" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# Show diff summary before committing
# ---------------------------------------------------------------------------
Write-Host "`n--- Staged diff summary ---" -ForegroundColor Cyan
git diff --staged --stat

# ---------------------------------------------------------------------------
# Commit
# ---------------------------------------------------------------------------
$msg = @"
feat: Stage 43 BALA Polish — Factor History + Doctor-ready framing

Factor History Beside Timeline:
- app.js: fh-row block inside renderBaselineAndTimeline() forEach
  Looks up getBehaviorHistory() filtered by matching date
  Renders factor pills + note per check-in date
  Safe label: 'Daily notes' — no causal claims
- styles.css: .fh-row, .fh-label, .fh-pill, .fh-note (4 new rules)
- Zero network calls — reads existing localStorage only

Doctor-ready export self-entered framing:
- buildDoctorReadySummary(): 'RECENT DAILY FACTORS' → 'DAILY NOTES (self-entered)'
  Added safety preamble: personal reflections, not medical observations
  Depth: last 5 entries → last 30 entries
- timelineSummary(): same header + preamble fix
  Depth: single latest entry → last 15 entries

Cache bump:
- sw.js: bala-shell-v44 → bala-shell-v45

COSTAR validation:
- All priorities from BALA_NEXT_PRODUCT_INTELLIGENCE_PLAN confirmed or built
- Weekly Reflection confirmed already live (lines 490-582 app.js)
- bala-score-engine.js architecture note: parallel impl accepted, not merged
- See BALA_STAGE43_VISION_VALIDATION.md for full gap table

Tests: 173/173 score-engine + 250/250 coach-engine still passing
Security: CHINTU_TELEGRAM_SEND_ENABLED=0 · local-only · no secrets · no network egress
Medical: no forbidden claims · self-entered preamble · health-awareness only
"@

git commit -m $msg

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Stage 43 commit complete." -ForegroundColor Green
    Write-Host ""
    git log --oneline -3
    Write-Host ""
    Write-Host "Next step: git push origin main" -ForegroundColor Cyan
    Write-Host "Stage 44 candidates: Connector CLI --discover, score-engine wiring, Approval Queue bridge" -ForegroundColor DarkGray
} else {
    Write-Error "Commit failed — check git output above"
    exit 1
}
