import { describe, expect, test } from 'bun:test'
import {
  builtInCommandNames,
  formatDescriptionWithSource,
  meetsAvailabilityRequirement,
} from './commands.js'
import { isCommand } from './types/command.js'

describe('builtInCommandNames', () => {
  test('includes the LSP command', () => {
    expect(builtInCommandNames()).toContain('lsp')
  })

  test('includes the commit attribution command', () => {
    expect(builtInCommandNames()).toContain('commit-message')
  })

  test('includes GakrCLI-specific diagnostic commands', () => {
    expect(builtInCommandNames()).toContain('benchmark')
    expect(builtInCommandNames()).toContain('cache-probe')
  })

  test('does not include removed GitHub Models onboarding command', () => {
    expect(builtInCommandNames()).not.toContain('onboard-github')
  })

  test('does not include unfinished self-improvement prototype commands', () => {
    expect(builtInCommandNames()).not.toContain('diagnose')
    expect(builtInCommandNames()).not.toContain('improve')
  })
})

describe('isCommand', () => {
  test('rejects generated missing-module noop stubs', () => {
    function noop19() {
      return null
    }

    expect(isCommand(noop19)).toBe(false)
    expect(isCommand({ isHidden: true, name: 'stub' })).toBe(false)
  })

  test('accepts real command objects', () => {
    expect(
      isCommand({
        type: 'local',
        name: 'example',
        description: 'example command',
        supportsNonInteractive: false,
        load: async () => ({
          call: async () => ({ type: 'skip' }),
        }),
      }),
    ).toBe(true)
  })
})

describe('formatDescriptionWithSource', () => {
  test('returns empty text for prompt commands missing a description', () => {
    const command = {
      name: 'example',
      type: 'prompt',
      source: 'builtin',
      description: undefined,
    } as any

    expect(formatDescriptionWithSource(command)).toBe('')
  })

  test('formats plugin commands with missing description safely', () => {
    const command = {
      name: 'example',
      type: 'prompt',
      source: 'plugin',
      description: undefined,
      pluginInfo: {
        pluginManifest: {
          name: 'MyPlugin',
        },
      },
    } as any

    expect(formatDescriptionWithSource(command)).toBe('(MyPlugin) ')
  })
})

describe('meetsAvailabilityRequirement', () => {
  test('tolerates malformed command entries while command registries are loading', () => {
    expect(meetsAvailabilityRequirement(null)).toBe(true)
    expect(meetsAvailabilityRequirement(undefined)).toBe(true)
    expect(
      meetsAvailabilityRequirement({
        name: 'partial',
        type: 'local',
      } as any),
    ).toBe(true)
  })
})
