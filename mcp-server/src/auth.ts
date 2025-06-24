import fetch from 'node-fetch';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { log, logError } from './logger.js';

const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://localhost:3000';
const TOKEN_CACHE_FILE = path.join(process.cwd(), '.mcp-auth-cache.json');

interface CachedAuth {
  wordpress_token: string;
  expires_at: number;
  user_info: any;
}

export async function validateToken(token: string): Promise<{
  valid: boolean;
  wordpress_token?: string;
  user_info?: any;
}> {
  try {
    const response = await fetch(`${AUTH_SERVER_URL}/auth/validate`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json() as any;
    return data;
  } catch (error) {
    logError('Token validation error', error);
    return { valid: false };
  }
}

// Check if auth server is healthy
async function checkAuthServerHealth(): Promise<boolean> {
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${AUTH_SERVER_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Try to start auth server if it's not running
async function ensureAuthServerRunning(): Promise<boolean> {
  try {
    // Check if server is already running
    if (await checkAuthServerHealth()) {
      return true;
    }

    log('Auth server not responding, attempting to start...');
    
    // Try to find the project root and start the service
    const projectRoot = findProjectRoot();
    if (projectRoot) {
      execSync('node service-manager.js auto-start', { 
        cwd: projectRoot,
        stdio: 'ignore',
        timeout: 10000
      });
      
      // Wait a moment for startup
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if it's now running
      if (await checkAuthServerHealth()) {
        log('Successfully started auth server');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logError('Failed to start auth server', error);
    return false;
  }
}

// Find project root directory
function findProjectRoot(): string | null {
  let currentDir = process.cwd();
  const maxLevels = 5; // Prevent infinite loop
  
  for (let i = 0; i < maxLevels; i++) {
    try {
      // Use sync version for directory traversal since it's simpler
      const { existsSync } = require('fs');
      if (existsSync(path.join(currentDir, 'service-manager.js'))) {
        return currentDir;
      }
    } catch (error) {
      // Continue to next directory
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root directory
    }
    currentDir = parentDir;
  }
  
  return null;
}

export async function getBackgroundToken(): Promise<string | null> {
  try {
    // Try to load cached token first
    const cachedToken = await loadCachedToken();
    if (cachedToken && cachedToken.expires_at > Date.now()) {
      log('Using cached WordPress token');
      return cachedToken.wordpress_token;
    }

    // Ensure auth server is running
    if (!(await ensureAuthServerRunning())) {
      log('Auth server is not available');
      return null;
    }

    // Check if there's a current valid session in the auth server
    const mcpSecret = process.env.MCP_SHARED_SECRET;
    if (!mcpSecret) {
      log('MCP_SHARED_SECRET not configured - cannot access secured endpoints');
      return null;
    }

    const response = await fetch(`${AUTH_SERVER_URL}/auth/current-token`, {
      method: 'GET',
      headers: {
        'X-MCP-Secret': mcpSecret
      }
    });

    if (response.ok) {
      const tokenData = await response.json() as any;
      if (tokenData.wordpress_token) {
        // Cache the token
        await saveCachedToken({
          wordpress_token: tokenData.wordpress_token,
          expires_at: tokenData.expires_at || (Date.now() + 3600000), // 1 hour default
          user_info: tokenData.user_info
        });
        return tokenData.wordpress_token;
      }
    }

    return null;
  } catch (error) {
    logError('Background token retrieval error', error);
    return null;
  }
}

export async function initiateBackgroundAuth(): Promise<string> {
  try {
    // Generate PKCE parameters
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('base64url');

    // Store the code verifier for later use
    await saveAuthState({ codeVerifier, state });

    // Create authorization URL
    const authUrl = `${AUTH_SERVER_URL}/auth/authorize?` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256&` +
      `state=${state}&` +
      `redirect_uri=${AUTH_SERVER_URL}/auth/callback&` +
      `source=mcp-background`;

    return authUrl;
  } catch (error) {
    logError('Background auth initiation error', error);
    return `${AUTH_SERVER_URL}/auth/test`;
  }
}

async function loadCachedToken(): Promise<CachedAuth | null> {
  try {
    const data = await fs.readFile(TOKEN_CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function saveCachedToken(token: CachedAuth): Promise<void> {
  try {
    await fs.writeFile(TOKEN_CACHE_FILE, JSON.stringify(token, null, 2));
  } catch (error) {
    logError('Failed to cache token', error);
  }
}

async function saveAuthState(state: { codeVerifier: string; state: string }): Promise<void> {
  try {
    const stateFile = path.join(process.cwd(), '.mcp-auth-state.json');
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    logError('Failed to save auth state', error);
  }
}