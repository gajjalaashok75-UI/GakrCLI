/**
 * Single import point for the GakrCLI-in-Chrome agent wire contract.
 *
 * The side panel in `packages/chrome-extension` compiles against
 * `@gakr-gakr/mcp-chrome-shared`. Importing the same source here (rather than
 * copying the types) is what keeps the two sides from drifting: if the
 * extension changes `RealtimeEvent`, this server fails to typecheck instead of
 * silently emitting a shape the panel cannot render.
 */

export type {
  AgentActRequest,
  AgentActResponse,
  AgentAttachment,
  AgentCliPreference,
  AgentConnectedEvent,
  AgentEngineInfo,
  AgentHeartbeatEvent,
  AgentManagementInfo,
  AgentMessage,
  AgentProject,
  AgentRole,
  AgentSession,
  AgentSessionOptionsConfig,
  AgentStatusEvent,
  AgentStoredMessage,
  AgentSystemPromptConfig,
  AgentToolsConfig,
  AgentUsageStats,
  AttachmentCleanupRequest,
  AttachmentCleanupResponse,
  AttachmentProjectStats,
  AttachmentStatsResponse,
  CleanupProjectResult,
  CreateAgentSessionInput,
  OpenProjectRequest,
  OpenProjectResponse,
  OpenProjectTarget,
  RealtimeEvent,
  UpdateAgentSessionInput,
} from '@gakr-gakr/mcp-chrome-shared'

export { NativeMessageType } from '@gakr-gakr/mcp-chrome-shared'
export { DEFAULT_SERVER_PORT, HOST_NAME } from '@gakr-gakr/mcp-chrome-shared'