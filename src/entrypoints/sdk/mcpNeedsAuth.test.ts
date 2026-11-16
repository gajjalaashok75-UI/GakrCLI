import { afterAll, describe, expect, it, mock } from 'bun:test'
import type { ScopedMcpServerConfig } from '../../services/mcp/types.js'

// Cache-busting import: `import * as realMcpClient` would resolve to this
// file's own (already mocked) instance once the module is registered.
const realMcpClient = {
  ...(await import('../../services/mcp/client.js?real=' + Date.now())),
}

// An embedder hands `mcpServers` to a v2 session, a server answers 401, and
// `system:init` reports needs-auth. connectSdkMcpServers must then surface the
// authenticate pseudo-tool so the model can start the sign-in on the user's
// behalf, instead of being told the server needs auth and handed no way to act.
const needsAuthClient = {
  name: 'needs-auth-server',
  type: 'needs-auth' as const,
  config: { type: 'http', url: 'https://example.test/mcp', scope: 'session' } as unknown as ScopedMcpServerConfig,
}

mock.module('../../services/mcp/client.js', () => ({
  ...realMcpClient,
  connectToServer: Object.assign(
    async () => needsAuthClient,
    { cache: new Map() },
  ),
  fetchToolsForClient: async () => [],
}))

const { connectSdkMcpServers } = await import('./permissions.js')

afterAll(() => {
  mock.restore()
})

describe('connectSdkMcpServers surfaces the authenticate tool for a needs-auth server', () => {
  it('returns the authenticate pseudo-tool when a server needs auth', async () => {
    const { clients, tools } = await connectSdkMcpServers({
      'needs-auth-server': { type: 'http', url: 'https://example.test/mcp' },
    })

    expect(clients).toHaveLength(1)
    expect(clients[0]!.type).toBe('needs-auth')
    expect(tools).toHaveLength(1)
    expect(tools[0]!.name).toBe('mcp__needs-auth-server__authenticate')
    expect(tools[0]!.isMcp).toBe(true)
  })

  it('tells the model to start a new session rather than promise automatic tools', async () => {
    const { tools } = await connectSdkMcpServers({
      'needs-auth-server': { type: 'http', url: 'https://example.test/mcp' },
    })

    const description = await tools[0]!.description({} as never, {} as never)
    expect(description).toContain('start a new session to use the server')
    expect(description).not.toContain('become available automatically')
  })

  it('returns no tools for a server that is neither connected nor needs-auth', async () => {
    const { clients, tools } = await connectSdkMcpServers({})
    expect(clients).toHaveLength(0)
    expect(tools).toHaveLength(0)
  })
})
