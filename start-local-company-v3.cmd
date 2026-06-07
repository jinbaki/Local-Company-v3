@echo off
setlocal

set "APP_DIR=%~dp0"
set "APP_URL=http://127.0.0.1:8789/"

cd /d "%APP_DIR%"

echo Starting Local Company V3...
echo.

call "%APP_DIR%start-local-company-v3-server.cmd"
if errorlevel 1 (
  echo Local Company V3 could not start.
  echo Check that Node.js 24 or newer is installed, then try again.
  pause
  exit /b 1
)

echo Opening the dashboard...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2"
start "" "%APP_URL%"
exit /b 0
