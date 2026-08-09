import type { UUID } from 'crypto'
// OpenClaude goal-evaluator shape (id/condition/turnCount/...). The merged
// codebase carries TWO goal implementations: this evaluator state (persisted
// as `goal-state` entries, exercised by sessionStorage.test.ts) and the
// claude-code auto-continuation GoalState defined below (persisted as `goal`
// entries via saveGoal/clearGoalEntry).
import type { GoalState as OpenClaudeGoalState } from '../services/goal/types.js'
import type { FileHistorySnapshot } from 'src/utils/fileHistory.js'
import type { ContentReplacementRecord } from 'src/utils/toolResultStorage.js'
import type { AgentId } from './ids.js'
import type { Message } from './message.js'
import type { QueueOperationMessage } from './messageQueueTypes.js'
/**
 * Goal status for the auto-continuation feature. Extended over the
 * upstream reference with `achieved` and `cleared` states.
 */
export type GoalStatus =
  | 'active'
  | 'paused'
  | 'blocked'
  | 'budget_limited'
  | 'usage_limited'
  | 'max_turns'
  | 'complete'
  | 'achieved'
  | 'cleared'

/**
 * Per-session goal state used by the goal auto-continuation service.
 * Persisted as a `goal` JSONL entry on every mutation; last-wins on read.
 *
 * Timing fields handle pause correctly: active elapsed time is
 * `accumulatedActiveMs + (now - startTime if active, else 0)`.
 *
 * `turnsExecuted` is a defensive upper bound for the auto-continuation
 * loop so a runaway goal cannot spin indefinitely.
 *
 * `blockedAttempts` + `lastBlockReason` implement the "blocked only
 * after 3 consecutive same-reason attempts" audit rule.
 */
export type GoalState = {
  objective: string
  status: GoalStatus
  tokenBudget: number | null
  tokensUsed: number
  startTime: number
  pausedAt: number | null
  accumulatedActiveMs: number
  blockedAttempts: number
  lastBlockReason: string | null
  createdAt: number
  updatedAt: number
  turnsExecuted: number
}
// SerializedMessage distributes over Message's `type` discriminant via
// Extract so that (a) `m.type === '...'` narrowing and Extract<...> both
// work on transcript entries, and (b) every SerializedMessage variant stays
// assignable to its Message variant (sessionStorage passes TranscriptMessage
// where Message is expected). When Message was an `any` stub this used
// Omit<Message, never> to fabricate an object shape; with the reconstructed
// discriminated union (issue #473) Extract is both simpler and sound —
// each variant's `[key: string]: any` escape hatch keeps property access
// permissive. 'progress' covers legacy on-disk entries (removed from
// isTranscriptMessage in PR #24099 but still present in old transcripts).
export type SerializedMessageFields = Message & {
  cwd: string
  userType: string
  entrypoint?: string // GAKR_CODE_ENTRYPOINT — distinguishes cli/sdk-ts/sdk-py/etc.
  sessionId: string
  timestamp: string
  version: string
  gitBranch?: string
  slug?: string // Session slug for files like plans (used for resume)
}

type SerializedMessageOf<K extends Message['type']> = Extract<
  Message,
  { type: K }
> &
  SerializedMessageFields

export type SerializedMessage =
  | SerializedMessageOf<'user'>
  | SerializedMessageOf<'assistant'>
  | SerializedMessageOf<'attachment'>
  | SerializedMessageOf<'system'>
  | SerializedMessageOf<'progress'>

export type LogOption = {
  date: string
  messages: SerializedMessage[]
  fullPath?: string
  value: number
  created: Date
  modified: Date
  firstPrompt: string
  messageCount: number
  fileSize?: number // File size in bytes (for display)
  isSidechain: boolean
  isLite?: boolean // True for lite logs (messages not loaded)
  sessionId?: string // Session ID for lite logs
  teamName?: string // Team name if this is a spawned agent session
  agentName?: string // Agent's custom name (from /rename or swarm)
  agentColor?: string // Agent's color (from /rename or swarm)
  agentSetting?: string // Agent definition used (from --agent flag or settings.agent)
  isTeammate?: boolean // Whether this session was created by a swarm teammate
  leafUuid?: UUID // If given, this uuid must appear in the DB
  summary?: string // Optional conversation summary
  customTitle?: string // Optional user-set custom title
  tag?: string // Optional tag for the session (searchable in /resume)
  fileHistorySnapshots?: FileHistorySnapshot[] // Optional file history snapshots
  attributionSnapshots?: AttributionSnapshotMessage[] // Optional attribution snapshots
  contextCollapseCommits?: ContextCollapseCommitEntry[] // Ordered — commit B may reference commit A's summary
  contextCollapseSnapshot?: ContextCollapseSnapshotEntry // Last-wins — staged queue + spawn state
  gitBranch?: string // Git branch at the end of the session
  projectPath?: string // Original project directory path
  prNumber?: number // GitHub PR number linked to this session
  prUrl?: string // Full URL to the linked PR
  prRepository?: string // Repository in "owner/repo" format
  mode?: 'coordinator' | 'normal' // Session mode for coordinator/normal detection
  worktreeSession?: PersistedWorktreeSession | null // Worktree state at session end (null = exited, undefined = never entered)
  contentReplacements?: ContentReplacementRecord[] // Replacement decisions for resume reconstruction
  goal?: OpenClaudeGoalState | null // Active goal-evaluator state at session end (for resume)
  sessionBranch?: SessionBranchEntry // Conversation-branch lineage metadata, if this session is a branch
}

