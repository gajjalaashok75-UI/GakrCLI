/**
 * Exposes the Chrome extension's `chrome_*` tools to the agent.
 *
 * The extension owns ~31 tool implementations. Without this bridge the agent
 * has no browser tools at all in the side panel and answers "which tab am I
 * on?" with a guess — the built-in `WebBrowserTool` cannot help, because it
 * drives a *separate* Playwright Chromium rather than the user's own Chrome
 * with their logged-in session.
 *
 * Schemas come from `mcp-chrome-shared`, the same source the extension names
 * its tools from, so the model is offered exactly the tools the extension
 * implements. Handlers execute over the native host socket.
 */

import { TOOL_SCHEMAS } from '@gakr-gakr/mcp-chrome-shared'
import type { SdkMcpToolDefinition } from '../../../entrypoints/sdk/v2.js'
import { toToolResult, type ToolResult } from '../toolResult.js'
import type { ToolExecutor } from './runner.js'

/**
 * Build the agent-facing tool definitions.
 *
 * Each handler is a thin pass-through to `execute`, which routes
 * CLI → native host socket → Chrome → extension and back. Errors are returned
 * as `isError` results rather than thrown, so the model can read what went
 * wrong and retry instead of the turn dying.
 */
export function buildChromeToolDefinitions(
  execute: ToolExecutor,
): SdkMcpToolDefinition[] {
  return TOOL_SCHEMAS.map(schema => ({
    name: schema.name,
    // The SDK requires a description; the shared schema marks it optional.
    description: schema.description ?? `Chrome tool ${schema.name}`,
    inputSchema: schema.inputSchema,
    handler: async (args: unknown): Promise<ToolResult> => {
      try {
        const result = await execute(
          schema.name,
          (args ?? {}) as Record<string, unknown>,
        )
        return toToolResult(result)
      } catch (error) {
        return toToolResult(
          `chrome tool ${schema.name} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          true,
        )
      }
    },
  }))
}

/** MCP server key the tools are registered under. */
export const CHROME_MCP_SERVER_NAME = 'chrome'