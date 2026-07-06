import type { ScopedMcpServerConfig } from '../../services/mcp/types.js'
import {
  GAKR_IN_CHROME_SKILL_HINT,
  GAKR_IN_CHROME_SKILL_HINT_WITH_WEBBROWSER,
} from './prompt.js'
import type { setupGakrCLIInChrome } from './setup.js'

type GakrCLIInChromeSetupResult = ReturnType<typeof setupGakrCLIInChrome>

export type GakrCLIInChromeStartupMode = 'disabled' | 'explicit' | 'auto'

export function resolveGakrCLIInChromeStartupMode({
  explicitEnabled,
  autoEnabled,
  hasGakrCLIInChromeAccess,
}: {
  explicitEnabled: boolean
  autoEnabled: boolean
  hasGakrCLIInChromeAccess: boolean
}): GakrCLIInChromeStartupMode {
  if (!hasGakrCLIInChromeAccess) {
    return 'disabled'
  }
  if (explicitEnabled) {
    return 'explicit'
  }
  if (autoEnabled) {
    return 'auto'
  }
  return 'disabled'
}

export function mergeGakrCLIInChromeStartupConfig({
  mode,
  setupResult,
  dynamicMcpConfig,
  appendSystemPrompt,
  hasWebBrowserTool,
}: {
  mode: Exclude<GakrCLIInChromeStartupMode, 'disabled'>
  setupResult: GakrCLIInChromeSetupResult
  dynamicMcpConfig: Record<string, ScopedMcpServerConfig>
  appendSystemPrompt?: string
  hasWebBrowserTool: boolean
}): {
  dynamicMcpConfig: Record<string, ScopedMcpServerConfig>
  allowedTools: string[]
  appendSystemPrompt?: string
} {
  const nextDynamicMcpConfig = {
    ...dynamicMcpConfig,
    ...setupResult.mcpConfig,
  }

  if (mode === 'explicit') {
    return {
      dynamicMcpConfig: nextDynamicMcpConfig,
      allowedTools: setupResult.allowedTools,
      appendSystemPrompt: appendSystemPrompt
        ? `${setupResult.systemPrompt}\n\n${appendSystemPrompt}`
        : setupResult.systemPrompt,
    }
  }

  const hint = hasWebBrowserTool
    ? GAKR_IN_CHROME_SKILL_HINT_WITH_WEBBROWSER
    : GAKR_IN_CHROME_SKILL_HINT

  return {
    dynamicMcpConfig: nextDynamicMcpConfig,
    allowedTools: [],
    appendSystemPrompt: appendSystemPrompt
      ? `${appendSystemPrompt}\n\n${hint}`
      : hint,
  }
}
