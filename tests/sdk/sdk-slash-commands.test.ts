import { describe, expect, test } from 'bun:test'
import { getDefaultAppState } from '../../src/state/AppStateStore.js'
import {
  buildRuntimeState,
  coerceCommandArray,
  listSlashCommandsFromState,
} from '../../src/entrypoints/sdk/runtime.js'
import type { Command } from '../../src/types/command.js'

describe('SDK slash command metadata', () => {
  test('treats missing plugin command stores as empty command lists', () => {
    expect(coerceCommandArray(null)).toEqual([])
    expect(coerceCommandArray(undefined)).toEqual([])
    expect(coerceCommandArray({ name: 'not-array' })).toEqual([])
  })

  test('builds an early runtime snapshot before provider config is initialized', () => {
    const runtime = buildRuntimeState({
      sessionId: 'session-early',
      cwd: process.cwd(),
      status: 'idle',
      state: getDefaultAppState(),
      mcpServers: [],
      account: { apiKeySource: 'none' },
      slashCommands: [],
    })

    expect(runtime.sessionId).toBe('session-early')
    expect(runtime.status).toBe('idle')
    expect(Array.isArray(runtime.profiles)).toBe(true)
    expect(Array.isArray(runtime.models)).toBe(true)
  })

  test('deduplicates registry commands and hides non-user commands', () => {
    const registryCommands = [
      {
        type: 'local',
        name: 'help',
        description: 'Show help',
        supportsNonInteractive: true,
        load: async () => ({ call: async () => ({ type: 'skip' }) }),
      },
      {
        type: 'local',
        name: 'help',
        description: 'Duplicate help',
        supportsNonInteractive: true,
        load: async () => ({ call: async () => ({ type: 'skip' }) }),
      },
      {
        type: 'local-jsx',
        name: 'provider',
        description: 'Set provider',
        load: async () => ({ call: async () => null }),
      },
      {
        type: 'prompt',
        name: 'model-only',
        description: 'Hidden from users',
        contentLength: 0,
        progressMessage: 'running',
        source: 'builtin',
        userInvocable: false,
        getPromptForCommand: async () => [],
      },
    ] satisfies Command[]

    const commands = listSlashCommandsFromState(getDefaultAppState(), registryCommands)

    expect(commands.map(command => command.name)).toEqual(['help', 'provider'])
    expect(commands.find(command => command.name === 'provider')?.requiresUi).toBe(true)
  })
})
