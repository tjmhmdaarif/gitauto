$ErrorActionPreference = 'Stop'

$taskName = 'GITAUTO'
$batch = 'C:\Users\muham\daily-automation\deploy\run-daily.bat'

$action = New-ScheduledTaskAction -Execute $batch
$trigger = New-ScheduledTaskTrigger -Daily -At '05:30'
# A laptop at 05:30 is usually asleep or on battery. The previous settings
# blocked the run in exactly those conditions, so the task never fired on
# schedule and only ever ran when StartWhenAvailable caught it at wake-up.
#
#   -AllowStartIfOnBatteries / -DontStopIfGoingOnBatteries : run on battery too
#   -StopOnIdleEnd:$false                                  : do not kill a run
#                                                         when the user returns
#   -StartWhenAvailable -WakeToRun                         : catch a missed 05:30
#                                                         at the next wake/boot
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -WakeToRun `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StopOnIdleEnd:$false `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$description = 'GITAUTO bot: fetch notable repos/skills, enrich, and deliver the daily digest (00:00 UTC)'

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description $description -Force | Out-Null

$task = Get-ScheduledTask -TaskName $taskName
$info = Get-ScheduledTaskInfo -TaskName $taskName
Write-Output "Task registered: $($task.TaskName)"
Write-Output "State: $($task.State)"
Write-Output "Next run: $($info.NextRunTime)"
Write-Output "Trigger: daily at 05:30 local (00:00 UTC)"
Write-Output "Battery: AllowStartIfOnBatteries=$($task.Settings.AllowStartIfOnBatteries) DontStopIfGoingOnBatteries=$($task.Settings.DontStopIfGoingOnBatteries) StopOnIdleEnd=$($task.Settings.StopOnIdleEnd)"
