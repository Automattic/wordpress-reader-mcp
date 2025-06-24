import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import { TokenInfo, MCPToken } from '../../shared/types.js';

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

// Authorization endpoint
router.get('/authorize', (req, res) => {
  const { code_challenge, code_challenge_method, redirect_uri, state } = req.query;

  // Validate PKCE parameters
  if (!code_challenge || code_challenge_method !== 'S256') {
    return res.status(400).json({ error: 'PKCE required' });
  }

  // Store state with code challenge
  pendingStates.set(state as string, {
    code_challenge: code_challenge as string,
    expires_at: Date.now() + 600000 // 10 minutes
  });

  // Redirect to WordPress.com
  const params = new URLSearchParams({
    client_id: process.env.WORDPRESS_CLIENT_ID!,
    redirect_uri: process.env.REDIRECT_URI!,
    response_type: 'code',
    scope: 'auth',
    state: state as string
  });

  res.redirect(`https://public-api.wordpress.com/oauth2/authorize?${params}`);
});

// Callback endpoint
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify state
  const stateData = pendingStates.get(state as string);
  if (!stateData) {
    return res.status(400).send('Invalid state');
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

    res.redirect(`mcp://auth/callback?code=${authCode}&state=${state}`);
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

export const authRouter = router;

// Token storage (implement with Redis in production)
const tokens = new Map<string, MCPToken>();
const authCodes = new Map<string, { token_id: string; code_challenge: string }>();

async function storeToken(token: MCPToken) {
  tokens.set(token.id, token);
}

async function getToken(id: string): Promise<MCPToken | null> {
  return tokens.get(id) || null;
}

async function storeAuthCode(code: string, tokenId: string, codeChallenge: string) {
  authCodes.set(code, { token_id: tokenId, code_challenge: codeChallenge });
}

async function getAuthCode(code: string) {
  return authCodes.get(code) || null;
}

async function deleteAuthCode(code: string) {
  authCodes.delete(code);
}