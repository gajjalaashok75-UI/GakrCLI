/**
 * Built-in MCP Server Initialization
 *
 * Mirrors src/plugins/bundled/index.ts. Each built-in MCP server gets a small
 * register* helper in this directory; initBuiltinMcpServers() calls them.
 *
 * To add a new built-in MCP server:
 * 1. Create `./<name>.ts` exporting `register<Name>McpServer()` which calls
 *    registerBuiltinMcpServer() with the definition.
 * 2. Call it from initBuiltinMcpServers() below.
 *
 * No change to services/mcp/config.ts is needed.
 */

import { registerComputerUseMcpServer } from './computerUse.js'

/**
 * Register all built-in MCP servers. Called during CLI startup, and lazily on
 * first read of the registry.
 */
export function initBuiltinMcpServers(): void {
  registerComputerUseMcpServer()
}
