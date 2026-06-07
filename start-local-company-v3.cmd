@echo off
setlocal

set "APP_DIR=%~dp0"
set "APP_URL=http://127.0.0.1:8789/"

cd /d "%APP_DIR%"

echo Starting Local Company V3...
echo.

if not exist "package.json" (
  echo App files were not found.
  echo Current folder: %APP_DIR%
  pause
  exit /b 1
)

where.exe npm.cmd > nul 2> nul
if errorlevel 1 (
  echo Node.js or npm was not found.
  echo Install Node.js LTS, then run this shortcut again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing required files. This may take a few minutes the first time.
  call npm install
  if errorlevel 1 (
    echo Install failed. Check the message above, then run this shortcut again.
    pause
    exit /b 1
  )
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$listener = Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue; if ($listener) { exit 0 } exit 1"
if errorlevel 1 (
  echo Starting the local server.
  echo Keep the server window open while using the dashboard and MCP.
  start "Local Company V3 Server" /D "%APP_DIR%" cmd.exe /k "npm run dev"
) else (
  echo The local server is already running.
)

echo Opening the dashboard...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3"
start "" "%APP_URL%"
exit /b 0
