#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');
const crypto = require('crypto');
const os = require('os');

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

// Get Claude Desktop config file path
function getClaudeConfigPath() {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
  } else if (platform === 'win32') {
    return path.join(os.homedir(), 'AppData/Roaming/Claude/claude_desktop_config.json');
  } else {
    // Linux/other
    return path.join(os.homedir(), '.config/Claude/claude_desktop_config.json');
  }
}

// Check if Node.js and npm are available
function checkPrerequisites() {
  log('\n🔍 Checking prerequisites...', 'cyan');
  
  try {
    execSync('node --version', { stdio: 'ignore' });
    logSuccess('Node.js is installed');
  } catch (error) {
    logError('Node.js is not installed. Please install it from https://nodejs.org/');
    process.exit(1);
  }

  try {
    execSync('npm --version', { stdio: 'ignore' });
    logSuccess('npm is available');
  } catch (error) {
    logError('npm is not available. Please install Node.js with npm from https://nodejs.org/');
    process.exit(1);
  }
}

// Install dependencies
function installDependencies() {
  log('\n📦 Installing dependencies...', 'cyan');
  
  try {
    log('Installing web-app dependencies...');
    execSync('npm install', { cwd: 'web-app', stdio: 'inherit' });
    logSuccess('Web-app dependencies installed');

    log('Installing MCP server dependencies...');
    execSync('npm install', { cwd: 'mcp-server', stdio: 'inherit' });
    logSuccess('MCP server dependencies installed');
  } catch (error) {
    logError('Failed to install dependencies');
    logError(error.message);
    process.exit(1);
  }
}

// Check if environment file already exists
function checkExistingEnvironment() {
  const envPath = 'web-app/.env';
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const hasClientId = envContent.includes('WORDPRESS_CLIENT_ID=') && 
                          !envContent.includes('WORDPRESS_CLIENT_ID=your_client_id_here') &&
                          !envContent.includes('WORDPRESS_CLIENT_ID=""');
      const hasClientSecret = envContent.includes('WORDPRESS_CLIENT_SECRET=') && 
                              !envContent.includes('WORDPRESS_CLIENT_SECRET=your_client_secret_here') &&
                              !envContent.includes('WORDPRESS_CLIENT_SECRET=""');
      
      if (hasClientId && hasClientSecret) {
        logSuccess('Found existing WordPress.com credentials in .env file');
        return true;
      }
    } catch (error) {
      // Ignore read errors, will create new file
    }
  }
  return false;
}

// Get WordPress credentials from user
async function getWordPressCredentials() {
  // Check if credentials already exist
  if (checkExistingEnvironment()) {
    const useExisting = await askQuestion('Use existing WordPress.com credentials? (y/n): ');
    if (useExisting.toLowerCase() === 'y' || useExisting.toLowerCase() === 'yes' || useExisting.toLowerCase() === '') {
      log('Using existing credentials from .env file');
      return null; // Signal to skip credential setup
    }
  }

  log('\n🔑 WordPress.com App Credentials', 'cyan');
  log('You need to create a WordPress.com application first:');
  log('1. Go to https://developer.wordpress.com/apps/');
  log('2. Create a new application');
  log('3. Set redirect URI to: http://localhost:3000/auth/callback');
  log('4. Copy your Client ID and Client Secret');
  log('');

  const clientId = await askQuestion('Enter your WordPress.com Client ID: ');
  if (!clientId.trim()) {
    logError('Client ID is required');
    process.exit(1);
  }

  const clientSecret = await askQuestion('Enter your WordPress.com Client Secret: ');
  if (!clientSecret.trim()) {
    logError('Client Secret is required');
    process.exit(1);
  }

  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}

// Prompt for confidentiality protection setting
async function promptForConfidentialityProtection() {
  log('\n🔒 Confidentiality Protection Configuration', 'cyan');
  log('WordPress.com blogs can have a "p2_confidentiality_disabled" sticker that indicates');
  log('their content CAN be accessed by AI systems.', 'yellow');
  log('Blogs WITHOUT this sticker should NOT be accessed by AI.', 'yellow');
  log('');
  log('When protection is ENABLED (recommended):', 'green');
  log('  ✓ Only blogs with the p2_confidentiality_disabled sticker will be accessible');
  log('  ✓ Blogs without the sticker will be automatically blocked');
  log('  ✓ This helps prevent accidental exposure of sensitive information');
  log('');
  log('When protection is DISABLED:', 'red');
  log('  ⚠️  ALL blog content will be accessible regardless of confidentiality settings');
  log('  ⚠️  It is YOUR responsibility to ensure you\'re not parsing sensitive information');
  log('  ⚠️  This may violate privacy policies or confidentiality agreements');
  log('');
  
  return new Promise((resolve) => {
    const localRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    localRl.question('Enable confidentiality protection? (Y/n): ', (answer) => {
      localRl.close();
      const enable = answer.toLowerCase() !== 'n';
      
      if (!enable) {
        log('\n⚠️  WARNING: Confidentiality protection will be DISABLED', 'red');
        log('You are responsible for ensuring compliance with all privacy and confidentiality requirements.', 'yellow');
        log('');
      } else {
        log('\n✅ Confidentiality protection will be ENABLED', 'green');
        log('');
      }
      
      resolve(enable);
    });
  });
}

