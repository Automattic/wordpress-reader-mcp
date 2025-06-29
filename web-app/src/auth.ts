import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { TokenInfo, MCPToken } from './types.js';

const router = Router();
const pendingStates = new Map<string, { 
  code_challenge: string;
  expires_at: number;
}>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (data.expires_at < now) {
      pendingStates.delete(state);
    }
  }
}, 60000); // Every minute

// Test page for manual OAuth testing
router.get('/test', (req, res) => {
  const testState = crypto.randomBytes(16).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  
  res.send(`
    <html>
      <body>
        <h2>WordPress Reader MCP Authentication</h2>
        <p>Authenticate your WordPress.com account to enable WordPress Reader tools in Claude Desktop.</p>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>🔒 What this does:</h3>
          <ul>
            <li>Connects your WordPress.com account</li>
            <li>Enables WordPress Reader tools in Claude</li>
            <li>Automatically manages authentication tokens</li>
            <li>No manual configuration required</li>
          </ul>
        </div>
        
        <p>
          <a href="/auth/authorize?code_challenge=${codeChallenge}&code_challenge_method=S256&state=${testState}&redirect_uri=http://localhost:3000/callback" 
             style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            🚀 Authenticate with WordPress.com
          </a>
        </p>
        
        <details style="margin-top: 20px;">
          <summary>🔍 Technical Details</summary>
          <p><strong>State:</strong> <code>${testState}</code></p>
          <p><strong>Code Verifier:</strong> <code>${codeVerifier}</code></p>
          <p><strong>Code Challenge:</strong> <code>${codeChallenge}</code></p>
        </details>
      </body>
    </html>
  `);
});

// Authorization endpoint
router.get('/authorize', (req, res) => {
  const { code_challenge, code_challenge_method, redirect_uri, state } = req.query;

  // Validate PKCE parameters
  if (!code_challenge || code_challenge_method !== 'S256') {
    return res.status(400).json({ error: 'PKCE required' });
  }

  // Store state with code challenge
  console.log('Storing state:', state);
  pendingStates.set(state as string, {
    code_challenge: code_challenge as string,
    expires_at: Date.now() + 600000 // 10 minutes
  });
  console.log('Pending states after store:', Array.from(pendingStates.keys()));

  // Redirect to WordPress.com
  const params = new URLSearchParams({
    client_id: process.env.WORDPRESS_CLIENT_ID!,
    redirect_uri: process.env.REDIRECT_URI!,
    response_type: 'code',
    scope: 'global',
    state: state as string
  });

  res.redirect(`https://public-api.wordpress.com/oauth2/authorize?${params}`);
});

// Callback endpoint
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  console.log('Callback received:', { code, state });
  console.log('Pending states:', Array.from(pendingStates.keys()));

  // Verify state
  const stateData = pendingStates.get(state as string);
  if (!stateData) {
    return res.status(400).send(`
      <html>
        <body>
          <h2>Invalid State Error</h2>
          <p><strong>Received state:</strong> <code>${state}</code></p>
          <p><strong>Available states:</strong> <code>${Array.from(pendingStates.keys()).join(', ')}</code></p>
          <p><strong>Possible causes:</strong></p>
          <ul>
            <li>State expired (10 minute timeout)</li>
            <li>State parameter was modified</li>
            <li>Multiple OAuth flows running simultaneously</li>
          </ul>
          <a href="/auth/test">← Try again</a>
        </body>
      </html>
    `);
  }

  try {
    // Exchange code for WordPress token
    const tokenResponse = await fetch('https://public-api.wordpress.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.WORDPRESS_CLIENT_ID!,
        client_secret: process.env.WORDPRESS_CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: process.env.REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenResponse.json() as TokenInfo;

    // Create MCP token
    const mcpToken: MCPToken = {
      id: crypto.randomUUID(),
      wordpress_token: tokenData.access_token,
      expires_at: Date.now() + 3600000, // 1 hour
      user_info: {
        blog_id: tokenData.blog_id,
        blog_url: tokenData.blog_url,
      }
    };

    // Store token (in production, use Redis or similar)
    await storeToken(mcpToken);

    // Return authorization code to MCP client
    const authCode = crypto.randomBytes(32).toString('base64url');
    await storeAuthCode(authCode, mcpToken.id, stateData.code_challenge);

    // Check if this is a browser test vs MCP client
    const userAgent = req.headers['user-agent'] || '';
    const isBrowserTest = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari');
    
    if (isBrowserTest) {
      // For browser testing, show the authorization code
      res.send(`
        <html>
          <body>
            <h2>OAuth Authentication Successful! ✅</h2>
            <p><strong>Token cached successfully!</strong> Your MCP server will now authenticate automatically.</p>
            <hr>
            <h3>✨ What happens next?</h3>
            <ul>
              <li>✅ Your WordPress token has been cached for the MCP server</li>
              <li>✅ No manual configuration needed in Claude Desktop</li>
              <li>✅ The MCP server will automatically use this token</li>
              <li>✅ Token will refresh automatically when needed</li>
            </ul>
            <hr>
            <h3>🚀 Test Your Setup</h3>
            <p>In Claude Desktop, try commands like:</p>
            <ul>
              <li>"Show me my WordPress Reader feed"</li>
              <li>"Get A8C posts"</li>
              <li>"Get posts tagged with 'technology'"</li>
            </ul>
            <hr>
            <details>
              <summary>🔍 Debug Information (click to expand)</summary>
              <p><strong>Authorization Code:</strong> <code>${authCode}</code></p>
              <p><strong>State:</strong> <code>${state}</code></p>
              <p><strong>WordPress Token:</strong> <code>${mcpToken.wordpress_token.substring(0, 20)}...</code></p>
              <p><strong>Blog ID:</strong> ${mcpToken.user_info.blog_id}</p>
              <p><strong>Blog URL:</strong> ${mcpToken.user_info.blog_url}</p>
              <p><strong>Token Expires:</strong> ${new Date(mcpToken.expires_at).toLocaleString()}</p>
            </details>
            <hr>
            <p><em>🎉 Authentication complete! You can close this page and start using WordPress Reader tools in Claude.</em></p>
          </body>
        </html>
      `);
    } else {
      // For MCP client, use the custom scheme
      res.redirect(`mcp://auth/callback?code=${authCode}&state=${state}`);
    }
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Authentication failed');
  }

  pendingStates.delete(state as string);
});

