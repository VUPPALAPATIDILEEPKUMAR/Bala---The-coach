# push-c63.ps1 -- C63: Health watchdog -- syntax check, egress test, commit, push
Set-Location 'C:\Users\Chintu\Desktop\test'

# 1. Syntax check
Write-Host "1. Syntax check..."
$r = node --check scripts\chintu-health-watchdog.js
if ($LASTEXITCODE -ne 0) { Write-Error "Syntax check FAILED"; exit 1 }
Write-Host "   PASS"

# 2. Egress test
Write-Host "2. Egress test..."
node scripts\chintu-no-network-egress.test.js
if ($LASTEXITCODE -ne 0) { Write-Error "Egress test FAILED"; exit 1 }
Write-Host "   PASS"

# 3. Git commit and push
Write-Host "3. Git..."
git add scripts\chintu-health-watchdog.js scripts\chintu-no-network-egress.test.js push-c63.ps1 schedule-c63.ps1
git commit -m "C63: Health watchdog -- silent 2hr checks, ntfy alert on failure"
git push origin main
Write-Host "C63 done."
