# schedule-c63.ps1 -- Register ChintuHealthWatchdog every 2 hours
$action  = New-ScheduledTaskAction -Execute 'node' -Argument 'scripts\chintu-health-watchdog.js' -WorkingDirectory 'C:\Users\Chintu\Desktop\test'
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Hours 2) -Once -At (Get-Date)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'ChintuHealthWatchdog' -Action $action -Trigger $trigger -Settings $settings -Force
Write-Host "ChintuHealthWatchdog scheduled every 2 hours."
