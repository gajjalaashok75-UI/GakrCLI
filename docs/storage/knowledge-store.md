# Knowledge Graph Store

## What It Is

The Knowledge Graph is a **pattern-based entity extraction and retrieval system** that maintains a structured store of technical facts (entities, relations, and summaries) extracted from conversations. Unlike Auto-Memory (which uses LLM-powered semantic understanding), the Knowledge Graph uses **regex pattern matching** to scrape entities from message text and stores them in a 3-tier dual-write architecture (JSON + SQLite + Orama).

Two companion systems extend the Knowledge Graph:

1. **Conversation Arc** — tracks conversation phase transitions (init/exploring/implementing/reviewing/completed) and extracts entities on each turn
2. **Multi-Turn Context** — tracks messages and tool calls within a single query to improve context awareness

---

## Why It Exists

- **Zero-cost extraction** — regex matching is local computation, no LLM token cost
- **Structured facts** — entities with typed attributes (not freeform markdown)
- **BM25 retrieval** — keyword search over summaries for prompt insertion
- **Orama full-text search** — in-memory inverted index for fast entity lookup
- **Dual-write durability** — JSON (human-readable audit) + SQLite (ACID working store) + Orama (search index)
- **Automatic prompt injection** — relevant entities/summaries are automatically injected into the system prompt on every turn

---

## Architecture

### 3-Tier Storage

```
                    ┌─────────────────────┐
                    │   Mutation Queue     │ ← AsyncLocalStorage re-entrant lock
                    │  (serializes writes)│
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────┐ ┌──────────────┐
      │  JSON File   │ │  SQLite  │ │  Orama Index │
      │ knowledge_   │ │ knowledge│ │ knowledge_   │
      │ graph.json   │ │ .db      │ │ .orama       │
      └──────────────┘ └──────────┘ └──────────────┘
```

### File Locations

All files live in the project directory:

```
~/.gakrcli/workspace/projects/<sanitized-cwd>/
├── knowledge_graph.json                ← JSON source of truth (human-readable)
├── knowledge.db                        ← SQLite working store (ACID)
└── knowledge.orama                     ← Orama in-memory index (persisted)
```

### Path Resolution

```
knowledgeGraph.ts:
  getKnowledgeDir()                     → getProjectsDir() + sanitizePath(cwd)
  getKnowledgeFile()                    → <knowledgeDir>/knowledge_graph.json
  getSQLiteDatabasePath()               → <knowledgeDir>/knowledge.db
  getOramaIndexPath()                   → <knowledgeDir>/knowledge.orama
```

---

## Data Model

### Entities

```typescript
type KnowledgeEntity = {
  id: string        // `${type}_${name}`
  type: string      // Entity type (environment_variable, concept, technology, etc.)
  name: string      // Entity name
  attributes: {     // Key-value pairs extracted from context
    [key: string]: string | undefined
  }
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}
```

### Relations

```typescript
type KnowledgeRelation = {
  sourceId: string   // Entity ID (source)
  targetId: string   // Entity ID (target)
  type: string       // Relation type (depends-on, implements, configures, etc.)
}
```

### Summaries

```typescript
type SemanticSummary = {
  id: string         // Unique ID
  content: string    // Free text summary of session/phase
  keywords: string[] // Extracted keywords for BM25 indexing
  timestamp: number  // Unix timestamp
}
```

### Rules

```typescript
type ProjectRule = string  // Simple string — extracted from "always/must/should/never" patterns
```

---

## Entity Extraction (Regex Patterns)

Extraction is done by `extractFactsAutomatically()` in `conversationArc.ts`. It scans message text with cascading regex patterns:

