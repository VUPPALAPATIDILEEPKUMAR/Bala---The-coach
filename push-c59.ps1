# push-c59.ps1 -- C59: BALA Autonomous QA Agent
# Pure ASCII. Run from repo root.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "=== C59 push ===" -ForegroundColor Cyan

# 1. Syntax check the new script
Write-Host "`n[1] Syntax check chintu-qa-agent.js..."
$chk = & node --check scripts\chintu-qa-agent.js 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "[PASS] node --check scripts\chintu-qa-agent.js"
} else {
  Write-Host "[FAIL] syntax error:" -ForegroundColor Red
  Write-Host $chk
  exit 1
}

# 2. Add chintu-qa-agent.js to egress allowlist (idempotent)
Write-Host "`n[2] Updating egress allowlist..."
$ef = 'scripts\chintu-no-network-egress.test.js'
$ec = Get-Content $ef -Raw
if ($ec -notmatch "'chintu-qa-agent\.js'") {
  $ec = $ec -replace "  'chintu-voice-out\.js',", "  'chintu-voice-out.js',`n  // C59: QA agent -- calls api.groq.com for diagnosis + ntfy/Telegram alerts`n  'chintu-qa-agent.js',"
  Set-Content $ef $ec -NoNewline
  git add $ef
  Write-Host "[PASS] Added chintu-qa-agent.js to allowlist"
} else {
  Write-Host "[PASS] Already in allowlist (skipped)"
}

# 3. Run egress test
Write-Host "`n[3] Running egress test..."
$egress = & node scripts\chintu-no-network-egress.test.js 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "[PASS] chintu-no-network-egress.test.js"
} else {
  Write-Host "[FAIL] egress test:" -ForegroundColor Red
  Write-Host $egress
  exit 1
}

# 4. Stage files
Write-Host "`n[4] Staging files..."
git add scripts\chintu-qa-agent.js push-c59.ps1
Write-Host "[PASS] git add done"

# 5. Commit
Write-Host "`n[5] Committing..."
git commit -m "C59: BALA Autonomous QA Agent -- health checks + Groq diagnosis + Telegram alert"
Write-Host "[PASS] Committed"

# 6. Push
Write-Host "`n[6] Pushing to origin main..."
git push origin main
Write-Host "[PASS] Pushed"

Write-Host "`n=== C59 done ===" -ForegroundColor Green
