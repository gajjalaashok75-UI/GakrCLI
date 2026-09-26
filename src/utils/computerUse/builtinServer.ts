import { join } from 'path'
import type { ScopedMcpServerConfig } from '../../services/mcp/types.js'
import { isInBundledMode } from '../bundledMode.js'
import { distRoot } from '../distRoot.js'
import { COMPUTER_USE_MCP_SERVER_NAME } from './common.js'

/**
 * Config for the built-in Computer Use MCP, registered in the MCP config layer
 * so it enumerates under "Built-in MCPs" on every platform — including while
 * disabled (opt-in via `enabledMcpServers`).
 *
 * `command`/`args` are never spawned: client.ts intercepts by name and runs the
 * server in-process. The config just needs to exist as `type: 'stdio'` to hit
 * that branch and to render in `/mcp`.
 *
 * Kept free of `@ant/computer-use-mcp` imports so `services/mcp/config.ts` can
 * register the built-in without pulling the vendored package into its eager
 * module graph.
 */
export function getComputerUseMCPServerConfig(): ScopedMcpServerConfig {
  const args = isInBundledMode()
    ? ['--computer-use-mcp']
    : [join(distRoot, 'cli.mjs'), '--computer-use-mcp']

  return {
    type: 'stdio',
    command: process.execPath,
    args,
    scope: 'dynamic',
  } as const
}

export { COMPUTER_USE_MCP_SERVER_NAME }
