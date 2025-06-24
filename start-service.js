#!/usr/bin/env node

// Simple service starter - this runs as the background process
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'auth-service.log');

// Redirect stdout and stderr to log file
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Override console methods to log to file
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const timestamp = new Date().toISOString();
  logStream.write(`${timestamp} [INFO] ${args.join(' ')}\n`);
  // Also log to original console in development
  if (process.env.NODE_ENV === 'development') {
    originalLog(...args);
  }
};

console.error = (...args) => {
  const timestamp = new Date().toISOString();
  logStream.write(`${timestamp} [ERROR] ${args.join(' ')}\n`);
  // Also log to original console in development
  if (process.env.NODE_ENV === 'development') {
    originalError(...args);
  }
};

// Handle process termination
process.on('SIGTERM', () => {
  console.log('WordPress Reader auth service stopping...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('WordPress Reader auth service stopping...');
  process.exit(0);
});

// Start the web app
console.log('Starting WordPress Reader auth service...');

try {
  // Make sure web-app is built
  if (!fs.existsSync('web-app/dist/index.js')) {
    console.log('Building web-app...');
    execSync('npm run build', { cwd: 'web-app', stdio: 'inherit' });
  }
  
  // Start the server by spawning npm start
  console.log('Starting server on port 3000...');
  const { spawn } = require('child_process');
  
  const server = spawn('npm', ['start'], {
    cwd: 'web-app',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  server.stdout.on('data', (data) => {
    console.log(data.toString());
  });
  
  server.stderr.on('data', (data) => {
    console.error(data.toString());
  });
  
  server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    process.exit(code);
  });
  
  server.on('error', (error) => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });
  
  // Keep process alive
  process.on('SIGTERM', () => {
    console.log('Terminating server...');
    server.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    console.log('Terminating server...');
    server.kill('SIGINT');
  });
  
} catch (error) {
  console.error('Failed to start service:', error.message);
  process.exit(1);
}