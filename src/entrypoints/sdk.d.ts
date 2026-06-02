// Type declarations for @gakr-gakr/gakrcli SDK
// Manually maintained — keep in sync with src/entrypoints/sdk/index.ts
// Drift is caught by validate-externals.ts (runs in CI)

// ============================================================================
// Error
// ============================================================================

export class AbortError extends Error {
  override readonly name: 'AbortError'
}

export class GakrcliError extends Error {
  constructor(message: string)
}

export class SDKError extends GakrcliError {
  constructor(message: string)
}

export class SDKAuthenticationError extends SDKError {
  constructor(message?: string)
}

export class SDKBillingError extends SDKError {
  constructor(message?: string)
}

export class SDKRateLimitError extends SDKError {
  readonly resetsAt?: number
  readonly rateLimitType?: string
  constructor(message?: string, resetsAt?: number, rateLimitType?: string)
}

export class SDKInvalidRequestError extends SDKError {
  constructor(message?: string)
}

export class SDKServerError extends SDKError {
  constructor(message?: string)
}

export class SDKMaxOutputTokensError extends SDKError {
  constructor(message?: string)
}

export type SDKAssistantMessageError =
  | 'authentication_failed'
  | 'billing_error'
  | 'rate_limit'
  | 'invalid_request'
  | 'server_error'
  | 'unknown'
  | 'max_output_tokens'

export function sdkErrorFromType(
  errorType: SDKAssistantMessageError,
  message?: string,
): SDKError | GakrcliError

// ============================================================================
// Types
// ============================================================================

export type ApiKeySource = 'user' | 'project' | 'org' | 'temporary' | 'oauth' | 'none'

export type RewindFilesResult = {
  canRewind: boolean
  error?: string
  filesChanged?: string[]
  insertions?: number
  deletions?: number
}

export type McpServerStatus = {
  name: string
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'
  serverInfo?: { name: string; version: string }
  error?: string
  scope?: string
  tools?: {
    name: string
    description?: string
    annotations?: {
      readOnly?: boolean
      destructive?: boolean
      openWorld?: boolean
    }
  }[]
}

export type PermissionResult = ({
  behavior: 'allow'
  updatedInput?: Record<string, unknown>
  updatedPermissions?: ({
    type: 'addRules'
    rules: { toolName: string; ruleContent?: string }[]
    behavior: 'allow' | 'deny' | 'ask'
    destination: 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg'
  }) | ({
    type: 'replaceRules'
    rules: { toolName: string; ruleContent?: string }[]
    behavior: 'allow' | 'deny' | 'ask'
    destination: 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg'
  }) | ({
    type: 'removeRules'
    rules: { toolName: string; ruleContent?: string }[]
    behavior: 'allow' | 'deny' | 'ask'
    destination: 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg'
  }) | ({
    type: 'setMode'
    mode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk'
    destination: 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg'
  }) | ({
    type: 'addDirectories'
    directories: string[]
    destination: 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg'
  }) | ({
    type: 'removeDirectories'
    directories: string[]
    destination: 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg'
  })[]
  toolUseID?: string
  decisionClassification?: 'user_temporary' | 'user_permanent' | 'user_reject'
}) | ({
  behavior: 'deny'
  message: string
  interrupt?: boolean
  toolUseID?: string
  decisionClassification?: 'user_temporary' | 'user_permanent' | 'user_reject'
})

export type SDKSessionInfo = {
  sessionId: string
  summary: string
  lastModified: number
  fileSize?: number
  customTitle?: string
  firstPrompt?: string
  gitBranch?: string
  cwd?: string
  tag?: string
  createdAt?: number
}

export type ListSessionsOptions = {
  dir?: string
  limit?: number
  offset?: number
  includeWorktrees?: boolean
}

export type GetSessionInfoOptions = {
  dir?: string
}

export type GetSessionMessagesOptions = {
  dir?: string
  limit?: number
  offset?: number
  includeSystemMessages?: boolean
}

export type SessionMutationOptions = {
  dir?: string
}

export type ForkSessionOptions = {
  dir?: string
  upToMessageId?: string
  title?: string
}

export type ForkSessionResult = {
  sessionId: string
}

