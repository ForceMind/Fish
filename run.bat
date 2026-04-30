@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js 18 or newer.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)

echo Starting Fish Arcade LAN server...
echo Game:  http://localhost:3000/
echo Admin: http://localhost:3000/admin
echo Keep this window open while playing.
echo.
node server\server.js
pause
