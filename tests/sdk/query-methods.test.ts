import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { query } from '../../src/entrypoints/sdk/index.js'
import { setPluginCommandsState } from '../../src/state/pluginCommandsStore.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../src/test/sharedMutationLock.js'

// These tests don't iterate — they test QueryImpl methods that manipulate
// internal state. Auth stub needed because query() triggers init() path.
const AUTH_KEY = 'ANTHROPIC_API_KEY'
let savedApiKey: string | undefined

beforeAll(async () => {
  await acquireSharedMutationLock('tests/sdk/query-methods.test.ts')
  savedApiKey = process.env[AUTH_KEY]
  if (!savedApiKey) process.env[AUTH_KEY] = 'sk-test-query-methods-stub'
})

afterAll(() => {
  try {
    setPluginCommandsState([])
    if (savedApiKey === undefined) delete process.env[AUTH_KEY]
    else process.env[AUTH_KEY] = savedApiKey
  } finally {
    releaseSharedMutationLock()
  }
})

describe('QueryImpl.setModel', () => {
  test('updates model in app state', async () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })
    await q.setModel('claude-haiku-4-5')

    const state = (q as any).appStateStore.getState()
    expect(state.mainLoopModel).toBe('claude-haiku-4-5')
    expect(state.mainLoopModelForSession).toBe('claude-haiku-4-5')
    q.interrupt()
  })
})

describe('QueryImpl.supportedAgents', () => {
  test('returns agentType list from active agents', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    // Simulate agents loaded into app state
    ;(q as any).appStateStore.setState(() => ({
      ...(q as any).appStateStore.getState(),
      agentDefinitions: {
        activeAgents: [
          { agentType: 'code-reviewer' },
          { agentType: 'test-runner' },
        ],
      },
    }))

    const agents = q.supportedAgents()
    expect(agents).toEqual(['code-reviewer', 'test-runner'])
    q.interrupt()
  })

  test('returns empty array when no agents loaded', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })
    const agents = q.supportedAgents()
    expect(agents).toEqual([])
    q.interrupt()
  })

  test('filters out entries with falsy agentType', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    ;(q as any).appStateStore.setState(() => ({
      ...(q as any).appStateStore.getState(),
      agentDefinitions: {
        activeAgents: [
          { agentType: 'valid-agent' },
          { agentType: null },
          { agentType: '' },
        ],
      },
    }))

    const agents = q.supportedAgents()
    expect(agents).toEqual(['valid-agent'])
    q.interrupt()
  })
})

describe('QueryImpl.supportedCommands', () => {
  test('returns command names from app state', () => {
    setPluginCommandsState([])
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    ;(q as any).appStateStore.setState(() => ({
      ...(q as any).appStateStore.getState(),
      mcp: {
        ...(q as any).appStateStore.getState().mcp,
        commands: [
          { name: '/help' },
          { name: '/clear' },
        ],
      },
    }))

    const cmds = q.supportedCommands()
    expect(cmds).toEqual(['/help', '/clear'])
    q.interrupt()
  })

  test('returns command names from plugin command store', () => {
    setPluginCommandsState([
      { type: 'prompt', name: '/plugin-alpha', description: '', prompt: '' },
      { type: 'local-jsx', name: '/plugin-beta', description: '', call: () => null },
    ])

    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })
    const cmds = q.supportedCommands()
    expect(cmds).toEqual(['/plugin-alpha', '/plugin-beta'])
    q.interrupt()
    setPluginCommandsState([])
  })

  test('returns empty array when no commands', () => {
    setPluginCommandsState([])
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })
    const cmds = q.supportedCommands()
    expect(cmds).toEqual([])
    q.interrupt()
  })
})

describe('QueryImpl.supportedModels', () => {
  test('returns current model as array', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    ;(q as any).appStateStore.setState(() => ({
      ...(q as any).appStateStore.getState(),
      mainLoopModel: 'claude-sonnet-4-6',
    }))

    const models = q.supportedModels()
    expect(models).toEqual(['claude-sonnet-4-6'])
    q.interrupt()
  })

  test('returns empty array when no model set', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    ;(q as any).appStateStore.setState(() => ({
      ...(q as any).appStateStore.getState(),
      mainLoopModel: undefined,
    }))

    const models = q.supportedModels()
    expect(models).toEqual([])
    q.interrupt()
  })
})

describe('QueryImpl.setMaxThinkingTokens', () => {
  test('enables thinking with budget', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })
    q.setMaxThinkingTokens(10000)

    const state = (q as any).appStateStore.getState()
    expect(state.thinkingEnabled).toBe(true)
    expect(state.thinkingBudgetTokens).toBe(10000)
    q.interrupt()
  })

  test('disables thinking when tokens is 0', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })
    // First enable
    q.setMaxThinkingTokens(5000)
    // Then disable
    q.setMaxThinkingTokens(0)

    const state = (q as any).appStateStore.getState()
    expect(state.thinkingEnabled).toBe(false)
    expect(state.thinkingBudgetTokens).toBeUndefined()
    q.interrupt()
  })
})