export type SessionMessage = {
  role: 'user' | 'assistant' | 'system'
  content: unknown
  timestamp?: string
  uuid?: string
  parentUuid?: string | null
  [key: string]: unknown
}

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
  categories: Array<{ name: string; tokens: number; color: string; isDeferred?: boolean }>
  totalTokens: number
  maxTokens: number
  rawMaxTokens: number
  percentage: number
  gridRows: unknown[][]
  model: string
  memoryFiles: Array<{ path: string; type: string; tokens: number }>
  mcpTools: Array<{ name: string; serverName: string; tokens: number; isLoaded?: boolean }>
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
    source: 'userSettings' | 'projectSettings' | 'localSettings' | 'flagSettings' | 'policySettings'
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

// Re-export precise SDK message types from generated types
// These use camelCase field names and discriminated unions for full IntelliSense
import type {
  ModelUsage,
  SDKMessage,
  SDKUserMessage,
  SDKResultMessage,
} from './sdk/coreTypes.generated.js'

export type {
  SDKMessage,
  SDKUserMessage,
  SDKResultMessage,
} from './sdk/coreTypes.generated.js'

// ============================================================================
// Query types
// ============================================================================

export type QueryPermissionMode =
  | 'default'
  | 'plan'
  | 'auto-accept'
  | 'bypass-permissions'
  | 'bypassPermissions'
  | 'acceptEdits'

export type QueryOptions = {
  cwd: string
  additionalDirectories?: string[]
  model?: string
  sessionId?: string
  /** Fork the session before resuming (requires sessionId). */
  fork?: boolean
  /** Alias for fork. When true, resumed session forks to a new session ID. */
  forkSession?: boolean
  /** Resume the most recent session for this cwd (no sessionId needed). */
  continue?: boolean
  resume?: string
  /** When resuming, resume messages up to and including this message UUID. */
  resumeSessionAt?: string
  permissionMode?: QueryPermissionMode
  abortController?: AbortController
  executable?: string
  allowDangerouslySkipPermissions?: boolean
  disallowedTools?: string[]
  hooks?: Record<string, unknown[]>
  mcpServers?: Record<string, unknown>
  settings?: {
    env?: Record<string, string>
    attribution?: { commit: string; pr: string }
  }
  /** Environment variables to apply during query execution. Overrides process.env. Takes precedence over settings.env. */
  env?: Record<string, string | undefined>
  /**
   * Callback invoked before each tool use. Return `{ behavior: 'allow' }` to
   * permit the call or `{ behavior: 'deny', message?: string }` to reject it.
   *
   * **Secure-by-default**: If neither `canUseTool` nor `onPermissionRequest`
   * is provided, ALL tool uses are denied. You MUST provide at least one of
   * these callbacks to allow tool execution.
   */
  canUseTool?: (
    name: string,
    input: unknown,
    options?: { toolUseID?: string },
  ) => Promise<{ behavior: 'allow' | 'deny'; message?: string; updatedInput?: unknown }>
  /**
   * Callback invoked when a tool needs permission approval. The host receives
   * the request immediately and can resolve it by calling
   * `query.respondToPermission(toolUseId, decision)` before the timeout.
   * If omitted, tools that require permission fall through to the default
   * permission logic immediately (no timeout).
   */
  onPermissionRequest?: (message: SDKPermissionRequestMessage) => void
  systemPrompt?:
    | string
    | { type: 'preset'; preset: string; append?: string }
    | { type: 'custom'; content: string }
  /** Agent definitions to register with the query engine. */
  agents?: Record<string, {
    description: string
    prompt: string
    tools?: string[]
    disallowedTools?: string[]
    model?: string
    maxTurns?: number
  }>
  settingSources?: string[]
  /** When true, yields stream_event messages for token-by-token streaming. */
  includePartialMessages?: boolean
  /** @internal Timeout in ms for permission request resolution. Default 30000. */
  _permissionTimeoutMs?: number
  stderr?: (data: string) => void
}