| Pattern | Regex | Entity Type | Example Match |
|---------|-------|-------------|---------------|
| Environment variables | `(?:export\s+)?([A-Z_]{3,})=([^\s\n"']+)` | `environment_variable` | `DATABASE_URL=postgres://...` |
| Absolute paths | `(\/(?:[\w.-]+\/)+[\w.-]+)` | `path` | `/home/user/config.json` |
| Versions | `(?:v\|version\s+)(\d+\.\d+(?:\.\d+)?)` | `version` | `v1.2.3` |
| URLs | `(https?:\/\/[^\s\n"']+)` | `endpoint` | `https://api.example.com` |
| IPs | `\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b` | `server_ip` | `192.168.1.1` |
| Backtick symbols | `` `([^`]+)` `` | `concept` | `` `useEffect` `` |
| PascalCase / camelCase / kebab-case | `\b([A-Z][a-z]+[A-Z][\w]*\|[a-z]+[A-Z][\w]*\|[\w]+(?:-[\w]+)+)\b` | `concept` | `ReactComponent`, `getUserData`, `worker-node` |
| Percentages | `(\d+(?:\.\d+)?%)` | `metric` | `99.9%` |
| Tech names | `includes()` on known terms | `technology` | "react", "typescript", "docker" |
| Rules | Pattern match on "always/must/should/never" | rule (direct) | `always use Postgres for persistence` |

### Quality Filters

- Min length: `name.length >= 2` and `name.length <= 60`
- Common word exclusion: `["The", "This", "That", "With", ...]`
- Path exclusions: `node_modules`, paths containing `://`
- IPs get context tags (proximity to words like "database", "prod", "worker")
- Dedup: entities keyed by `(type, name)` — attributes merge on re-extraction

### What This Misses

- Freeform reasoning and design decisions
- Abstract concepts that don't match a regex pattern
- Architectural context without explicit pattern markers
- User preferences and feedback
- Anything expressed in natural language without backtick symbols or specific patterns

---

## Storage Operations

### Writing (Dual-Write with Mutex)

All mutations go through `enqueueMutation()` — a re-entrant serialized queue using `AsyncLocalStorage`:

```
1. enqueueMutation(fn)
   → Acquire lock (or queue)
   → 2. JSON saveGraph()
   → 3. SQLite saveGraph() (if ready)
   → 4. Orama insert/update (if ready)
   → Release lock
```

**JSON** = source of truth, human-readable, always written first.
**SQLite** = ACID working store, written on init if SQLite provider is active.
**Orama** = in-memory search index, written on init, rebuilt from JSON if needed.

### Initialization

`initKnowledgeStore()` checks if JSON exists:
- **If yes**: Load JSON into memory. Initialize SQLite and Orama from JSON.
- **If no**: Initialize from scratch. Create empty stores.
- SQLite save-on-init: after loading from JSON, also saves current graph to SQLite for consistency.

### Init Flow (`initOrama` / `initKnowledgeStore`)

The full initialization follows a freshness-comparison flow:

1. Initialize SQLite if available (bun:sqlite / node:sqlite)
2. Load the graph from JSON and/or SQLite
3. Choose the freshest graph by `lastUpdateTime` — JSON wins exact ties
4. Self-heal by writing the chosen graph back to the stale or missing backend
5. Load Orama from disk if the `meta:sync` document's `lastUpdateTime` matches
6. Otherwise, rebuild Orama from the graph and persist it

If Orama load fails, the corrupt file is renamed to `knowledge.orama.corrupted.<timestamp>`, then the index is rebuilt.

### SQLite Detail

**Pragmas**: WAL mode, foreign keys enabled.

