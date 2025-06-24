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
  
  const authToken = request.params._meta?.auth_token;
  if (!authToken) {
    throw new Error('Authentication required');
  }

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

const transport = new StdioServerTransport();
server.connect(transport);