export type SummaryMessage = {
  type: 'summary'
  leafUuid: UUID
  summary: string
}

export type CustomTitleMessage = {
  type: 'custom-title'
  sessionId: UUID
  customTitle: string
}

/**
 * AI-generated session title. Distinct from CustomTitleMessage so that:
 * - User renames (custom-title) always win over AI titles in read preference
 * - reAppendSessionMetadata never re-appends AI titles (they're ephemeral/
 *   regeneratable; re-appending would clobber user renames on resume)
 * - VS Code's onlyIfNoCustomTitle CAS check only matches user titles,
 *   allowing AI to overwrite its own previous AI title but not user titles
 */
export type AiTitleMessage = {
  type: 'ai-title'
  sessionId: UUID
  aiTitle: string
}

export type LastPromptMessage = {
  type: 'last-prompt'
  sessionId: UUID
  lastPrompt: string
}

/**
 * Periodic fork-generated summary of what the agent is currently doing.
 * Written every min(5 steps, 2min) by forking the main thread mid-turn so
 * `gakrcli ps` can show something more useful than the last user prompt
 * (which is often "ok go" or "fix it").
 */
export type TaskSummaryMessage = {
  type: 'task-summary'
  sessionId: UUID
  summary: string
  timestamp: string
}

export type TagMessage = {
  type: 'tag'
  sessionId: UUID
  tag: string
}

export type AgentNameMessage = {
  type: 'agent-name'
  sessionId: UUID
  agentName: string
}

export type AgentColorMessage = {
  type: 'agent-color'
  sessionId: UUID
  agentColor: string
}

export type AgentSettingMessage = {
  type: 'agent-setting'
  sessionId: UUID
  agentSetting: string
}

/**
 * PR link message stored in session transcript.
 * Links a session to a GitHub pull request for tracking and navigation.
 */
export type PRLinkMessage = {
  type: 'pr-link'
  sessionId: UUID
  prNumber: number
  prUrl: string
  prRepository: string // e.g., "owner/repo"
  timestamp: string // ISO timestamp when linked
}

export type ModeEntry = {
  type: 'mode'
  sessionId: UUID
  mode: 'coordinator' | 'normal'
}
/**
 * JSONL entry representing a goal-state checkpoint. Written on every
 * mutation (set / pause / resume / complete / token update). Readers
 * use the latest entry by sessionId as the authoritative state.
 */
export type GoalMetadataEntry = {
  type: 'goal'
  sessionId: UUID
  state: GoalState
  timestamp: string
}

/**
 * JSONL entry signalling the user explicitly cleared the goal.
 * Distinct from `complete` (which preserves the achievement). Readers
 * encountering this entry after a `goal` entry should treat the goal
 * as absent.
 */
export type GoalClearedEntry = {
  type: 'goal-cleared'
  sessionId: UUID
  timestamp: string
}

/**
 * Worktree session state persisted to the transcript for resume.
 * Subset of WorktreeSession from utils/worktree.ts — excludes ephemeral
 * fields (creationDurationMs, usedSparsePaths) that are only used for
 * first-run analytics.
 */
export type PersistedWorktreeSession = {
  originalCwd: string
  worktreePath: string
  worktreeName: string
  worktreeBranch?: string
  originalBranch?: string
  originalHeadCommit?: string
  sessionId: string
  tmuxSessionName?: string
  hookBased?: boolean
}

/**
 * Records whether the session is currently inside a worktree created by
 * EnterWorktree or --worktree. Last-wins: an enter writes the session,
 * an exit writes null. On --resume, restored only if the worktreePath
 * still exists on disk (the /exit dialog may have removed it).
 */
