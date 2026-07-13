@echo off
title EMS Database Copilot - Electron App Launcher
color 0A
cls

echo ==========================================================
echo       EMS SQL COPILOT - ELECTRON DESKTOP LAUNCHER
echo ==========================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Node.js is not installed or not found in your system PATH.
    echo Please install Node.js version 18 or higher from https://nodejs.org/
    echo and try running this batch file again.
    echo.
    pause
    exit /b 1
)

:: First-Run Detection
if not exist node_modules (
    echo [FIRST RUN DETECTED]
    echo Local node_modules directory was not found.
    echo Installing project dependencies - this may take a couple of minutes...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo ERROR: Dependency installation failed.
        echo Please ensure you are connected to the internet and try again.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies successfully installed!
    echo.
)

:: Self-Healing package.json Script Verification
echo Verifying package.json scripts...
node -e "try { const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json')); p.scripts=p.scripts||{}; let updated=false; if(!p.scripts.dev) { p.scripts.dev='tsx server.ts'; updated=true; } if(!p.scripts.electron) { p.scripts.electron='electron electron-main.cjs'; updated=true; } if(!p.scripts.tauri) { p.scripts.tauri='tauri'; updated=true; } if(updated) { fs.writeFileSync('package.json', JSON.stringify(p, null, 2)); console.log('Successfully repaired package.json scripts!'); } } catch(err) { console.error('Failed to verify/repair package.json:', err.message); }"

echo Starting desktop application via Electron...
echo This will spin up the local Express database controller on port 3000
echo and load the visual interface directly into a desktop window.
echo.

:: Start Electron
call npm run electron

if %errorlevel% neq 0 (
    echo.
    echo Server or desktop wrapper exited with code %errorlevel%.
)
echo.
pause
