#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVICE_NAME = 'wordpress-reader-auth';
const PID_FILE = path.join(__dirname, '.service.pid');
const LOG_FILE = path.join(__dirname, 'auth-service.log');

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Check if service is running
function isServiceRunning() {
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }
  
  try {
    const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
    if (!pid) return false;
    
    // Check if process is actually running
    process.kill(parseInt(pid), 0);
    return true;
  } catch (error) {
    // Process not running, clean up pid file
    try {
      fs.unlinkSync(PID_FILE);
    } catch (e) {}
    return false;
  }
}

// Start the service
function startService() {
  if (isServiceRunning()) {
    logWarning('WordPress Reader auth service is already running');
    return;
  }
  
  logInfo('Starting WordPress Reader auth service...');
  
  // Ensure web-app is built
  if (!fs.existsSync('web-app/dist')) {
    log('Building web-app first...');
    try {
      require('child_process').execSync('npm run build', { 
        cwd: 'web-app', 
        stdio: 'inherit' 
      });
    } catch (error) {
      logError('Failed to build web-app');
      process.exit(1);
    }
  }
  
  // Start the service in background
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  
  const child = spawn('npm', ['start'], {
    cwd: 'web-app',
    detached: true,
    stdio: ['ignore', logStream, logStream]
  });
  
  // Save PID
  fs.writeFileSync(PID_FILE, child.pid.toString());
  
  // Detach from parent process
  child.unref();
  
  // Wait a moment to check if it started successfully
  setTimeout(() => {
    if (isServiceRunning()) {
      logSuccess(`WordPress Reader auth service started (PID: ${child.pid})`);
      logInfo(`Logs: ${LOG_FILE}`);
      logInfo('Service URL: http://localhost:3000');
    } else {
      logError('Failed to start service');
      process.exit(1);
    }
  }, 2000);
}

// Stop the service
function stopService() {
  if (!isServiceRunning()) {
    logWarning('WordPress Reader auth service is not running');
    return;
  }
  
  try {
    const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
    logInfo(`Stopping WordPress Reader auth service (PID: ${pid})...`);
    
    // Kill the process
    process.kill(parseInt(pid), 'SIGTERM');
    
    // Wait for graceful shutdown
    setTimeout(() => {
      try {
        process.kill(parseInt(pid), 0);
        // Still running, force kill
        process.kill(parseInt(pid), 'SIGKILL');
      } catch (error) {
        // Process stopped
      }
      
      // Clean up PID file
      try {
        fs.unlinkSync(PID_FILE);
      } catch (error) {}
      
      logSuccess('WordPress Reader auth service stopped');
    }, 1000);
    
  } catch (error) {
    logError('Failed to stop service');
    logError(error.message);
  }
}

// Restart the service
function restartService() {
  logInfo('Restarting WordPress Reader auth service...');
  stopService();
  setTimeout(() => {
    startService();
  }, 2000);
}

// Show service status
function showStatus() {
  if (isServiceRunning()) {
    const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
    logSuccess(`WordPress Reader auth service is running (PID: ${pid})`);
    logInfo('Service URL: http://localhost:3000');
    logInfo(`Logs: ${LOG_FILE}`);
  } else {
    logWarning('WordPress Reader auth service is not running');
  }
}

// Show logs
function showLogs() {
  if (fs.existsSync(LOG_FILE)) {
    console.log(fs.readFileSync(LOG_FILE, 'utf8'));
  } else {
    logWarning('No log file found');
  }
}

// Check service health
async function checkHealth() {
  try {
    // Try to import fetch for Node.js versions that need it
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      // Use built-in fetch if available (Node 18+)
      fetch = globalThis.fetch;
    }
    
    if (fetch) {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        logSuccess('WordPress Reader auth service is healthy');
        return true;
      }
    }
  } catch (error) {
    logError('WordPress Reader auth service is not responding');
    return false;
  }
  return false;
}

