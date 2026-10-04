import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { setupTools } from './register-tools';

/**
 * Create a new MCP Server instance for a single client connection.
 * Each call returns an independent server — safe for concurrent multi-client use.
 */
export const createMcpServer = () => {
  const mcpServer = new Server(
    {
      name: 'GakrChromeBridge',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  setupTools(mcpServer);
  return mcpServer;
};
