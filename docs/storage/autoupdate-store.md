# Auto-Memory / AutoUpdate Store

## What It Is

The Auto-Memory system is an **LLM-powered persistent memory layer** that writes, reads, and retrieves human-readable markdown memory files. Unlike the Knowledge Graph (which uses regex extraction + BM25), Auto-Memory uses the actual model itself to understand conversation context and decide what's worth remembering. It is the "long-term memory" of the agent — durable across sessions, projects, and workspace restarts.

Three separate background systems write to this memory layer:

1. **ExtractMemories** — periodic session memory extraction (every N turns)
2. **Auto-Dream** — cross-session consolidation (every 24h / 5+ new sessions)
3. **Session Memory** — per-session compact summary (GrowthBook-gated)

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

All auto-memory lives under one tree — always `~/.gakrcli/workspace/projects/` since the path unification fix:

```
~/.gakrcli/workspace/projects/<sanitized-project-root>/
└── memory/
    ├── MEMORY.md                        ← Index file (loaded into system prompt)
    ├── topic-file.md                    ← Topic files at root level
    ├── user/                            ← User-type memory files
    │   ├── MEMORY.md                    ← Subdirectory index (optional)
    │   ├── user-preferences.md
    │   └── user-profile.md
    ├── feedback/                        ← Feedback-type memory files
    │   ├── testing-policy.md
    │   └── workflow-conventions.md
    ├── project/                         ← Project-type memory files
    │   ├── architecture-decision.md
    │   └── sprint-goals.md
    ├── reference/                       ← Reference-type memory files
    │   ├── external-api-docs.md
    │   └── tool-reference.md
    ├── private/                         ← User-created grouping (not a code feature)
    │   ├── MEMORY.md
    │   ├── personal-notes.md
    │   └── investigation-logs.md
    └── team/                            ← Team memory (TEAMMEM flag)
        ├── MEMORY.md
        ├── team-conventions.md
        └── shared-reference.md
```

**Note:** Subdirectories (`user/`, `feedback/`, `project/`, `reference/`, `private/`) are **organizational conventions** created by the extractMemories agent or user. They are not enforced by code — any `.md` file at any depth up to 3 levels is scanned.

### How Subdirectories Are Scanned

`scanMemoryFiles()` in `memoryScan.ts`:

```
readdir(memoryDir, { recursive: true })
  → filters .md files
  → filters out basename 'MEMORY.md'
  → max depth 3 levels (prevents DoS from deep symlink trees)
  → for each file: reads first 30 lines, parses YAML frontmatter
  → returns MemoryHeader[] sorted newest-first (max 200 files)
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
memdir/paths.ts:
  getProjectsDir()                       → ~/.gakrcli/workspace/projects/
  getAutoMemPath()                       → <projectsDir>/<sanitized-git-root>/memory/
  getAutoMemBase()                       → canonical git root (or project root fallback)

  Resolution order:
    1. GAKR_COWORK_MEMORY_PATH_OVERRIDE env var (full override)
    2. autoMemoryDirectory in settings.json (trusted sources only)
    3. getProjectsDir() → workspace/projects/<slug>/memory/

memdir/teamMemPaths.ts:
  getTeamMemPath()                       → <autoMemPath>/team/
  getTeamMemEntrypoint()                 → <teamMemPath>/MEMORY.md
```

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

Post-sampling hook, checked after every query loop. Passes if:

1. **Feature flag** `EXTRACT_MEMORIES=true` — if false, module is never imported
2. **GrowthBook gate** is enabled
3. **Auto-memory is enabled** in config (not disabled by user)
4. **Not in remote mode**
5. **Not a subagent** — only main REPL thread
6. **Main agent didn't already write memories** (`hasMemoryWritesSince` check)
7. **Throttle passed** — enough turns since last extraction

### Extraction Flow

