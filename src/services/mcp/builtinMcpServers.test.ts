import { afterEach, describe, expect, test } from 'bun:test'
import {
  clearBuiltinMcpServers,
  findReservedBuiltinMcpServerName,
  getBuiltinMcpServerConfigs,
  getBuiltinMcpServerDefinition,
  isBuiltinMcpServerName,
  isDefaultDisabledBuiltinMcpServer,
  registerBuiltinMcpServer,
} from './builtinMcpServers.js'

afterEach(() => {
  clearBuiltinMcpServers()
})

describe('built-in MCP server registry', () => {
  test('registers a server and enumerates its config', () => {
    registerBuiltinMcpServer({
      name: 'demo-server',
      getConfig: () => ({ type: 'stdio', command: '/bin/demo', args: [], scope: 'dynamic' }),
    })

    const configs = getBuiltinMcpServerConfigs()
    expect(configs['demo-server']).toBeDefined()
    expect(configs['demo-server'].type).toBe('stdio')
  })

  // The extensibility contract: adding a second built-in must not require
  // editing services/mcp/config.ts or main.tsx.
  test('supports multiple built-ins without core edits', () => {
    registerBuiltinMcpServer({
      name: 'alpha',
      getConfig: () => ({ type: 'stdio', command: '/bin/alpha', args: [], scope: 'dynamic' }),
    })
    registerBuiltinMcpServer({
      name: 'beta',
      getConfig: () => ({ type: 'stdio', command: '/bin/beta', args: [], scope: 'dynamic' }),
    })

    const configs = getBuiltinMcpServerConfigs()
    expect(Object.keys(configs).sort()).toEqual(['alpha', 'beta'])
    expect(isBuiltinMcpServerName('alpha')).toBe(true)
    expect(isBuiltinMcpServerName('beta')).toBe(true)
  })

  test('getConfig is deferred until enumeration', () => {
    let calls = 0
    registerBuiltinMcpServer({
      name: 'lazy',
      getConfig: () => {
        calls++
        return { type: 'stdio', command: '/bin/lazy', args: [], scope: 'dynamic' }
      },
    })

    expect(calls).toBe(0)
    getBuiltinMcpServerConfigs()
    expect(calls).toBe(1)
  })

  test('isAvailable false omits the server entirely', () => {
    registerBuiltinMcpServer({
      name: 'gated',
      getConfig: () => ({ type: 'stdio', command: '/bin/gated', args: [], scope: 'dynamic' }),
      isAvailable: () => false,
    })

    expect(getBuiltinMcpServerConfigs()['gated']).toBeUndefined()
    expect(isBuiltinMcpServerName('gated')).toBe(false)
  })

  test('defaultEnabled false marks the server opt-in', () => {
    registerBuiltinMcpServer({
      name: 'opt-in',
      getConfig: () => ({ type: 'stdio', command: '/bin/opt-in', args: [], scope: 'dynamic' }),
      defaultEnabled: false,
    })
    registerBuiltinMcpServer({
      name: 'opt-out',
      getConfig: () => ({ type: 'stdio', command: '/bin/opt-out', args: [], scope: 'dynamic' }),
    })

    expect(isDefaultDisabledBuiltinMcpServer('opt-in')).toBe(true)
    expect(isDefaultDisabledBuiltinMcpServer('opt-out')).toBe(false)
  })

  test('reserved-name lookup returns the canonical name', () => {
    registerBuiltinMcpServer({
      name: 'computer-use',
      getConfig: () => ({ type: 'stdio', command: '/bin/cu', args: [], scope: 'dynamic' }),
      defaultEnabled: false,
    })

    expect(findReservedBuiltinMcpServerName(['unrelated', 'computer-use'])).toBe('computer-use')
    expect(findReservedBuiltinMcpServerName(['unrelated'])).toBeUndefined()
  })

  test('getBuiltinMcpServerDefinition resolves invalid-char variants', () => {
    registerBuiltinMcpServer({
      name: 'demo-server',
      getConfig: () => ({ type: 'stdio', command: '/bin/demo', args: [], scope: 'dynamic' }),
    })

    // Dots/spaces normalize to underscores (same rule the original
    // isComputerUseMCPServer applied), so '.demo server' matches 'demo-server'
    // only where the normalized forms collide.
    expect(getBuiltinMcpServerDefinition('demo-server')?.name).toBe('demo-server')
    expect(getBuiltinMcpServerDefinition('demo server')).toBeUndefined()
  })
})
