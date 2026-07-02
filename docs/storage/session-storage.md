# Session Storage

## What It Is

Session Storage is the system that persists full conversation transcripts (message-by-message) as JSONL files on disk. Every session — whether interactive, headless, forked, or resumed — writes its entire message history to a JSONL file in real-time. This enables the `/resume` and `--continue` features, cross-session goal persistence, session branching (`/branch`), and crash recovery.

A secondary **Session Memory** system maintains a compact markdown summary of the current conversation for resumption context.

---

## Why It Exists

- **Resume across process restarts** — close the CLI, reopen, `/resume` loads the full conversation back into context
- **Crash recovery** — if the process crashes mid-session, the JSONL is append-only and can be recovered up to the last written line
- **Session branching** — `/branch` creates a forked session from a point in the transcript
- **Goal persistence** — goal state is snapshotted to the JSONL so `--resume` restores active goals
- **Cross-project resume** — sessions from different working directories are isolated per project but searchable

---

## Architecture

```
~/.gakrcli/workspace/projects/<sanitized-cwd>/
├── <session-uuid>.jsonl              ← Full transcript (one JSON object per line)
├── <session-uuid>.lite.jsonl         ← Lite metadata (message IDs + token counts)
├── <session-uuid>/
│   ├── session-memory/
│   │   └── summary.md                ← Session memory (compact markdown)
│   ├── tool-results/
│   │   ├── <toolUseId>.json          ← Persisted JSON tool results (>threshold)
│   │   └── <toolUseId>.txt           ← Persisted text tool results (>threshold)
│   ├── subagents/
│   │   ├── agent-<agentId>.jsonl     ← Subagent transcripts
│   │   └── <subdir>/
│   │       └── agent-<agentId>.jsonl ← Grouped subagent transcripts (e.g. workflow runs)
│   └── remote-agents/
│       └── remote-agent-<taskId>.meta.json ← Remote agent task metadata
└── workflows/<runId>/
    └── <session-uuid>.jsonl          ← Workflow-run subagent transcripts
```

### Scale

A typical project accumulates **100+ session JSONL files** (this project has 125). Each file can grow to multiple GB on long-running sessions. A **50 MB read threshold** (`MAX_TRANSCRIPT_READ_BYTES`) protects against OOM during resume — transcripts larger than this are rejected with `ResumeTranscriptTooLargeError`.

### Write Queue Architecture

The `Project` class manages write queues per session file to avoid concurrent-write corruption:

```
appendMessage() → in-memory queue for that .jsonl
                  │
                  ▼ (async flush)
         writeFile(append=true) to disk
                  │
                  ▼ (on cleanup / process exit)
         registerCleanup → flush all queues
                        → reAppendSessionMetadata (customTitle, tag at EOF)
```

Subagent transcripts are written to subdirectories within the session directory:
- **Default**: `<projectDir>/<sessionId>/subagents/agent-<agentId>.jsonl`
- **Grouped**: `<projectDir>/<sessionId>/subagents/<subdir>/agent-<agentId>.jsonl` (workflow runs, etc. via `agentTranscriptSubdirs` map)
- Each subagent transcript also has a **`.meta.json`** sidecar file (e.g., `agent-<agentId>.meta.json`) containing agent metadata
- Cleared on subagent exit, gated by `agentTranscriptSubdirs` map.

Remote agent task metadata is stored at `<projectDir>/<sessionId>/remote-agents/remote-agent-<taskId>.meta.json`.

Each `<sanitized-cwd>` is the user's working directory with path separators replaced (e.g. `C--Users-gajja-Documents-data-science-Gakrcli`).

### Path Resolution Chain

```
sessionStoragePortable.ts:
  getProjectsDir()                    → ~/.gakrcli/workspace/projects/
  getProjectDir(cwd)                  → ~/.gakrcli/workspace/projects/<sanitized-cwd>/
  getSessionFilePath(id)              → <projectDir>/<uuid>.jsonl
  getLiteLogFilePath(id)              → <projectDir>/<uuid>.lite.jsonl

permissions/filesystem.ts:
  getSessionMemoryDir()               → <projectDir>/<sessionId>/session-memory/
  getSessionMemoryPath()              → <projectDir>/<sessionId>/session-memory/summary.md
```

---

## File Format

### Full Log (`*.jsonl`)

Each line is a JSON object conforming to the `Entry` union type. Written **append-only** during the session. Entries fall into two categories:

**Message entries** — actual conversation messages (user, assistant, tool results):

