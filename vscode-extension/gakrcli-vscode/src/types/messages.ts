// src/types/messages.ts
// TypeScript types for ALL StdoutMessage and StdinMessage variants.
// Mirrors controlSchemas.ts StdoutMessageSchema and StdinMessageSchema unions.

import type {
  AccountInfo,
  AgentDefinition,
  AgentInfo,
  ApiKeySource,
  AssistantMessageError,
  FastModeState,
  HookCallbackMatcher,
  HookEvent,
  McpServerConfigForProcessTransport,
  McpServerStatus,
  ModelInfo,
  ModelUsage,
  PermissionMode,
  PermissionUpdate,
  SlashCommand,
} from './session';

// ============================================================================
// SDK Core Messages (type field discriminates at top level)
// ============================================================================

/** Complete assistant turn */
export interface SDKAssistantMessage {
  type: 'assistant';
  message: unknown; // APIAssistantMessage from Anthropic SDK
  parent_tool_use_id: string | null;
  error?: AssistantMessageError;
  uuid: string;
  session_id: string;
}

/** User message (sent or echoed/replayed) */
export interface SDKUserMessage {
  type: 'user';
  message: unknown; // APIUserMessage from Anthropic SDK
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
  priority?: 'now' | 'next' | 'later';
  timestamp?: string;
  uuid?: string;
  session_id?: string;
}

/** User message replay (from session resume) */
export interface SDKUserMessageReplay {
  type: 'user';
  message: unknown;
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
  priority?: 'now' | 'next' | 'later';
  timestamp?: string;
  uuid: string;
  session_id: string;
  isReplay: true;
}

/** Successful turn result */
export interface SDKResultSuccess {
  type: 'result';
  subtype: 'success';
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;
  stop_reason: string | null;
  total_cost_usd: number;
  usage: unknown; // NonNullableUsage
  modelUsage: Record<string, ModelUsage>;
  permission_denials: Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
  }>;
  structured_output?: unknown;
  fast_mode_state?: FastModeState;
  uuid: string;
  session_id: string;
}

/** Error turn result */
export interface SDKResultError {
  type: 'result';
  subtype:
    | 'error_during_execution'
    | 'error_max_turns'
    | 'error_max_budget_usd'
    | 'error_max_structured_output_retries';
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  stop_reason: string | null;
  total_cost_usd: number;
  usage: unknown;
  modelUsage: Record<string, ModelUsage>;
  permission_denials: Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
  }>;
  errors: string[];
  fast_mode_state?: FastModeState;
  uuid: string;
  session_id: string;
}

export type SDKResultMessage = SDKResultSuccess | SDKResultError;

/** Streaming event wrapper (Anthropic-format stream events) */
export interface SDKPartialAssistantMessage {
  type: 'stream_event';
  event: unknown; // RawMessageStreamEvent from Anthropic SDK
  parent_tool_use_id: string | null;
  uuid: string;
  session_id: string;
}

/** Tool progress during long-running tool execution */
export interface SDKToolProgressMessage {
  type: 'tool_progress';
  tool_use_id: string;
  tool_name: string;
  parent_tool_use_id: string | null;
  elapsed_time_seconds: number;
  task_id?: string;
  uuid: string;
  session_id: string;
}

/** Tool use summary */
export interface SDKToolUseSummaryMessage {
  type: 'tool_use_summary';
  summary: string;
  preceding_tool_use_ids: string[];
  uuid: string;
  session_id: string;
}

/** Auth status change */
export interface SDKAuthStatusMessage {
  type: 'auth_status';
  isAuthenticating: boolean;
  output: string[];
  error?: string;
  uuid: string;
  session_id: string;
}

/** Rate limit event */
export interface SDKRateLimitEvent {
  type: 'rate_limit_event';
  rate_limit_info: {
    status: 'allowed' | 'allowed_warning' | 'rejected';
    resetsAt?: number;
    rateLimitType?: string;
    utilization?: number;
    overageStatus?: 'allowed' | 'allowed_warning' | 'rejected';
    overageResetsAt?: number;
    overageDisabledReason?: string;
    isUsingOverage?: boolean;
    surpassedThreshold?: number;
  };
  uuid: string;
  session_id: string;
}

/** Prompt suggestion from AI */
export interface SDKPromptSuggestionMessage {
  type: 'prompt_suggestion';
  suggestion: string;
  uuid: string;
  session_id: string;
}

// ============================================================================
// System Messages (type: 'system', discriminated by subtype)
// ============================================================================

