import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readerTools } from './tools.js';
import { validateToken } from './auth.js';

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
  
  // Method 1: Direct WordPress token from environment
  if (process.env.WORDPRESS_ACCESS_TOKEN) {
    wordpressToken = process.env.WORDPRESS_ACCESS_TOKEN;
    console.log('Using WordPress token from environment variable');
  } 
  // Method 2: JWT token from environment (validate through web app)
  else if (process.env.MCP_AUTH_TOKEN) {
    const tokenInfo = await validateToken(process.env.MCP_AUTH_TOKEN);
    if (tokenInfo.valid && tokenInfo.wordpress_token) {
      wordpressToken = tokenInfo.wordpress_token;
      console.log('Using validated JWT token from environment variable');
    }
  }
  // Method 3: Token from request meta (for future Claude integration)
  else if (request.params._meta?.auth_token) {
    const tokenInfo = await validateToken(request.params._meta.auth_token as string);
    if (tokenInfo.valid && tokenInfo.wordpress_token) {
      wordpressToken = tokenInfo.wordpress_token;
      console.log('Using token from request metadata');
    }
  }

  if (!wordpressToken) {
    throw new Error('Authentication required. Please set WORDPRESS_ACCESS_TOKEN or MCP_AUTH_TOKEN environment variable.');
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