```jsonl
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"hello"}]},"uuid":"abc-123","timestamp":"2026-07-02T12:00:00.000Z","cwd":"/home/project","isNew":true}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi! How can I help?"}]},"uuid":"def-456","timestamp":"2026-07-02T12:01:00.000Z"}
```

Line schema fields (each message entry):

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `user`, `assistant`, `attachment`, `system`, `tool_result` |
| `message` | object | The actual message/content blocks |
| `uuid` | string (UUID) | Unique message ID (base for chain, snip, compaction, resume) |
| `timestamp` | string | ISO 8601 timestamp |
| `parentUuid` | string (UUID)? | Parent message in conversation chain |
| `subtype` | string? | `snip_boundary`, `compact_boundary`, `custom-title`, `ai-title`, `tag`, `goal-snapshot` |
| `snipMetadata` | object? | `{ removedUuids: string[] }` — which messages were removed by this snip |
| `cwd` | string? | Working directory at time of message |
| `isNew` | boolean? | Session boundary marker (first message of resumed session) |
| `isSidechain` | boolean? | Forked/branched session marker |
| `isMeta` | boolean? | Meta-messages (boundaries, system messages) |
| `goalSnapshot` | object? | Serialized goal state at time of message |
| `sessionId` | string (UUID)? | Source session ID (for cross-session content replacement) |
| `agentId` | string? | Agent ID for subagent transcripts |
| `metadata` | object? | Session metadata: agent type, model override, entrypoint, user type |

### Lite Log (`*.lite.jsonl`)

Storage optimization — stores minimal metadata for the LogSelector UI:

```typescript
type LiteLog = {
  sessionId: UUID
  startTime: string        // ISO 8601
  messageCount: number
  tokenCount: number
  customTitle?: string
  aiTitle?: string
  tag?: string
  agent?: string
  model?: string
  cwd?: string
}
```

Lite logs avoid loading the full transcript for the session picker. `loadFullLog()` expands lite → full by reading the corresponding `.jsonl`.

### Session Metadata (Session-Level Entries)

Entries written at session boundaries and re-appended at EOF:

| Entry Type | `subtype` | Content |
|------------|-----------|---------|
| User-assigned title | `custom-title` | User-set session name (e.g. `/rename my-session`) |
| AI-generated title | `ai-title` | Auto-generated title from first prompt |
| Tag | `tag` | User-set tag for organization |
| Goal snapshot | `goal-snapshot` | Serialized goal state |
| Session boundary | (first message) | `isNew: true` + metadata (agent, model, cwd, entrypoint) |

### Additional Entry Types

Beyond message entries, the JSONL contains metadata entries for state persistence and session management:

| Entry Type | `type` value | Purpose |
|------------|-------------|---------|
| Content replacement | `content-replacement` | `ContentReplacementRecord[]` — tool result persistence decisions for prompt cache stability |
| Goal state | `goal-state` | Serialized goal state (active/paused/completed) |
| Summary | (summary message) | Compact boundary summaries (snip/compact) |
| Custom title | `custom-title` | User-assigned session name |
| AI title | `ai-title` | Auto-generated title from first prompt |
| Tag | `tag` | User-set session tag |
| File history snapshot | `file-history-snapshot` | File edit history for resume reconstruction |
| Attribution snapshot | `attribution-snapshot` | Commit attribution context |
| Context collapse commit | `marble-origami-commit` | Collapsed context span boundaries |
| Context collapse snapshot | `marble-origami-snapshot` | Staged collapse queue state |
| Agent name | `agent-name` | Current agent name |
| Agent color | `agent-color` | Current agent color |
| Agent setting | `agent-setting` | Agent type / model override |
| Mode | `mode` | Coordinator vs normal mode |
| Worktree state | `worktree-state` | Worktree session tracking |
| PR link | `pr-link` | Associated PR URL |
| Queue operation | `queue-operation` | Task queue mutations |
| Speculation accept | `speculation-accept` | Speculative decoding acceptance |

---

## Key Operations

### Writing (Real-Time)

Every message `push` to the conversation array triggers an append to the JSONL via `appendMessagesToLogFile()` in `sessionStorage.ts`. The write is asynchronous and non-blocking.

Session persistence is skipped when:
- `NODE_ENV === 'test'` (unless `TEST_ENABLE_SESSION_PERSISTENCE` is set)
- `cleanupPeriodDays === 0` in settings
- `GAKR_CODE_SKIP_PROMPT_HISTORY` env var is set
- Session persistence is explicitly disabled by bootstrap state

### Session File Resolution

