# fix-flash.ps1 -- C69: Fix flashing terminal window for ChintuTelegramPoll
#
# The Task Scheduler runs node.exe directly, which pops up a visible cmd window
# every minute and immediately closes it -- very distracting.
#
# Fix: Create a VBS launcher that runs node with window style 0 (completely hidden).
#      Re-register the ChintuTelegramPoll task to use wscript.exe + VBS instead.
#      Preserves all existing triggers (every 1 min + AtLogon boot resilience).
#
# REQUIRES: Run as Administrator
# Usage (Admin PowerShell): .\fix-flash.ps1

$ErrorActionPreference = 'Stop'

$repoRoot   = $PSScriptRoot
$taskName   = 'ChintuTelegramPoll'
$taskPath   = '\Chintu\'
$scriptPath = Join-Path $repoRoot 'scripts\chintu-telegram-poll.js'
$vbsPath    = Join-Path $repoRoot 'scripts\run-poll-hidden.vbs'

function Test-IsAdministrator {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-TaskUsesHiddenLauncher {
  param([object]$Task)
  if (-not $Task -or -not $Task.Actions -or $Task.Actions.Count -lt 1) {
    return $false
  }
  $taskAction = $Task.Actions[0]
  return (
    $taskAction.Execute -match 'wscript(\.exe)?$' -and
    $taskAction.Arguments -match [Regex]::Escape($vbsPath)
  )
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C69: Fix Flashing Telegram Poll Window" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# -- Step 1: Resolve node.exe path (PS5 compatible -- no ?. operator) -------
Write-Host "STEP 1: Find node.exe" -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCmd) { $nodeCmd.Source } else { 'node' }
Write-Host "  node: $nodeExe" -ForegroundColor DarkGray

# -- Step 2: Write VBS launcher (window style 0 = completely hidden) ---------
Write-Host ""
Write-Host "STEP 2: Write VBS hidden launcher" -ForegroundColor Yellow

$vbsContent = @"
' run-poll-hidden.vbs -- C69
' Runs chintu-telegram-poll.js silently (no terminal window).
' Called by Windows Task Scheduler every minute.
'
' Window style 0 = hidden (no window flash).
' bWaitOnReturn False = fire and forget.
Dim WshShell
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c """ & "$nodeExe" & """ """ & "$scriptPath" & """", 0, False
Set WshShell = Nothing
"@

$vbsContent | Out-File -FilePath $vbsPath -Encoding ASCII -Force
Write-Host "  [PASS] Written: $vbsPath" -ForegroundColor Green

# -- Step 3: Verify VBS file exists ------------------------------------------
Write-Host ""
Write-Host "STEP 3: Verify VBS file" -ForegroundColor Yellow
if (Test-Path $vbsPath) {
  Write-Host "  [PASS] VBS launcher exists: $vbsPath" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] VBS file not written" -ForegroundColor Red
  exit 1
}

# -- Step 4: Check existing task before modifying ----------------------------
Write-Host ""
Write-Host "STEP 4: Check existing ChintuTelegramPoll task" -ForegroundColor Yellow
$existingTask = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
if ($existingTask) {
  Write-Host "  Found existing task -- will update action to use VBS launcher" -ForegroundColor DarkGray
} else {
  Write-Host "  No existing task found -- will create fresh" -ForegroundColor DarkGray
}

# -- Step 4b: Require elevation only when task still needs changes ----------
Write-Host ""
Write-Host "STEP 4b: Check elevation / current task state" -ForegroundColor Yellow
$isAdmin = Test-IsAdministrator
$alreadyHidden = Test-TaskUsesHiddenLauncher -Task $existingTask
if ($alreadyHidden) {
  Write-Host "  [PASS] Task already uses wscript.exe + VBS hidden launcher" -ForegroundColor Green
  if (-not $isAdmin) {
    Write-Host "  Current shell is not elevated, but no re-registration is needed." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  C69 DONE -- Window flash already fixed" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  VBS launcher: $vbsPath"
    Write-Host "  Task:         $taskPath$taskName"
    Write-Host ""
    exit 0
  }
}
if (-not $isAdmin) {
  Write-Host "  [FAIL] Administrator rights are required to re-register Task Scheduler entries." -ForegroundColor Red
  Write-Host "  Re-run this script from Admin PowerShell only if the task still needs updating." -ForegroundColor Yellow
  exit 1
}