export type WorktreeStateEntry = {
  type: 'worktree-state'
  sessionId: UUID
  worktreeSession: PersistedWorktreeSession | null
}

/**
 * Records content blocks whose in-context representation was replaced with a
 * smaller stub (the full content was persisted elsewhere). Replayed on resume
 * for prompt cache stability. Written once per enforcement pass that replaces
 * at least one block. When agentId is set, the record belongs to a subagent
 * sidechain (AgentTool resume reads these); when absent, it's main-thread
 * (/resume reads these).
 */
export type ContentReplacementEntry = {
  type: 'content-replacement'
  sessionId: UUID
  agentId?: AgentId
  replacements: ContentReplacementRecord[]
}

export type GoalStateEntry = {
  type: 'goal-state'
  sessionId: UUID
  goal: OpenClaudeGoalState | null
}

export type SessionBranchEntry = {
  type: 'session-branch'
  sessionId: UUID
  /**
   * Immediate conversation-lineage parent. Branches of branches point to the
   * source branch here, while rootSessionId keeps the first ancestor.
   */
  parentSessionId: UUID
  rootSessionId: UUID
  /**
   * Session whose current transcript tail was copied for this branch. Today it
   * matches parentSessionId; future rewind/checkpoint branches may diverge.
   */
  branchedFromSessionId: UUID
  branchName?: string
  branchedAt: string
  branchedAtMessageId?: UUID
}

export type FileHistorySnapshotMessage = {
  type: 'file-history-snapshot'
  messageId: UUID
  snapshot: FileHistorySnapshot
  isSnapshotUpdate: boolean
}

/**
 * Per-file attribution state tracking GakrCLI's character contributions.
 */
export type FileAttributionState = {
  contentHash: string // SHA-256 hash of file content
  gakrcliContribution: number // Characters written by GakrCLI
  mtime: number // File modification time
}

/**
 * Attribution snapshot message stored in session transcript.
 * Tracks character-level contributions by GakrCLI for commit attribution.
 */
export type AttributionSnapshotMessage = {
  type: 'attribution-snapshot'
  messageId: UUID
  surface: string // Client surface (cli, ide, web, api)
  fileStates: Record<string, FileAttributionState>
  promptCount?: number // Total prompts in session
  promptCountAtLastCommit?: number // Prompts at last commit
  permissionPromptCount?: number // Total permission prompts shown
  permissionPromptCountAtLastCommit?: number // Permission prompts at last commit
  escapeCount?: number // Total ESC presses (cancelled permission prompts)
  escapeCountAtLastCommit?: number // ESC presses at last commit
}

export type TranscriptMessage = SerializedMessage & {
  parentUuid: UUID | null
  logicalParentUuid?: UUID | null // Preserves logical parent when parentUuid is nullified for session breaks
  isSidechain: boolean
  gitBranch?: string
  agentId?: string // Agent ID for sidechain transcripts to enable resuming agents
  teamName?: string // Team name if this is a spawned agent session
  agentName?: string // Agent's custom name (from /rename or swarm)
  agentColor?: string // Agent's color (from /rename or swarm)
  promptId?: string // Correlates with OTel prompt.id for user prompt messages
}

export type SpeculationAcceptMessage = {
  type: 'speculation-accept'
  timestamp: string
  timeSavedMs: number
}

/**
 * Persisted context-collapse commit. The archived messages themselves are
 * NOT persisted — they're already in the transcript as ordinary user/
 * assistant messages. We only persist enough to reconstruct the splice
 * instruction (boundary uuids) and the summary placeholder (which is NOT
 * in the transcript because it's never yielded to the REPL).
 *
 * On restore, the store reconstructs CommittedCollapse with archived=[];
 * projectView lazily fills the archive the first time it finds the span.
 *
 * Discriminator is obfuscated to match the gate name. sessionStorage.ts
 * isn't feature-gated (it's the generic transcript plumbing used by every
 * entry type), so a descriptive string here would leak into external builds
 * via the appendEntry dispatch / loadTranscriptFile parser even though
 * nothing in an external build ever writes or reads this entry.
 */
export type ContextCollapseCommitEntry = {
  type: 'marble-origami-commit'
  sessionId: UUID
  /** 16-digit collapse ID. Max across entries reseeds the ID counter. */
  collapseId: string
  /** The summary placeholder's uuid — registerSummary() needs it. */
  summaryUuid: string
  /** Full <collapsed id="...">text</collapsed> string for the placeholder. */
  summaryContent: string
  /** Plain summary text for ctx_inspect. */
  summary: string
  /** Span boundaries — projectView finds these in the resumed Message[]. */
  firstArchivedUuid: string
  lastArchivedUuid: string
  /** Number of messages collapsed into the summary. Absent for pre-field sessions. */
  archivedCount?: number
}

