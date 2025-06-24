# WordPress.com Reader API MCP Server Implementation Guide

## Project Overview

Build an MCP (Model Context Protocol) server that provides Claude with access to WordPress.com Reader API functionality through OAuth 2.0 authentication.

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Claude    │────▶│  MCP Server  │────▶│   Web App      │
│  (Client)   │◀────│  (Bridge)    │◀────│ (OAuth Handler)│
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │ WordPress.com   │
                                          │   OAuth/API     │
                                          └─────────────────┘
```

## Prerequisites

- Node.js 20+ with TypeScript support
- Basic understanding of OAuth 2.0 flow
- WordPress.com developer account for OAuth app registration

## Project Structure

```
wordpress-reader-mcp/
├── web-app/                 # OAuth handler web application
│   ├── src/
│   │   ├── index.ts        # Express server
│   │   ├── auth.ts         # OAuth implementation
│   │   ├── tokens.ts       # Token management
│   │   └── discovery.ts    # OAuth discovery endpoints
│   ├── package.json
│   └── tsconfig.json
├── mcp-server/             # MCP server
│   ├── src/
│   │   ├── index.ts        # MCP server entry
│   │   ├── tools.ts        # Reader API tools
│   │   ├── auth.ts         # Token validation
│   │   └── wordpress-api.ts # API client
│   ├── package.json
│   └── tsconfig.json
├── shared/                 # Shared types and utilities
│   └── types.ts
└── README.md
```

## Step 1: Register WordPress.com OAuth Application

1. Go to https://developer.wordpress.com/apps/
2. Create a new application
3. Set redirect URI to: `http://localhost:3000/callback` (development)
4. Note your Client ID and Client Secret
5. Requested scopes: `auth` (for Reader API access)

## Step 2: Create Shared Types

Create `shared/types.ts`:

```typescript
export interface TokenInfo {
  access_token: string;
  token_type: string;
  blog_id: string;
  blog_url: string;
  scope: string;
}

export interface MCPToken {
  id: string;
  wordpress_token: string;
  expires_at: number;
  user_info: {
    blog_id: string;
    blog_url: string;
  };
}

export interface OAuthConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  authorization_base_url: string;
  token_url: string;
}
```

## Step 3: Implement Web Application (OAuth Handler)

### 3.1 Environment Configuration

Create `web-app/.env`:

```
WORDPRESS_CLIENT_ID=your_client_id
WORDPRESS_CLIENT_SECRET=your_client_secret
REDIRECT_URI=http://localhost:3000/callback
PORT=3000
JWT_SECRET=generate_a_secure_random_string
MCP_SERVER_URL=http://localhost:3001
```

### 3.2 Express Server Setup

Create `web-app/src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './auth';
import { discoveryRouter } from './discovery';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.MCP_SERVER_URL,
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/.well-known', discoveryRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OAuth handler running on port ${PORT}`);
});
```

### 3.3 OAuth Implementation

Create `web-app/src/auth.ts`:

```typescript
import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import { TokenInfo, MCPToken } from '../../shared/types';

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
    scope: 'global',
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
```

### 3.4 OAuth Discovery Endpoints

Create `web-app/src/discovery.ts`:

```typescript
import { Router } from 'express';

const router = Router();

