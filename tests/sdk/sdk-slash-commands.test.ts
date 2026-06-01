import { describe, expect, test } from 'bun:test'
import { getDefaultAppState } from '../../src/state/AppStateStore.js'
import { listSlashCommandsFromState } from '../../src/entrypoints/sdk/runtime.js'
import type { Command } from '../../src/types/command.js'

describe('SDK slash command metadata', () => {
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