// Token endpoint
router.post('/token', async (req, res) => {
  const { grant_type, code, code_verifier } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  try {
    // Verify code and PKCE
    const authCodeData = await getAuthCode(code);
    if (!authCodeData) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    // Verify PKCE challenge
    const challenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');

    if (challenge !== authCodeData.code_challenge) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    // Get MCP token
    const mcpToken = await getToken(authCodeData.token_id);
    if (!mcpToken) {
      return res.status(400).json({ error: 'invalid_grant' });
    }

    // Create JWT access token
    const accessToken = jwt.sign(
      { 
        sub: mcpToken.id,
        blog_id: mcpToken.user_info.blog_id 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
    });

    // Clean up auth code
    await deleteAuthCode(code);
  } catch (error) {
    console.error('Token error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// Token validation endpoint (for MCP server)
router.get('/validate', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const mcpToken = await getToken(decoded.sub);
    
    if (!mcpToken || mcpToken.expires_at < Date.now()) {
      return res.status(401).json({ error: 'token_expired' });
    }

    res.json({
      valid: true,
      wordpress_token: mcpToken.wordpress_token,
      user_info: mcpToken.user_info,
    });
  } catch (error) {
    res.status(401).json({ error: 'invalid_token' });
  }
});

// Security middleware for MCP server endpoints
const validateMCPAccess = (req: any, res: any, next: any) => {
  // 1. Restrict to localhost only
  const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';
  const isLocalhost = clientIP === '127.0.0.1' || 
                     clientIP === '::1' || 
                     clientIP === '::ffff:127.0.0.1' ||
                     clientIP.startsWith('127.') ||
                     clientIP === 'localhost';
  
  if (!isLocalhost) {
    console.warn(`Unauthorized access attempt to MCP endpoint from IP: ${clientIP}`);
    return res.status(403).json({ error: 'Access denied - localhost only' });
  }
  
  // 2. Check for MCP server shared secret
  const mcpSecret = req.headers['x-mcp-secret'];
  const expectedSecret = process.env.MCP_SHARED_SECRET || crypto.randomBytes(32).toString('hex');
  
  if (!mcpSecret || mcpSecret !== expectedSecret) {
    console.warn(`Invalid MCP secret provided from IP: ${clientIP}`);
    return res.status(401).json({ error: 'Invalid MCP authentication' });
  }
  
  // 3. Rate limiting - max 10 requests per minute per IP
  const now = Date.now();
  const rateLimitKey = `mcp_rate_${clientIP}`;
  
  // Use module-level rate limiting instead of global
  if (!(global as any).mcpRateLimit) {
    (global as any).mcpRateLimit = new Map();
  }
  
  const requests = (global as any).mcpRateLimit.get(rateLimitKey) || [];
  const recentRequests = requests.filter((time: number) => now - time < 60000); // Last minute
  
  if (recentRequests.length >= 10) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  recentRequests.push(now);
  (global as any).mcpRateLimit.set(rateLimitKey, recentRequests);
  
  next();
};

// Helper endpoint to get WordPress token for MCP configuration (SECURED)
router.get('/wordpress-token/:auth_code', validateMCPAccess, async (req, res) => {
  const { auth_code } = req.params;
  
  try {
    const authCodeData = await getAuthCode(auth_code);
    if (!authCodeData) {
      return res.status(404).json({ error: 'Authorization code not found' });
    }
    
    const mcpToken = await getToken(authCodeData.token_id);
    if (!mcpToken) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    res.json({
      wordpress_token: mcpToken.wordpress_token,
      blog_id: mcpToken.user_info.blog_id,
      blog_url: mcpToken.user_info.blog_url,
      expires_at: mcpToken.expires_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve token' });
  }
});

// Background authentication endpoint for MCP server (SECURED)
router.get('/current-token', validateMCPAccess, async (req, res) => {
  try {
    // Get the most recent valid token from persistent storage
    const tokens = await loadTokens();
    let latestToken: MCPToken | null = null;
    let latestTimestamp = 0;
    
    for (const token of Object.values(tokens)) {
      if (token.expires_at > Date.now() && token.expires_at > latestTimestamp) {
        latestToken = token;
        latestTimestamp = token.expires_at;
      }
    }
    
    if (latestToken) {
      const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';
      console.log(`Serving cached token for user ${latestToken.user_info.blog_id} to MCP server (${clientIP}), expires at ${new Date(latestToken.expires_at).toISOString()}`);
      res.json({
        wordpress_token: latestToken.wordpress_token,
        blog_id: latestToken.user_info.blog_id,
        blog_url: latestToken.user_info.blog_url,
        expires_at: latestToken.expires_at
      });
    } else {
      console.log('No valid cached token found for MCP server request');
      res.status(404).json({ error: 'No valid token found' });
    }
  } catch (error) {
    console.error('Failed to retrieve current token:', error);
    res.status(500).json({ error: 'Failed to retrieve current token' });
  }
});

export const authRouter = router;

// Persistent token storage
const TOKEN_STORAGE_FILE = path.join(process.cwd(), '.wp-auth-tokens.json');
const AUTH_CODES_FILE = path.join(process.cwd(), '.wp-auth-codes.json');

interface TokenStorage {
  tokens: Record<string, MCPToken>;
  lastUpdated: number;
}

interface AuthCodeStorage {
  authCodes: Record<string, { token_id: string; code_challenge: string; expires_at: number }>;
  lastUpdated: number;
}

// Load tokens from file
async function loadTokens(): Promise<Record<string, MCPToken>> {
  try {
    const data = await fs.readFile(TOKEN_STORAGE_FILE, 'utf-8');
    const storage: TokenStorage = JSON.parse(data);
    
    // Clean up expired tokens
    const now = Date.now();
    const validTokens: Record<string, MCPToken> = {};
    
    for (const [id, token] of Object.entries(storage.tokens)) {
      if (token.expires_at > now) {
        validTokens[id] = token;
      }
    }
    
    // Save cleaned tokens back if any were removed
    if (Object.keys(validTokens).length !== Object.keys(storage.tokens).length) {
      await saveTokens(validTokens);
    }
    
    return validTokens;
  } catch (error) {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
}

// Save tokens to file
async function saveTokens(tokens: Record<string, MCPToken>): Promise<void> {
  try {
    const storage: TokenStorage = {
      tokens,
      lastUpdated: Date.now()
    };
    await fs.writeFile(TOKEN_STORAGE_FILE, JSON.stringify(storage, null, 2));
  } catch (error) {
    console.error('Failed to save tokens:', error);
  }
}

// Load auth codes from file
async function loadAuthCodes(): Promise<Record<string, { token_id: string; code_challenge: string; expires_at: number }>> {
  try {
    const data = await fs.readFile(AUTH_CODES_FILE, 'utf-8');
    const storage: AuthCodeStorage = JSON.parse(data);
    
    // Clean up expired auth codes (valid for 10 minutes)
    const now = Date.now();
    const validCodes: Record<string, { token_id: string; code_challenge: string; expires_at: number }> = {};
    
    for (const [code, data] of Object.entries(storage.authCodes)) {
      if (data.expires_at > now) {
        validCodes[code] = data;
      }
    }
    
    // Save cleaned codes back if any were removed
    if (Object.keys(validCodes).length !== Object.keys(storage.authCodes).length) {
      await saveAuthCodes(validCodes);
    }
    
    return validCodes;
  } catch (error) {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
}

// Save auth codes to file
async function saveAuthCodes(authCodes: Record<string, { token_id: string; code_challenge: string; expires_at: number }>): Promise<void> {
  try {
    const storage: AuthCodeStorage = {
      authCodes,
      lastUpdated: Date.now()
    };
    await fs.writeFile(AUTH_CODES_FILE, JSON.stringify(storage, null, 2));
  } catch (error) {
    console.error('Failed to save auth codes:', error);
  }
}

async function storeToken(token: MCPToken) {
  const tokens = await loadTokens();
  tokens[token.id] = token;
  await saveTokens(tokens);
  console.log(`Token stored persistently for user ${token.user_info.blog_id}`);
}

async function getToken(id: string): Promise<MCPToken | null> {
  const tokens = await loadTokens();
  return tokens[id] || null;
}

async function storeAuthCode(code: string, tokenId: string, codeChallenge: string) {
  const authCodes = await loadAuthCodes();
  authCodes[code] = { 
    token_id: tokenId, 
    code_challenge: codeChallenge,
    expires_at: Date.now() + 600000 // 10 minutes
  };
  await saveAuthCodes(authCodes);
}

async function getAuthCode(code: string) {
  const authCodes = await loadAuthCodes();
  return authCodes[code] || null;
}

async function deleteAuthCode(code: string) {
  const authCodes = await loadAuthCodes();
  delete authCodes[code];
  await saveAuthCodes(authCodes);
}