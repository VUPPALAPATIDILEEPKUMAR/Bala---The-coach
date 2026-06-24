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
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
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

Write-Host "  [PASS] Task registered: $taskName" -ForegroundColor Green
Write-Host "  Schedule: daily at 7:00 AM (silent -- no window flash)" -ForegroundColor DarkGray
Write-Host "  Launcher: wscript.exe -> VBS -> node (hidden)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Test now (silent): wscript.exe `"$vbsPath`""
Write-Host "  Test now (visible): node `"$scriptPath`""
Write-Host ""
