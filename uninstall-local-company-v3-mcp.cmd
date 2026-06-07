@echo off
setlocal

codex mcp remove "local-company-v3"
if errorlevel 1 (
  echo MCP removal failed or the MCP entry was not registered.
  pause
  exit /b 1
)

echo Local Company V3 MCP was removed.
pause