export interface Query {
  readonly sessionId: string
  [Symbol.asyncIterator](): AsyncIterator<SDKMessage>
  setModel(model: string): Promise<void>
  setPermissionMode(mode: QueryPermissionMode): Promise<void>
  close(): void
  interrupt(): void
  respondToPermission(toolUseId: string, decision: PermissionResult): void
  /** Check if file rewind is possible. */
  rewindFiles(): RewindFilesResult
  /** Actually perform the file rewind. Returns files changed and diff stats. */
  rewindFilesAsync(): Promise<RewindFilesResult>
  supportedCommands(): string[]
  supportedModels(): string[]
  supportedAgents(): string[]
  mcpServerStatus(): McpServerStatus[]
  accountInfo(): Promise<{ apiKeySource: ApiKeySource; [key: string]: unknown }>
  setMaxThinkingTokens(tokens: number): void
  getRuntimeState(): Promise<SDKRuntimeState>
  getSettings(): SDKSettingsSnapshot
  applySettings(settings: SDKApplySettingsInput): Promise<SDKSettingsSnapshot>
  listProviders(): SDKProviderInfo[]
  listProviderProfiles(): SDKProviderProfileInfo[]
  getActiveProviderProfile(): SDKProviderProfileInfo | undefined
  setActiveProviderProfile(profileId: string): Promise<SDKMutationResult>
  listModels(): SDKModelInfo[]
  discoverModels(): Promise<SDKModelInfo[]>
  getPermissionMode(): QueryPermissionMode
  getReasoningConfig(): SDKReasoningConfig
  setReasoningEffort(effort: 'low' | 'medium' | 'high' | 'max' | number | null): SDKReasoningConfig
  getFastModeState(): SDKFastModeState
  setFastMode(enabled: boolean): SDKFastModeState
  getContextUsage(): Promise<SDKContextUsage>
  getUsageSummary(): SDKUsageSummary
  getTodoState(): SDKTodoState
  listSlashCommands(): SDKSlashCommandInfo[]
  runSlashCommand(command: string, args?: string): Promise<SDKRunSlashCommandResult>
  listMcpServers(): McpServerStatus[]
  setMcpServers(servers: Record<string, unknown>): Promise<SDKMutationResult>
  toggleMcpServer(serverName: string, enabled: boolean): Promise<SDKMutationResult>
  reconnectMcpServer(serverName: string): Promise<SDKMutationResult>
  listPlugins(): SDKPluginInfo[]
  setPluginEnabled(pluginName: string, enabled: boolean): Promise<SDKMutationResult>
  reloadPlugins(): Promise<SDKMutationResult>
}

/**
 * Permission request message emitted when a tool needs permission approval.
 * Hosts can respond via respondToPermission() using the request_id.
 */
export type SDKPermissionRequestMessage = {
  type: 'permission_request'
  request_id: string
  tool_name: string
  tool_use_id: string
  input: Record<string, unknown>
  uuid: string
  session_id: string
}

export type SDKPermissionTimeoutMessage = {
  type: 'permission_timeout'
  tool_name: string
  tool_use_id: string
  timed_out_after_ms: number
  uuid: string
  session_id: string
}

/**
 * A message emitted when agent definitions fail to load.
 * This allows hosts to detect configuration issues that would otherwise
 * be silently logged to console.warn.
 *
 * Note: Agent load failures are non-fatal — the query continues without agents.
 */
export type SDKAgentLoadFailureMessage = {
  type: 'agent_load_failure'
  stage: 'definitions' | 'injection'
  error_message: string
}

// ============================================================================
// Permission resolve decision (SDK-specific)
// ============================================================================

/**
 * Decision returned by permission resolution.
 * Used by respondToPermission() and internal permission handling.
 */
export type PermissionResolveDecision =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message: string; decisionReason: { type: 'mode'; mode: string } }

// ============================================================================
// V2 API types
// ============================================================================

export type SDKSessionOptions = {
  cwd: string
  model?: string
  permissionMode?: QueryPermissionMode
  abortController?: AbortController
  /**
   * Callback invoked before each tool use. Return `{ behavior: 'allow' }` to
   * permit the call or `{ behavior: 'deny', message?: string }` to reject it.
   *
   * **Secure-by-default**: If neither `canUseTool` nor `onPermissionRequest`
   * is provided, ALL tool uses are denied. You MUST provide at least one of
   * these callbacks to allow tool execution.
   */
  canUseTool?: (
    name: string,
    input: unknown,
    options?: { toolUseID?: string },
  ) => Promise<{ behavior: 'allow' | 'deny'; message?: string; updatedInput?: unknown }>
  /** MCP server configurations for this session. */
  mcpServers?: Record<string, unknown>
  /**
   * Callback invoked when a tool needs permission approval. The host receives
   * the request immediately and can resolve it via respondToPermission().
   */
  onPermissionRequest?: (message: SDKPermissionRequestMessage) => void
  /** Tools to disallow (blanket deny by tool name). */
  disallowedTools?: string[]
}

