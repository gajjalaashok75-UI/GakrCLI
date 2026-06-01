import type { Store } from '../../state/store.js'
import type { AppState } from '../../state/AppStateStore.js'
import type { Command } from '../../types/command.js'
import { getCommandName, isCommandEnabled } from '../../types/command.js'
import type { LoadedPlugin } from '../../types/plugin.js'
import { getPluginErrorMessage } from '../../types/plugin.js'
import { getPluginCommandsState } from '../../state/pluginCommandsStore.js'
import {
  getAllModels,
  getProviderPresetUiMetadata,
  ORDERED_PROVIDER_PRESETS,
  type ProviderPreset,
} from '../../integrations/index.js'
import {
  getActiveProviderProfile as readActiveProviderProfile,
  getProfileModelOptions,
  getProviderProfiles,
  persistActiveProviderProfileModel,
  setActiveProviderProfile as activateProviderProfile,
} from '../../utils/providerProfiles.js'
import type { ModelUsage } from './coreTypes.generated.js'
import type { McpServerStatus, PermissionResult } from './coreTypes.generated.js'
import type { QueryPermissionMode } from './shared.js'

export type SDKProviderInfo = {
  id: string
  label: string
  name: string
  provider: string
  defaultBaseUrl?: string
  defaultModel?: string
  requiresApiKey?: boolean
}

export type SDKProviderProfileInfo = {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  hasApiKey: boolean
  apiFormat?: string
  authHeader?: string
  authScheme?: string
  hasAuthHeaderValue?: boolean
  customHeaders?: string[]
  active?: boolean
}

export type SDKModelInfo = {
  value: string
  displayName: string
  description?: string
  provider?: string
  contextWindow?: number
  maxOutputTokens?: number
  supportsReasoning?: boolean
  supportsVision?: boolean
  supportsFastMode?: boolean
}

export type SDKReasoningConfig = {
  thinkingEnabled: boolean
  maxThinkingTokens?: number
  effort?: 'low' | 'medium' | 'high' | 'max' | number
}

export type SDKFastModeState = {
  state: 'off' | 'cooldown' | 'on'
  enabled: boolean
  canToggle: boolean
}

export type SDKUsageSummary = {
  totalCostUsd: number
  usage: Record<string, number>
  modelUsage: Record<string, ModelUsage>
  fastModeState?: 'off' | 'cooldown' | 'on'
}

export type SDKTodoItem = {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

export type SDKTodoState = {
  items: SDKTodoItem[]
  activeItem?: SDKTodoItem
  completed: number
  total: number
}

export type SDKContextUsage = {
  categories: Array<{
    name: string
    tokens: number
    color: string
    isDeferred?: boolean
  }>
  totalTokens: number
  maxTokens: number
  rawMaxTokens: number
  percentage: number
  gridRows: unknown[][]
  model: string
  memoryFiles: Array<{ path: string; type: string; tokens: number }>
  mcpTools: Array<{
    name: string
    serverName: string
    tokens: number
    isLoaded?: boolean
  }>
  agents: Array<{ agentType: string; source: string; tokens: number }>
  isAutoCompactEnabled: boolean
  apiUsage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  } | null
  [key: string]: unknown
}

export type SDKSlashCommandInfo = {
  name: string
  description: string
  argumentHint: string
  type?: 'prompt' | 'local' | 'local-jsx'
  source?: string
  requiresUi?: boolean
}

export type SDKRunSlashCommandResult =
  | { type: 'prompt'; command: SDKSlashCommandInfo; content: string }
  | { type: 'local_output'; command: SDKSlashCommandInfo; content: string }
  | { type: 'requires_ui'; command: SDKSlashCommandInfo }
  | { type: 'not_found'; command: string }
  | { type: 'unsupported'; command: SDKSlashCommandInfo; reason: string }

export type SDKPluginInfo = {
  name: string
  path?: string
  source?: string
  repository?: string
  version?: string
  status: 'enabled' | 'disabled' | 'error'
  commands?: string[]
  error?: string
  builtin?: boolean
}

