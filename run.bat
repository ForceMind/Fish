@echo off
setlocal

cd /d "%~dp0"
set "PORT=8080"
set "PYTHON_CMD="

where py >nul 2>nul
if %errorlevel%==0 (
    set "PYTHON_CMD=py -3"
)

if not defined PYTHON_CMD (
    where python >nul 2>nul
    if %errorlevel%==0 (
        set "PYTHON_CMD=python"
    )
)

if not defined PYTHON_CMD (
    echo Python 3 was not found.
    echo Install Python 3 and make sure "py" or "python" is available in PATH.
    pause
    exit /b 1
)

echo Starting Fishing Joy at http://localhost:%PORT%/
echo Press Ctrl+C in this window to stop the server.
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/'"
call %PYTHON_CMD% -m http.server %PORT%
