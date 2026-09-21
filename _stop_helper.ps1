$ErrorActionPreference = 'SilentlyContinue'
$wd = Split-Path -Parent $MyInvocation.MyCommand.Path
$hit = $false

Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'cmd.exe' -and $_.CommandLine -and (
    $_.CommandLine -like '*Cronos Sniper Bot*' -or
    ($_.CommandLine -like ('*' + $wd + '*') -and $_.CommandLine -like '*npm start*')
  )
} | ForEach-Object {
  Write-Host ("Stopping console PID " + $_.ProcessId)
  Stop-Process -Id $_.ProcessId -Force
  $hit = $true
}

Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq 'node.exe' -or $_.Name -eq 'tsx.exe') -and $_.CommandLine -and (
    $_.CommandLine -like ('*' + $wd + '*') -or
    $_.CommandLine -like '*src\index.ts*' -or
    $_.CommandLine -like '*src/index.ts*'
  )
} | ForEach-Object {
  Write-Host ("Stopping " + $_.Name + " PID " + $_.ProcessId)
  Stop-Process -Id $_.ProcessId -Force
  $hit = $true
}

if ($hit) { exit 10 } else { exit 0 }