// OAuth Authorization Server Metadata
router.get('/oauth-authorization-server', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/auth/authorize`,
    token_endpoint: `${baseUrl}/auth/token`,
    token_endpoint_auth_methods_supported: ['none'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
  });
});

// Protected Resource Metadata
router.get('/oauth-protected-resource', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    resource: baseUrl,
    authorization_servers: [`${baseUrl}`],
  });
});

export const discoveryRouter = router;
```

## Step 4: Implement MCP Server

### 4.1 MCP Server Configuration

Create `mcp-server/src/index.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readerTools } from './tools';
import { validateToken } from './auth';

const server = new Server(
  {
    name: 'wordpress-reader-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(readerTools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Get auth token from request context
  const authToken = request.params._meta?.auth_token;
  if (!authToken) {
    throw new Error('Authentication required');
  }

  // Validate token and get WordPress token
  const tokenInfo = await validateToken(authToken);
  if (!tokenInfo.valid) {
    throw new Error('Invalid authentication token');
  }

  const tool = readerTools[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.handler(args, tokenInfo.wordpress_token);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { 
      content: [{ 
        type: 'text', 
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }],
      isError: true,
    };
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
```

### 4.2 Reader API Tools Implementation

Create `mcp-server/src/tools.ts`:

```typescript
import { z } from 'zod';
import { callWordPressAPI } from './wordpress-api';

interface Tool {
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any, token: string) => Promise<any>;
}

export const readerTools: Record<string, Tool> = {
  // Get default reader menu
  getReaderMenu: {
    description: 'Get default reader menu',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/menu', token);
    },
  },

  // Get feed details
  getFeed: {
    description: 'Get details about a feed',
    inputSchema: {
      type: 'object',
      properties: {
        feed_url_or_id: {
          type: 'string',
          description: 'Feed URL or ID',
        },
      },
      required: ['feed_url_or_id'],
    },
    handler: async (args, token) => {
      return callWordPressAPI(`/read/feed/${encodeURIComponent(args.feed_url_or_id)}`, token);
    },
  },

  // Get a single post
  getPost: {
    description: 'Get a single post by ID',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site domain or ID',
        },
        post_id: {
          type: 'string',
          description: 'Post ID',
        },
      },
      required: ['site', 'post_id'],
    },
    handler: async (args, token) => {
      return callWordPressAPI(`/read/sites/${args.site}/posts/${args.post_id}`, token);
    },
  },

  // Get following posts
  getFollowingPosts: {
    description: 'Get a list of posts from the blogs a user follows',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Number of posts to return (default: 20)',
        },
        page: {
          type: 'number',
          description: 'Page number',
        },
      },
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      if (args.page) params.append('page', args.page.toString());
      
      return callWordPressAPI(`/read/following?${params}`, token);
    },
  },

  // Get liked posts
  getLikedPosts: {
    description: 'Get a list of posts from the blogs a user likes',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Number of posts to return',
        },
      },
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      
      return callWordPressAPI(`/read/liked?${params}`, token);
    },
  },

  // Get posts by tag
  getTagPosts: {
    description: 'Get a list of posts from a tag',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Tag name',
        },
        number: {
          type: 'number',
          description: 'Number of posts to return',
        },
      },
      required: ['tag'],
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      
      return callWordPressAPI(`/read/tags/${encodeURIComponent(args.tag)}/posts?${params}`, token);
    },
  },

  // Get user tags
  getUserTags: {
    description: 'Get a list of tags subscribed to by the user',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/tags', token);
    },
  },

  // Subscribe to tag
  subscribeToTag: {
    description: 'Subscribe to a new tag',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Tag name to subscribe to',
        },
      },
      required: ['tag'],
    },
    handler: async (args, token) => {
      return callWordPressAPI(
        `/read/tags/${encodeURIComponent(args.tag)}/mine/new`,
        token,
        'POST'
      );
    },
  },

  // Unsubscribe from tag
  unsubscribeFromTag: {
    description: 'Unsubscribe from a tag',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Tag name to unsubscribe from',
        },
      },
      required: ['tag'],
    },
    handler: async (args, token) => {
      return callWordPressAPI(
        `/read/tags/${encodeURIComponent(args.tag)}/mine/delete`,
        token,
        'POST'
      );
    },
  },

  // Get following feeds
  getFollowingFeeds: {
    description: 'Get a list of the feeds the user is following',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/following/mine', token);
    },
  },

  // Follow a blog
  followBlog: {
    description: 'Follow the specified blog',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: {
          type: 'string',
          description: 'Blog URL to follow',
        },
      },
      required: ['site_url'],
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/following/mine/new', token, 'POST', {
        url: args.site_url,
      });
    },
  },

  // Unfollow a blog
  unfollowBlog: {
    description: 'Unfollow the specified blog',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: {
          type: 'string',
          description: 'Blog URL to unfollow',
        },
      },
      required: ['site_url'],
    },
    handler: async (args, token) => {
      return callWordPressAPI('/read/following/mine/delete', token, 'POST', {
        url: args.site_url,
      });
    },
  },

  // Get recommendations
  getRecommendations: {
    description: 'Get a list of blog recommendations for the current user',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          description: 'Number of recommendations to return',
        },
      },
    },
    handler: async (args, token) => {
      const params = new URLSearchParams();
      if (args.number) params.append('number', args.number.toString());
      
      return callWordPressAPI(`/read/recommendations/mine?${params}`, token);
    },
  },
};
```

### 4.3 WordPress API Client

Create `mcp-server/src/wordpress-api.ts`:

```typescript
import fetch from 'node-fetch';

const WORDPRESS_API_BASE = 'https://public-api.wordpress.com/rest/v1.1';

export async function callWordPressAPI(
  endpoint: string,
  token: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const url = `${WORDPRESS_API_BASE}${endpoint}`;
  
  const options: any = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WordPress API error: ${response.status} - ${error}`);
  }

  return response.json();
}
```

### 4.4 Token Validation

Create `mcp-server/src/auth.ts`:

```typescript
import fetch from 'node-fetch';

