import { feature } from 'bun:bundle'

import {
  COMPUTER_USE_MCP_SERVER_NAME,
} from '../../../utils/computerUse/common.js'
import { registerBuiltinMcpServer } from '../builtinMcpServers.js'

/**
 * Registers the Computer Use MCP server as a built-in.
 *
 * Gated on CHICAGO_MCP, matching the config-layer gate that keeps the vendored
 * `@ant/computer-use-mcp` package out of the eager module graph. When the flag
 * is off nothing is registered, so the name is not reserved and no config is
 * enumerated — the same behaviour as before this registry existed.
 *
 * Default-disabled: it renders under "Built-in MCPs" in /mcp on every platform,
 * including while disabled, and stays opt-in via `enabledMcpServers`.
 */
export function registerComputerUseMcpServer(): void {
  if (!feature('CHICAGO_MCP')) return

  registerBuiltinMcpServer({
    name: COMPUTER_USE_MCP_SERVER_NAME,
    // Deferred so the builtinServer module (and its dist-mode path logic) is
    // only pulled in when a config is actually read.
    getConfig: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getComputerUseMCPServerConfig } =
        require('../../../utils/computerUse/builtinServer.js') as typeof import('../../../utils/computerUse/builtinServer.js')
      return getComputerUseMCPServerConfig()
    },
    defaultEnabled: false,
  })
}