// Create environment files for both web-app and mcp-server
function createEnvironmentFile(credentials, enableConfidentialityProtection = true) {
  const webAppEnvPath = 'web-app/.env';
  const mcpServerEnvPath = 'mcp-server/.env';
  
  // If credentials is null, we're using existing file
  if (credentials === null) {
    if (fs.existsSync(webAppEnvPath)) {
      logSuccess('Using existing web-app environment configuration');
      // Still need to ensure MCP server env exists and has shared secret
      ensureMCPServerEnvironment(enableConfidentialityProtection);
      return;
    } else {
      logError('Expected existing .env file but it was not found');
      process.exit(1);
    }
  }
  
  log('\n⚙️  Creating environment configuration...', 'cyan');
  
  const jwtSecret = crypto.randomBytes(32).toString('base64');
  const mcpSharedSecret = crypto.randomBytes(32).toString('hex');
  
  // Create web-app .env file
  const webAppEnvContent = `# WordPress OAuth Application Credentials
# Get these from https://developer.wordpress.com/apps/
WORDPRESS_CLIENT_ID=${credentials.clientId}
WORDPRESS_CLIENT_SECRET=${credentials.clientSecret}

# OAuth Configuration
REDIRECT_URI=http://localhost:3000/auth/callback

# Server Configuration
PORT=3000

# Security
# Generate a secure random string for JWT signing
# You can use: openssl rand -base64 32
JWT_SECRET=${jwtSecret}

# MCP Server URL (where the MCP server will be running)
MCP_SERVER_URL=http://localhost:3001

# MCP Security - Shared secret for MCP server authentication
# Generate with: openssl rand -hex 32
MCP_SHARED_SECRET=${mcpSharedSecret}
`;

  // Create mcp-server .env file
  const mcpServerEnvContent = `AUTH_SERVER_URL=http://localhost:3000
MCP_SHARED_SECRET=${mcpSharedSecret}
DISABLE_CONFIDENTIALITY_CHECK=${enableConfidentialityProtection ? 'false' : 'true'}
`;

  try {
    fs.writeFileSync(webAppEnvPath, webAppEnvContent);
    logSuccess('Web-app environment configuration created');
    
    fs.writeFileSync(mcpServerEnvPath, mcpServerEnvContent);
    logSuccess('MCP server environment configuration created');
    
    // Store the shared secret for Claude Desktop configuration
    global.setupMCPSharedSecret = mcpSharedSecret;
  } catch (error) {
    logError('Failed to create environment files');
    logError(error.message);
    process.exit(1);
  }
}

// Ensure MCP server environment exists (for existing setup scenario)
function ensureMCPServerEnvironment(enableConfidentialityProtection = true) {
  const mcpServerEnvPath = 'mcp-server/.env';
  const webAppEnvPath = 'web-app/.env';
  
  let mcpSharedSecret = null;
  
  // Try to read existing shared secret from web-app .env
  if (fs.existsSync(webAppEnvPath)) {
    try {
      const webAppEnvContent = fs.readFileSync(webAppEnvPath, 'utf8');
      const secretMatch = webAppEnvContent.match(/MCP_SHARED_SECRET=(.+)/);
      if (secretMatch) {
        mcpSharedSecret = secretMatch[1].trim();
      }
    } catch (error) {
      // Continue without existing secret
    }
  }
  
  // Generate new secret if none found
  if (!mcpSharedSecret) {
    mcpSharedSecret = crypto.randomBytes(32).toString('hex');
    
    // Add to web-app .env file
    try {
      const webAppEnvContent = fs.readFileSync(webAppEnvPath, 'utf8');
      if (!webAppEnvContent.includes('MCP_SHARED_SECRET=')) {
        const updatedContent = webAppEnvContent + `\n# MCP Security - Shared secret for MCP server authentication
# Generate with: openssl rand -hex 32
MCP_SHARED_SECRET=${mcpSharedSecret}\n`;
        fs.writeFileSync(webAppEnvPath, updatedContent);
        logSuccess('Added MCP shared secret to web-app environment');
      }
    } catch (error) {
      logWarning('Could not update web-app .env file with shared secret');
    }
  }
  
  // Create or update MCP server .env file
  const mcpServerEnvContent = `AUTH_SERVER_URL=http://localhost:3000
MCP_SHARED_SECRET=${mcpSharedSecret}
DISABLE_CONFIDENTIALITY_CHECK=${enableConfidentialityProtection ? 'false' : 'true'}
`;
  
  try {
    fs.writeFileSync(mcpServerEnvPath, mcpServerEnvContent);
    logSuccess('MCP server environment configuration ensured');
    
    // Store the shared secret for Claude Desktop configuration
    global.setupMCPSharedSecret = mcpSharedSecret;
  } catch (error) {
    logError('Failed to create MCP server environment file');
    logError(error.message);
    process.exit(1);
  }
}

