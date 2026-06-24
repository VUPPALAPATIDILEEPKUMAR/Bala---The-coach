# schedule-c51.ps1
# C51 -- Boot-resilient Telegram Poll Task Scheduler setup.
#
# Registers \Chintu\ChintuTelegramPoll with TWO triggers:
#   Trigger 1: repeat every 1 minute (normal polling)
#   Trigger 2: fire at logon (fires within seconds after restart/reboot)
#
# Combined: bridge comes back automatically within ~1 min of any restart.
# StartWhenAvailable catches any missed runs during sleep/offline periods.
#
# Replaces schedule-c50.ps1 -- run this to upgrade the task.
# MUST RUN AS ADMINISTRATOR (for \Chintu\ task folder).
# Right-click PowerShell -> "Run as Administrator", then: .\schedule-c51.ps1

$ErrorActionPreference = "Stop"

$repoPath  = "C:\Users\Chintu\Desktop\test"
$taskName  = "ChintuTelegramPoll"
$taskPath  = "\Chintu\"

Write-Host ""
Write-Host "Chintu C51 -- Task Scheduler Setup (Boot-Resilient)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
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

# Verify new C51 script exists
$pollScript  = Join-Path $repoPath "scripts\chintu-telegram-poll.js"
$sendScript  = Join-Path $repoPath "scripts\chintu-send-telegram.js"
if (-not (Test-Path $pollScript)) {
    Write-Host "ERROR: $pollScript not found. Run push-c51.ps1 first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $sendScript)) {
    Write-Host "WARNING: $sendScript missing -- morning push won't work until C51 is pushed." -ForegroundColor Yellow
}

# Check env vars are configured
$token     = [System.Environment]::GetEnvironmentVariable("TELEGRAM_BOT_TOKEN",               "User")
$chatIds   = [System.Environment]::GetEnvironmentVariable("CHINTU_TELEGRAM_ALLOWED_CHAT_IDS", "User")
$sendFlag  = [System.Environment]::GetEnvironmentVariable("CHINTU_TELEGRAM_SEND_ENABLED",     "User")

if (-not $token) {
    Write-Host "WARNING: TELEGRAM_BOT_TOKEN not set -- run .\setup-c50.ps1 first" -ForegroundColor Yellow
}
if (-not $chatIds) {
    Write-Host "WARNING: CHINTU_TELEGRAM_ALLOWED_CHAT_IDS not set -- messages will be blocked" -ForegroundColor Yellow
}
if ($sendFlag -ne "1") {
    Write-Host "WARNING: CHINTU_TELEGRAM_SEND_ENABLED != 1 -- replies will be suppressed" -ForegroundColor Yellow
}

# Remove old task if exists (C50 or older)
Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "  Removed old task (if any)" -ForegroundColor Gray

# Action: run node scripts\chintu-telegram-poll.js from repo root
$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "scripts\chintu-telegram-poll.js" `
    -WorkingDirectory $repoPath

# ── Trigger 1: repeat every 1 minute indefinitely (normal operation) ────────
# Note: omitting RepetitionDuration defaults to indefinite on Windows 10/11
$triggerRepeat = New-ScheduledTaskTrigger `
    -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 1)

# ── Trigger 2: fire at every logon (boot/restart resilience) ────────────────
# When laptop restarts and user logs in -> task fires within seconds.
# Combined with Trigger 1, the 1-min polling resumes immediately after login.
$triggerLogon = New-ScheduledTaskTrigger `
    -AtLogon `
    -User $env:USERNAME

# Settings: start-when-available (catches missed runs during sleep/restart)
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

# Principal: run as current user (inherits token from Windows Registry)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

# Register with BOTH triggers
Register-ScheduledTask `
    -TaskName $taskName `
    -TaskPath $taskPath `
    -Action $action `
    -Trigger @($triggerRepeat, $triggerLogon) `
    -Settings $settings `
    -Principal $principal `
    -Description "Chintu C51 -- Telegram bridge. Polls every 1 min + fires at logon (boot resilient). SAFE_COMMANDS: 20 keys including push, diff, brain, digest. Requires TELEGRAM_BOT_TOKEN + CHINTU_TELEGRAM_SEND_ENABLED=1." `
    -Force | Out-Null

Write-Host ""
Write-Host "Task registered (C51 -- boot resilient)!" -ForegroundColor Green
Write-Host "  Name:      $taskPath$taskName" -ForegroundColor Cyan
Write-Host "  Trigger 1: every 1 minute (polling)" -ForegroundColor Cyan
Write-Host "  Trigger 2: at logon (restart resilience)" -ForegroundColor Cyan
Write-Host "  Node:      $nodePath" -ForegroundColor Cyan
Write-Host "  Repo:      $repoPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Start it now (no need to wait for next trigger):" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName '$taskName' -TaskPath '$taskPath'" -ForegroundColor Yellow
Write-Host ""
Write-Host "Verify it ran:" -ForegroundColor Yellow
Write-Host "  node scripts\chintu-telegram-poll.js --status" -ForegroundColor Yellow
Write-Host ""
Write-Host "Restart test:" -ForegroundColor Yellow
Write-Host "  Restart laptop -> log back in -> check Telegram for morning push" -ForegroundColor Gray
Write-Host "  (autonomous brain fires at 7am and sends digest to your phone)" -ForegroundColor Gray
Write-Host ""
Write-Host "C51 phone commands (text to your Telegram bot):" -ForegroundColor Cyan
Write-Host "  digest / morning   -- full digest (status + today + BALA)" -ForegroundColor White
Write-Host "  push / ship        -- commit + push tracked changes" -ForegroundColor White
Write-Host "  diff               -- what changed in last commit" -ForegroundColor White
Write-Host "  brain              -- run autonomous brain (dry-run)" -ForegroundColor White
Write-Host "  test / t           -- run all tests" -ForegroundColor White
Write-Host "  bala / bala audit  -- BALA health" -ForegroundColor White
Write-Host "  status / s         -- git status" -ForegroundColor White
Write-Host "  help               -- full command list" -ForegroundColor White
Write-Host ""
