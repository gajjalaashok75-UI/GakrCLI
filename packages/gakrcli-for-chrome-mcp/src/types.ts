/**
 * Optional type for the second argument of the Logger.
 * Callers use util.format to append details; in practice this is usually a caught exception.
 */
export type LoggerDetail = Error | NodeJS.ErrnoException

/** Narrow unknown to LoggerDetail for use in catch blocks passed to the logger. */
export function toLoggerDetail(detail: unknown): LoggerDetail | undefined {
  return detail instanceof Error ? detail : undefined
}

/** Host-injected logging interface, aligned with DebugLogger (util.format). */
export interface Logger {
  info: (message: string, detail?: LoggerDetail) => void // informational
  error: (message: string, detail?: LoggerDetail) => void // errors
  warn: (message: string, detail?: LoggerDetail) => void // warnings
  debug: (message: string, detail?: LoggerDetail) => void // debug
  silly: (message: string, detail?: LoggerDetail) => void // finest granularity debug
}

/**
 * Error type enum for Bridge connection failures.
 * Reported by bridgeClient when getUserId / getOAuthToken / WebSocket creation fails.
 */
export type ChromeBridgeConnectionErrorType =
  | 'no_user_id' // Unable to get user UUID
  | 'no_oauth_token' // Unable to get OAuth token
  | 'websocket_error' // WebSocket creation or runtime error

/** Telemetry metadata for tool calls (started / completed / timeout / error). */
export type ChromeBridgeToolCallMetadata = {
  tool_name: string // MCP tool name
  tool_use_id: string // UUID for this invocation
  duration_ms?: number // Duration in milliseconds
  timeout_ms?: number // Timeout threshold in ms, only for timeout events
  error_message?: string // Error summary (truncated), only for error events
}

/** Telemetry metadata for Bridge connection failures. */
export type ChromeBridgeConnectionFailedMetadata = {
  duration_ms: number // Duration from connection start to failure (ms)
  error_type: ChromeBridgeConnectionErrorType // Failure reason category
  reconnect_attempt: number // Current reconnection attempt number
}

/** Telemetry metadata when Bridge starts connecting. */
export type ChromeBridgeConnectionStartedMetadata = {
  bridge_url: string // Target WebSocket URL (includes user path)
}

/** Telemetry metadata for Bridge disconnection. */
export type ChromeBridgeDisconnectedMetadata = {
  close_code: number // WebSocket close code
  duration_since_connect_ms: number // Time from successful connection to disconnection (ms)
  reconnect_attempt: number // Upcoming reconnection sequence number
}

/** Telemetry metadata for successful Bridge connection. */
export type ChromeBridgeConnectionSucceededMetadata = {
  duration_ms: number // Duration from start to connection ready (ms)
  status: 'paired' | 'waiting' // paired=extension paired; waiting=awaiting extension
}

/** Telemetry metadata when Bridge reconnection attempts are exhausted. */
export type ChromeBridgeReconnectExhaustedMetadata = {
  total_attempts: number // Cumulative reconnection attempt limit
}

/**
 * Union type for trackEvent callback metadata.
 * Each variant corresponds to a chrome_bridge_* event in bridgeClient; null means no additional fields.
 */
export type ChromeBridgeTrackEventMetadata =
  | ChromeBridgeToolCallMetadata
  | ChromeBridgeConnectionFailedMetadata
  | ChromeBridgeConnectionStartedMetadata
  | ChromeBridgeDisconnectedMetadata
  | ChromeBridgeConnectionSucceededMetadata
  | ChromeBridgeReconnectExhaustedMetadata
  | null // No metadata (e.g. peer_connected / peer_disconnected)

export type PermissionMode =
  | 'ask'
  | 'skip_all_permission_checks'
  | 'follow_a_plan'