// Check if applications are already built
function checkExistingBuilds() {
  const webAppBuilt = fs.existsSync('web-app/dist') && fs.readdirSync('web-app/dist').length > 0;
  const mcpServerBuilt = fs.existsSync('mcp-server/dist') && fs.readdirSync('mcp-server/dist').length > 0;
  
  return { webAppBuilt, mcpServerBuilt };
}

// Build applications
function buildApplications() {
  log('\n🔨 Building applications...', 'cyan');
  
  const builds = checkExistingBuilds();
  
  try {
    if (!builds.webAppBuilt) {
      log('Building web-app...');
      execSync('npm run build', { cwd: 'web-app', stdio: 'inherit' });
      logSuccess('Web-app built successfully');
    } else {
      logSuccess('Web-app already built');
    }

    if (!builds.mcpServerBuilt) {
      log('Building MCP server...');
      execSync('npm run build', { cwd: 'mcp-server', stdio: 'inherit' });
      logSuccess('MCP server built successfully');
    } else {
      logSuccess('MCP server already built');
    }

    // If both were already built, offer to rebuild
    if (builds.webAppBuilt && builds.mcpServerBuilt) {
      logInfo('Both applications are already built');
    }
  } catch (error) {
    logError('Failed to build applications');
    logError(error.message);
    process.exit(1);
  }
}

// Check if Claude Desktop is already configured
function checkClaudeConfiguration(requiredSecret) {
  const configPath = getClaudeConfigPath();
  
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers && config.mcpServers['wordpress-reader']) {
        // If no secret required, just check for existence
        if (!requiredSecret) {
          return true;
        }
        
        // Check if the configuration includes the required shared secret
        const wpReader = config.mcpServers['wordpress-reader'];
        if (wpReader.env && wpReader.env.MCP_SHARED_SECRET === requiredSecret) {
          return true;
        }
      }
    } catch (error) {
      // Ignore parse errors, will reconfigure
    }
  }
  
  return false;
}

// Configure Claude Desktop
function configureClaudeDesktop() {
  log('\n🎯 Configuring Claude Desktop...', 'cyan');
  
  const configPath = getClaudeConfigPath();
  const currentDir = process.cwd();
  const mcpServerPath = path.join(currentDir, 'mcp-server/dist/index.js');
  
  logInfo(`Claude config file: ${configPath}`);
  
  // Get the MCP shared secret
  let mcpSharedSecret = global.setupMCPSharedSecret;
  
  // If not available from setup, try to read from environment files
  if (!mcpSharedSecret) {
    try {
      const webAppEnvPath = 'web-app/.env';
      if (fs.existsSync(webAppEnvPath)) {
        const webAppEnvContent = fs.readFileSync(webAppEnvPath, 'utf8');
        const secretMatch = webAppEnvContent.match(/MCP_SHARED_SECRET=(.+)/);
        if (secretMatch) {
          mcpSharedSecret = secretMatch[1].trim();
        }
      }
    } catch (error) {
      logWarning('Could not read MCP shared secret from environment files');
    }
  }
  
  if (!mcpSharedSecret) {
    logError('MCP shared secret not available - this is required for security');
    return false;
  }
  
  // Check if already configured with correct secret
  if (checkClaudeConfiguration(mcpSharedSecret)) {
    logSuccess('WordPress Reader is already configured in Claude Desktop');
    return true;
  }
  
  try {
    let config = {};
    
    // Read existing config if it exists
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configContent);
    }
    
    // Ensure mcpServers object exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // Add our WordPress Reader server with security
    config.mcpServers['wordpress-reader'] = {
      command: 'node',
      args: [mcpServerPath],
      env: {
        AUTH_SERVER_URL: 'http://localhost:3000',
        MCP_SHARED_SECRET: mcpSharedSecret
      }
    };
    
    // Create config directory if it doesn't exist
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logSuccess('Claude Desktop configured successfully with security settings');
    
    return true;
  } catch (error) {
    logWarning('Failed to automatically configure Claude Desktop');
    logError(error.message);
    return false;
  }
}

