# push-c68.ps1 -- C68: Chintu Morning Health Brief
#
# Reads ~/bala-daily-snapshot.json (exported from BALA via B68 button).
# Calls Groq llama-3.3-70b-versatile for a warm 2-3 paragraph brief.
# Sends via Telegram every morning. Always exits 0 (Task Scheduler safe).
#
# Required env vars (existing Chintu setup):
#   TELEGRAM_TOKEN + TELEGRAM_CHAT_ID  -- Telegram delivery
#   GROQ_KEY or GROQ_API_KEY           -- AI brief (optional, falls back)
#
# Privacy: health values never logged. No external upload of data.
# Egress: api.groq.com (AI brief), api.telegram.org (send only)
#
# Usage: .\push-c68.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C68: Chintu Morning Health Brief" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# -- Step 1: Syntax check ---------------------------------------------------
Write-Host "STEP 1: Syntax check -- chintu-health-brief.js" -ForegroundColor Yellow
$result = node --check scripts\chintu-health-brief.js 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  [PASS] chintu-health-brief.js syntax OK" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] Syntax error:" -ForegroundColor Red
  Write-Host $result
  exit 1
}

# -- Step 2: Egress allowlist test ------------------------------------------
Write-Host ""
Write-Host "STEP 2: No-network-egress safety scan" -ForegroundColor Yellow
$result = node scripts\chintu-no-network-egress.test.js 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "  [PASS] $result" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] Egress scan failed:" -ForegroundColor Red
  Write-Host $result
  exit 1
}

# -- Step 3: Medical safety check in health brief ---------------------------
Write-Host ""
Write-Host "STEP 3: Medical safety check -- chintu-health-brief.js" -ForegroundColor Yellow
$medHits = Select-String -Path scripts\chintu-health-brief.js `
  -Pattern '\bdiagnose\b|\btreat\b|\bprescri\b|\bcardiac arrest\b|\bheart attack\b' `
  -CaseSensitive:$false |
  Where-Object { $_.Line -notmatch 'never|NEVER|not a diag|awareness only|not medical|emergency care' }
if ($medHits) {
  Write-Host "  [FAIL] Possible unsafe medical language:" -ForegroundColor Red
  $medHits | ForEach-Object { Write-Host "    $($_.LineNumber): $($_.Line.Trim())" }
  exit 1
} else {
  Write-Host "  [PASS] No unsafe medical claims" -ForegroundColor Green
}

# -- Step 4: Privacy guard -- health values not logged ----------------------
Write-Host ""
Write-Host "STEP 4: Privacy guard -- health values not printed to console" -ForegroundColor Yellow
$privacyHits = Select-String -Path scripts\chintu-health-brief.js `
  -Pattern 'console\.(log|warn|error).*\b(hrv|rhr|sleep|steps|spo2|score)\b' `
  -CaseSensitive:$false
if ($privacyHits) {
  Write-Host "  [FAIL] Health values logged to console:" -ForegroundColor Red
  $privacyHits | ForEach-Object { Write-Host "    $($_.LineNumber): $($_.Line.Trim())" }
  exit 1
} else {
  Write-Host "  [PASS] No health values logged to console" -ForegroundColor Green
}

# -- Step 5: Env gate check -- token never printed --------------------------
Write-Host ""
Write-Host "STEP 5: Token gate check -- TELEGRAM_TOKEN never printed" -ForegroundColor Yellow
$tokenHits = Select-String -Path scripts\chintu-health-brief.js `
  -Pattern 'console\.(log|warn|error).*TELEGRAM_TOKEN|console\.(log|warn|error).*GROQ' `
  -CaseSensitive:$false
if ($tokenHits) {
  Write-Host "  [FAIL] Token printed to console" -ForegroundColor Red
  exit 1
} else {
  Write-Host "  [PASS] Tokens not logged" -ForegroundColor Green
}

# -- Step 6: Git commit + push ----------------------------------------------
Write-Host ""
Write-Host "STEP 6: Git commit and push" -ForegroundColor Yellow

$c68Files = @(
  'scripts\chintu-health-brief.js',
  'scripts\chintu-no-network-egress.test.js',
  'push-c68.ps1'
)
foreach ($f in $c68Files) {
  if (Test-Path $f) {
    git add $f
    Write-Host "  staged: $f" -ForegroundColor DarkGray
  }
}

$status = git status --short
if (-not $status) {
  Write-Host "  (nothing to commit -- already pushed)" -ForegroundColor DarkGray
} else {
  git commit -m "C68: Chintu Morning Health Brief -- Groq + Telegram

Reads ~/bala-daily-snapshot.json exported from BALA app (B68 button).
Calls Groq llama-3.3-70b-versatile for warm 2-3 paragraph brief.
Sends HTML-formatted message via Telegram every morning at 7am.

Safety: NEVER diagnose/prescribe/predict. Safe language only.
Privacy: health values never logged. No external upload.
Fallback: plain-text digest if Groq unavailable.
Nudge: sends setup instructions if snapshot file not found.
Always exits 0 -- safe for Windows Task Scheduler."

  git push origin main

  Write-Host ""
  Write-Host "  C68 PUSHED!" -ForegroundColor Green
  Write-Host ""
  git log --oneline -3
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C68 LIVE -- Next steps:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Run .\schedule-c68.ps1 (as Admin) to register 7am daily task"
Write-Host "  2. Open BALA, add a check-in, tap 'Export for Chintu'"
Write-Host "  3. Move bala-daily-snapshot.json to your home folder"
Write-Host "  4. Test now: node scripts\chintu-health-brief.js"
Write-Host ""