export interface SDKSession {
  sessionId: string
  sendMessage(content: string): AsyncIterable<SDKMessage>
  getMessages(): SDKMessage[]
  interrupt(): void
  /** Close the session and release resources (MCP connections, etc.). */
  close(): void
  /** Respond to a pending permission prompt. */
  respondToPermission(toolUseId: string, decision: PermissionResult): void
}

// ============================================================================
// MCP tool types
// ============================================================================

export interface SdkMcpToolDefinition<Schema = any> {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: any, extra: unknown) => Promise<any>
  annotations?: any
  searchHint?: string
  alwaysLoad?: boolean
}

// ============================================================================
// Session functions
// ============================================================================

export function listSessions(
  options?: ListSessionsOptions,
): Promise<SDKSessionInfo[]>

export function getSessionInfo(
  sessionId: string,
  options?: GetSessionInfoOptions,
): Promise<SDKSessionInfo | undefined>

export function getSessionMessages(
  sessionId: string,
  options?: GetSessionMessagesOptions,
): Promise<SessionMessage[]>

export function renameSession(
  sessionId: string,
  title: string,
  options?: SessionMutationOptions,
): Promise<void>

export function tagSession(
  sessionId: string,
  tag: string | null,
  options?: SessionMutationOptions,
): Promise<void>

export function forkSession(
  sessionId: string,
  options?: ForkSessionOptions,
): Promise<ForkSessionResult>

export function deleteSession(
  sessionId: string,
  options?: SessionMutationOptions,
): Promise<void>

// ============================================================================
// Query functions
// ============================================================================

export function query(params: {
  prompt: string | AsyncIterable<SDKUserMessage>
  options?: QueryOptions
}): Query

export function queryAsync(params: {
  prompt: string | AsyncIterable<SDKUserMessage>
  options?: QueryOptions
}): Promise<Query>

// ============================================================================
// V2 API functions
// ============================================================================

export function unstable_v2_createSession(options: SDKSessionOptions): SDKSession

export function unstable_v2_resumeSession(
  sessionId: string,
  options: SDKSessionOptions,
): Promise<SDKSession>

export function unstable_v2_prompt(
  message: string,
  options: SDKSessionOptions,
): Promise<SDKResultMessage>

// ============================================================================
// MCP tool functions
// ============================================================================

export function tool<Schema = any>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: any, extra: unknown) => Promise<any>,
  extras?: {
    annotations?: any
    searchHint?: string
    alwaysLoad?: boolean
  },
): SdkMcpToolDefinition<Schema>

/**
 * MCP server transport configuration types.
 * Matches McpServerConfigForProcessTransport from coreTypes.generated.ts.
 */
export type SdkMcpStdioConfig = {
  type?: "stdio"
  command: string
  args?: string[]
  env?: Record<string, string>
}

export type SdkMcpSSEConfig = {
  type: "sse"
  url: string
  headers?: Record<string, string>
}

export type SdkMcpHttpConfig = {
  type: "http"
  url: string
  headers?: Record<string, string>
}

export type SdkMcpSdkConfig = {
  type: "sdk"
  name: string
  /** In-process tool definitions created via the tool() helper. */
  tools?: SdkMcpToolDefinition[]
}

export type SdkMcpServerConfig = SdkMcpStdioConfig | SdkMcpSSEConfig | SdkMcpHttpConfig | SdkMcpSdkConfig

/**
 * Scoped MCP server config with session scope.
 * Returned by createSdkMcpServer() for use with mcpServers option.
 */
export type SdkScopedMcpServerConfig = SdkMcpServerConfig & {
  scope: "session"
}

/**
 * Wraps an MCP server configuration for use with the SDK.
 * Adds the 'session' scope marker so the SDK knows this server
 * should be connected per-session (not globally).
 *
 * @param config - MCP server config (stdio, sse, http, or sdk type)
 * @returns Scoped config with scope: 'session' added
 *
 * @example
 * ```typescript
 * const server = createSdkMcpServer({
 *   type: 'stdio',
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
 * })
 * const session = unstable_v2_createSession({
 *   cwd: '/my/project',
 *   mcpServers: { 'fs': server },
 * })
 * ```
 */
export function createSdkMcpServer(config: SdkMcpServerConfig): SdkScopedMcpServerConfig