# -- Step 5: Remove old task -------------------------------------------------
Write-Host ""
Write-Host "STEP 5: Remove old task (to update action)" -ForegroundColor Yellow
Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "  [PASS] Old task removed (if existed)" -ForegroundColor Green

# -- Step 6: Re-register with VBS launcher (same triggers as C51) ------------
Write-Host ""
Write-Host "STEP 6: Re-register task with silent VBS launcher" -ForegroundColor Yellow

# Action: wscript.exe runs the VBS (hidden -- no window)
$action = New-ScheduledTaskAction `
  -Execute 'wscript.exe' `
  -Argument "`"$vbsPath`"" `
  -WorkingDirectory $repoRoot

# Trigger 1: repeat every 1 minute indefinitely
$triggerRepeat = New-ScheduledTaskTrigger `
  -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 1)

# Trigger 2: fire at every logon (boot/restart resilience)
$triggerLogon = New-ScheduledTaskTrigger `
  -AtLogon `
  -User $env:USERNAME

# Settings -- identical to original C51 task
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -RestartCount 1 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

# Principal: run as current user (inherits env vars from Windows Registry)
$principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName    $taskName `
  -TaskPath    $taskPath `
  -Action      $action `
  -Trigger     @($triggerRepeat, $triggerLogon) `
  -Settings    $settings `
  -Principal   $principal `
  -Description "Chintu C69 -- Telegram poll. Runs silently via VBS (no window flash). Every 1 min + AtLogon. CHINTU_GROQ_API_KEY must be set at Machine scope for brain chat." `
  -Force | Out-Null

# -- Step 7: Verify new action -----------------------------------------------
Write-Host ""
Write-Host "STEP 7: Verify new task action" -ForegroundColor Yellow
$updatedTask = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
if ($updatedTask) {
  $taskAction = $updatedTask.Actions[0]
  if (Test-TaskUsesHiddenLauncher -Task $updatedTask) {
    Write-Host "  [PASS] Task re-registered: $taskName (VBS launcher, silent)" -ForegroundColor Green
    Write-Host "  [PASS] Action uses wscript.exe + VBS (silent)" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] Action does not match the expected hidden launcher:" -ForegroundColor Red
    Write-Host "    Execute:   $($taskAction.Execute)"
    Write-Host "    Arguments: $($taskAction.Arguments)"
    exit 1
  }
  Write-Host "  Triggers: $($updatedTask.Triggers.Count) (expect 2: repeat + logon)" -ForegroundColor DarkGray
} else {
  Write-Host "  [FAIL] Task not found after registration" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C69 DONE -- Window flash FIXED" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  What changed:"
Write-Host "    Before: Task ran node.exe directly -> cmd window flashed every minute"
Write-Host "    After:  Task runs wscript.exe -> VBS (hidden) -> node (no window)"
Write-Host ""
Write-Host "  VBS launcher: $vbsPath"
Write-Host "  Task:         $taskPath$taskName"
Write-Host ""
Write-Host "  NOTE: CHINTU_GROQ_API_KEY must be set at MACHINE scope for brain"
Write-Host "  to work in Task Scheduler. If brain still shows offline, run:"
Write-Host ""
Write-Host "    [Environment]::SetEnvironmentVariable('CHINTU_GROQ_API_KEY', 'gsk_...', 'Machine')"
Write-Host ""
Write-Host "  Then RESTART (or sign out + in) so Task Scheduler picks it up."
Write-Host ""
Write-Host "  Test VBS now (silent, no window):"
Write-Host "    wscript.exe `"$vbsPath`""
Write-Host ""
