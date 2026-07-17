import type {
  ClientCapabilities,
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
