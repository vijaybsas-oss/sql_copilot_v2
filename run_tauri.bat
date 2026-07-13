@echo off
title EMS Database Copilot - Tauri Desktop Launcher
color 0D
cls

echo ==========================================================
echo         EMS SQL COPILOT - TAURI DESKTOP LAUNCHER
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

:: First-Run Detection for npm packages
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

:: Check if Rust toolchain is installed
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    color 0E
    echo WARNING: Rust Cargo build system was not found in your system PATH.
    echo Tauri requires the Rust toolchain to compile and run desktop apps.
    echo.
    echo You can easily install Rust by running the following command in PowerShell:
    echo     winget install Rustlang.Rustup
    echo Or download the installer from: https://rustup.rs/
    echo.
    echo Please install Rust, restart your terminal, and try again.
    echo.
    pause
    exit /b 1
)

echo Starting the local full-stack Express database controller...
echo Preparing to spin up the Tauri WebView container...
echo.

:: Spawn the backend server in the background
start "EMS SQL Copilot Express Server" /min cmd /c "npm run dev"

:: Wait a brief moment for the backend to initialize
echo Waiting for backend server to bind to port 3000...
timeout /t 3 >nul

:: Launch Tauri
echo Starting Tauri development environment...
call npm run tauri dev

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo Tauri process exited with code %errorlevel%.
    echo If this is the first time running Tauri, make sure your Windows C++ Build Tools are installed.
)
echo.
pause