const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://localhost:3000';

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

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Token validation error:', error);
    return { valid: false };
  }
}
```

## Step 5: MCP Client Configuration

Create a configuration file for Claude Desktop:

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "wordpress-reader": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "AUTH_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Step 6: Security Best Practices

1. **Token Storage**: Use Redis or similar for production token storage
2. **HTTPS Only**: Always use HTTPS in production
3. **Token Rotation**: Implement token refresh mechanism
4. **Rate Limiting**: Add rate limiting to prevent abuse
5. **Input Validation**: Validate all inputs using zod schemas
6. **Audit Logging**: Log all authentication events
7. **CORS Configuration**: Restrict CORS to specific origins
8. **Environment Variables**: Never commit secrets to version control

## Step 7: Testing

### 7.1 Unit Tests

Create tests for:
- OAuth flow (authorization, callback, token exchange)
- PKCE validation
- Token validation
- Each Reader API tool
- Error handling

### 7.2 Integration Tests

Test the complete flow:
1. Start web app and MCP server
2. Initiate OAuth flow from Claude
3. Complete authentication
4. Call Reader API tools
5. Verify responses

### 7.3 Security Tests

- Test invalid tokens
- Test expired tokens
- Test PKCE validation
- Test rate limiting
- Test CORS restrictions

## Step 8: Usage Instructions

1. Install dependencies:
   ```bash
   cd web-app && npm install
   cd ../mcp-server && npm install
   ```

2. Start the web app:
   ```bash
   cd web-app && npm run dev
   ```

3. Start the MCP server:
   ```bash
   cd mcp-server && npm run dev
   ```

4. Configure Claude Desktop with the MCP server
5. In Claude, you can now use commands like:
   - "Show me my WordPress Reader feed"
   - "Get posts tagged with 'technology'"
   - "Follow the blog example.com"
   - "Show my blog recommendations"

## Troubleshooting

### Common Issues

1. **"Authentication required" error**: Ensure OAuth flow completed successfully
2. **"Invalid token" error**: Check token expiration and validation endpoint
3. **CORS errors**: Verify CORS configuration matches your domains
4. **Rate limiting**: WordPress.com API has rate limits - implement caching

### Debug Mode

Set `DEBUG=mcp:*` environment variable for detailed logging.

## Future Enhancements

1. **Token Refresh**: Implement automatic token refresh
2. **Caching**: Add Redis caching for API responses
3. **Batch Operations**: Support batch API calls
4. **Webhooks**: Implement real-time updates via webhooks
5. **Additional APIs**: Expand to other WordPress.com APIs

## Resources

- [WordPress.com OAuth Documentation](https://developer.wordpress.com/docs/oauth2/)
- [WordPress.com Reader API](https://developer.wordpress.com/docs/api/#10-reader)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)

---

This guide provides a complete implementation path. Start with Step 1 and work through sequentially. Each component can be tested independently before integration.