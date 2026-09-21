@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Cronos Sniper - Stop

set "KILLED=0"

if exist ".bot.pid" (
  for /f "usebackq delims=" %%p in (".bot.pid") do set "BOT_PID=%%p"
  if defined BOT_PID (
    echo Stopping bot process tree PID %BOT_PID%...
    taskkill /PID %BOT_PID% /T /F >nul 2>&1
    if not errorlevel 1 set "KILLED=1"
  )
  del /f /q ".bot.pid" >nul 2>&1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_stop_helper.ps1"
if errorlevel 10 set "KILLED=1"

if "%KILLED%"=="1" (
  echo Stopped.
) else (
  echo No running Cronos sniper bot found.
)

timeout /t 3 >nul
exit /b 0