/** Session init system message */
export interface SDKSystemInitMessage {
  type: 'system';
  subtype: 'init';
  agents?: string[];
  apiKeySource: ApiKeySource;
  betas?: string[];
  gakrcli_version?: string;
  cwd: string;
  tools: string[];
  mcp_servers: Array<{ name: string; status: string }>;
  model: string;
  permissionMode: PermissionMode;
  slash_commands: string[];
  output_style: string;
  skills: string[];
  plugins: Array<{ name: string; path: string; source?: string }>;
  fast_mode_state?: FastModeState;
  uuid: string;
  session_id: string;
}

/** Status update */
export interface SDKStatusMessage {
  type: 'system';
  subtype: 'status';
  status: 'compacting' | null;
  permissionMode?: PermissionMode;
  uuid: string;
  session_id: string;
}

/** Context compaction boundary */
export interface SDKCompactBoundaryMessage {
  type: 'system';
  subtype: 'compact_boundary';
  compact_metadata: {
    trigger: 'manual' | 'auto';
    pre_tokens: number;
    preserved_segment?: {
      head_uuid: string;
      anchor_uuid: string;
      tail_uuid: string;
    };
  };
  uuid: string;
  session_id: string;
}

/** API retry event */
export interface SDKAPIRetryMessage {
  type: 'system';
  subtype: 'api_retry';
  attempt: number;
  max_retries: number;
  retry_delay_ms: number;
  error_status: number | null;
  error: AssistantMessageError;
  uuid: string;
  session_id: string;
}

/** Local command output */
export interface SDKLocalCommandOutputMessage {
  type: 'system';
  subtype: 'local_command_output';
  content: string;
  uuid: string;
  session_id: string;
}

/** Hook started */
export interface SDKHookStartedMessage {
  type: 'system';
  subtype: 'hook_started';
  hook_id: string;
  hook_name: string;
  hook_event: string;
  uuid: string;
  session_id: string;
}

/** Hook progress */
export interface SDKHookProgressMessage {
  type: 'system';
  subtype: 'hook_progress';
  hook_id: string;
  hook_name: string;
  hook_event: string;
  stdout: string;
  stderr: string;
  output: string;
  uuid: string;
  session_id: string;
}

/** Hook response */
export interface SDKHookResponseMessage {
  type: 'system';
  subtype: 'hook_response';
  hook_id: string;
  hook_name: string;
  hook_event: string;
  output: string;
  stdout: string;
  stderr: string;
  exit_code?: number;
  outcome: 'success' | 'error' | 'cancelled';
  uuid: string;
  session_id: string;
}

/** Session state changed */
export interface SDKSessionStateChangedMessage {
  type: 'system';
  subtype: 'session_state_changed';
  state: 'idle' | 'running' | 'requires_action';
  uuid: string;
  session_id: string;
}

/** Files persisted event */
export interface SDKFilesPersistedEvent {
  type: 'system';
  subtype: 'files_persisted';
  files: Array<{ filename: string; file_id: string }>;
  failed: Array<{ filename: string; error: string }>;
  processed_at: string;
  uuid: string;
  session_id: string;
}

/** Task notification */
export interface SDKTaskNotificationMessage {
  type: 'system';
  subtype: 'task_notification';
  task_id: string;
  tool_use_id?: string;
  status: 'completed' | 'failed' | 'stopped';
  output_file: string;
  summary: string;
  usage?: { total_tokens: number; tool_uses: number; duration_ms: number };
  uuid: string;
  session_id: string;
}

/** Task started */
export interface SDKTaskStartedMessage {
  type: 'system';
  subtype: 'task_started';
  task_id: string;
  tool_use_id?: string;
  description: string;
  task_type?: string;
  workflow_name?: string;
  prompt?: string;
  uuid: string;
  session_id: string;
}

/** Task progress */
export interface SDKTaskProgressMessage {
  type: 'system';
  subtype: 'task_progress';
  task_id: string;
  tool_use_id?: string;
  description: string;
  usage: { total_tokens: number; tool_uses: number; duration_ms: number };
  last_tool_name?: string;
  summary?: string;
  uuid: string;
  session_id: string;
}

/** Elicitation complete */
export interface SDKElicitationCompleteMessage {
  type: 'system';
  subtype: 'elicitation_complete';
  mcp_server_name: string;
  elicitation_id: string;
  uuid: string;
  session_id: string;
}

