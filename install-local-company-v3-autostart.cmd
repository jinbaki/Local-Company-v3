@echo off
setlocal

set "APP_DIR=%~dp0"
set "START_SCRIPT=%APP_DIR%start-local-company-v3-server.cmd"

echo Installing Local Company V3 autostart...
echo.

if not exist "%START_SCRIPT%" (
  echo start-local-company-v3.cmd was not found.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$startup = [Environment]::GetFolderPath('Startup');" ^
  "$v2Links = Get-ChildItem -LiteralPath $startup -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'local company v2|local-company-v2|local company' -and $_.Name -notmatch 'v3' };" ^
  "foreach ($link in $v2Links) { Remove-Item -LiteralPath $link.FullName -Force -ErrorAction SilentlyContinue };" ^
  "$shortcutPath = Join-Path $startup 'Local Company V3.lnk';" ^
  "$shell = New-Object -ComObject WScript.Shell;" ^
  "$shortcut = $shell.CreateShortcut($shortcutPath);" ^
  "$shortcut.TargetPath = '%START_SCRIPT%';" ^
  "$shortcut.WorkingDirectory = '%APP_DIR%';" ^
  "$shortcut.WindowStyle = 7;" ^
  "$shortcut.Description = 'Start Local Company V3 on Windows sign-in';" ^
  "$shortcut.Save();" ^
  "Write-Output $shortcutPath"

if errorlevel 1 (
  echo Autostart installation failed.
  pause
  exit /b 1
)

echo.
echo Local Company V3 will start when this Windows user signs in.
echo You can remove it with uninstall-local-company-v3-autostart.cmd.
pause