describe('QueryImpl.respondToPermission', () => {
  test('resolves pending allow decision', async () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    const promise = (q as any).registerPendingPermission('tool-123')
    q.respondToPermission('tool-123', { behavior: 'allow' })

    const decision = await promise
    expect(decision.behavior).toBe('allow')
    q.interrupt()
  })

  test('resolves pending deny decision with message', async () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    const promise = (q as any).registerPendingPermission('tool-456')
    q.respondToPermission('tool-456', {
      behavior: 'deny',
      message: 'Blocked by policy',
    })

    const decision = await promise
    expect(decision.behavior).toBe('deny')
    expect(decision.message).toBe('Blocked by policy')
    q.interrupt()
  })

  test('deny with no message uses default', async () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    const promise = (q as any).registerPendingPermission('tool-789')
    q.respondToPermission('tool-789', { behavior: 'deny' })

    const decision = await promise
    expect(decision.behavior).toBe('deny')
    expect(decision.message).toBe('Permission denied')
    q.interrupt()
  })

  test('no-op for unknown toolUseId', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })
    // Should not throw
    expect(() =>
      q.respondToPermission('nonexistent', { behavior: 'allow' })
    ).not.toThrow()
    q.interrupt()
  })

  test('allow with updatedInput passes through', async () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    const promise = (q as any).registerPendingPermission('tool-input')
    q.respondToPermission('tool-input', {
      behavior: 'allow',
      updatedInput: { path: '/safe/dir' },
    })

    const decision = await promise
    expect(decision.behavior).toBe('allow')
    expect(decision.updatedInput).toEqual({ path: '/safe/dir' })
    q.interrupt()
  })
})

describe('QueryImpl.rewindFiles', () => {
  test('returns canRewind false when no file history', async () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })
    const result = await q.rewindFiles()
    expect(result.canRewind).toBe(false)
    q.interrupt()
  })
})

describe('QueryImpl runtime control API', () => {
  test('returns a runtime snapshot with provider, model, command, and usage state', async () => {
    setPluginCommandsState([
      { type: 'prompt', name: '/runtime-alpha', description: 'Alpha command', prompt: '' },
    ])
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })
    await q.setModel('claude-sonnet-4-6')

    const state = await q.getRuntimeState()

    expect(state.sessionId).toBe(q.sessionId)
    expect(state.cwd).toBe(process.cwd())
    expect(state.model).toBe('claude-sonnet-4-6')
    expect(state.models.length).toBeGreaterThan(0)
    expect(state.slashCommands.some(command => command.name === '/runtime-alpha')).toBe(true)
    expect(state.usage.totalCostUsd).toBe(0)
    q.interrupt()
    setPluginCommandsState([])
  })

  test('applySettings updates model, permission mode, fast mode, and reasoning', async () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    const settings = await q.applySettings({
      model: 'claude-haiku-4-5',
      permissionMode: 'plan',
      effort: 'low',
      fastMode: true,
    })

    const state = (q as any).appStateStore.getState()
    expect(settings.applied.model).toBe('claude-haiku-4-5')
    expect(settings.applied.permissionMode).toBe('plan')
    expect(settings.applied.fastMode).toBe(true)
    expect(state.mainLoopModel).toBe('claude-haiku-4-5')
    expect(q.getPermissionMode()).toBe('plan')
    expect(q.getFastModeState().state).toBe('on')
    expect(q.getReasoningConfig().effort).toBe('low')
    q.interrupt()
  })

  test('getTodoState returns TodoWrite state for headless hosts', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    ;(q as any).appStateStore.setState(() => ({
      ...(q as any).appStateStore.getState(),
      todos: {
        [q.sessionId]: [
          { content: 'Read SDK state', activeForm: 'Reading SDK state', status: 'in_progress' },
          { content: 'Wire webview', status: 'pending' },
          { content: 'Build extension', status: 'completed' },
        ],
      },
    }))

    const todos = q.getTodoState()
    expect(todos.total).toBe(3)
    expect(todos.completed).toBe(1)
    expect(todos.activeItem?.activeForm).toBe('Reading SDK state')
    q.interrupt()
  })

  test('listProviders and listModels expose catalogs for hosts', () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    expect(q.listProviders().length).toBeGreaterThan(0)
    expect(q.listModels().length).toBeGreaterThan(0)
    q.interrupt()
  })

  test('setMcpServers returns mutation details without spawning a CLI wrapper', async () => {
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    const result = await q.setMcpServers({
      sdkTest: { type: 'sdk', name: 'sdkTest' },
    })

    expect(result.success).toBe(true)
    expect(result.added).toContain('sdkTest')
    expect(q.listMcpServers()).toEqual([])
    q.interrupt()
  })

  test('runSlashCommand returns UI metadata for local JSX commands', async () => {
    setPluginCommandsState([
      { type: 'local-jsx', name: '/needs-ui', description: 'Needs UI', call: () => null },
    ])
    const q = query({ prompt: 'test', options: { cwd: process.cwd() } })

    const result = await q.runSlashCommand('/needs-ui')

    expect(result.type).toBe('requires_ui')
    if (result.type === 'requires_ui') {
      expect(result.command.requiresUi).toBe(true)
    }
    q.interrupt()
    setPluginCommandsState([])
  })
})

// setPermissionMode is tested via buildPermissionContext in permissions.test.ts
// (mode mapping, additionalDirectories, bypass flag). The QueryImpl.setPermissionMode
// method delegates to buildPermissionContext + getTools + engine.updateTools — the
// latter two depend on CI environment state, so integration tests are fragile.
