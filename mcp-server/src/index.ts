import { config } from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readerTools } from './tools.js';
import { validateToken, getBackgroundToken, initiateBackgroundAuth } from './auth.js';
import { log, logError } from './logger.js';

// Load environment variables from .env file
config();

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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(readerTools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Try multiple authentication methods
  let wordpressToken: string | undefined;
  
  // Method 1: Background authentication - get fresh token from auth server
  try {
    const bgToken = await getBackgroundToken();
    if (bgToken) {
      wordpressToken = bgToken;
      log('Using background authentication with fresh token');
    }
  } catch (error) {
    log('Background authentication failed, trying other methods');
  }
  
  // Method 2: Direct WordPress token from environment (fallback)
  if (!wordpressToken && process.env.WORDPRESS_ACCESS_TOKEN) {
    wordpressToken = process.env.WORDPRESS_ACCESS_TOKEN;
    log('Using WordPress token from environment variable');
  } 
  // Method 3: JWT token from environment (validate through web app)
  else if (!wordpressToken && process.env.MCP_AUTH_TOKEN) {
    const tokenInfo = await validateToken(process.env.MCP_AUTH_TOKEN);
    if (tokenInfo.valid && tokenInfo.wordpress_token) {
      wordpressToken = tokenInfo.wordpress_token;
      log('Using validated JWT token from environment variable');
    }
  }
  // Method 4: Token from request meta (for future Claude integration)
  else if (!wordpressToken && request.params._meta?.auth_token) {
    const tokenInfo = await validateToken(request.params._meta.auth_token as string);
    if (tokenInfo.valid && tokenInfo.wordpress_token) {
      wordpressToken = tokenInfo.wordpress_token;
      log('Using token from request metadata');
    }
  }

  if (!wordpressToken) {
    // Trigger OAuth flow if no authentication available
    const authUrl = await initiateBackgroundAuth();
    throw new Error(`Authentication required. Please visit: ${authUrl}`);
  }

  const tool = readerTools[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.handler(args, wordpressToken);
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

const transport = new StdioServerTransport();
server.connect(transport);