export type SDKSettingsSnapshot = {
  effective: Record<string, unknown>
  sources: Array<{
    source:
      | 'userSettings'
      | 'projectSettings'
      | 'localSettings'
      | 'flagSettings'
      | 'policySettings'
    settings: Record<string, unknown>
  }>
  applied: {
    model: string
    permissionMode: QueryPermissionMode
    effort: 'low' | 'medium' | 'high' | 'max' | number | null
    fastMode: boolean
  }
}

export type SDKRuntimeState = {
  sessionId: string
  cwd: string
  status: 'idle' | 'running' | 'closed'
  provider?: SDKProviderInfo
  providers: SDKProviderInfo[]
  activeProfile?: SDKProviderProfileInfo
  profiles: SDKProviderProfileInfo[]
  model: string
  models: SDKModelInfo[]
  permissionMode: QueryPermissionMode
  reasoning: SDKReasoningConfig
  fastModeState: SDKFastModeState
  slashCommands: SDKSlashCommandInfo[]
  agents: Array<{ name: string; description?: string; model?: string }>
  mcpServers: McpServerStatus[]
  plugins: SDKPluginInfo[]
  account: { apiKeySource: string; [key: string]: unknown }
  usage: SDKUsageSummary
  todos: SDKTodoState
}

export async function loadSlashCommandsForSdk(cwd: string): Promise<Command[]> {
  try {
    const { getCommands } = await import('../../commands.js')
    return await getCommands(cwd)
  } catch {
    return []
  }
}

export type SDKApplySettingsInput = {
  model?: string | null
  permissionMode?: QueryPermissionMode
  effort?: 'low' | 'medium' | 'high' | 'max' | number | null
  maxThinkingTokens?: number | null
  fastMode?: boolean
  env?: Record<string, string | undefined>
}

export type SDKMutationResult = {
  success: boolean
  message?: string
  [key: string]: unknown
}

export function sanitizeProfile(profile: ReturnType<typeof readActiveProviderProfile> | undefined): SDKProviderProfileInfo | undefined {
  if (!profile) return undefined
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    model: profile.model,
    hasApiKey: Boolean(profile.apiKey),
    apiFormat: profile.apiFormat,
    authHeader: profile.authHeader,
    authScheme: profile.authScheme,
    hasAuthHeaderValue: Boolean(profile.authHeaderValue),
    customHeaders: profile.customHeaders ? Object.keys(profile.customHeaders) : undefined,
  }
}

export function listProviders(): SDKProviderInfo[] {
  return ORDERED_PROVIDER_PRESETS.map((preset: ProviderPreset) => {
    const metadata = getProviderPresetUiMetadata(preset)
    return {
      id: preset,
      label: metadata.label,
      name: metadata.name,
      provider: metadata.provider,
      defaultBaseUrl: metadata.baseUrl,
      defaultModel: metadata.model,
      requiresApiKey: metadata.requiresApiKey,
    }
  })
}

export function listProviderProfiles(): SDKProviderProfileInfo[] {
  const active = readActiveProviderProfile()
  return getProviderProfiles().map(profile => ({
    ...sanitizeProfile(profile)!,
    active: active?.id === profile.id,
  }))
}

export function getActiveProviderProfile(): SDKProviderProfileInfo | undefined {
  const active = sanitizeProfile(readActiveProviderProfile())
  return active ? { ...active, active: true } : undefined
}

export function setActiveProviderProfile(profileId: string): SDKMutationResult {
  const profile = activateProviderProfile(profileId)
  if (!profile) {
    return { success: false, message: `Provider profile not found: ${profileId}` }
  }
  return { success: true, profile: { ...sanitizeProfile(profile), active: true } }
}