export interface BridgeConfig {
  /** Bridge WebSocket base URL (e.g., wss://bridge.gakrcliusercontent.com) */
  url: string
  /** Returns the user's account UUID for the connection path */
  getUserId: () => Promise<string | undefined>
  /** Returns a valid OAuth token for bridge authentication */
  getOAuthToken: () => Promise<string | undefined>
  /** Optional dev user ID for local development (bypasses OAuth) */
  devUserId?: string
}

/** Metadata about a connected Chrome extension instance. */
export interface ChromeExtensionInfo {
  deviceId: string
  osPlatform?: string
  connectedAt: number
  name?: string
}

export interface GakrCLIForChromeContext {
  serverName: string
  logger: Logger
  socketPath: string
  // Optional dynamic resolver for socket path. When provided, called on each
  // connection attempt to handle runtime conditions (e.g., TMPDIR mismatch).
  getSocketPath?: () => string
  // Optional resolver returning all available socket paths (for multi-profile support).
  // When provided, a socket pool connects to all sockets and routes by tab ID.
  getSocketPaths?: () => string[]
  clientTypeId: string // "desktop" | "gakrcli-code"
  onToolCallDisconnected: () => string
  onAuthenticationError: () => void
  isDisabled?: () => boolean
  /** Bridge WebSocket configuration. When provided, uses bridge instead of socket. */
  bridgeConfig?: BridgeConfig
  /** If set, permission mode is sent to the extension immediately on bridge connection. */
  initialPermissionMode?: PermissionMode
  /** Bridge telemetry callback; eventName is chrome_bridge_* event name */
  trackEvent?: (
    eventName: string, // Event name
    metadata: ChromeBridgeTrackEventMetadata, // Event metadata
  ) => void
  /** Called when user pairs with an extension via the browser pairing flow. */
  onExtensionPaired?: (deviceId: string, name: string) => void
  /** Returns the previously paired deviceId, if any. */
  getPersistedDeviceId?: () => string | undefined
  /** Called when a remote extension is auto-selected (only option available). */
  onRemoteExtensionWarning?: (ext: ChromeExtensionInfo) => void
}

/**
 * Map Node's process.platform to the platform string reported by Chrome extensions
 * via navigator.userAgentData.platform.
 */
export function localPlatformLabel(): string {
  return process.platform === 'darwin'
    ? 'macOS'
    : process.platform === 'win32'
      ? 'Windows'
      : 'Linux'
}

/** Permission request forwarded from the extension to the desktop for user approval. */
export interface BridgePermissionRequest {
  /** Links to the pending tool_call */
  toolUseId: string
  /** Unique ID for this permission request */
  requestId: string
  /** Tool type, e.g. "navigate", "click", "execute_javascript" */
  toolType: string
  /** The URL/domain context */
  url: string
  /** Additional action data (click coordinates, text, etc.) */
  actionData?: Record<string, unknown>
}

/** Desktop response to a bridge permission request. */
export interface BridgePermissionResponse {
  requestId: string
  allowed: boolean
}

/** Per-call permission overrides, allowing each session to use its own permission state. */
export interface PermissionOverrides {
  permissionMode: PermissionMode
  allowedDomains?: string[]
  /** Callback invoked when the extension requests user permission via the bridge. */
  onPermissionRequest?: (request: BridgePermissionRequest) => Promise<boolean>
}

/** Shared interface for McpSocketClient and McpSocketPool */
export interface SocketClient {
  ensureConnected(): Promise<boolean>
  callTool(
    name: string,
    args: Record<string, unknown>,
    permissionOverrides?: PermissionOverrides,
  ): Promise<unknown>
  isConnected(): boolean
  disconnect(): void
  setNotificationHandler(
    handler: (notification: {
      method: string
      params?: Record<string, unknown>
    }) => void,
  ): void
  /** Set permission mode for the current session. Only effective on BridgeClient. */
  setPermissionMode?(
    mode: PermissionMode,
    allowedDomains?: string[],
  ): Promise<void>
  /** Switch to a different browser. Only available on BridgeClient. */
  switchBrowser?(): Promise<
    | {
        deviceId: string
        name: string
      }
    | 'no_other_browsers'
    | null
  >
}
