import { resolveActiveRouteIdFromEnv } from '../integrations/routeMetadata.js'
import {
  isDirectLocalOllamaEndpoint,
  isLocalProviderUrl,
} from '../services/api/providerConfig.js'
import type { Tool, ToolPermissionContext } from '../Tool.js'
import type { AgentDefinitionsResult } from '../tools/AgentTool/loadAgentsDir.js'
import type { MemoryFileInfo } from './gakrclimd.js'
import {
  checkContextWarnings,
  type ContextWarning,
  type ContextWarnings,
} from './doctorContextWarnings.js'
import { formatTokens } from './format.js'
import { isEnvTruthy } from './envUtils.js'
import { plural } from './stringUtils.js'
import {
  type OllamaContextWarning,
  checkOllamaPsContextWarning,
} from './ollamaContext.js'

type ContributorId =
  | 'mcp_tools'
  | 'agent_descriptions'
  | 'gakrclimd_files'
  | 'ollama_context_length'

export type LocalModelContextContributor = {
  id: ContributorId
  message: string
  details: string[]
  summary: string
}

export type LocalModelContextWarning = {
  contributors: LocalModelContextContributor[]
  lines: string[]
}

function summarizeContextWarning(
  warning: ContextWarning,
): LocalModelContextContributor | null {
  switch (warning.type) {
    case 'mcp_tools':
      return {
        id: warning.type,
        message: warning.message,
        details: warning.details,
        summary: `MCP tools: ~${formatTokens(warning.currentValue)} tokens`,
      }
    case 'agent_descriptions':
      return {
        id: warning.type,
        message: warning.message,
        details: warning.details,
        summary: `Agent descriptions: ~${formatTokens(warning.currentValue)} tokens`,
      }
    case 'gakrclimd_files':
      return {
        id: warning.type,
        message: warning.message,
        details: warning.details,
        summary: `GAKRCLI.md: ${warning.currentValue} large ${plural(warning.currentValue, 'file')}`,
      }
    case 'unreachable_rules':
      return null
  }
}

function summarizeOllamaContextWarning(
  warning: OllamaContextWarning,
): LocalModelContextContributor {
  return {
    id: 'ollama_context_length' as ContributorId,
    message: warning.message,
    details: warning.details,
    summary: `Ollama context: ~${formatTokens(warning.currentTokens)} / ~${formatTokens(warning.maxTokens)} tokens`,
  }
}

export function buildLocalModelContextLoad(
  warnings: ContextWarnings | null | undefined,
  extraContributors: LocalModelContextContributor[] = [],
): LocalModelContextWarning | null {
  if (!warnings && extraContributors.length === 0) {
    return null
  }

  const contributors = [
    warnings?.mcpWarning ?? null,
    warnings?.agentWarning ?? null,
    warnings?.gakrcliMdWarning ?? null,
  ]
    .filter((warning): warning is ContextWarning => warning !== null)
    .map(summarizeContextWarning)
    .filter(
      (contributor): contributor is LocalModelContextContributor =>
        contributor !== null,
    )
    .concat(extraContributors)

  if (contributors.length === 0) {
    return null
  }

  return {
    contributors,
    lines: contributors.map(contributor => contributor.summary),
  }
}

function readConfiguredBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return undefined
  }
  return trimmed
}

export function resolveActiveProviderBaseUrl(
  processEnv: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (
    isEnvTruthy(processEnv.GAKR_CODE_USE_FOUNDRY) ||
    isEnvTruthy(processEnv.GAKR_CODE_USE_BEDROCK) ||
    isEnvTruthy(processEnv.GAKR_CODE_USE_VERTEX)
  ) {
    return undefined
  }

  const routeId = resolveActiveRouteIdFromEnv(processEnv)

  switch (routeId) {
    case 'anthropic':
      return readConfiguredBaseUrl(processEnv.ANTHROPIC_BASE_URL)
    case 'gemini':
      return (
        readConfiguredBaseUrl(processEnv.GEMINI_BASE_URL) ??
        readConfiguredBaseUrl(processEnv.OPENAI_API_BASE)
      )
    case 'mistral':
      return (
        readConfiguredBaseUrl(processEnv.MISTRAL_BASE_URL) ??
        readConfiguredBaseUrl(processEnv.OPENAI_API_BASE)
      )
    case 'bedrock':
    case 'vertex':
      return undefined
    default:
      return (
        readConfiguredBaseUrl(processEnv.OPENAI_BASE_URL) ??
        readConfiguredBaseUrl(processEnv.OPENAI_API_BASE)
      )
  }
}

export function isActiveProviderLocalModel(
  processEnv: NodeJS.ProcessEnv = process.env,
): boolean {
  return isLocalProviderUrl(resolveActiveProviderBaseUrl(processEnv))
}

function isLoopbackOllamaEndpoint(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false
  }
  return isDirectLocalOllamaEndpoint(new URL(baseUrl))
}

async function checkOllamaContextLength(
  activeModelName: string | undefined,
  baseUrl: string | undefined,
): Promise<LocalModelContextContributor | null> {
  if (!isLoopbackOllamaEndpoint(baseUrl)) {
    return null
  }

  const warning = await checkOllamaPsContextWarning(activeModelName)
  if (!warning) {
    return null
  }

  return summarizeOllamaContextWarning(warning)
}

export async function checkLocalModelContextLoad(
  tools: readonly Tool[],
  agentDefinitions: AgentDefinitionsResult | null | undefined,
  memoryFiles: MemoryFileInfo[],
  getToolPermissionContext: () => Promise<ToolPermissionContext>,
  baseUrl?: string,
  activeModelName?: string,
): Promise<LocalModelContextWarning | null> {
  const resolvedBaseUrl = baseUrl ?? resolveActiveProviderBaseUrl()
  if (!isLocalProviderUrl(resolvedBaseUrl)) {
    return null
  }

  const [warnings, ollamaWarning] = await Promise.all([
    checkContextWarnings(
      tools,
      agentDefinitions ?? null,
      getToolPermissionContext,
      {
        memoryFiles,
        mcpTokenStrategy: 'estimate',
        includeUnreachableRules: false,
      },
    ),
    checkOllamaContextLength(activeModelName, resolvedBaseUrl),
  ])
  return buildLocalModelContextLoad(warnings, ollamaWarning ? [ollamaWarning] : [])
}
