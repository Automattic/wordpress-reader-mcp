import fetch from 'node-fetch';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

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
    console.error('Token validation error:', error);
    return { valid: false };
  }
}

export async function getBackgroundToken(): Promise<string | null> {
  try {
    // Try to load cached token first
    const cachedToken = await loadCachedToken();
    if (cachedToken && cachedToken.expires_at > Date.now()) {
      console.log('Using cached WordPress token');
      return cachedToken.wordpress_token;
    }

    // Check if there's a current valid session in the auth server
    const response = await fetch(`${AUTH_SERVER_URL}/auth/current-token`, {
      method: 'GET',
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
    console.error('Background token retrieval error:', error);
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
      `redirect_uri=${AUTH_SERVER_URL}/callback&` +
      `source=mcp-background`;

    return authUrl;
  } catch (error) {
    console.error('Background auth initiation error:', error);
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
    console.error('Failed to cache token:', error);
  }
}

async function saveAuthState(state: { codeVerifier: string; state: string }): Promise<void> {
  try {
    const stateFile = path.join(process.cwd(), '.mcp-auth-state.json');
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to save auth state:', error);
  }
}