/** Post-turn summary (background agent progress) */
export interface SDKPostTurnSummaryMessage {
  type: 'system';
  subtype: 'post_turn_summary';
  summarizes_uuid: string;
  status_category: 'blocked' | 'waiting' | 'completed' | 'review_ready' | 'failed';
  status_detail: string;
  is_noteworthy: boolean;
  title: string;
  description: string;
  recent_action: string;
  needs_action: string;
  artifact_urls: string[];
  uuid: string;
  session_id: string;
}

/** Union of all system message subtypes */
export type SDKSystemMessage =
  | SDKSystemInitMessage
  | SDKStatusMessage
  | SDKCompactBoundaryMessage
  | SDKAPIRetryMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKSessionStateChangedMessage
  | SDKFilesPersistedEvent
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKElicitationCompleteMessage
  | SDKPostTurnSummaryMessage;

// ============================================================================
// Streamlined Messages (internal, for agent progress summaries)
// ============================================================================

export interface SDKStreamlinedTextMessage {
  type: 'streamlined_text';
  text: string;
  session_id: string;
  uuid: string;
}

export interface SDKStreamlinedToolUseSummaryMessage {
  type: 'streamlined_tool_use_summary';
  tool_summary: string;
  session_id: string;
  uuid: string;
}

// ============================================================================
// Control Messages (see protocol.ts for full details)
// ============================================================================

// Forward declaration — full types in protocol.ts
export interface SDKControlResponse {
  type: 'control_response';
  response: ControlResponseSuccess | ControlResponseError;
}

export interface ControlResponseSuccess {
  subtype: 'success';
  request_id: string;
  response?: Record<string, unknown>;
}

export interface ControlResponseError {
  subtype: 'error';
  request_id: string;
  error: string;
  pending_permission_requests?: SDKControlRequest[];
}

export interface SDKControlRequest {
  type: 'control_request';
  request_id: string;
  request: ControlRequestInner;
}

export interface SDKControlCancelRequest {
  type: 'control_cancel_request';
  request_id: string;
}

export interface SDKKeepAliveMessage {
  type: 'keep_alive';
}

// ============================================================================
// Control Request Inner Types (subtypes the CLI sends TO the extension)
// ============================================================================

export interface ControlRequestPermission {
  subtype: 'can_use_tool';
  tool_name: string;
  input: Record<string, unknown>;
  permission_suggestions?: PermissionUpdate[];
  blocked_path?: string;
  decision_reason?: string;
  title?: string;
  display_name?: string;
  tool_use_id: string;
  agent_id?: string;
  description?: string;
}

export interface ControlRequestElicitation {
  subtype: 'elicitation';
  mcp_server_name: string;
  message: string;
  mode?: 'form' | 'url';
  url?: string;
  elicitation_id?: string;
  requested_schema?: Record<string, unknown>;
}

export interface ControlRequestHookCallback {
  subtype: 'hook_callback';
  callback_id: string;
  input: unknown; // HookInput union
  tool_use_id?: string;
}

export interface ControlRequestMcpMessage {
  subtype: 'mcp_message';
  server_name: string;
  message: unknown; // JSON-RPC message
}

export interface ControlRequestSetPermissionMode {
  subtype: 'set_permission_mode';
  mode: PermissionMode;
  ultraplan?: boolean;
}

/** Union of control_request subtypes that the CLI sends to the extension */
export type ControlRequestInner =
  | ControlRequestPermission
  | ControlRequestElicitation
  | ControlRequestHookCallback
  | ControlRequestMcpMessage
  | ControlRequestSetPermissionMode;

// ============================================================================
// Aggregate Message Types (mirror StdoutMessageSchema / StdinMessageSchema)
// ============================================================================

/**
 * StdoutMessage — all possible messages the CLI can write to stdout.
 * Discriminated by `type` field at top level.
 */
export type StdoutMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKToolProgressMessage
  | SDKToolUseSummaryMessage
  | SDKAuthStatusMessage
  | SDKRateLimitEvent
  | SDKPromptSuggestionMessage
  | SDKStreamlinedTextMessage
  | SDKStreamlinedToolUseSummaryMessage
  | SDKPostTurnSummaryMessage
  | SDKControlResponse
  | SDKControlRequest
  | SDKControlCancelRequest
  | SDKKeepAliveMessage;

/**
 * StdinMessage — all possible messages the extension can write to stdin.
 */
export type StdinMessage =
  | SDKUserMessage
  | SDKControlRequest
  | SDKControlResponse
  | SDKKeepAliveMessage
  | SDKUpdateEnvironmentVariablesMessage;

export interface SDKUpdateEnvironmentVariablesMessage {
  type: 'update_environment_variables';
  variables: Record<string, string>;
}
