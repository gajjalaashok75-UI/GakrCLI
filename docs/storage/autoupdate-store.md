# Auto-Memory / AutoUpdate Store

## What It Is

The Auto-Memory system is an **LLM-powered persistent memory layer** that writes, reads, and retrieves human-readable markdown memory files. Unlike the Knowledge Graph layer (which uses regex extraction + Orama full-text search), Auto-Memory uses the actual model itself to understand conversation context and decide what's worth remembering. It is the "long-term memory" of the agent — durable across sessions, projects, and workspace restarts.

Four writers touch this memory layer:

1. **ExtractMemories** — background forked agent that extracts memories at the end of each complete query loop (stop hook)
2. **Auto-Dream** — cross-session consolidation (24h + 5 new sessions gates; OFF by default in the open build — see Auto-Dream below)
3. **Auto fact extraction** — regex-based fact scraping into `.facts/` (zero LLM cost; part of the Knowledge Graph layer, see `knowledge-store.md`)
4. **The main agent itself** — direct memory writes are always available via the system-prompt instructions

> **Not a writer here:** Session Memory (`services/SessionMemory/`) maintains a per-session `summary.md` under the *session transcript directory*, not in this memory tree. It is a separate system (see `session-storage.md`).

> **Open-build flag defaults** (GrowthBook is a local stub reading `~/.gakrcli/feature-flags.json`): `tengu_passport_quail` (extraction) and `tengu_coral_fern` (past-context search guidance) default **ON**; `tengu_moth_copse` (recall prefetch), `tengu_session_memory`, `tengu_sm_compact`, and `tengu_onyx_plover` (auto-dream) default **OFF**.

---

## Why It Exists

- **Durable persistence** — memories survive process restarts and machine reboots
- **Human-readable** — markdown files with frontmatter are git-friendly and inspectable
- **Semantic understanding** — the LLM itself judges what's worth remembering, not regex patterns
- **Model-directed recall** — the agent reads relevant memory files when it needs context
- **Cross-session continuity** — information from one session is available to future sessions
- **Team memory** — shared memory files across team members (behind TEAMMEM flag)

---

## Architecture

### Directory Structure (Single Tree, Unified)

Auto-memory lives in one tree per project. Default base is the config home (`~/.gakrcli`, or `GAKR_CONFIG_DIR`), redirected entirely by `GAKR_CODE_REMOTE_MEMORY_DIR` when set:

```
~/.gakrcli/projects/<sanitized-git-root>/
└── memory/
    ├── MEMORY.md                        ← Index file (one line per entry; loaded into context)
    ├── topic-file.md                    ← Topic files (any depth ≤ 3 is scanned)
    ├── .facts/                          ← Regex-extracted facts (Knowledge Graph layer)
    │   └── fact-concept-*.md
    ├── .arc.json                        ← Conversation Arc state (goals/decisions/milestones)
    ├── .vector-index                    ← Orama search index (derived, rebuildable)
    ├── .vector-index-meta.json          ← Index freshness metadata (checksums)
    ├── .consolidate-lock                ← Auto-dream lock (mtime = lastConsolidatedAt)
    ├── logs/YYYY/MM/YYYY-MM-DD.md       ← KAIROS assistant-mode daily logs (append-only)
    └── team/                            ← Team memory (TEAMMEM flag)
        ├── MEMORY.md
        └── team-conventions.md
```

> **Do not confuse the two "projects" directories:** session transcripts live under `~/.gakrcli/workspace/projects/<sanitized-cwd>/` (`getProjectsDir()` in `envUtils.ts`), while auto-memory lives under `~/.gakrcli/projects/<sanitized-git-root>/` (`getMemoryBaseDir()` in `memdir/paths.ts`). Memory keys on the canonical git root so all worktrees share one memory dir; transcripts key on the cwd.

> **Note:** Subdirectories (e.g. `user/`, `feedback/`, `project/`, `reference/`) are **organizational conventions** created by the extractMemories agent or the user. They are not created or enforced by code — any `.md` file at any depth up to 3 levels is scanned.

### How Subdirectories Are Scanned

`scanMemoryFiles()` in `memoryScan.ts`:

```
iterative depth-bounded walk (MAX_DEPTH = 3, no recursion into deeper dirs)
  → yields .md files at any depth ≤ 3 (symlinked .md files included;
    symlinked directories are not followed)
  → skips 'MEMORY.md' (already loaded as the index)
  → for each file: reads first 30 lines / 64 KB (FRONTMATTER_MAX_LINES /
    FRONTMATTER_MAX_BYTES), parses YAML frontmatter, 8-way concurrent
  → returns MemoryHeader[] sorted newest-first (max 200 files, MAX_MEMORY_FILES)
```

Each file's directory is **not** used for type inference. The `type` field from frontmatter is the authoritative classification. Files in `user/` with `type: feedback` are classified as feedback, not user.

The `formatMemoryManifest()` function outputs: `[type] filename (ISO-timestamp): description` where type comes from the frontmatter `type:` field, not the directory name.

For workspace-level memory (not project-specific):
```
~/.gakrcli/workspace/
├── MEMORY.md                            ← Cross-project curated memory
├── USER.md                              ← User profile
├── SOUL.md                              ← Assistant personality
├── IDENTITY.md                          ← Assistant identity
├── RULEBOOK.md                          ← Stable rules
└── GAKRCLI.md                           ← Workspace overview
```

### Path Resolution Chain

```
envUtils.ts:
  getGakrCLIConfigHomeDir()              → GAKR_CONFIG_DIR env, else ~/.gakrcli
  getProjectsDir()                       → <workspace>/projects/          ← TRANSCRIPTS only
  getGakrCLIWorkspaceDir()               → GAKRCLI_WORKSPACE_DIR env, else ~/.gakrcli/workspace/

memdir/paths.ts:
  getMemoryBaseDir()                     → GAKR_CODE_REMOTE_MEMORY_DIR env, else <configHome>
  getAutoMemPath()                       → <memoryBase>/projects/<sanitized-git-root>/memory/
  getAutoMemBase()                       → canonical git root (or project root fallback)
  getAutoMemEntrypoint()                 → <autoMemPath>/MEMORY.md
  getAutoMemDailyLogPath()               → <autoMemPath>/logs/YYYY/MM/YYYY-MM-DD.md (KAIROS)

  Auto-memory path resolution order:
    1. GAKR_COWORK_MEMORY_PATH_OVERRIDE env var (full override)
    2. autoMemoryDirectory in settings.json (trusted sources only; projectSettings excluded)
    3. <memoryBase>/projects/<sanitized-git-root>/memory/

memdir/teamMemPaths.ts:
  getTeamMemPath()                       → <autoMemPath>/team/
  getTeamMemEntrypoint()                 → <teamMemPath>/MEMORY.md
```

`getAutoMemPath()` is memoized per project root. The git-root keying means all worktrees of one repo share a single memory directory.

### Data Model

Each memory file is a markdown file with YAML frontmatter:

```markdown
---
name: descriptive-name
description: One-line description of what this memory contains
type: user|feedback|project|reference
---

Memory content — structured as needed per type.
```

**Four memory types:**

| Type | Scope | Purpose | Examples |
|------|-------|---------|---------|
| `user` | always private | User's role, goals, knowledge | Role, preferences, expertise level |
| `feedback` | private by default | Guidance on approach | "Don't mock DB", "Prefers bundled PRs" |
| `project` | bias toward team | Ongoing work, decisions | "Merge freeze 2026-03-05", "Auth rewrite for compliance" |
| `reference` | usually team | External resource pointers | "Bugs tracked in Linear project INGEST" |

**What NOT to save** (enforced by prompt instructions):
- Code patterns, conventions, architecture (derivable from project state)
- Git history or who-changed-what (git log/blame is authoritative)
- Debugging solutions or fix recipes (fix is in the code)
- Anything already in GAKRCLI.md files
- Ephemeral task details (in-progress state)

---

## System 1: ExtractMemories

### Source Files

```
src/services/extractMemories/
├── extractMemories.ts       ← Core extraction logic
├── prompts.ts               ← Extraction prompt templates
└── prompts.test.ts          ← Prompt tests
```

### When It Fires

**Stop hook** (not post-sampling) — fires from `handleStopHooks` in `src/query/stopHooks.ts` once per completed query loop, i.e. when the model produces a final response with no tool calls. Initialization happens in `backgroundHousekeeping.ts` (`initExtractMemories()`), behind `feature('EXTRACT_MEMORIES')`.

Passes if ALL of:

1. **Build flag** `EXTRACT_MEMORIES=true` — if false, the module is never imported (true in the open build)
2. **GrowthBook gate `tengu_passport_quail`** is enabled (default **ON** in the open-build flag stub; can be overridden in `~/.gakrcli/feature-flags.json`)
3. **Auto-memory is enabled** (`isAutoMemoryEnabled()` — not disabled by env/settings; default OFF for non-interactive `-p` sessions unless explicitly opted in)
4. **Memory-write approval is not required** (`isMemoryWriteApprovalRequired()` must be false)
5. **Not in remote mode**
6. **Not a subagent** — main thread only (`toolUseContext.agentId` must be unset); non-interactive runs additionally require the `tengu_slate_thimble` flag (`isExtractModeActive()`)
7. **Main agent didn't already write memories** (`hasMemoryWritesSince` check — direct writes and the background fork are mutually exclusive per turn)
8. **Throttle passed** — `tengu_bramble_lintel` config, default 1 eligible turn (trailing/coalesced runs skip the throttle)
9. **Not `--bare` mode** (stopHooks skips all background bookkeeping in bare mode)

### Extraction Flow

```
StopHooks (end of complete query loop) → executeExtractMemories()
  │
  ├─ GATE CHECKS (feature flag, tengu_passport_quail, auto-memory enabled,
  │   write approval, not remote, not subagent, not bare)
  │
  ├─ hasMemoryWritesSince() → did main agent already write memory files?
  │   Yes → advance cursor, skip (no redundant extraction)
  │
  ├─ Throttle check → tengu_bramble_lintel eligible turns since last run (default 1)
  │
  └─ runForkedAgent() with:
       │
       ├─ Max 5 turns (hard cap to prevent verification rabbit-holes)
       ├─ skipTranscript: true (no race with the main thread)
       ├─ Restricted tool access via createAutoMemCanUseTool():
       │   ✓ Read, Grep, Glob (read-only investigation)
       │   ✓ Read-only bash (no mutation)
       │   ✓ Edit/Write only within auto-memory directory
       │   ✗ Everything else denied (MCP, Agent, write-capable bash)
       │
       └─ Prompt (buildExtractAutoOnlyPrompt / buildExtractCombinedPrompt):
            "Analyze the most recent ~N messages and update your persistent
             memory systems"
                 │
                 ├─ + Memory types taxonomy (user/feedback/project/reference)
                 ├─ + Manifest of existing memory files (formatMemoryManifest —
                 │     pre-injected so the fork spends no turn on `ls`)
                 ├─ + What NOT to save rules
                 └─ + Format instructions (frontmatter schema)
                      │
                      ▼
                Forked agent writes/updates .md files
                and updates MEMORY.md index
```

### Cursor Tracking

`lastMemoryMessageUuid` tracks which messages have been processed. Only new messages since the cursor are analyzed each time.

On extraction error: cursor is NOT advanced → retried next turn.
On success: cursor advanced past the last message UUID.

Overlapping calls are coalesced: if an extraction is already running, the newer context is stashed and a single trailing run executes after the current one finishes (the superseded run is aborted with a `memory-extraction-superseded` reason). In `-p`/SDK mode, `drainPendingExtraction()` awaits in-flight extractions (60 s soft timeout) between response flush and shutdown.

The forked agent saves files; a user-facing `createMemorySavedMessage` system message lists what was saved (index-file (`MEMORY.md`) touches are excluded from the count).

---

## System 2: Auto-Dream

### Source Files

```
src/services/autoDream/
├── autoDream.ts              ← Dreaming service
├── config.ts                 ← Dream configuration
├── consolidationLock.ts      ← Cross-process lock
└── consolidationPrompt.ts    ← Dream prompt template
```

### What It Is

A **background reflective pass** that runs periodically to synthesize, merge, and organize memories. Unlike ExtractMemories (which captures immediate conversation context), Dream steps back to look at the big picture across sessions.

### When It Fires

All gates are ANDed (cheapest first), checked from the stop hook on every turn:

| Gate | Condition |
|---------|-----------|
| **Enabled** | `isAutoDreamEnabled()`: settings.json `autoDreamEnabled` overrides when set; otherwise GrowthBook `tengu_onyx_plover.enabled` — default **OFF** in the open build (set `autoDreamEnabled: true` in settings.json or add the flag to `~/.gakrcli/feature-flags.json`) |
| **Mode** | Skipped when KAIROS assistant mode is active (it uses the disk-skill dream) or in remote mode; requires auto-memory enabled |
| **Time-based** | ≥ `minHours` since last consolidation (default 24 h; knob inside `tengu_onyx_plover` config) |
| **Session-based** | ≥ `minSessions` transcripts touched since last consolidation, excluding the current session (default 5; same config); session scan throttled to once per 10 min |
| **One-at-a-time** | Cross-process `consolidationLock.ts` prevents concurrent dreams |

### Gate

`isGateOpen()` in `autoDream.ts` = auto-dream enabled AND auto-memory enabled AND not KAIROS-active AND not remote.

### Consolidation Lock

Auto-dream uses a cross-process lock to prevent concurrent dreams:

**Path**: `<autoMemory>/.consolidate-lock`

**Behavior**:
- Lock body = holder's PID (integer)
- Lock mtime = `lastConsolidatedAt` timestamp
- **Stale protection**: 1 hour (`HOLDER_STALE_MS = 60 * 60 * 1000`) — if the holder PID is dead or the lock is older than 1 hour, the lock is reclaimed
- **Rollback**: on failure, `rollbackConsolidationLock(priorMtime)` rewinds the mtime so the next trigger isn't delayed
- **Crash recovery**: a stuck mtime + dead PID means the next process auto-reclaims

### Dream Flow

```
autoDream.ts (initAutoDream closure) → runForkedAgent() → forked agent
  │  (skipTranscript: true; DreamTask registered so the run is visible in
  │   the bg-tasks UI; abortable, kill rewinds the lock mtime)
  ├─ Phase 1 (Orient): ls memory dir, read MEMORY.md index, skim topic files
  ├─ Phase 2 (Gather): daily logs (KAIROS) → drifted memories → narrow grep of
  │     session transcripts (grep, NOT full-file reads)
  ├─ Phase 3 (Consolidate): merge new signal into existing topic files
  │     • Convert relative dates → absolute dates
  │     • Delete contradicted facts at the source
  │     • Prune duplicate or superseded entries
  └─ Phase 4 (Prune/index): keep MEMORY.md under 200 lines AND ~25 KB,
        one line per entry

Tool constraints: bash is restricted to read-only commands; Edit/Write only
inside the memory directory (same createAutoMemCanUseTool as extraction).
```

### Consolidation Prompt

```typescript
// consolidationPrompt.ts — the forked agent receives:
"You are performing a dream — a reflective pass over your memory files.
Synthesize what you've learned recently into durable, well-organized
memories so that future sessions can orient quickly."
```

---

## System 3: Session Memory

### Source Files

```
src/services/SessionMemory/
├── sessionMemory.ts          ← Core session memory service
├── sessionMemoryUtils.ts     ← Utilities + config
├── prompts.ts                ← Session memory prompts
└── multiStore.ts             ← Multiple store support
```

### What It Is

A per-session compact markdown summary that tracks current conversation state — goals, decisions, blockers, and next steps. Lives in the session-scoped transcript directory (not in the auto-memory tree), and is consumed by session-memory compaction, the `/summary` command, and the away-recap.

### Gate

GrowthBook feature flag `tengu_session_memory` — **default OFF in the open build** (not in the open-build flag defaults; enable via `~/.gakrcli/feature-flags.json`). Additionally:

- `initSessionMemory()` returns early unless **auto-compact is enabled** (`isAutoCompactEnabled()`), and in remote mode
- The hook itself only runs on the main REPL thread (`querySource === 'repl_main_thread'`), skips poor mode, and is token-thresholded (config from `tengu_sm_config`)

The **`/summary` command** calls `manuallyExtractSessionMemory()` directly and bypasses the automatic thresholds — it works regardless of the automatic gate.

### Extraction Thresholds

| Threshold | Default | Description |
|-----------|---------|-------------|
| `minimumMessageTokensToInit` | 10,000 | Min context tokens before first extraction |
| `minimumTokensBetweenUpdate` | 5,000 | Min context growth between subsequent extractions (same metric as autocompact) |
| `toolCallsBetweenUpdates` | 3 | Min tool calls between extractions |

### Storage

```
<projectDir>/<sessionId>/session-memory/summary.md
```

---

## How Memories Are Retrieved

