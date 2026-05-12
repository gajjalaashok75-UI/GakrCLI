import { describe, expect, test } from 'bun:test'
import { builtInCommandNames, formatDescriptionWithSource } from './commands.js'

describe('builtInCommandNames', () => {
  test('includes the provider command', () => {
    expect(builtInCommandNames()).toContain('provider')
  })

  test('uses provider setup instead of login/logout slash commands', () => {
    const names = builtInCommandNames()

    expect(names).toContain('provider')
    expect(names).not.toContain('login')
    expect(names).not.toContain('logout')
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