// Show manual configuration instructions
function showManualConfig() {
  const currentDir = process.cwd();
  const mcpServerPath = path.join(currentDir, 'mcp-server/dist/index.js');
  const configPath = getClaudeConfigPath();
  
  // Get the MCP shared secret
  let mcpSharedSecret = global.setupMCPSharedSecret;
  
  // If not available from setup, try to read from environment files
  if (!mcpSharedSecret) {
    try {
      const webAppEnvPath = 'web-app/.env';
      if (fs.existsSync(webAppEnvPath)) {
        const webAppEnvContent = fs.readFileSync(webAppEnvPath, 'utf8');
        const secretMatch = webAppEnvContent.match(/MCP_SHARED_SECRET=(.+)/);
        if (secretMatch) {
          mcpSharedSecret = secretMatch[1].trim();
        }
      }
    } catch (error) {
      // Continue without secret
    }
  }
  
  if (!mcpSharedSecret) {
    mcpSharedSecret = 'YOUR_MCP_SHARED_SECRET_HERE';
    logWarning('Could not determine MCP shared secret - please check your .env files');
  }
  
  log('\n📋 Manual Claude Desktop Configuration', 'yellow');
  log('Please add this to your Claude Desktop configuration file:');
  log(`File location: ${configPath}`, 'cyan');
  log('');
  log('Add this to the "mcpServers" section:', 'cyan');
  log('');
  
  const configSnippet = `{
  "mcpServers": {
    "wordpress-reader": {
      "command": "node",
      "args": ["${mcpServerPath}"],
    }
  }
}`;
  
  log(configSnippet, 'green');
  log('');
  log('If the file doesn\'t exist, create it with the content above.', 'yellow');
  log('If it exists, add the "wordpress-reader" entry to the existing "mcpServers" object.', 'yellow');
  if (mcpSharedSecret === 'YOUR_MCP_SHARED_SECRET_HERE') {
    log('');
    logWarning('IMPORTANT: Replace YOUR_MCP_SHARED_SECRET_HERE with the actual secret from web-app/.env');
  }
}