### Method 1: MEMORY.md Index (Injected Every Session)

On every session startup, `loadMemoryPrompt()` in `memdir.ts`:
1. Reads `MEMORY.md` from the auto-memory directory
2. Truncates to 200 lines / 25 KB with a truncation warning (`truncateEntrypointContent`)
3. Emits the behavioral memory instructions (`# auto memory`) as the `memory` system-prompt section (`systemPromptSection('memory', ...)`), with the MEMORY.md content injected via user context

The model sees the MEMORY.md index lines like:
```
- [User Role](user_role.md) — role and preferences
- [Feedback Testing](feedback_testing.md) — testing policies
```

In KAIROS assistant mode (`feature('KAIROS')` + active), the prompt instead directs the agent to append to daily logs (`logs/YYYY/MM/YYYY-MM-DD.md`); MEMORY.md becomes a read-only distilled index maintained by the nightly dream.

### Method 2: Read Tool (On-Demand Recall)

When the model needs full content of a specific memory:
1. Sees the filename + description in the MEMORY.md index (already in context)
2. Uses **Read tool** on `<autoMemPath>/topic-file.md`
3. Reads the full frontmatter + content

### Method 3: findRelevantMemories (LLM-Powered Selection)

`findRelevantMemories()` in `memdir/findRelevantMemories.ts`:
1. Scans all memory `.md` files via `scanMemoryFiles()` (excluding MEMORY.md and anything already surfaced)
2. Reads frontmatter descriptions (not full content)
3. Calls **Sonnet** (side model via `sideQuery`) to select up to 5 most relevant files; recently-used tools are passed so the selector skips reference docs for tools already in active use
4. Returns file paths + mtime; `attachments.ts` reads the files (truncated at 200 lines / 4 KB per file — `MAX_MEMORY_LINES` / `MAX_MEMORY_BYTES`) and injects them as `<relevant_memories>` attachments with per-memory staleness notes

**Status in the open build: dormant.** The prefetch/attachment path is gated by `tengu_moth_copse`, which is not in the open-build flag defaults (default false). Enable it in `~/.gakrcli/feature-flags.json` to activate. The related `tengu_coral_fern` flag (default ON) only controls the "Searching past context" guidance section in the memory prompt (grep the memory dir / transcripts). A session-level byte budget (`collectSurfacedMemories`) throttles re-surfacing; compact resets it naturally.

### Method 4: Dream Outputs

Auto-dream writes consolidated markdown files that are indistinguishable from extractMemories outputs — they live in the same directory, use the same frontmatter format, and are retrieved the same way (MEMORY.md index → Read tool).

---

## Team Memory (`memdir/teamMemPaths.ts`)

### Path

```
~/.gakrcli/projects/<slug>/memory/team/
├── MEMORY.md                  ← Team memory index
└── topic files...             ← Shared across team members
```

### Feature Flag & Runtime Gates

- Build flag `TEAMMEM` (true in the open build), runtime gate `tengu_herring_clock` (default true) + auto-memory enabled (`isTeamMemoryEnabled()`)
- When enabled, the combined memory prompt (private + team directories, per-type `<scope>` guidance) replaces the single-directory prompt, and the team directory is created alongside private memory

### Sync Service (`services/teamMemorySync/`)

Syncs team memory between the local `team/` directory and the server API (`GET/PUT /api/gakrcli_code/team_memory?repo=<owner/repo>`), **per GitHub repo, shared across org members**. Requires first-party Anthropic OAuth **and** a github.com remote — otherwise the watcher silently never starts (dormant for API-key setups).

- **Pull**: server-wins per-key, writes validated into `team/` (symlink-escape-proofed), ETag/304 aware
- **Push**: delta upload (only keys whose sha256 differs from server checksums), If-Match optimistic locking, 412 conflict → re-probe `?view=hashes` and retry (local-wins per key, no content merge), byte-budgeted PUT batches, server max_entries learned from structured 413
- **Secret scanning**: gitleaks-style patterns skip files containing detected secrets on push; FileWriteTool/FileEditTool also reject secret-bearing writes into team memory (`teamMemSecretGuard`)
- **Watcher**: `fs.watch` recursive on `team/`, 2 s debounce, permanent-failure suppression (cleared on unlink/restart); started at setup behind the same gates
- **Deletions do not propagate** — server-only entries re-appear on next pull

---

## Agent Memory