export function listModelsFromState(state: AppState): SDKModelInfo[] {
  const activeProfile = readActiveProviderProfile()
  if (activeProfile) {
    const options = getProfileModelOptions(activeProfile)
    return options.map(option => ({
      value: option.value,
      displayName: option.label ?? option.value,
      description: option.description,
      provider: activeProfile.provider,
    }))
  }

  const activeModel = state.mainLoopModel ?? state.mainLoopModelForSession
  const catalog = getAllModels().map(model => ({
    value: model.defaultModel,
    displayName: model.label,
    provider: model.gatewayId ?? model.vendorId,
    contextWindow: model.contextWindow,
    maxOutputTokens: model.maxOutputTokens,
    supportsReasoning: model.capabilities.supportsReasoning,
    supportsVision: model.capabilities.supportsVision,
  }))

  if (activeModel && !catalog.some(model => model.value === activeModel)) {
    return [
      { value: activeModel, displayName: activeModel },
      ...catalog,
    ]
  }

  return catalog
}

export function getReasoningConfig(state: AppState): SDKReasoningConfig {
  return {
    thinkingEnabled: state.thinkingEnabled !== false,
    maxThinkingTokens: state.thinkingBudgetTokens,
    effort: state.effortValue,
  }
}

export function getFastModeState(state: AppState): SDKFastModeState {
  const enabled = state.fastMode === true
  return {
    state: enabled ? 'on' : 'off',
    enabled,
    canToggle: true,
  }
}

export function listSlashCommandsFromState(
  state: AppState,
  commandsFromRegistry: readonly Command[] = [],
): SDKSlashCommandInfo[] {
  const commands = [
    ...commandsFromRegistry,
    ...(state.mcp.commands ?? []),
    ...(state.plugins.commands ?? []),
    ...getPluginCommandsState(),
  ]
  const seen = new Set<string>()
  const result: SDKSlashCommandInfo[] = []

  for (const command of commands) {
    const name = getCommandName(command)
    if (
      !name ||
      seen.has(name) ||
      command.userInvocable === false ||
      command.isHidden ||
      !isCommandEnabled(command)
    ) continue
    seen.add(name)
    result.push(commandToInfo(command))
  }

  return result
}

export function commandToInfo(command: Command): SDKSlashCommandInfo {
  return {
    name: getCommandName(command),
    description: command.description ?? '',
    argumentHint: command.argumentHint ?? '',
    type: command.type,
    source: command.source,
    requiresUi: command.type === 'local-jsx',
  }
}

export function listAgentsFromState(state: AppState): Array<{ name: string; description?: string; model?: string }> {
  return (state.agentDefinitions?.activeAgents ?? [])
    .map((agent: any) => ({
      name: String(agent.agentType ?? agent.name ?? ''),
      description: typeof agent.description === 'string' ? agent.description : undefined,
      model: typeof agent.model === 'string' ? agent.model : undefined,
    }))
    .filter(agent => agent.name.length > 0)
}

export function listPluginsFromState(state: AppState): SDKPluginInfo[] {
  const commandNamesByPlugin = new Map<string, string[]>()
  for (const command of state.plugins.commands ?? []) {
    const pluginName = command.pluginInfo?.pluginManifest?.name
    if (!pluginName) continue
    const current = commandNamesByPlugin.get(pluginName) ?? []
    current.push(getCommandName(command))
    commandNamesByPlugin.set(pluginName, current)
  }

  const toPluginInfo = (plugin: LoadedPlugin, status: 'enabled' | 'disabled'): SDKPluginInfo => ({
    name: plugin.name,
    path: plugin.path,
    source: plugin.source,
    repository: plugin.repository,
    version: plugin.manifest.version,
    status,
    commands: commandNamesByPlugin.get(plugin.name) ?? [],
    builtin: plugin.isBuiltin,
  })

  const errors = (state.plugins.errors ?? []).map(error => ({
    name: error.plugin ?? error.source,
    status: 'error' as const,
    source: error.source,
    error: getPluginErrorMessage(error),
  }))

  return [
    ...(state.plugins.enabled ?? []).map(plugin => toPluginInfo(plugin, 'enabled')),
    ...(state.plugins.disabled ?? []).map(plugin => toPluginInfo(plugin, 'disabled')),
    ...errors,
  ]
}

