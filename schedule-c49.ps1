# schedule-c49.ps1
# C49 -- Register Chintu Autonomous Brain as a Windows Task Scheduler task.
# Runs daily at 07:00 AM. Catches missed runs (StartWhenAvailable).
# Requires: CHINTU_GROQ_API_KEY stored via setup-env-c49.ps1

$repoPath  = "C:\Users\Chintu\Desktop\test"
$taskName  = "ChintuAutonomousBrain"
$taskPath  = "\Chintu\"

Write-Host ""
Write-Host "Chintu C49 -- Task Scheduler Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Find node.exe
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Host "ERROR: node.exe not found in PATH. Install Node.js from nodejs.org first." -ForegroundColor Red
    exit 1
}
Write-Host "  node.exe: $nodePath" -ForegroundColor Gray

# Verify env var is set
$apiKey = [System.Environment]::GetEnvironmentVariable("CHINTU_GROQ_API_KEY", "User")
if (-not $apiKey) {
    Write-Host "WARNING: CHINTU_GROQ_API_KEY not set in user environment." -ForegroundColor Yellow
    Write-Host "Run .\setup-env-c49.ps1 first to store your Groq key permanently." -ForegroundColor Yellow
    Write-Host "Continuing anyway -- brain will run in dry-run mode until key is set." -ForegroundColor Gray
}

# Remove old task if exists
Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false -ErrorAction SilentlyContinue

# Action: run node scripts\chintu-autonomous-brain.js from repo root
$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "scripts\chintu-autonomous-brain.js" `
    -WorkingDirectory $repoPath

# Trigger: daily at 7am
$trigger = New-ScheduledTaskTrigger -Daily -At "07:00AM"

# Settings: start-when-available (catches missed runs if PC was off at 7am)
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable $true `
    -RunOnlyIfNetworkAvailable $false `
    -DisallowStartIfOnBatteries $false

# Principal: run as current user, only when logged in (inherits user env vars incl. CHINTU_GROQ_API_KEY)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

# Register
Register-ScheduledTask `
    -TaskName $taskName `
    -TaskPath $taskPath `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Chintu Autonomous Brain C49 -- AI-planned daily audit at 07:00 AM. Reads repo, calls Groq free LLM, executes safe commands, commits, sends ntfy push." `
    -Force | Out-Null

Write-Host ""
Write-Host "Task registered:" -ForegroundColor Green
Write-Host "  Name:    $taskPath$taskName" -ForegroundColor Cyan
Write-Host "  Runs:    Daily at 07:00 AM (catches missed runs automatically)" -ForegroundColor Cyan
Write-Host "  Node:    $nodePath" -ForegroundColor Cyan
Write-Host "  Repo:    $repoPath" -ForegroundColor Cyan
Write-Host "  Mode:    LIVE (uses CHINTU_GROQ_API_KEY from Windows Registry)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test it right now:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName '$taskName' -TaskPath '$taskPath'" -ForegroundColor Yellow
Write-Host ""
Write-Host "Check last run log:" -ForegroundColor Yellow
Write-Host "  node scripts\chintu-autonomous-brain.js --status" -ForegroundColor Yellow
Write-Host ""
Write-Host "View in Task Scheduler UI:" -ForegroundColor Gray
Write-Host "  taskschd.msc  ->  Task Scheduler Library -> Chintu" -ForegroundColor Gray
Write-Host ""
Write-Host "Disable (keep registered):" -ForegroundColor Gray
Write-Host "  Disable-ScheduledTask -TaskName '$taskName' -TaskPath '$taskPath'" -ForegroundColor Gray
Write-Host ""
Write-Host "Remove completely:" -ForegroundColor Gray
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -TaskPath '$taskPath' -Confirm:`$false" -ForegroundColor Gray