Agent memory is a separate memory system scoped by agent type and memory scope, distinct from auto-memory:

### Paths

```
user:    <memoryBase>/agent-memory/<agentType>/
project: <cwd>/.gakrcli/agent-memory/<agentType>/
local:   <cwd>/.gakrcli/agent-memory-local/<agentType>/
```

Remote local override: `<GAKR_CODE_REMOTE_MEMORY_DIR>/projects/<sanitized-project-root>/agent-memory-local/<agentType>/`

Each agent memory directory has a `MEMORY.md` entrypoint and uses the same topic-file format as auto-memory.

### Agent Memory Snapshots

Snapshot directory: `<cwd>/.gakrcli/agent-memory-snapshots/<agentType>/`

Snapshot metadata: `snapshot.json` with `{ updatedAt: string }`.

Per-memory synced marker: `<agentMemoryDir>/.snapshot-synced.json` with `{ syncedFrom: string }`.

Snapshots can initialize or replace local agent memory when newer than the last synced marker. Agent memory paths are explicitly allowed by the internal permission system for agent self-improvement.

---

## Supporting Files

| File | Purpose |
|------|----------|
| `memdir/memdir.ts` | Loads memory prompt, builds system prompt sections, ensures directories exist, truncates MEMORY.md |
| `memdir/paths.ts` | Resolves auto-memory, team-memory, and daily-log paths; `isAutoMemoryEnabled()` gate |
| `memdir/memoryScan.ts` | Scans memory dirs for `.md` files, parses frontmatter |
| `memdir/memoryTypes.ts` | Memory type taxonomy + prompt sections (combined/individual modes) |
| `memdir/memoryAge.ts` | Memory aging/staleness tracking (injected into FileReadTool output for memory files) |
| `memdir/memorySecurity.ts` | Secret redaction for all memory writes (`sanitizeMemoryText`/`Identifier`) |
| `memdir/memoryShapeTelemetry.ts` | **Inert stub** in this source tree — both functions are no-ops (real telemetry not included) |
| `memdir/memoryIdentity.test.ts` | Tests for memory identity/prompt wording |
| `memdir/teamMemPaths.ts` | Team memory paths + symlink-safe path validation |
| `memdir/teamMemPrompts.ts` | Team memory prompt sections |
| `memdir/findRelevantMemories.ts` | LLM-powered relevant memory selection (dormant by default) |
| `memdir/vectorIndex.ts` | Orama full-text index over memory `.md` files (incl. `.facts/`), persisted + checksummed |
| `memdir/autoExtractFacts.ts` | Regex-based fact extraction into `.facts/` (Knowledge Graph layer) |
| `services/extractMemories/prompts.ts` | Extraction prompt templates |
| `services/autoDream/consolidationPrompt.ts` | Dream prompt |
| `services/teamMemorySync/` | Team memory pull/push sync + watcher + secret scanner |
| `services/SessionMemory/prompts.ts` | Session memory prompt templates (customizable via `~/.gakrcli/session-memory/config/`) |
| `services/SessionMemory/multiStore.ts` | Local key-value memory stores (`~/.gakrcli/local-memory/`), currently behind the disabled `LOCAL_MEMORY` build flag |

## User-Facing Surfaces

| Surface | What it does |
|---------|--------------|
| `/memory` | Picker dialog: open any memory layer in `$EDITOR` + toggles for auto-memory and auto-dream (writes `settings.json`), shows last-dream time |
| `/dream` (command + bundled skill) | Manual consolidation run with full tool permissions; stamps the consolidation lock so auto-dream resets its timer |
| `/summary` | Manual session-memory extraction + display (bypasses auto thresholds) |
| `/recap` (`/away`, `/catchup`) | One-line session recap (AWAY_SUMMARY build flag + `tengu_sedge_lantern`, both ON) |
| `/remember` (bundled skill) | Memory review/promotion proposals — **gated on `USER_TYPE === 'ant'`**, inert for everyone else |
| `/knowledge` | Knowledge Graph layer status/clear/list (see `knowledge-store.md`) |
| `/local-memory`, `LocalMemoryRecall` tool | Local KV memory stores — **disabled**: `LOCAL_MEMORY` build flag is false |
| `/memory-stores` (cloud API) | Fully implemented client but **not registered** in `commands.ts` (see `ISSUES.md`) |
