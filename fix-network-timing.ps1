# fix-network-timing.ps1 -- C70 hotfix
#
# Fixes "fetch failed" errors after Windows restart.
#
# ROOT CAUSE:
#   The ChintuTelegramPoll Task Scheduler task fires at logon before the
#   network adapter is ready. Node.js tries api.telegram.org -> fails ->
#   error appears as CHINTU_TELEGRAM_POLL_ERROR / fetch failed in logs.
#
# FIX:
#   1. Add RunOnlyIfNetworkAvailable = $true to task settings
#   2. Add 60-second delay to the AtLogon trigger (boot grace period)
#   3. Keep the VBS hidden launcher (no window flash)
#   4. Keep the 1-minute repeat trigger unchanged
#
# REQUIRES: Run as Administrator
# Usage: .\fix-network-timing.ps1

$ErrorActionPreference = 'Stop'

$repoRoot  = $PSScriptRoot
$taskName  = 'ChintuTelegramPoll'
$taskPath  = '\Chintu\'
$vbsPath   = Join-Path $repoRoot 'scripts\run-poll-hidden.vbs'

function Test-IsAdministrator {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-NetworkTimingConfigured {
  param([object]$Task)
  if (-not $Task) {
    return $false
  }
  if (-not $Task.Actions -or $Task.Actions.Count -lt 1) {
    return $false
  }
  $action = $Task.Actions[0]
  if ($action.Execute -notmatch 'wscript(\.exe)?$') {
    return $false
  }
  if ($action.Arguments -notmatch [Regex]::Escape($vbsPath)) {
    return $false
  }
  if (-not $Task.Settings.RunOnlyIfNetworkAvailable) {
    return $false
  }
  $logonTrigger = $Task.Triggers | Where-Object { $_.CimClass.CimClassName -match 'Logon' } | Select-Object -First 1
  if (-not $logonTrigger) {
    return $false
  }
  return $logonTrigger.Delay -eq 'PT60S'
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C70 Hotfix: Fix Network Timing on Boot" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Root cause: Task fires before network is ready at boot."
Write-Host "  Fix: RunOnlyIfNetworkAvailable + 60s AtLogon delay."
Write-Host ""

# -- Step 1: Verify VBS launcher exists --------------------------------------
Write-Host "STEP 1: Check VBS launcher exists" -ForegroundColor Yellow
if (-not (Test-Path $vbsPath)) {
  Write-Host "  [FAIL] VBS launcher not found at: $vbsPath" -ForegroundColor Red
  Write-Host "  Run fix-flash.ps1 first to create the VBS launcher." -ForegroundColor Red
  exit 1
}
Write-Host "  [PASS] VBS launcher found: $vbsPath" -ForegroundColor Green

# -- Step 2: Find existing task ----------------------------------------------
Write-Host ""
Write-Host "STEP 2: Find existing task" -ForegroundColor Yellow
$existing = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "  [PASS] Task found: $taskPath$taskName" -ForegroundColor Green
} else {
  Write-Host "  [WARN] Task not found -- will create fresh" -ForegroundColor Yellow
}

# -- Step 2b: Require elevation only when task needs changes -----------------
Write-Host ""
Write-Host "STEP 2b: Check elevation / current task state" -ForegroundColor Yellow
$isAdmin = Test-IsAdministrator
$alreadyConfigured = Test-NetworkTimingConfigured -Task $existing
if ($alreadyConfigured) {
  Write-Host "  [PASS] Network timing fix is already configured" -ForegroundColor Green
  if (-not $isAdmin) {
    Write-Host "  Current shell is not elevated, but no re-registration is needed." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  Network Timing Already Fixed" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    exit 0
  }
}
if (-not $isAdmin) {
  Write-Host "  [FAIL] Administrator rights are required to change Task Scheduler timing." -ForegroundColor Red
  Write-Host "  Re-run this script from Admin PowerShell to enable RunOnlyIfNetworkAvailable and the 60s logon delay." -ForegroundColor Yellow
  exit 1
}

# -- Step 3: Remove old task -------------------------------------------------
Write-Host ""
Write-Host "STEP 3: Remove old task" -ForegroundColor Yellow
Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "  [PASS] Old task removed (if existed)" -ForegroundColor Green

# -- Step 4: Re-register with network condition + boot delay -----------------
Write-Host ""
Write-Host "STEP 4: Re-register with network timing fix" -ForegroundColor Yellow

# Action: wscript.exe runs the VBS (silent -- no window flash)
$action = New-ScheduledTaskAction `
  -Execute 'wscript.exe' `
  -Argument "`"$vbsPath`"" `
  -WorkingDirectory $repoRoot

# Trigger 1: repeat every 1 minute indefinitely (unchanged)
$triggerRepeat = New-ScheduledTaskTrigger `
  -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 1)

# Trigger 2: AtLogon with 60-second delay (FIXED -- was firing too early)
$triggerLogon = New-ScheduledTaskTrigger `
  -AtLogon `
  -User $env:USERNAME
$triggerLogon.Delay = 'PT60S'   # ISO 8601: 60 seconds

# Settings -- KEY FIX: RunOnlyIfNetworkAvailable = $true
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit    (New-TimeSpan -Minutes 2) `
  -RestartCount          1 `
  -RestartInterval       (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable `
  -MultipleInstances     IgnoreNew `
  -RunOnlyIfNetworkAvailable

# Principal: run as current user
$principal = New-ScheduledTaskPrincipal `
  -UserId    $env:USERNAME `
  -LogonType Interactive `
  -RunLevel  Limited

Register-ScheduledTask `
  -TaskName    $taskName `
  -TaskPath    $taskPath `
  -Action      $action `
  -Trigger     @($triggerRepeat, $triggerLogon) `
  -Settings    $settings `
  -Principal   $principal `
  -Description "Chintu C70 -- Telegram poll. Silent VBS. Network-aware (no boot race). CHINTU_GROQ_API_KEY at Machine scope for brain." `
  -Force | Out-Null

# -- Step 5: Verify new settings ---------------------------------------------
Write-Host ""
Write-Host "STEP 5: Verify settings" -ForegroundColor Yellow
$updated = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
if ($updated) {
  $s = $updated.Settings
  Write-Host "  RunOnlyIfNetworkAvailable : $($s.RunOnlyIfNetworkAvailable)" -ForegroundColor DarkGray
  Write-Host "  Triggers                  : $($updated.Triggers.Count) (expect 2)" -ForegroundColor DarkGray
  $logonTrigger = $updated.Triggers | Where-Object { $_ -is [CimInstance] -and $_.CimClass.CimClassName -match 'Logon' }
  if ($logonTrigger) {
    Write-Host "  AtLogon delay             : $($logonTrigger.Delay)" -ForegroundColor DarkGray
  }
  if (Test-NetworkTimingConfigured -Task $updated) {
    Write-Host "  [PASS] Task re-registered with network fix" -ForegroundColor Green
    Write-Host "  [PASS] RunOnlyIfNetworkAvailable is true -- boot race fixed" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] Task settings do not match the expected network-safe configuration." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "  [FAIL] Task not found after re-registration" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Network Timing Fixed" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  BEFORE: Task fired at logon -> network not ready -> fetch failed x12"
Write-Host "  AFTER:  Task waits for network + 60s grace period -> clean start"
Write-Host ""
Write-Host "  Next restart: errors should be GONE."
Write-Host ""
Write-Host "  Still needed if brain shows 'offline':"
Write-Host "    [Environment]::SetEnvironmentVariable('CHINTU_GROQ_API_KEY','gsk_...','Machine')"
Write-Host "    Then restart." -ForegroundColor Yellow
Write-Host ""
