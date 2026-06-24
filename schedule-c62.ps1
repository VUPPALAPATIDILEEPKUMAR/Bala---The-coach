# schedule-c62.ps1 -- Register ChintuGitHubWatch Task Scheduler task (run as Admin)
# Polls GitHub notifications every 30 minutes and sends Telegram digest.

$action = New-ScheduledTaskAction `
  -Execute 'node' `
  -Argument 'scripts\chintu-github-watch.js' `
  -WorkingDirectory 'C:\Users\Chintu\Desktop\test'

$trigger = New-ScheduledTaskTrigger `
  -RepetitionInterval (New-TimeSpan -Minutes 30) `
  -Once `
  -At (Get-Date)

$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName 'ChintuGitHubWatch' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Force

Write-Host "ChintuGitHubWatch task registered -- runs every 30 minutes."
