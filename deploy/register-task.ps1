$ErrorActionPreference = 'Stop'

$taskName = 'GITAUTO'
$batch = 'C:\Users\muham\daily-automation\deploy\run-daily.bat'

$action = New-ScheduledTaskAction -Execute $batch
$trigger = New-ScheduledTaskTrigger -Daily -At '05:30'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$description = 'GITAUTO bot: fetch notable repos/skills, enrich, and deliver the daily digest (00:00 UTC)'

try {
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
} catch {
    Write-Output "Note: WakeToRun not permitted here; continuing without it."
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description $description -Force | Out-Null

$task = Get-ScheduledTask -TaskName $taskName
$info = Get-ScheduledTaskInfo -TaskName $taskName
Write-Output "Task registered: $($task.TaskName)"
Write-Output "State: $($task.State)"
Write-Output "Next run: $($info.NextRunTime)"
Write-Output "Trigger: daily at 05:30 local (00:00 UTC)"
