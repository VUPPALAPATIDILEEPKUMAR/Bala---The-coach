# push-c58.ps1 -- C58: Groq Vision + clipboard tools
# Pure ASCII. Steps: syntax check, egress test, git add/commit/push.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "C58 push sequence starting..."
Write-Host ""

# Step 1: JS syntax check
Write-Host "[1/5] Syntax check: scripts\chintu-groq-tools.js"
node --check scripts\chintu-groq-tools.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Syntax check failed. Aborting."
    exit 1
}
Write-Host "[PASS] Syntax OK"
Write-Host ""

# Step 2: Egress test
Write-Host "[2/5] Running egress test..."
node scripts\chintu-no-network-egress.test.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Egress test failed. Aborting."
    exit 1
}
Write-Host "[PASS] Egress test passed"
Write-Host ""

# Step 3: git add
Write-Host "[3/5] Staging files..."
git add scripts\chintu-groq-tools.js scripts\chintu-no-network-egress.test.js push-c58.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] git add failed."
    exit 1
}
Write-Host "[PASS] Files staged"
Write-Host ""

# Step 4: git commit
Write-Host "[4/5] Committing..."
git commit -m "C58: Groq Vision + clipboard -- analyze_screenshot + read_clipboard tools"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] git commit failed."
    exit 1
}
Write-Host "[PASS] Committed"
Write-Host ""

# Step 5: git push
Write-Host "[5/5] Pushing to origin main..."
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] git push failed."
    exit 1
}
Write-Host "[PASS] Pushed to origin main"
Write-Host ""
Write-Host "C58 shipped: analyze_screenshot + read_clipboard live."
