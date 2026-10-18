/**
 * The GakrCLI-in-Chrome MCP server.
 *
 * Advertises exactly the tools the Chrome extension implements — `TOOL_SCHEMAS`
 * from `mcp-chrome-shared`, the same module the extension takes its tool names
 * from — and executes them over the native-host socket using the
 * `call_tool` + `requestId` protocol in `chromeNativeHostClient.ts`.
 *
 * Two entry points share this one server, so all three GakrCLI-in-Chrome
 * surfaces offer the same tools:
 *   - `gakrcli --gakrcli-in-chrome-mcp` — stdio, for external MCP clients.
 *   - `gakrcli --chrome` — in-process, connected by services/mcp/client.ts.
 *   - `gakrcli --chrome-extension` — the side-panel agent server, which builds
 *     its tool definitions from the same schemas (agentServer/chromeTools.ts).
 *
 * The previous implementation wrapped `@gakr-gakr/gakrcli-for-chrome-mcp`,
 * which advertises an 18-name surface (`tabs_context_mcp`, `read_page`, …) that
 * this extension does not implement, and speaks a legacy `execute_tool` socket
 * dialect the native host and extension do not answer.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { TOOL_SCHEMAS } from '@gakr-gakr/mcp-chrome-shared'
import { logForDebugging } from '../debug.js'
import { callExtensionTool } from './chromeNativeHostClient.js'
import { toToolResult } from './toolResult.js'

const SERVER_NAME = 'gakrcli-in-chrome'
const SERVER_VERSION = '1.0.0'

/** Executes one browser tool in the extension by its `chrome_*` name. */
export type ChromeToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>

/**
 * Build the MCP server. `execute` is injectable so tests can drive the tool
 * surface without a browser; it defaults to the native-host socket client.
 */
export function createChromeMcpServer({
  execute = callExtensionTool,
}: {
  execute?: ChromeToolExecutor
} = {}): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_SCHEMAS,
  }))

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name } = request.params
    const args = (request.params.arguments ?? {}) as Record<string, unknown>
    try {
      return toToolResult(await execute(name, args))
    } catch (error) {
      return toToolResult(
        `chrome tool ${name} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        true,
      )
    }
  })

  return server
}

/**
 * Run the server over stdio for the `--gakrcli-in-chrome-mcp` entry point,
 * which external MCP clients spawn directly.
 */
export async function runGakrCLIInChromeMcpServer(): Promise<void> {
  const server = createChromeMcpServer()
  const transport = new StdioServerTransport()

  // Exit when the parent process dies (stdin pipe closes).
  let exiting = false
  const shutdownAndExit = async (): Promise<void> => {
    if (exiting) {
      return
    }
    exiting = true
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0)
  }
  process.stdin.on('end', () => void shutdownAndExit())
  process.stdin.on('error', () => void shutdownAndExit())

  logForDebugging('[GakrCLI in Chrome] Starting MCP server')
  await server.connect(transport)
  logForDebugging('[GakrCLI in Chrome] MCP server started')
}
