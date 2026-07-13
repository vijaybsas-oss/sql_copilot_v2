/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let serverProcess = null;
let mainWindow = null;
const PORT = 3000;

function startExpressServer() {
  console.log('Starting full-stack Express & Vite backend server...');
  
  // Use npm.cmd on Windows, npm on Unix systems
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  
  // Spawn the development server (which compiles TypeScript server.ts using tsx on the fly)
  serverProcess = spawn(cmd, ['run', 'dev'], {
    cwd: process.cwd(),
    shell: true,
    env: { 
      ...process.env, 
      PORT: String(PORT), 
      NODE_ENV: 'development',
      ELECTRON_RUNNING: 'true'
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Express Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Express Server Error] ${data.toString().trim()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Express server process exited with code ${code}`);
    if (code && code !== 0) {
      dialog.showErrorBox(
        'Server Process Terminated',
        `The backend database server stopped unexpectedly with code ${code}. Please make sure port ${PORT} is not already in use.`
      );
    }
  });
}

function pollServerAndCreateWindow() {
  const checkServer = () => {
    const req = http.get(`http://localhost:${PORT}/api/database/connection`, (res) => {
      console.log('Backend database server is active! Spawning Electron GUI...');
      createWindow();
    });
    
    req.on('error', (err) => {
      console.log('Waiting for backend server to spin up...');
      setTimeout(checkServer, 1000);
    });
    
    req.end();
  };
  
  checkServer();
}

function createWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    title: "EMS SQL Copilot & Auditor",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    autoHideMenuBar: true,
    backgroundColor: '#0f172a' // match deep slate dark theme background
  });

  // Load the web interface served by our local full-stack server
  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startExpressServer();
  pollServerAndCreateWindow();
});

app.on('window-all-closed', () => {
  // Respect macOS app lifecycles, otherwise close server and app
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    console.log('Shutting down backend database server...');
    // Kill child server process
    if (process.platform === 'win32') {
      // Use taskkill on Windows to ensure child tree processes are also killed
      spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t'], { shell: true });
    } else {
      serverProcess.kill('SIGTERM');
    }
  }
});
