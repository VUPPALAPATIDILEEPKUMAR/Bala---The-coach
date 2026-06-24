# push-c64.ps1 -- C64: Beast Mode tools -- run_node_code + write_file + list_directory + fetch_page
Set-Location 'C:\Users\Chintu\Desktop\test'

# 1. Syntax check
Write-Host "1. Syntax check..."
node --check scripts\chintu-groq-tools.js
if ($LASTEXITCODE -ne 0) { Write-Error "Syntax check FAILED"; exit 1 }
Write-Host "   PASS"

# 2. Egress test
Write-Host "2. Egress test..."
node scripts\chintu-no-network-egress.test.js
if ($LASTEXITCODE -ne 0) { Write-Error "Egress test FAILED"; exit 1 }
Write-Host "   PASS"

# 3. Git commit and push
Write-Host "3. Git..."
git add scripts\chintu-groq-tools.js push-c64.ps1
git commit -m "C64: Beast Mode tools -- run_node_code + write_file + list_directory + fetch_page"
git push origin main
Write-Host "C64 done."