export function getSettingsSnapshot(state: AppState): SDKSettingsSnapshot {
  const settings = state.settings as unknown as Record<string, unknown>
  const sources = [
    'userSettings',
    'projectSettings',
    'localSettings',
    'flagSettings',
    'policySettings',
  ] as const

  return {
    effective: settings,
    sources: sources.map(source => ({ source, settings: {} })),
    applied: {
      model: state.mainLoopModel ?? 'default',
      permissionMode: state.toolPermissionContext.mode as QueryPermissionMode,
      effort: state.effortValue ?? null,
      fastMode: state.fastMode === true,
    },
  }
}

export function emptyUsageSummary(): SDKUsageSummary {
  return {
    totalCostUsd: 0,
    usage: {},
    modelUsage: {},
  }
}

export function getTodoStateFromState(state: AppState): SDKTodoState {
  const items = Object.values(state.todos ?? {}).flat() as SDKTodoItem[]
  const visibleItems = items.every(todo => todo.status === 'completed') ? [] : items
  return {
    items: visibleItems,
    activeItem: visibleItems.find(todo => todo.status === 'in_progress'),
    completed: visibleItems.filter(todo => todo.status === 'completed').length,
    total: visibleItems.length,
  }
}

export function usageSummaryFromResult(message: any): SDKUsageSummary | undefined {
  if (!message || message.type !== 'result') return undefined
  return {
    totalCostUsd: typeof message.total_cost_usd === 'number'
      ? message.total_cost_usd
      : typeof message.totalCostUsd === 'number'
        ? message.totalCostUsd
        : 0,
    usage: (message.usage && typeof message.usage === 'object')
      ? message.usage
      : {},
    modelUsage: (message.modelUsage && typeof message.modelUsage === 'object')
      ? message.modelUsage
      : {},
    fastModeState: message.fast_mode_state ?? message.fastModeState,
  }
}

export function applyModelToProfile(model: string): SDKMutationResult {
  const profile = persistActiveProviderProfileModel(model)
  return profile
    ? { success: true, profile: { ...sanitizeProfile(profile), active: true } }
    : { success: false, message: 'No active provider profile accepted the model update' }
}

export function buildRuntimeState(input: {
  sessionId: string
  cwd: string
  status: 'idle' | 'running' | 'closed'
  state: AppState
  mcpServers: McpServerStatus[]
  account: { apiKeySource: string; [key: string]: unknown }
  usage?: SDKUsageSummary
  slashCommands?: SDKSlashCommandInfo[]
}): SDKRuntimeState {
  const providers = listProviders()
  const activeProfile = getActiveProviderProfile()
  const activeModel = input.state.mainLoopModel ?? input.state.mainLoopModelForSession ?? activeProfile?.model ?? 'default'
  const provider = activeProfile
    ? providers.find(candidate => candidate.provider === activeProfile.provider || candidate.id === activeProfile.provider)
    : undefined

  return {
    sessionId: input.sessionId,
    cwd: input.cwd,
    status: input.status,
    provider,
    providers,
    activeProfile,
    profiles: listProviderProfiles(),
    model: activeModel,
    models: listModelsFromState(input.state),
    permissionMode: input.state.toolPermissionContext.mode as QueryPermissionMode,
    reasoning: getReasoningConfig(input.state),
    fastModeState: getFastModeState(input.state),
    slashCommands: input.slashCommands ?? listSlashCommandsFromState(input.state),
    agents: listAgentsFromState(input.state),
    mcpServers: input.mcpServers,
    plugins: listPluginsFromState(input.state),
    account: input.account,
    usage: input.usage ?? emptyUsageSummary(),
    todos: getTodoStateFromState(input.state),
  }
}

export function normalizePermissionDecision(decision: PermissionResult): PermissionResult {
  return decision
}

export function updateStoreFastMode(store: Store<AppState>, enabled: boolean): SDKFastModeState {
  store.setState(prev => ({
    ...prev,
    fastMode: enabled,
  }))
  return getFastModeState(store.getState())
}
