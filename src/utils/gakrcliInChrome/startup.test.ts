import { describe, expect, test } from 'bun:test'
import type { ScopedMcpServerConfig } from '../../services/mcp/types.js'
import {
  GAKR_IN_CHROME_SKILL_HINT,
  GAKR_IN_CHROME_SKILL_HINT_WITH_WEBBROWSER,
} from './prompt.js'
import {
  mergeGakrCLIInChromeStartupConfig,
  resolveGakrCLIInChromeStartupMode,
} from './startup.js'

const existingMcpConfig: Record<string, ScopedMcpServerConfig> = {
  existing: {
    type: 'stdio',
    command: 'existing-command',
    args: [],
    scope: 'dynamic',
  },
}

const setupResult = {
  mcpConfig: {
    'gakrcli-in-chrome': {
      type: 'stdio' as const,
      command: 'chrome-command',
      args: ['--chrome'],
      scope: 'dynamic' as const,
    },
  },
  allowedTools: ['mcp__gakrcli-in-chrome__tabs_context_mcp'],
  systemPrompt: 'chrome system prompt',
}

describe('resolveGakrCLIInChromeStartupMode', () => {
  test('uses explicit Chrome startup only when subscriber access is available', () => {
    expect(
      resolveGakrCLIInChromeStartupMode({
        explicitEnabled: true,
        autoEnabled: false,
        hasGakrCLIInChromeAccess: true,
      }),
    ).toBe('explicit')

    expect(
      resolveGakrCLIInChromeStartupMode({
        explicitEnabled: true,
        autoEnabled: false,
        hasGakrCLIInChromeAccess: false,
      }),
    ).toBe('disabled')
  })

  test('uses auto Chrome startup only when subscriber access is available', () => {
    expect(
      resolveGakrCLIInChromeStartupMode({
        explicitEnabled: false,
        autoEnabled: true,
        hasGakrCLIInChromeAccess: true,
      }),
    ).toBe('auto')

    expect(
      resolveGakrCLIInChromeStartupMode({
        explicitEnabled: false,
        autoEnabled: true,
        hasGakrCLIInChromeAccess: false,
      }),
    ).toBe('disabled')
  })

  test('prefers explicit startup over auto startup', () => {
    expect(
      resolveGakrCLIInChromeStartupMode({
        explicitEnabled: true,
        autoEnabled: true,
        hasGakrCLIInChromeAccess: true,
      }),
    ).toBe('explicit')
  })
})

describe('mergeGakrCLIInChromeStartupConfig', () => {
  test('explicit startup merges MCP config, allowed tools, and prepends the Chrome system prompt', () => {
    const merged = mergeGakrCLIInChromeStartupConfig({
      mode: 'explicit',
      setupResult,
      dynamicMcpConfig: existingMcpConfig,
      appendSystemPrompt: 'existing prompt',
      hasWebBrowserTool: false,
    })

    expect(Object.keys(merged.dynamicMcpConfig)).toEqual([
      'existing',
      'gakrcli-in-chrome',
    ])
    expect(merged.allowedTools).toEqual(setupResult.allowedTools)
    expect(merged.appendSystemPrompt).toBe(
      'chrome system prompt\n\nexisting prompt',
    )
  })

  test('auto startup merges MCP config and appends the Chrome skill hint only for subscribers', () => {
    const merged = mergeGakrCLIInChromeStartupConfig({
      mode: 'auto',
      setupResult,
      dynamicMcpConfig: existingMcpConfig,
      appendSystemPrompt: 'existing prompt',
      hasWebBrowserTool: false,
    })

    expect(Object.keys(merged.dynamicMcpConfig)).toEqual([
      'existing',
      'gakrcli-in-chrome',
    ])
    expect(merged.allowedTools).toEqual([])
    expect(merged.appendSystemPrompt).toBe(
      `existing prompt\n\n${GAKR_IN_CHROME_SKILL_HINT}`,
    )
  })

  test('auto startup uses the WebBrowser-specific hint when that tool is available', () => {
    const merged = mergeGakrCLIInChromeStartupConfig({
      mode: 'auto',
      setupResult,
      dynamicMcpConfig: {},
      hasWebBrowserTool: true,
    })

    expect(merged.appendSystemPrompt).toBe(
      GAKR_IN_CHROME_SKILL_HINT_WITH_WEBBROWSER,
    )
  })
})
