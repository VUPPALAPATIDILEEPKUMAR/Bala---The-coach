# push-c67.ps1 -- C67: Chintu BALA bridge -- HTTP server on :7891, POST /coach with Groq + safety prompt
Set-Location 'C:\Users\Chintu\Desktop\test'

# 1. Syntax check
Write-Host "1. Syntax check..."
node --check scripts\chintu-bala-bridge.js
if ($LASTEXITCODE -ne 0) { Write-Error "Syntax check FAILED"; exit 1 }
Write-Host "   PASS"

# 2. API key guard -- no hardcoded keys allowed
Write-Host "2. API key guard..."
$hits = Select-String -Path scripts\chintu-bala-bridge.js -Pattern 'gsk_|sk-' -Quiet
if ($hits) { Write-Error "Hardcoded API key found in chintu-bala-bridge.js -- aborting"; exit 1 }
Write-Host "   PASS (no hardcoded keys)"

# 3. Egress allowlist -- add bala-bridge if not already present
Write-Host "3. Checking egress allowlist..."
$ef = 'scripts\chintu-no-network-egress.test.js'
$ec = Get-Content $ef -Raw
if ($ec -notmatch "'chintu-bala-bridge\.js'") {
  $ec = $ec -replace "  'chintu-voice-out\.js',", "  'chintu-voice-out.js',`n  // C67: BALA bridge HTTP server -- calls api.groq.com/openai on POST /coach (GROQ_KEY gated, 127.0.0.1 only)`n  'chintu-bala-bridge.js',"
  Set-Content $ef $ec -NoNewline
  git add $ef
  Write-Host "   Added to allowlist"
} else {
  Write-Host "   Already in allowlist"
}

# 4. Egress test
Write-Host "4. Egress test..."
node scripts\chintu-no-network-egress.test.js
if ($LASTEXITCODE -ne 0) { Write-Error "Egress test FAILED"; exit 1 }
Write-Host "   PASS"

# 5. Git commit and push
Write-Host "5. Git..."
git add scripts\chintu-bala-bridge.js push-c67.ps1
git commit -m "C67: Chintu BALA bridge -- HTTP server on :7891, POST /coach with Groq + safety prompt"
git push origin main
Write-Host "C67 done."
