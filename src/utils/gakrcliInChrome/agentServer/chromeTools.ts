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
import type { ToolExecutor } from './runner.js'

type TextContent = { type: 'text'; text: string }
type ToolResult = { content: TextContent[]; isError?: boolean }

/** Cap on any single tool result, so a full-page dump cannot blow up context. */
const MAX_RESULT_CHARS = 100_000

function toTextResult(value: unknown, isError = false): ToolResult {
  let text: string
  if (typeof value === 'string') {
    text = value
  } else {
    try {
      text = JSON.stringify(value, null, 2) ?? String(value)
    } catch {
      text = String(value)
    }
  }
  if (text.length > MAX_RESULT_CHARS) {
    text = `${text.slice(0, MAX_RESULT_CHARS)}\n…[truncated]`
  }
  return { content: [{ type: 'text', text }], isError }
}

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
        return toTextResult(result)
      } catch (error) {
        return toTextResult(
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