// Kill any zombie processes on port 3000
function killZombieProcesses() {
  try {
    const { execSync } = require('child_process');
    
    if (os.platform() === 'win32') {
      // Windows
      try {
        const result = execSync('netstat -ano | findstr :3000', { encoding: 'utf8' });
        const lines = result.split('\n');
        lines.forEach(line => {
          const match = line.trim().match(/\s+(\d+)$/);
          if (match) {
            const pid = match[1];
            execSync(`taskkill /pid ${pid} /F`, { stdio: 'ignore' });
          }
        });
      } catch (error) {
        // No processes found on port 3000
      }
    } else {
      // Unix-like systems
      try {
        const result = execSync('lsof -ti:3000', { encoding: 'utf8' });
        const pids = result.trim().split('\n').filter(p => p);
        if (pids.length > 0) {
          logInfo('Cleaning up zombie processes on port 3000...');
          execSync(`lsof -ti:3000 | xargs kill -9`, { stdio: 'ignore' });
          logSuccess('Zombie processes cleaned up');
        }
      } catch (error) {
        // No processes found on port 3000
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Start authentication process
async function startAuthentication() {
  log('\n🔐 Starting authentication process...', 'cyan');
  
  try {
    // Start the web server
    log('Starting authentication server...');
    const webServer = spawn('npm', ['run', 'dev'], { 
      cwd: 'web-app',
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if server is running
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
          logSuccess('Authentication server is running on http://localhost:3000');
        }
      }
    } catch (error) {
      logWarning('Server may still be starting...');
    }
    
    log('\n🌐 Opening authentication page...', 'cyan');
    log('Please complete the following steps:');
    log('1. A browser window will open to http://localhost:3000/auth/test');
    log('2. Click "Authenticate with WordPress.com"');
    log('3. Login to your WordPress.com account');
    log('4. Grant permissions to the application');
    log('5. You\'ll see a success message when complete');
    log('');
    
    // Try to open browser
    const authUrl = 'http://localhost:3000/auth/test';
    try {
      const platform = os.platform();
      if (platform === 'darwin') {
        execSync(`open "${authUrl}"`);
      } else if (platform === 'win32') {
        execSync(`start "${authUrl}"`);
      } else {
        execSync(`xdg-open "${authUrl}"`);
      }
      logSuccess('Browser opened to authentication page');
    } catch (error) {
      logWarning('Could not open browser automatically');
      log(`Please manually open: ${authUrl}`, 'cyan');
    }
    
    // Create a fresh readline interface for authentication prompt
    const authRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise(resolve => {
      authRl.question('\nPress Enter after you have completed authentication in the browser...', () => {
        authRl.close();
        resolve();
      });
    });
    
    log('Stopping authentication server...');
    // Stop the web server
    webServer.kill();
    logSuccess('Authentication completed');
    
  } catch (error) {
    logError('Authentication process failed');
    logError(error.message);
    log('\nYou can manually start the authentication server later with:', 'yellow');
    log('cd web-app && npm run dev', 'cyan');
    log('Then visit: http://localhost:3000/auth/test', 'cyan');
  }
}

// Main setup function
async function main() {
  log('🚀 WordPress Reader for Claude Desktop - Setup', 'magenta');
  log('================================================', 'magenta');
  
  try {
    checkPrerequisites();
    installDependencies();
    
    const credentials = await getWordPressCredentials();
    const enableConfidentialityProtection = await promptForConfidentialityProtection();
    createEnvironmentFile(credentials, enableConfidentialityProtection);
    buildApplications();
    
    const claudeConfigured = configureClaudeDesktop();
    if (!claudeConfigured) {
      showManualConfig();
      
      const continueSetup = await askQuestion('\nDid you manually configure Claude Desktop? (y/n): ');
      if (continueSetup.toLowerCase() !== 'y') {
        log('\nSetup paused. Configure Claude Desktop and run the setup again.', 'yellow');
        process.exit(0);
      }
    }
    
    await startAuthentication();
    
    // Start the background service
    log('\n🚀 Starting background service...', 'cyan');
    
    // Clean up any zombie processes first
    killZombieProcesses();
    
    try {
      execSync('node service-manager.js auto-start', { stdio: 'inherit' });
      logSuccess('Background auth service is now running');
    } catch (error) {
      logWarning('Failed to start background service automatically');
      log('You can start it manually with: npm run service:start', 'yellow');
    }
    
    log('\n🎉 Setup Complete!', 'green');
    log('==================', 'green');
    log('');
    logSuccess('WordPress Reader is now configured for Claude Desktop');
    logSuccess('Background authentication service is running');
    logSuccess('Security hardening with shared secrets is enabled');
    log('');
    log('🔒 Security Features:', 'cyan');
    log('• Localhost-only access to authentication endpoints');
    log('• Shared secret authentication between MCP server and auth service');
    log('• Rate limiting on sensitive endpoints');
    log('• Persistent token storage with automatic cleanup');
    log('');
    log('⚠️  IMPORTANT: You must restart Claude Desktop completely', 'yellow');
    log('   for the new security configuration to take effect!', 'yellow');
    log('');
    log('Next steps:', 'cyan');
    log('1. 🔄 Restart Claude Desktop completely (Quit and reopen)');
    log('2. ✅ Try these commands in Claude:');
    log('   • "Show me my WordPress Reader feed"');
    log('   • "How many unread notifications do I have?"');
    log('   • "Get posts tagged with technology"');
    log('   • "Create a new blog post"');
    log('   • "Show comments on my latest post"');
    log('');
    log('📊 Available APIs (37 tools):', 'cyan');
    log('• Reader API: Feed management, following, tags');
    log('• Notifications API: Check and manage notifications');
    log('• Comments API: Read, create, and manage comments');
    log('• Posts API: Complete CRUD operations for posts');
    log('');
    log('Service management:', 'cyan');
    log('• Check status: npm run service:status');
    log('• View logs: npm run service:logs');
    log('• Restart: npm run service:restart');
    log('');
    log('If you need help, check the README.md file for troubleshooting.', 'blue');
    
  } catch (error) {
    logError('Setup failed');
    logError(error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  logError('Setup failed with error:');
  console.error(error);
  process.exit(1);
});

// Run setup
main();