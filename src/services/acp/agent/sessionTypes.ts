import type {
  ClientCapabilities,
  NewSessionResponse,
  ResumeSessionResponse,
  SessionModeState,
  SessionConfigOption,
} from '@agentclientprotocol/sdk'
import type { QueryEngine } from '../../../QueryEngine.js'
import type { Command } from '../../../types/command.js'
import type { AppState } from '../../../state/AppStateStore.js'
import type { ToolUseCache } from '../bridge.js'

// ── Local type definitions ────────────────────────────────────────
// SessionModelState is not exported from @agentclientprotocol/sdk (the SDK
// only has SessionModeState for permission modes). We define it locally
// for the AI model selector that ACP clients rely on.
export type SessionModelState = {
  currentModelId: string
  availableModels: Array<{
    modelId: string
    name: string
    description?: string
  }>
}

// The published SDK (1.1.0) dropped the UNSTABLE `models` field from
// NewSessionResponse/ResumeSessionResponse, but ACP clients (Cursor/Zed/VS
// Code) read it to populate the model selector. The agent returns it at
// runtime; these aliases keep that visible to callers and tests.
export type AcpNewSessionResponse = NewSessionResponse & {
  models?: SessionModelState | null
}

export type AcpResumeSessionResponse = ResumeSessionResponse & {
  models?: SessionModelState | null
}

// ── Session state ─────────────────────────────────────────────────

export type AcpSession = {
  queryEngine: QueryEngine
  cancelled: boolean
  cancelGeneration: number
  cwd: string
  sessionFingerprint: string
  modes: SessionModeState
  models: SessionModelState
  configOptions: SessionConfigOption[]
  promptRunning: boolean
  pendingMessages: Map<string, PendingPrompt>
  pendingQueue: string[]
  pendingQueueHead: number
  toolUseCache: ToolUseCache
  clientCapabilities?: ClientCapabilities
  appState: AppState
  commands: Command[]
}

export type PendingPrompt = {
  resolve: (cancelled: boolean) => void
}
