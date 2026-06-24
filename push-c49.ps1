# push-c49.ps1
# C49 -- Commit and push: beast mode SAFE_COMMANDS + Task Scheduler setup
# Files: scripts/chintu-autonomous-brain.js, setup-env-c49.ps1, schedule-c49.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Chintu C49 push -- Jarvis Mode" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Clear any stale locks
$lock = ".git\index.lock"
if (Test-Path $lock) { Remove-Item $lock -Force; Write-Host "  Cleared index.lock" -ForegroundColor Yellow }
$lock2 = ".git\MERGE_HEAD"
if (Test-Path $lock2) { Remove-Item $lock2 -Force }

# Syntax check the brain first
Write-Host ""
Write-Host "Syntax check..." -ForegroundColor Yellow
node --check scripts\chintu-autonomous-brain.js
if ($LASTEXITCODE -ne 0) { Write-Host "ABORT: syntax error in brain" -ForegroundColor Red; exit 1 }
Write-Host "  chintu-autonomous-brain.js -- OK" -ForegroundColor Green

# Run safety tests
Write-Host ""
Write-Host "Safety tests..." -ForegroundColor Yellow
node scripts\chintu-no-network-egress.test.js
if ($LASTEXITCODE -ne 0) { Write-Host "ABORT: egress test failed" -ForegroundColor Red; exit 1 }
node scripts\chintu-medical-claims.test.js
if ($LASTEXITCODE -ne 0) { Write-Host "ABORT: medical claims test failed" -ForegroundColor Red; exit 1 }
node -e "require('./scripts/chintu-skill-contracts.js'); console.log('skill-contracts: PASS')"
if ($LASTEXITCODE -ne 0) { Write-Host "ABORT: skill-contracts failed" -ForegroundColor Red; exit 1 }

# Stage C49 files
Write-Host ""
Write-Host "Staging C49 files..." -ForegroundColor Yellow
git add scripts/chintu-autonomous-brain.js
git add setup-env-c49.ps1
git add schedule-c49.ps1
git add push-c49.ps1

Write-Host ""
git status --short

Write-Host ""
Write-Host "Staged for C49:" -ForegroundColor Cyan
Write-Host "  scripts/chintu-autonomous-brain.js  -- 14 beast mode SAFE_COMMANDS (C49 expanded)" -ForegroundColor Gray
Write-Host "  setup-env-c49.ps1                  -- permanent Groq key in Windows Registry" -ForegroundColor Gray
Write-Host "  schedule-c49.ps1                   -- Windows Task Scheduler, 7am daily" -ForegroundColor Gray
Write-Host "  push-c49.ps1                       -- this push script" -ForegroundColor Gray

# Commit
Write-Host ""
git commit -m "C49: Jarvis mode -- beast SAFE_COMMANDS, Task Scheduler, permanent env vars"
if ($LASTEXITCODE -ne 0) { Write-Host "Commit failed" -ForegroundColor Red; exit 1 }

# Push
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Push failed -- check auth" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "PUSHED! C49 live on GitHub." -ForegroundColor Green
Write-Host ""
Write-Host "C49 is live. What Chintu can now do autonomously:" -ForegroundColor Cyan
Write-Host "  14 safe commands -- git, tests, syntax checks, inventory, resume context" -ForegroundColor Gray
Write-Host "  Brain reads repo daily at 7am (after setup + schedule scripts)" -ForegroundColor Gray
Write-Host "  Groq LLM plans the best audit from 14 options, not just 8" -ForegroundColor Gray
Write-Host ""
Write-Host "Next: run .\setup-env-c49.ps1 then .\schedule-c49.ps1 to arm the 7am task" -ForegroundColor Yellow
Write-Host ""
git log --oneline -3
