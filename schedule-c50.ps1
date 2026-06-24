# schedule-c50.ps1
# C50 -- Register Chintu Telegram Poll as a Windows Task Scheduler task.
# Runs every 1 minute. Catches missed runs (StartWhenAvailable).
# Requires: TELEGRAM_BOT_TOKEN + CHINTU_TELEGRAM_ALLOWED_* stored via setup-c50.ps1
#
# MUST RUN AS ADMINISTRATOR (for \Chintu\ task folder creation).
# Right-click PowerShell -> "Run as Administrator", then: .\schedule-c50.ps1

$ErrorActionPreference = "Stop"

$repoPath  = "C:\Users\Chintu\Desktop\test"
$taskName  = "ChintuTelegramPoll"
$taskPath  = "\Chintu\"

Write-Host ""
Write-Host "Chintu C50 -- Task Scheduler Setup (Telegram Poll)" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Check running as Admin
$currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Must run as Administrator." -ForegroundColor Red
    Write-Host "Right-click PowerShell -> Run as Administrator, then rerun this script." -ForegroundColor Yellow
    exit 1
}

# Find node.exe
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Host "ERROR: node.exe not found in PATH. Install Node.js from nodejs.org first." -ForegroundColor Red
    exit 1
}
Write-Host "  node.exe: $nodePath" -ForegroundColor Gray

# Check env vars are configured
$token     = [System.Environment]::GetEnvironmentVariable("TELEGRAM_BOT_TOKEN",               "User")
$chatIds   = [System.Environment]::GetEnvironmentVariable("CHINTU_TELEGRAM_ALLOWED_CHAT_IDS", "User")
$sendFlag  = [System.Environment]::GetEnvironmentVariable("CHINTU_TELEGRAM_SEND_ENABLED",     "User")

if (-not $token) {
    Write-Host "WARNING: TELEGRAM_BOT_TOKEN not set." -ForegroundColor Yellow
    Write-Host "Run .\setup-c50.ps1 first to store your bot token." -ForegroundColor Yellow
    Write-Host "Continuing -- poll script will exit with error until token is configured." -ForegroundColor Gray
}
if (-not $chatIds) {
    Write-Host "WARNING: CHINTU_TELEGRAM_ALLOWED_CHAT_IDS not set." -ForegroundColor Yellow
    Write-Host "All incoming messages will be blocked until allowlist is configured." -ForegroundColor Gray
}
if ($sendFlag -ne "1") {
    Write-Host "WARNING: CHINTU_TELEGRAM_SEND_ENABLED is not 1 -- replies will be logged but not sent." -ForegroundColor Yellow
}

# Remove old task if exists
Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "  Removed old task (if any)" -ForegroundColor Gray

# Action: run node scripts\chintu-telegram-poll.js from repo root
$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "scripts\chintu-telegram-poll.js" `
    -WorkingDirectory $repoPath

# Trigger: repeat every 1 minute, indefinitely
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 1) -Once -At (Get-Date)
# RepetitionDuration = TimeSpan.MaxValue means run forever
$trigger.RepetitionDuration = [System.TimeSpan]::MaxValue

# Settings: start-when-available, no timeout
# NOTE: -StartWhenAvailable is a SwitchParameter (no $true argument needed)
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

# Principal: run as current user (inherits TELEGRAM_BOT_TOKEN from Windows Registry)
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
    -Description "Chintu Telegram Poll C50 -- polls Telegram every 1 minute, executes SAFE_COMMANDS, replies to founder. Needs TELEGRAM_BOT_TOKEN + CHINTU_TELEGRAM_SEND_ENABLED=1." `
    -Force | Out-Null

Write-Host ""
Write-Host "Task registered!" -ForegroundColor Green
Write-Host "  Name:    $taskPath$taskName" -ForegroundColor Cyan
Write-Host "  Runs:    Every 1 minute (inherits user env vars)" -ForegroundColor Cyan
Write-Host "  Node:    $nodePath" -ForegroundColor Cyan
Write-Host "  Repo:    $repoPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Start it now (no need to wait for next trigger):" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName '$taskName' -TaskPath '$taskPath'" -ForegroundColor Yellow
Write-Host ""
Write-Host "Check it ran:" -ForegroundColor Yellow
Write-Host "  node scripts\chintu-telegram-poll.js --status" -ForegroundColor Yellow
Write-Host ""
Write-Host "View in Task Scheduler UI:" -ForegroundColor Gray
Write-Host "  taskschd.msc -> Task Scheduler Library -> Chintu -> $taskName" -ForegroundColor Gray
Write-Host ""
Write-Host "Pause all polling:" -ForegroundColor Gray
Write-Host "  Disable-ScheduledTask -TaskName '$taskName' -TaskPath '$taskPath'" -ForegroundColor Gray
Write-Host ""
Write-Host "Remove completely:" -ForegroundColor Gray
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -TaskPath '$taskPath' -Confirm:`$false" -ForegroundColor Gray
Write-Host ""
Write-Host "Test your bot right now -- send any of these from Telegram:" -ForegroundColor Cyan
Write-Host "  help | status | git log | today | test | bala | count | scripts | resume" -ForegroundColor Gray
Write-Host ""