/**
 * Snapshot of the staged queue and spawn trigger state. Unlike commits
 * (append-only, replay-all), snapshots are last-wins — only the most
 * recent snapshot entry is applied on restore. Written after every
 * ctx-agent spawn resolves (when staged contents may have changed).
 *
 * Staged boundaries are UUIDs (session-stable), not collapse IDs (which
 * reset with the uuidToId bimap). Restoring a staged span issues fresh
 * collapse IDs for those messages on the next decorate/display, but the
 * span itself resolves correctly.
 */
export type ContextCollapseSnapshotEntry = {
  type: 'marble-origami-snapshot'
  sessionId: UUID
  staged: Array<{
    startUuid: string
    endUuid: string
    summary: string
    risk: number
    stagedAt: number
  }>
  /** Spawn trigger state — so the +interval clock picks up where it left off. */
  armed: boolean
  lastSpawnTokens: number
}

export type Entry =
  | TranscriptMessage
  | SummaryMessage
  | CustomTitleMessage
  | AiTitleMessage
  | LastPromptMessage
  | TaskSummaryMessage
  | TagMessage
  | AgentNameMessage
  | AgentColorMessage
  | AgentSettingMessage
  | PRLinkMessage
  | FileHistorySnapshotMessage
  | AttributionSnapshotMessage
  | QueueOperationMessage
  | SpeculationAcceptMessage
  | ModeEntry
  | WorktreeStateEntry
  | ContentReplacementEntry
  | GoalStateEntry
  | SessionBranchEntry
  | ContextCollapseCommitEntry
  | ContextCollapseSnapshotEntry
  | GoalMetadataEntry
  | GoalClearedEntry

/**
 * Single step in the replay timeline - represents a tool execution or user message.
 */
export type ReplayStep =
  | ReplayToolStep
  | ReplayUserStep
  | ReplayRetryStep
  | ReplayErrorStep

/**
 * Tool execution step with input, result, and timing information.
 */
export interface ReplayToolStep {
  type: 'tool'
  stepNumber: number
  toolName: string
  toolUseId: string
  input: Record<string, unknown>
  inputSummary: string // Human-readable summary: "Read src/utils.ts"
  resultStatus: 'success' | 'error' | 'cancelled' | 'permission_denied'
  resultPreview?: string // First 200 chars of result
  durationMs: number
  timestamp: string
  filesModified?: string[] // From file history if Edit/Write tool
  repeatedAttemptNumber?: number // 1 for first occurrence, 2+ for repeated tool/input executions
  isRepeatedAttempt?: boolean
}

/**
 * User message step.
 */
export interface ReplayUserStep {
  type: 'user'
  stepNumber: number
  content: string // User's request
  timestamp: string
}

/**
 * Retry event emitted by real retry paths such as API retry or permission retry.
 */
export interface ReplayRetryStep {
  type: 'retry'
  stepNumber: number
  retryType: 'api' | 'permission'
  attempt?: number
  maxRetries?: number
  retryDelayMs?: number
  reason: string
  commands?: string[]
  timestamp: string
}

/**
 * Error step for unexpected failures.
 */
export interface ReplayErrorStep {
  type: 'error'
  stepNumber: number
  error: string
  timestamp: string
}

/**
 * Summary statistics for the replay session.
 */
export interface ReplaySummary {
  totalSteps: number
  toolBreakdown: Record<string, number> // { Read: 5, Edit: 3, Bash: 2 }
  filesModified: string[]
  durationMs: number
  startTimestamp: string
  endTimestamp: string
  userRequests: number
  retryAttempts?: number
  repeatedAttempts?: number
}

/**
 * Complete replay index stored as .replay.json alongside the transcript.
 */
export interface ReplayIndex {
  sessionId: string
  version: 1
  createdAt: string
  summary: ReplaySummary
  steps: ReplayStep[]
}

export function sortLogs(logs: LogOption[]): LogOption[] {
  return logs.sort((a, b) => {
    // Sort by modified date (newest first)
    const modifiedDiff = b.modified.getTime() - a.modified.getTime()
    if (modifiedDiff !== 0) {
      return modifiedDiff
    }

    // If modified dates are equal, sort by created date (newest first)
    return b.created.getTime() - a.created.getTime()
  })
}
