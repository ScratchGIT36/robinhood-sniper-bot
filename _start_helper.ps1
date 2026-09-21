$ErrorActionPreference = 'Stop'
$wd = Split-Path -Parent $MyInvocation.MyCommand.Path
$inner = 'title Cronos Sniper Bot && cd /d "' + $wd + '" && echo Cronos Sniper Bot && echo Close this window or run STOP.bat to quit. && echo. && npm start'
$p = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $inner) -WorkingDirectory $wd -PassThru
Set-Content -LiteralPath (Join-Path $wd '.bot.pid') -Value $p.Id -Encoding ascii
Write-Host ("Started. Console PID " + $p.Id)