`resolveSessionFilePath(sessionId, dir?)` finds a non-empty transcript by looking in:
1. **Exact project directory** — `<projectDir>/<sessionId>.jsonl`
2. **Long-path fallback** — scan prefixes with truncated hash suffixes
3. **Sibling git worktrees** — check all worktrees sharing the same git root
4. **All projects scan** — across all `<projects>/*/<sessionId>.jsonl`

Zero-byte transcript files are treated as missing.

### Reading Transcript Metadata

`readLiteMetadata()` reads the first and last chunks of a transcript to power resume lists without loading the whole file. It extracts:
- first prompt, custom title, AI title, summary, tag, PR link
- mode, latest git branch, project path, worktree state

`readTranscriptForLoad()` reads in chunks and skips attribution snapshots for normal replay. It also truncates pre-compact messages at the latest compact boundary unless a preserved segment applies.

### Full Resume Load

`loadTranscriptFile()` in `sessionStorage.ts`:
1. Resolves session file path from session UUID (see resolution above)
2. Reads the JSONL file line-by-line
3. Deserializes each JSON line into a `Message` object
4. Walks the `parentUuid` chain to reconstruct conversation order (skips orphaned entries)
5. Bridges `progress` entries written by older versions (pre-PR #24099) via `progressBridge`
6. Applies **content replacements** — fork/branch sessions replace messages by `sessionId` key
7. Removes entries recorded in `removedUuids` across all `snip_boundary` and `compact_boundary` entries
8. Enforces size limits — rejects files >50MB (`MAX_TRANSCRIPT_READ_BYTES`)
9. Returns `{ messages, summaries, customTitles, tags, fileHistorySnapshots, attributionSnapshots, ... }`

### Chain Repair on Resume

When a session is compacted or snipped, the `parentUuid` chain is broken (removed messages' UUIDs are gone). `loadTranscriptFile` performs **relinking**:

1. Collects all `removedUuids` from boundary entries
2. Deletes those UUIDs from the in-memory map
3. For each survivor with a `parentUuid` pointing into the gap, walks backward through the removed region's own parent links to find the first non-removed ancestor
4. Relinks the survivor to that ancestor, restoring a linear conversation chain

This ensures resume always produces a valid conversation regardless of how many snip/compact operations happened.

### State Recovery (`sessionRestore.ts`)

After loading the transcript, `restoreSessionStateFromLog()` restores:

| State | Source | Implementation |
|-------|--------|---------------|
| Full message history | `.jsonl` | All messages loaded into app state |
| File history | Snapshots in log | `fileHistoryRestoreStateFromLog()` — reconstructs file edit history |
| Attribution state | Snapshots in log | `attributionRestoreStateFromLog()` — reinstates commit attribution context |
| Context collapse | Commit log + snapshot | `collapseRestoreStateFromLog()` — restored collapsed file view |
| Goal state | Log metadata | `prepareGoalForSessionResume()` → `hydrateGoalFromTranscript()` — restores active/paused goals |
| Todo list | Last TodoWrite | `extractTodosFromTranscript()` — reconstructs task list from last TodoWrite in transcript |
| Agent type | Log metadata | `restoreAgentFromSession()` — reapplies agent type + model override |
| Worktree state | Log metadata | Worktree-aware session restoration |
| Mode (coordinator/normal) | Log metadata | Mode restored, agent defs refreshed |
| Content replacement state | Transcript records | `reconstructContentReplacementState()` — freezes `seenIds` + restores `replacements` for prompt cache stability |

### Goal Persistence (`goalStorage.ts`)

Goals are snapshotted to the JSONL on every mutation via `persistCurrentGoal()`:
- Goal **set** → serialized to JSONL as `goalSnapshot` on the next message
- Goal **paused/resumed** → snapshot with updated status
- Goal **completed** → snapshot with completed status + end time
- Goal **cleared** → `goal-cleared` tombstone written to prevent stale resurrection

`hydrateGoalFromTranscript()` reads these snapshots to restore in-memory goal state during `--resume`.

### Search / Discovery

`loadAllProjectsMessageLogs()` — scans all project directories for session files.
`searchSessionsByCustomTitle()` — regex-based title search.
`agenticSessionSearch()` — LLM-powered natural language session search.

### Cross-Project Resume

`checkCrossProjectResume()` compares session's `originalCwd` with current `cwd`:
- Same project → resume directly
- Different project → shows user a command to run `/resume /path/to/project`

---

## Entry Points

| Trigger | Code Path | Entrypoint Type |
|---------|-----------|-----------------|
| `/resume <uuid>` | `resume.tsx` → `context.resume()` | `slash_command_session_id` |
| `/resume <search>` | `resume.tsx` → `agenticSessionSearch()` | `slash_command_title` |
| `/resume` (picker) | `resume.tsx` → `LogSelector` UI | `slash_command_picker` |
| `--resume <uuid>` | `cli/print.ts` → `runHeadless()` | `cli_flag` |
| `--continue` | `cli/print.ts` → auto-finds latest session | `cli_flag` |
| `/branch <msg-id>` | `branch.tsx` → fork → `context.resume()` | `fork` |
| `/teleport` | Cross-machine via teleport server | `teleport` |

---

## Oversized Tool Result Storage

### What It Is

When tool results exceed a configurable threshold (default 50KB), they are persisted to disk as individual files instead of being truncated. The content is replaced in the model's view with a preview wrapped in `<persisted-output>` XML tags, preserving the full output for later reference while keeping the conversation context lean.

### Path

```
<projectDir>/<sessionId>/tool-results/<toolUseId>.json|txt
```

- JSON tool results (content arrays) → `.json` extension, formatted with indentation
- Text tool results (plain string) → `.txt` extension, stored as-is
- Written with `'wx'` flag — if the file already exists, it's skipped (deterministic replay across API turns)

### Threshold

| Setting | Default | Description |
|---------|---------|-------------|
| `DEFAULT_MAX_RESULT_SIZE_CHARS` | 50,000 | Global fallback threshold |
| Per-tool `maxResultSizeChars` | Tool-specific | Declared cap per tool definition |
| GrowthBook `tengu_satin_quoll` | `{}` | Per-tool override map (bypasses Math.min clamp) |

Effective threshold per tool: `Math.min(declaredMaxResultSizeChars, DEFAULT_MAX_RESULT_SIZE_CHARS)`, overridden by GrowthBook map entry when present and finite.

Tools with `maxResultSizeChars: Infinity` (e.g., Read) are hard-opted out — persisting their output to a file the model reads back is circular.

### Preview Format

```xml
<persisted-output>
Output too large (X.XX MB). Full output saved to: <filepath>

Preview (first 2.00 KB):
<preview content>
...
</persisted-output>
```

- `PREVIEW_SIZE_BYTES` = 2000 bytes
- Truncation happens at a newline boundary when possible (cuts at last `\n` within the first 50%–100% of the limit)
- `PERSISTED_OUTPUT_TAG` = `<persisted-output>`

### Per-Message Aggregate Budget

Beyond per-tool persistence, `enforceToolResultBudget()` enforces a **per-message aggregate budget** on all tool results combined within a single wire-level user message:

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_TOOL_RESULTS_PER_MESSAGE_CHARS` | ~2M chars | Hardcoded fallback |
| GrowthBook `tengu_hawthorn_window` | `null` | Override (finite positive number) |

**Flow:**
1. Groups tool results by wire-level message (merging consecutive user messages not separated by assistant messages — matches `normalizeMessagesForAPI` behavior)
2. If the group exceeds the budget, the **largest fresh** results are persisted to disk and replaced with previews
3. Previously seen results are frozen: already-replaced results get the same cached replacement re-applied (zero I/O, byte-identical); previously-unreplaced results are never replaced later

### ContentReplacementState

Per-conversation-thread state to preserve **prompt cache stability** across turns:

```typescript
type ContentReplacementState = {
  seenIds: Set<string>       // tool_use_ids that have passed through budget
  replacements: Map<string, string>  // subset that were persisted → their exact preview
}
```

| Operation | Effect |
|-----------|--------|
| `createContentReplacementState()` | Fresh state for new sessions |
| `cloneContentReplacementState()` | Fork for agent summary (cache-sharing forks) |
| `reconstructContentReplacementState()` | Rebuild from transcript records on resume |
| `reconstructForSubagentResume()` | Resume variant with parent gap-fill |
| `provisionContentReplacementState()` | Feature flag gate + fresh-vs-reconstruct decision |
| `applyToolResultReplacementsToMessages()` | Drop `toolUseResult` from live state after replacement |

**Records** are written to the transcript as `ContentReplacementRecord` entries:
```typescript
type ContentReplacementRecord = {
  kind: 'tool-result'
  toolUseId: string
  replacement: string    // Exact string the model saw (frozen for cache stability)
}
```

**Resume reconstruction:** `reconstructContentReplacementState()` reads records from transcript + parent state to freeze all candidate IDs (seen) and restore replacement strings for byte-identical prompt cache.

### Feature Gate

- GrowthBook flag: `tengu_hawthorn_steeple` (not a build flag)
- Aggressive dedup via `'wx'` write flag prevents re-persisting on replay turns
- Status logged via `tengu_tool_result_persisted` and `tengu_tool_result_persisted_message_budget` analytics events

### Cleanup

On session end, `cleanup.ts` scans `tool-results/` subdirectory entries and removes them via `tryRmdir()`.

---

## Secondary JSON Session Store

A separate, simpler session persistence mechanism exists alongside the main JSONL transcript system:

**Path**: `<configHome>/sessions/<id>.json`

Where `<configHome>` is `GAKR_CONFIG_DIR` if set, otherwise `~/.gakrcli`.

**Schema**:
```typescript
interface JsonSession {
  id: string
  messages: SessionMessage[]
  config: SessionConfig
  createdAt: string
  updatedAt: string
  deviceId?: string
}

interface SessionMessage {
  role?: string
  content?: unknown
  timestamp?: string
  tool_calls?: unknown
  tool_use_id?: string
}

interface SessionConfig {
  model?: string
  effort?: string
  maxTokens?: number
  provider?: string
  systemPrompt?: string
}
```

Source: `src/utils/sessionPersistence.ts`. This store is separate from and independent of the primary JSONL transcript system.

---

## Task Output Files

Background command output produced by the task system is stored in a per-project temp tree:

**Path**: `<projectTemp>/<sessionId>/tasks/<taskId>.output`

Where `<projectTemp>` is `<system-temp>/gakrcli/<sanitized-original-cwd>/` (Unix: `/tmp/gakrcli-<uid>/`; Windows: user temp + `gakrcli`, overridable by `GAKR_CODE_TMPDIR`).

**Behavior**:
- File-mode commands write stdout/stderr directly to the output file
- Pipe-mode hooks buffer in memory up to 8MB, then spill to disk
- Disk cap is 5GB per temp tree
- Reads use ranges/tails to avoid loading huge files
- Agent background task output can be a symlink to the subagent transcript

Source: `src/utils/task/outputFile.ts`.

---

## Session Memory (`services/SessionMemory/`)

A separate system that maintains a **compact markdown summary** of the current conversation, stored per-session at `<projectDir>/<sessionId>/session-memory/summary.md`.

### How It Works

| Step | Detail |
|------|--------|
| **Trigger** | Post-sampling hook, fires after N tool calls + token threshold |
| **Gate** | GrowthBook feature flag `tengu_session_memory` |
| **Extraction** | `runForkedAgent()` with a prompt to summarize key decisions, blockers, and next steps |
| **Storage** | Writes/updates `summary.md` via `FileEditTool` (only tool allowed) |
| **Retrieval** | Loaded into system prompt on `/resume` |
| **Config** | `minimumMessageTokensToInit`, `minimumTokensBetweenUpdate`, `toolCallsBetweenUpdates` |

The forked agent has severely restricted tool access — it can only read and edit the single `summary.md` file. This prevents side effects during memory extraction.

---

## Compaction & Snip (Related Systems)

While not session storage per se, these systems interact with session projection:

| System | What It Does | Source File |
|--------|-------------|-------------|
| **SnipTool** | LLM-callable message removal by `snip_id` | `tools/SnipTool/SnipTool.ts` |
| **force-snip** | User-triggered removal of all prior messages | `commands/force-snip.ts` |
| **snipCompactIfNeeded** | Applies pending snips, removes UUID-matched messages | `services/compact/snipCompact.ts` |
| **projectSnippedView** | Filters `removedUuids` from the model-facing message array | `services/compact/snipProjection.ts` |
| **Compact** | Full context compaction (synthesizes summary of older messages) | `services/compact/compact.ts` |
| **AutoCompact** | Automatic compaction when context fills | `services/compact/autoCompact.ts` |
| **MicroCompact** | Compact individual tool results (cached) | `services/compact/microCompact.ts` |
| **ReactiveCompact** | On-demand compaction triggered by context pressure | `services/compact/reactiveCompact.ts` |

Snip removes messages entirely (cheap, no model call). Compact synthesizes summaries (costly, requires model call).

---

## Env Vars & Config

| Setting | Effect |
|---------|--------|
| `GAKR_CODE_SKIP_PROMPT_HISTORY` | Skip writing session JSONL entirely |
| `TEST_ENABLE_SESSION_PERSISTENCE` | Allow persistence in test mode |
| `cleanupPeriodDays` in settings | Session file retention (0 = disable persistence) |
| `NODE_ENV=test` | Skip persistence (unless overridden) |