**Tables**:
```sql
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  attributes TEXT NOT NULL,
  last_updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS relations (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type TEXT NOT NULL,
  PRIMARY KEY (source_id, target_id, type),
  FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  keywords TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rules (
  content TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Serialized columns: `entities.attributes` (JSON), `summaries.keywords` (JSON), `sync_meta.last_update_time` (graph timestamp).

SQLite self-heal: on critical failure, deletes `knowledge.db`, `knowledge.db-wal`, `knowledge.db-shm`, then falls back to JSON.

### Orama Index Detail

**Orama file**: `<projectDir>/knowledge.orama`

**Orama schema**:
```typescript
{
  id: 'string',
  type: 'string',
  name: 'string',
  content: 'string',
  attributes: 'string',
}
```

Each graph entity and summary is inserted into Orama. A special metadata document with id `meta:sync` stores the graph `lastUpdateTime` so Orama can be checked for freshness against JSON/SQLite.

### Store Status

`getKnowledgeStorageStatus()` returns diagnostic info:
```typescript
{
  json: { exists: boolean, size: number }
  orama: { exists: boolean, size: number, ready: boolean }
  sqlite: { exists: boolean, size: number, ready: boolean, rows: number }
}
```

---

## Retrieval

### Orchestrated Search: `getOrchestratedMemory(query)`

The primary retrieval function searches Orama first, then falls back to native keyword/BM25 search:

1. **Orama search** — full-text BM25 search over the Orama inverted index
2. **Fallback** — if Orama is unavailable or fails, uses native keyword/BM25 over the in-memory graph

Returned prompt section names:
- `--- [PERSISTENT PROJECT MEMORY (ORAMA RAG)] ---` when Orama succeeds
- `--- [PERSISTENT PROJECT MEMORY (NATIVE RAG)] ---` on fallback

Both sections include active project rules and top-ranked entities/summaries.

### Method 2: `getArcSummary(query)` — Auto-Injected on Every Turn

Called from `query.ts` on every query loop. Flow:

```
User input text
  → extractKeywords()
    → lowercase split
    → filter stop-words (["the", "a", "is", ...])
    → filter short tokens (< 3 chars)
    → dedup
  → Orama.search(db, { term: query, limit: 20 })
    → BM25 score each match
    → "summary" type matches → BM25 ranking
    → "entity" type matches → full-text score
  → Top 20 results
  → Format as:
    "--- [PERSISTENT PROJECT MEMORY] ---
     [environment_variable] DATABASE_URL: environment=production
     [concept] getData: source=recent_conversation
     [summary] exploring phase: found config files, env vars..."
  → Inject into system prompt before LLM call
```

### BM25 Scoring Formula

```
score = IDF × (TF × 2.2) / (TF + 1.2)
```

Pure TF-IDF variant (same algorithm as Elasticsearch). No neural embeddings, no LLM calls.

### Method 2: `getEntity(name, type)` — Direct Entity Lookup

Returns a single entity by type + name from the in-memory map.

### Method 3: `getAllEntities()`, `getAllRelations()`, `getAllSummaries()`

Bulk access to all stored data — used by `/knowledge list` command and for initialization.

---

## Conversation Arc (`conversationArc.ts`)

### Runtime Types

```typescript
type Goal = {
  id: string
  description: string
  status: 'pending' | 'active' | 'completed' | 'abandoned'
  createdAt: number
  completedAt?: number
}

type Decision = {
  id: string
  description: string
  rationale?: string
  timestamp: number
}

type Milestone = {
  id: string
  description: string
  achievedAt: number
}

