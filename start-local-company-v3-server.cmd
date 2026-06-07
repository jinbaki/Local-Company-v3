@echo off
setlocal

set "APP_DIR=%~dp0"
set "PORT=8789"

cd /d "%APP_DIR%"

if not exist "package.json" (
  exit /b 1
)

where.exe npm.cmd > nul 2> nul
if errorlevel 1 (
  exit /b 1
)

if not exist "node_modules" (
  call npm install
  if errorlevel 1 exit /b 1
)

if not exist "dist\server\server\index.js" (
  call npm run build
  if errorlevel 1 exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$listener = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue; if ($listener) { exit 0 } exit 1"
if errorlevel 1 (
  if not exist "logs" mkdir "logs"
  start "Local Company V3 Server" /min /D "%APP_DIR%" cmd.exe /c "npm start >> logs\local-company-v3.log 2>> logs\local-company-v3.err.log"
)

exit /b 0
