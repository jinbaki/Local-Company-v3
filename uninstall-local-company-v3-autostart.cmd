@echo off
setlocal

echo Removing Local Company V3 autostart...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$startup = [Environment]::GetFolderPath('Startup');" ^
  "$shortcutPath = Join-Path $startup 'Local Company V3.lnk';" ^
  "if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath -Force; Write-Output 'Removed:' $shortcutPath } else { Write-Output 'No Local Company V3 autostart shortcut was found.' }"

if errorlevel 1 (
  echo Autostart removal failed.
  pause
  exit /b 1
)

echo.
echo Local Company V3 autostart was removed.
pause