type ConversationArc = {
  id: string
  goals: Goal[]
  decisions: Decision[]
  milestones: Milestone[]
  currentPhase: 'init' | 'exploring' | 'implementing' | 'reviewing' | 'completed'
  startTime: number
  lastUpdateTime: number
}
```

### Phase Detection

Detects conversation phase from user input using keyword matching:

| Phase | Keywords |
|-------|----------|
| `init` | "start", "begin", "first", "hello" |
| `exploring` | "look", "find", "search", "check", "what is", "explore" |
| `implementing` | "create", "implement", "build", "write", "change", "fix" |
| `reviewing` | "review", "check", "verify", "test" |
| `completed` | "done", "finish", "complete", "ready" |

### Arc Summary Injection

At every turn, if `CONVERSATION_ARC=true`:
1. `updateArcPhase(userMessage)` → possibly transition phase
2. `getArcSummary(userQuery)` → BM25 search → inject into system prompt

### Finalization

At session end, `finalizeArcTurn()`:
1. Reads completed goals from goal state
2. Extracts new facts (entities created during this session)
3. Writes a `SemanticSummary` with concatenated goals + decisions + milestones + new entity types

---

## Multi-Turn Context (`multiTurnContext.ts`)

### Purpose

Tracks message/tool-call pairs within a single query to prevent the model from losing context between tool calls.

### When Active

Gated by `MULTI_TURN_CONTEXT=true` + `config.knowledgeGraphEnabled=true`.

### What It Tracks

- User messages
- Assistant tool_use blocks
- Tool results
- Token accumulation

### Injection

When multi-turn context exceeds a threshold, a summary of the current turn's progress is injected into the next LLM call to keep the model aware of what's been done so far.

---

## Prompt Injection (Complete System Prompt Section)

With `CONVERSATION_ARC=true` and `knowledgeGraphEnabled=true`, the system prompt gets:

```
--- [PERSISTENT PROJECT MEMORY] ---
[environment_variable] DATABASE_URL: environment=production
[concept] fetchUserData: source=recent_session
[path] /app/config.json: context=setup
completed phase: exploring
active entities: 12, relations: 3
```

This is followed by the Conversation Arc section:

```
--- [CONVERSATION ARC] ---
Current phase: implementing
Phase goals:
  - Set up database connection
  - Create user API endpoints

Completed sub-goals:
  - Configuration loaded (exploring)

Key decisions:
  - Using Postgres for persistence
  - REST API over GraphQL
```

---

## Feature Flags

| Flag | Default | Effect |
|------|---------|--------|
| `KNOWLEDGE` | `true` | `/knowledge` slash command (status/enable/clear/list) |
| `CONVERSATION_ARC` | `true` | Entity extraction, phase tracking, BM25 prompt injection |
| `MULTI_TURN_CONTEXT` | `true` | Multi-turn context tracking within queries |

All three must be `true` for the complete pipeline to work. The `/knowledge` command is independently usable for manual inspection.

---

## User Config

```typescript
// config key (set by `/knowledge enable yes`)
knowledgeGraphEnabled: boolean  // default: depends on config
```

The runtime integration (entity extraction, prompt injection) only activates when both the feature flag AND the config toggle are enabled.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/utils/knowledgeGraph.ts` | Core engine (759 lines) — entities, relations, summaries, JSON/SQLite/Orama, BM25 search |
| `src/utils/conversationArc.ts` | Phase detection, entity extraction from messages, session finalization |
| `src/utils/multiTurnContext.ts` | Multi-turn context tracking within queries |
| `src/utils/storage/SQLiteProvider.ts` | SQLite storage provider (ACID) |
| `src/utils/storage/JSONProvider.ts` | JSON storage provider (source of truth) |
| `src/commands/knowledge/knowledge.ts` | `/knowledge` command handler (status/enable/clear/list) |
| `src/commands/knowledge/index.ts` | Command registration |
| `src/query.ts` | Runtime integration — arc summary injection, multi-turn context, entity extraction |

---

## Comparison with Auto-Memory

| Aspect | Knowledge Graph | Auto-Memory (ExtractMemories) |
|--------|----------------|------------------------------|
| **Engine** | Regex patterns + BM25 inverted index | Full LLM (forked agent) |
| **Understanding** | Mechanical — matches shapes | Semantic — the model comprehends |
| **Storage** | JSON + SQLite + Orama (structured) | Markdown files with frontmatter |
| **Retrieval** | BM25 keyword search + prompt injection | MEMORY.md index in prompt + Read tool |
| **Cost** | Zero (local computation) | Token cost per extraction (2-4 forked turns) |
| **What it captures** | Env vars, paths, versions, IPs, URLs, backtick symbols | Anything the model considers worth remembering |
| **Noise** | High (every regex match stored) | Low (model judges relevance) |
| **Coverage** | ~5% of useful conversation context | Depends on the model's judgment |
