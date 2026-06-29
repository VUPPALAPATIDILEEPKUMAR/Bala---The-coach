# schedule-c68.ps1 -- Register C68 Morning Health Brief with Windows Task Scheduler
#
# Runs chintu-health-brief.js every day at 7:00 AM -- silently (no window flash).
# Uses a VBS launcher so the node process runs completely hidden.
#
# REQUIRES: Run as Administrator
# Usage (Admin PowerShell): .\schedule-c68.ps1

$ErrorActionPreference = 'Stop'

$taskName   = 'ChintuMorningHealthBrief'
$taskDesc   = 'C68: BALA morning health brief via Groq + Telegram. Reads bala-daily-snapshot.json.'
$repoRoot   = $PSScriptRoot
$scriptPath = Join-Path $repoRoot 'scripts\chintu-health-brief.js'

function Test-IsAdministrator {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-MorningBriefTaskConfigured {
  param([object]$Task, [string]$ExpectedVbsPath)
  if (-not $Task -or -not $Task.Actions -or $Task.Actions.Count -lt 1) {
    return $false
  }
  $action = $Task.Actions[0]
  if ($action.Execute -notmatch 'wscript(\.exe)?$') {
    return $false
  }
  if ($action.Arguments -notmatch [Regex]::Escape($ExpectedVbsPath)) {
    return $false
  }
  $dailyTrigger = $Task.Triggers | Where-Object { $_.CimClass.CimClassName -match 'Daily' } | Select-Object -First 1
  if (-not $dailyTrigger) {
    return $false
  }
  return $dailyTrigger.StartBoundary -match 'T07:00:00'
}

# Resolve node.exe path -- PS5 compatible (no ?. operator)
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCmd) { $nodeCmd.Source } else { 'node' }

# VBS launcher runs node hidden (no flashing terminal window)
$vbsPath = Join-Path $repoRoot 'scripts\run-health-brief-hidden.vbs'
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c """ & "$nodeExe" & """ """ & "$scriptPath" & """", 0, False
"@
$vbsContent | Out-File -FilePath $vbsPath -Encoding ASCII -Force

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  C68: Schedule Morning Health Brief" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  VBS launcher: $vbsPath" -ForegroundColor DarkGray

# Remove existing task if present
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Write-Host "  Existing task: $(if ($existingTask) { 'found' } else { 'not found' })" -ForegroundColor DarkGray
$isAdmin = Test-IsAdministrator
$alreadyConfigured = Test-MorningBriefTaskConfigured -Task $existingTask -ExpectedVbsPath $vbsPath
if ($alreadyConfigured) {
  Write-Host "  [PASS] Task already uses the hidden 7:00 AM launcher" -ForegroundColor Green
  if (-not $isAdmin) {
    Write-Host "  Current shell is not elevated, but no re-registration is needed." -ForegroundColor DarkGray
    exit 0
  }
}
if (-not $isAdmin) {
  Write-Host "  [FAIL] Administrator rights are required to register or update this scheduled task." -ForegroundColor Red
  exit 1
}

if ($existingTask) {
  Write-Host "  Removing existing task: $taskName" -ForegroundColor DarkGray
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action   = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbsPath`""
$trigger  = New-ScheduledTaskTrigger -Daily -At '07:00AM'
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 3) `
  -StartWhenAvailable `
  -DontStopOnIdleEnd

Register-ScheduledTask `
  -TaskName    $taskName `
  -Description $taskDesc `
  -Action      $action `
  -Trigger     $trigger `
  -Settings    $settings `
  -RunLevel    Limited `
  -Force | Out-Null

$updatedTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (Test-MorningBriefTaskConfigured -Task $updatedTask -ExpectedVbsPath $vbsPath) {
  Write-Host "  [PASS] Task registered: $taskName" -ForegroundColor Green
  Write-Host "  Schedule: daily at 7:00 AM (silent -- no window flash)" -ForegroundColor DarkGray
  Write-Host "  Launcher: wscript.exe -> VBS -> node (hidden)" -ForegroundColor DarkGray
} else {
  Write-Host "  [FAIL] Task did not verify with the expected 7:00 AM hidden-launcher configuration." -ForegroundColor Red
  exit 1
}
Write-Host ""
Write-Host "  Test now (silent): wscript.exe `"$vbsPath`""
Write-Host "  Test now (visible): node `"$scriptPath`""
Write-Host ""