// Auto-start if needed
async function autoStart() {
  if (!isServiceRunning()) {
    logInfo('Auto-starting WordPress Reader auth service...');
    startService();
    
    // Wait and check health
    setTimeout(async () => {
      const healthy = await checkHealth();
      if (!healthy) {
        logWarning('Service started but not responding to health checks');
      }
    }, 3000);
  } else {
    const healthy = await checkHealth();
    if (!healthy) {
      logWarning('Service is running but not healthy, restarting...');
      restartService();
    } else {
      logSuccess('WordPress Reader auth service is already running and healthy');
    }
  }
}

// Install as system service (optional)
function installSystemService() {
  const platform = os.platform();
  const currentDir = process.cwd();
  
  if (platform === 'darwin') {
    // macOS launchd
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.wordpress.reader.auth</string>
    <key>ProgramArguments</key>
    <array>
        <string>node</string>
        <string>${currentDir}/service-manager.js</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${currentDir}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${currentDir}/auth-service.log</string>
    <key>StandardErrorPath</key>
    <string>${currentDir}/auth-service.log</string>
</dict>
</plist>`;
    
    const plistPath = path.join(os.homedir(), 'Library/LaunchAgents/com.wordpress.reader.auth.plist');
    fs.writeFileSync(plistPath, plistContent);
    
    logSuccess('macOS LaunchAgent installed');
    logInfo(`To enable: launchctl load ${plistPath}`);
    logInfo(`To disable: launchctl unload ${plistPath}`);
    
  } else if (platform === 'linux') {
    // systemd user service
    const serviceContent = `[Unit]
Description=WordPress Reader Auth Service
After=network.target

[Service]
Type=simple
User=${os.userInfo().username}
WorkingDirectory=${currentDir}
ExecStart=node ${currentDir}/service-manager.js start
Restart=always
RestartSec=10

[Install]
WantedBy=default.target`;
    
    const servicePath = path.join(os.homedir(), '.config/systemd/user/wordpress-reader-auth.service');
    
    // Create directory if it doesn't exist
    const serviceDir = path.dirname(servicePath);
    if (!fs.existsSync(serviceDir)) {
      fs.mkdirSync(serviceDir, { recursive: true });
    }
    
    fs.writeFileSync(servicePath, serviceContent);
    
    logSuccess('systemd user service installed');
    logInfo('To enable: systemctl --user enable wordpress-reader-auth.service');
    logInfo('To start: systemctl --user start wordpress-reader-auth.service');
    
  } else {
    logWarning('System service installation not supported on this platform');
    logInfo('Use manual start/stop commands instead');
  }
}

// Main command handler
function main() {
  const command = process.argv[2] || 'status';
  
  switch (command) {
    case 'start':
      startService();
      break;
    case 'stop':
      stopService();
      break;
    case 'restart':
      restartService();
      break;
    case 'status':
      showStatus();
      break;
    case 'logs':
      showLogs();
      break;
    case 'health':
      checkHealth();
      break;
    case 'auto-start':
      autoStart();
      break;
    case 'install':
      installSystemService();
      break;
    case 'help':
    default:
      log('WordPress Reader Auth Service Manager\n', 'blue');
      log('Commands:');
      log('  start       Start the auth service');
      log('  stop        Stop the auth service');
      log('  restart     Restart the auth service');
      log('  status      Show service status');
      log('  logs        Show service logs');
      log('  health      Check service health');
      log('  auto-start  Start if not running, restart if unhealthy');
      log('  install     Install as system service (optional)');
      log('  help        Show this help\n');
      log('Examples:');
      log('  node service-manager.js start');
      log('  node service-manager.js status');
      log('  node service-manager.js logs');
      break;
  }
}

// Handle process signals
process.on('SIGINT', () => {
  if (process.argv[2] === 'start') {
    stopService();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (process.argv[2] === 'start') {
    stopService();
  }
  process.exit(0);
});

// Run main function
main();