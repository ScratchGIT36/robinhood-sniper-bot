@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Cronos Sniper - Launcher

if exist ".bot.pid" (
  for /f "usebackq delims=" %%p in (".bot.pid") do set "OLD_PID=%%p"
  if defined OLD_PID (
    tasklist /FI "PID eq %OLD_PID%" 2>nul | find "%OLD_PID%" >nul
    if not errorlevel 1 (
      echo Bot already running as PID %OLD_PID%.
      echo Use STOP.bat first, or double-click STOP then START again.
      pause
      exit /b 1
    )
  )
  del /f /q ".bot.pid" >nul 2>&1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install Node 20+ from https://nodejs.org then try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  if exist ".env.example" (
    echo No .env found - copying .env.example to .env
    copy /y ".env.example" ".env" >nul
    echo Edit .env before live trading. Current MODE comes from that file.
  ) else (
    echo Missing .env and .env.example
    pause
    exit /b 1
  )
)

echo Starting Cronos sniper in a new window...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_start_helper.ps1"
if errorlevel 1 (
  echo Failed to start.
  pause
  exit /b 1
)

echo.
echo Bot window should be open. Double-click STOP.bat to close it.
timeout /t 4 >nul
exit /b 0