```
StopHooks → executeExtractMemories()
  │
  ├─ GATE CHECKS (feature flag, growthbook, auto-memory enabled, not remote, not subagent)
  │
  ├─ hasMemoryWritesSince() → did main agent already write memory files?
  │   Yes → advance cursor, skip (no redundant extraction)
  │
  ├─ Throttle check → minimum N turns since last extraction
  │
  └─ runForkedAgent() with:
       │
       ├─ Max 5 turns
       ├─ Restricted tool access:
       │   ✓ Read, Grep, Glob (read-only investigation)
       │   ✓ Read-only bash (no mutation)
       │   ✓ Edit/Write only within auto-memory directory
       │   ✗ Everything else denied
       │
       └─ Prompt: "Analyze the most recent ~N messages and update your persistent memory systems"
            │
            ├─ + Memory types taxonomy (user/feedback/project/reference)
            ├─ + Currently loaded MEMORY.md index
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

| Trigger | Condition |
|---------|-----------|
| **Time-based** | Every 24h minimum (configurable via `hoursBetweenDreams`) |
| **Session-based** | After 5+ new sessions accumulate since last dream |
| **One-at-a-time** | Cross-process `consolidationLock.ts` prevents concurrent dreams |

### Gate

`isAutoDreamEnabled()` + GrowthBook feature flag `tengu_onyx_plover`.

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
autoDream.ts → runHeadless() → forked agent
  │
  ├─ Phase 1: Read existing memory files + MEMORY.md index
  ├─ Phase 2: grep session transcripts for narrow terms (NOT full-file reads)
  ├─ Phase 3: Merge new signal into existing topic files
  │     • Convert relative dates → absolute dates
  │     • Cross-reference against existing facts
  │     • Prune duplicate or superseded entries
  └─ Writes consolidated .md files + updates MEMORY.md
```

### Consolidation Prompt

```typescript
// consolidationPrompt.ts — the forked agent receives:
"Drean — a reflective pass over your memory files.
Synthesize what you've learned recently into durable,
well-organized memories..."
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

A per-session compact markdown summary that tracks current conversation state — goals, decisions, blockers, and next steps. Lives in a session-scoped directory, loaded on `/resume`.

### Gate

GrowthBook feature flag `tengu_session_memory`.

### Extraction Thresholds

| Threshold | Default | Description |
|-----------|---------|-------------|
| `minimumMessageTokensToInit` | 4000 | Min tokens before first extraction |
| `minimumTokensBetweenUpdate` | 2000 | Min tokens between subsequent extractions |
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
2. Truncates to 200 lines / 25 KB with a truncation warning
3. Injects into the **system prompt** as `## Memory (auto memory)` section

The model sees the MEMORY.md index lines like:
```
- [User Role](user_role.md) — role and preferences
- [Feedback Testing](feedback_testing.md) — testing policies
```

### Method 2: Read Tool (On-Demand Recall)

When the model needs full content of a specific memory:
1. Sees the filename + description in the MEMORY.md index (already in context)
2. Uses **Read tool** on `<autoMemPath>/topic-file.md`
3. Reads the full frontmatter + content

### Method 3: findRelevantMemories (LLM-Powered Selection)

`findRelevantMemories()` in `memdir/findRelevantMemories.ts`:
1. Scans all memory `.md` files via `scanMemoryFiles()`
2. Reads frontmatter descriptions (not full content)
3. Calls **Sonnet** (side model) to select up to 5 most relevant files
4. Returns file paths + mtime for the main model to Read

This is gated separately and used for proactive memory injection.

### Method 4: Dream Outputs

Auto-dream writes consolidated markdown files that are indistinguishable from extractMemories outputs — they live in the same directory, use the same frontmatter format, and are retrieved the same way (MEMORY.md index → Read tool).

---

## Team Memory (`memdir/teamMemPaths.ts`)

### Path

```
~/.gakrcli/workspace/projects/<slug>/memory/team/
├── MEMORY.md                  ← Team memory index
└── topic files...             ← Shared across team members
```

### Feature Flag

`TEAMMEM` — when enabled, team directory is created alongside private memory. Both directories are loaded into the system prompt with distinct sections.

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
|------|---------|
| `memdir/memdir.ts` | Loads memory prompt, builds system prompt sections, ensures directories exist |
| `memdir/paths.ts` | Resolves auto-memory and workspace paths |
| `memdir/memoryScan.ts` | Scans memory dirs for `.md` files, parses frontmatter |
| `memdir/memoryTypes.ts` | Memory type taxonomy + prompt sections (combined/individual modes) |
| `memdir/memoryAge.ts` | Memory aging/staleness tracking |
| `memdir/memoryShapeTelemetry.ts` | Telemetry for memory directory shapes |
| `memdir/memoryIdentity.test.ts` | Tests for memory identity |
| `memdir/teamMemPrompts.ts` | Team memory prompt sections |
| `memdir/findRelevantMemories.ts` | LLM-powered relevant memory selection |
| `services/extractMemories/prompts.ts` | Extraction prompt templates |
| `services/autoDream/consolidationPrompt.ts` | Dream prompt |
| `services/SessionMemory/prompts.ts` | Session memory prompt templates |
