# push-c61.ps1 -- C61: Morning brief upgrade (Groq tools chain: weather + deals + prefs)
# Pure ASCII. Run from repo root.

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== C61 Push Script ==="
Write-Host ""

# Step 1: Syntax check
Write-Host "Step 1: Syntax check..."
$syntaxResult = node --check scripts\chintu-bala-morning-digest.js 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] scripts\chintu-bala-morning-digest.js syntax OK"
} else {
    Write-Host "[FAIL] Syntax error:"
    Write-Host $syntaxResult
    exit 1
}

# Step 2: Egress test
Write-Host ""
Write-Host "Step 2: Egress test..."
$egressResult = node scripts\chintu-no-network-egress.test.js 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] No network egress violations"
} else {
    Write-Host "[FAIL] Egress test failed:"
    Write-Host $egressResult
    exit 1
}

# Step 3: git add
Write-Host ""
Write-Host "Step 3: git add..."
git add scripts\chintu-bala-morning-digest.js push-c61.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] git add failed"
    exit 1
}
Write-Host "[PASS] Files staged"

# Step 4: git commit
Write-Host ""
Write-Host "Step 4: git commit..."
git commit -m "C61: Morning brief upgrade -- Groq tools chain (weather + deals + prefs)"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] git commit failed"
    exit 1
}
Write-Host "[PASS] Committed"

# Step 5: git push
Write-Host ""
Write-Host "Step 5: git push..."
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] git push failed"
    exit 1
}
Write-Host "[PASS] Pushed to origin/main"

Write-Host ""
Write-Host "=== C61 push complete ==="
