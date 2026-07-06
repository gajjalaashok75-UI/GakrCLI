# gakrcli Unified Persistence Layer — Design Document

**Status:** Draft v1 — ready for implementation review
**Replaces:** `knowledge_graph.json` + `knowledge.db` + `knowledge.orama` + `memory/*.md` tree + `*.jsonl` / `*.lite.jsonl` transcripts + `tool-results/*.json|txt` + `session-memory/summary.md` + `sessions/*.json`
**Keeps:** Orama, but demoted to a **derived, rebuildable search cache** — SQLite is the only source of truth.

---

## 1. Understanding Summary

- **What's being built:** one SQLite `.db` file per project (plus one workspace-level `.db`) that becomes the *single* persisted store for everything gakrcli currently scatters across JSON, JSONL, and Markdown files — sessions, every message, every tool call/result (untruncated), sub-agents, remote-agent tasks, auto-memory content, and the knowledge graph (entities/relations/summaries/rules).
- **Why:** the current architecture triple-writes (JSON + SQLite + Orama) for the knowledge graph, separately maintains a markdown-file tree for auto-memory, and separately maintains JSONL transcripts with an on-disk "persisted output" side-channel for big tool results. Three write paths, three failure modes, three freshness-comparison algorithms. Collapsing to one file removes the sync problem entirely.
- **Who it's for:** the gakrcli runtime itself (retrieval + prompt injection) and you, inspecting/debugging state.
- **Key constraints (from your brief):**
  - SQLite only — no other persisted storage tier.
  - No truncation — full session content, full tool results, full memory content, all stored in full.
  - Everything in one place: sessions, JSONL-equivalent messages, tool calls/results, sub-agents, auto-memory, knowledge graph facts.
  - Orama stays, but only as a **search/ranking layer synced from SQLite** — not an independent store.
  - Retrieval must be **BM25/vector-style ranking, not LLM-based** (replaces `findRelevantMemories()`'s Sonnet call).
  - Result: higher-quality, cheaper, more deterministic context injection into the agent's prompt.
- **Explicit non-goals:** this doc does not implement the TypeScript write/read services, does not migrate historical data (covered as a migration *strategy*, not a script), and does not change Orama's client library — only what feeds it.

### Assumptions (flagged explicitly — correct me if wrong)

| # | Assumption | Why |
|---|---|---|
| A1 | One `.db` file **per project** (at `<projectDir>/gakr_store.db`), plus one **workspace-level** `.db` (`~/.gakrcli/workspace/gakr_workspace.db`) for cross-project files (MEMORY.md/USER.md/SOUL.md/IDENTITY.md/RULEBOOK.md/GAKRCLI.md equivalents). This matches your existing per-project directory isolation and avoids one enormous global file. |
| A2 | "No truncation" governs **storage** — every row keeps full content forever (soft-delete only, never hard-delete on snip/compact). **Prompt injection** is still token-budgeted (you can't inject an unbounded context into a finite context window) — the budgeting logic picks *which* full rows to inject, it never truncates a row's stored content. |
| A3 | Orama is kept as an **in-memory, disk-cached index** rebuilt from SQLite (same freshness-check pattern you already have for `knowledge.orama`), not as a second authoritative store. If the Orama file is deleted, nothing is lost — it's rebuilt from SQLite on next init. |
| A4 | "No LLM search" means the hot retrieval path (called every turn) is pure BM25/FTS ranking. An optional embeddings column is included for a *future* vector-similarity upgrade, but is not required for v1 and involves no LLM call either (just an embedding model, offline). |
| A5 | SQLite's `TEXT`/`BLOB` columns support up to 1 GB each, so "full tool result, no truncation" is stored inline in the DB, not on a side filesystem path. Large media (screenshots etc.) can stay as `BLOB` or as a file-path reference if you want to keep binary bloat out of the DB — flagged as an open question below. |

### Open Questions

1. Binary/large attachments (images, screenshots): inline `BLOB` in SQLite, or keep a filesystem path reference stored in SQLite? (Default assumed: inline BLOB, since "everything in this DB" was explicit — but this can bloat the file fast.)
2. Do you want a single global `.db` instead of per-project + workspace split? (Default assumed: per-project, per A1.)
3. Retention: since nothing is hard-deleted, do you want a periodic `VACUUM`/archival policy, or truly infinite growth forever? (Default assumed: `auto_vacuum=INCREMENTAL` + soft-delete, no hard cap.)

I'll proceed with the defaults above; call out any you want changed and I'll adjust before we lock the schema.

---

## 2. Architecture Overview

```
                         ┌─────────────────────────────┐
                         │   gakr_store.db (per project) │
                         │   gakr_workspace.db (global)   │
                         │        SINGLE SOURCE OF TRUTH  │
                         └───────────────┬─────────────┘
                                         │
                     WAL-mode, single writer queue (mutex-free
                     re-entrant lock — same AsyncLocalStorage
                     pattern you already use, now guarding one
                     file instead of three)
                                         │
        ┌────────────────┬──────────────┼──────────────┬────────────────┐
        ▼                ▼              ▼              ▼                ▼
   sessions/msgs    tool_calls/     memory_files   entities/relations  search_documents
   (was *.jsonl)    tool_results    (was memory/    /kg_summaries/     (feeds FTS5 +
                    (was tool-      *.md tree)      rules (was KG)      Orama, via triggers)
                    results/*.json)
                                         │
                                         ▼
                          FTS5 virtual table (bm25 ranking)
                          — always in sync via SQL triggers,
                            zero application-level dual-write
                                         │
                                         ▼
                     Orama in-memory index — rebuilt/synced from
                     search_documents at process start (freshness
                     check via sync_meta, same pattern as today)
                                         │
                                         ▼
                     getUnifiedContext(query) — pure ranking,
                     no LLM call — merges FTS5 + Orama scores,
                     applies importance weight + recency decay
                                         │
                                         ▼
                     Token-budgeted prompt injection
                     (full rows pulled from SQLite by id,
                      nothing truncated in storage)
```

**Core shift from today's design:** the JSON⇄SQLite⇄Orama triple-write and the JSON⇄SQLite freshness-comparison dance disappear. SQLite is written once; FTS5 sync is a same-transaction trigger (not application code); Orama becomes a rebuildable cache instead of a peer store. The 15+ narrow JSONL "entry subtypes" (goal-snapshot, file-history-snapshot, marble-origami-commit, etc.) collapse into one flexible `session_events` table instead of one column-shape per concept.

---

## 3. Decision Log

| # | Decision | Alternatives considered | Why this one |
|---|---|---|---|
| D1 | One flexible `session_events` table for the ~15 misc JSONL entry subtypes (goal-state, file-history-snapshot, attribution-snapshot, marble-origami-*, agent-name/color/setting, mode, worktree-state, pr-link, queue-operation, speculation-accept) instead of 15 dedicated tables | 15 narrow tables with proper typed columns | Narrow tables are "more correct" relationally, but these are low-volume, schema-varying, mostly-write-once-read-rarely audit events. A generic `(session_id, event_type, payload JSON)` table with an index on `(session_id, event_type)` gets 95% of the query performance with 10% of the migration churn, and new event types need zero schema changes. |
| D2 | Sub-agents, workflow runs, and remote-agent tasks are rows in the **same** `sessions` table (via `session_kind` + `parent_session_id`) rather than separate tables | Separate `subagents` / `workflow_runs` / `remote_tasks` tables mirroring the current directory split | Today's `subagents/agent-<id>.jsonl`, `workflows/<runId>/<uuid>.jsonl`, and `remote-agents/*.meta.json` are all "a session with a parent and a different entrypoint." Unifying them means `messages`, `tool_calls`, and `search_documents` all have exactly one FK target (`session_id`) instead of three, which massively simplifies retrieval and FTS sync. |
| D3 | Messages are **never hard-deleted** on snip/compact — a `removed_by_message_uuid` column marks them, and a `message_boundaries` table records the boundary event + which UUIDs it removed | Hard-delete removed rows (matches today's in-memory "filtered view" behavior) | Your requirement is explicit: no truncation, full history. Soft-delete gives you the same fast "live view" (filter `WHERE removed_by_message_uuid IS NULL`) while keeping full audit/replay capability that hard-delete would destroy. |
| D4 | Tool results stored **inline** in `tool_results.content` (TEXT/BLOB, no size cap) instead of the current "persist to a side file + inject a preview" pattern | Keep the persisted-output-file pattern, just point it at rows instead of files | The side-file pattern exists today specifically to avoid bloating the *prompt* with huge results — that's a prompt-injection concern, not a storage concern. Storage should keep everything; the token-budgeting logic (unchanged in spirit) decides what to inject, reading the full row and building its own preview on the fly instead of reading a pre-truncated file. |
| D5 | One `search_documents` + FTS5 virtual table spanning **all** object types (messages, tool results, memory files, entities, kg summaries, rules, session summaries), tagged by `object_type`, instead of separate indexes per subsystem | Keep 3 separate retrieval paths (KG's Orama, Auto-Memory's `findRelevantMemories`, Session Memory's per-session summary) | You explicitly asked for one retrieval path that ranks across everything and injects the top results — this is the schema-level enabler for that. `object_type` + `importance_weight` let you tune "a `rule` should outrank a raw `message`" without separate code paths. |
| D6 | Orama is rebuilt from `search_documents`, not written to independently | Keep dual-writing Orama like today | You said "Orama is fine" — keeping it, but its persisted `.orama` file becomes a cache, disposable and rebuildable, consistent with "use only this SQLite, no other [authoritative] storage." |
| D7 | `findRelevantMemories()`'s Sonnet call is replaced by pure BM25 (FTS5 `bm25()`) + Orama score + `importance_weight` + recency decay, computed in-process | Replace Sonnet with a full embeddings/vector-similarity pipeline | You explicitly said "without the LLM search or recall" — BM25 hybrid ranking is zero-latency, zero-cost, and matches the retrieval quality bar you already accept from `getArcSummary()`'s existing BM25 path today. An `embedding BLOB` column is included so a future vector upgrade doesn't require a schema migration, but it's optional/unused in v1. |
| D8 | Per-project DB (`gakr_store.db`) + one workspace-level DB (`gakr_workspace.db`), not one giant global file | Single global DB for everything | Matches your existing per-project directory isolation, keeps per-project file size manageable, and avoids one process file-locking across unrelated projects. Workspace-level memory (MEMORY.md/USER.md/SOUL.md/IDENTITY.md/RULEBOOK.md/GAKRCLI.md equivalents) lives in the workspace DB with `project_id IS NULL`. |

---

## 4. Full Schema (DDL)

### 4.1 Pragmas (set once per connection, at open)

```sql
PRAGMA journal_mode = WAL;          -- concurrent readers while writing
PRAGMA synchronous = NORMAL;        -- safe with WAL, much faster than FULL
PRAGMA foreign_keys = ON;           -- enforce FK integrity (off by default in SQLite!)
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000;         -- ~64MB page cache
PRAGMA mmap_size = 268435456;       -- 256MB memory-mapped I/O
PRAGMA auto_vacuum = INCREMENTAL;   -- reclaim space without a blocking full VACUUM
PRAGMA busy_timeout = 5000;         -- wait on lock contention instead of erroring immediately
```

> Since nothing is hard-deleted, run `PRAGMA incremental_vacuum(N);` periodically (e.g. on session end, capped batch) rather than a full `VACUUM`, which locks the whole file.

---

### 4.2 Meta / bookkeeping

```sql
CREATE TABLE db_meta (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- seeded rows: schema_version, created_at, last_orama_sync_at, last_incremental_vacuum_at

CREATE TABLE projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  root_path       TEXT NOT NULL UNIQUE,       -- absolute cwd / git root
  sanitized_slug  TEXT NOT NULL,              -- matches existing <sanitized-cwd> convention
  git_remote      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- NOTE: only present in gakr_workspace.db, or omitted entirely in a per-project db
-- where project_id is implicitly "this file" (see §7 for the two-DB layout).
```

---

### 4.3 Sessions (unifies main sessions, sub-agents, workflow runs, remote tasks)

```sql
CREATE TABLE sessions (
  id                  TEXT PRIMARY KEY,                -- session/agent UUID
  project_id          INTEGER REFERENCES projects(id),
  parent_session_id   TEXT REFERENCES sessions(id),     -- fork/branch/subagent/workflow parent
  session_kind        TEXT NOT NULL DEFAULT 'main'
                        CHECK (session_kind IN ('main','subagent','workflow_run','remote')),
  workflow_run_id      TEXT,                             -- groups subagents under one workflow (was workflows/<runId>/)
  agent_type          TEXT,
  model               TEXT,
  cwd                 TEXT,
  entrypoint_type     TEXT,                              -- slash_command_session_id, cli_flag, fork, teleport, subagent, remote...
  custom_title        TEXT,
  ai_title            TEXT,
  tag                 TEXT,
  pr_link             TEXT,
  mode                TEXT,                              -- coordinator | normal
  is_sidechain        INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','abandoned','crashed')),
  remote_task_status  TEXT,                               -- only used when session_kind='remote'
  message_count       INTEGER NOT NULL DEFAULT 0,         -- denormalized, trigger-maintained
  token_count         INTEGER NOT NULL DEFAULT 0,         -- denormalized, trigger-maintained
  started_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ended_at            TEXT,
  metadata            TEXT NOT NULL DEFAULT '{}'          -- JSON: agent, model override, user type, misc
);

CREATE INDEX idx_sessions_project        ON sessions(project_id, started_at DESC);
CREATE INDEX idx_sessions_parent         ON sessions(parent_session_id);
CREATE INDEX idx_sessions_kind_workflow  ON sessions(session_kind, workflow_run_id);
CREATE INDEX idx_sessions_status         ON sessions(status);
CREATE INDEX idx_sessions_tag            ON sessions(tag);
```

---

### 4.4 Messages (replaces `*.jsonl` transcript lines — full content, no truncation)

```sql
CREATE TABLE messages (
  uuid                    TEXT PRIMARY KEY,
  session_id              TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  parent_uuid             TEXT REFERENCES messages(uuid),        -- conversation chain link
  role                    TEXT NOT NULL
                            CHECK (role IN ('user','assistant','system','tool_result','attachment')),
  subtype                 TEXT,                                  -- snip_boundary, compact_boundary, custom-title, ai-title, tag, goal-snapshot, NULL for normal
  content                 TEXT NOT NULL,                         -- full JSON content blocks, verbatim, no truncation
  content_tokens          INTEGER,
  is_new                  INTEGER NOT NULL DEFAULT 0,            -- session boundary marker
  is_sidechain            INTEGER NOT NULL DEFAULT 0,
  is_meta                 INTEGER NOT NULL DEFAULT 0,
  removed_by_message_uuid TEXT REFERENCES messages(uuid),        -- soft-delete: set when a snip/compact boundary removes this row
  cwd                     TEXT,
  metadata                TEXT NOT NULL DEFAULT '{}',            -- JSON: entrypoint, user type, misc
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_messages_session_time   ON messages(session_id, created_at);
CREATE INDEX idx_messages_parent         ON messages(parent_uuid);
CREATE INDEX idx_messages_removed        ON messages(removed_by_message_uuid);
CREATE INDEX idx_messages_live           ON messages(session_id) WHERE removed_by_message_uuid IS NULL;

-- Boundary events: what a snip/compact operation removed, and any synthesized summary
CREATE TABLE message_boundaries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  boundary_uuid   TEXT NOT NULL REFERENCES messages(uuid),   -- the boundary marker message itself
  boundary_type   TEXT NOT NULL CHECK (boundary_type IN ('snip_boundary','compact_boundary')),
  removed_uuids   TEXT NOT NULL DEFAULT '[]',                -- JSON array, for chain-repair on resume
  summary_content TEXT,                                      -- compact's synthesized summary, if any
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_boundaries_session ON message_boundaries(session_id, created_at);

-- Everything else that used to be a narrow JSONL entry subtype (see Decision D1)
CREATE TABLE session_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_uuid  TEXT REFERENCES messages(uuid),
  event_type    TEXT NOT NULL CHECK (event_type IN (
                  'content-replacement','goal-state','file-history-snapshot',
                  'attribution-snapshot','marble-origami-commit','marble-origami-snapshot',
                  'agent-name','agent-color','agent-setting','mode','worktree-state',
                  'pr-link','queue-operation','speculation-accept'
                )),
  payload       TEXT NOT NULL,                               -- JSON, shape depends on event_type
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_session_events_lookup ON session_events(session_id, event_type, created_at);

-- Goals get first-class columns (frequently queried: active goal on resume)
CREATE TABLE goals (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending','active','paused','completed','abandoned')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at  TEXT
);
CREATE INDEX idx_goals_session_status ON goals(session_id, status);
```

---

### 4.5 Tool calls & results (full content inline, replaces `tool-results/*.json|txt`)

```sql
CREATE TABLE tool_calls (
  id            TEXT PRIMARY KEY,                            -- tool_use_id
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_uuid  TEXT NOT NULL REFERENCES messages(uuid),
  tool_name     TEXT NOT NULL,
  input         TEXT NOT NULL,                                -- JSON, full tool input
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_tool_calls_session ON tool_calls(session_id, created_at);
CREATE INDEX idx_tool_calls_name    ON tool_calls(tool_name);

CREATE TABLE tool_results (
  tool_use_id   TEXT PRIMARY KEY REFERENCES tool_calls(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,                                 -- full result, JSON or plain text, NEVER truncated
  content_type  TEXT NOT NULL CHECK (content_type IN ('json','text','binary_ref')),
  binary_blob   BLOB,                                          -- used only when content_type='binary_ref' and you want inline binary (see Open Q1)
  is_error      INTEGER NOT NULL DEFAULT 0,
  size_bytes    INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_tool_results_size ON tool_results(size_bytes DESC);  -- useful for storage audits
```

> Replaces the `DEFAULT_MAX_RESULT_SIZE_CHARS` / preview-file pattern entirely for **storage**. The prompt-injection layer (unchanged philosophy) still builds a preview *on read*, from the full row, when deciding what fits in context — see §6.

---

### 4.6 Auto-Memory (replaces the `memory/*.md` tree)

```sql
CREATE TABLE memory_files (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id         INTEGER REFERENCES projects(id),          -- NULL only in workspace db (workspace-scope files)
  scope              TEXT NOT NULL CHECK (scope IN ('workspace','project','team')),
  virtual_path       TEXT NOT NULL,                             -- organizational label, e.g. 'user/user-preferences', 'feedback/testing-policy' — no real filesystem meaning anymore
  name               TEXT NOT NULL,
  description        TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('user','feedback','project','reference')),
  content             TEXT NOT NULL,                             -- full markdown body, no truncation
  source_system      TEXT NOT NULL CHECK (source_system IN ('extract_memories','auto_dream','session_memory','manual')),
  source_session_id  TEXT REFERENCES sessions(id),
  is_index           INTEGER NOT NULL DEFAULT 0,                 -- true for the MEMORY.md-equivalent row
  version            INTEGER NOT NULL DEFAULT 1,
  superseded_by      INTEGER REFERENCES memory_files(id),        -- soft versioning: old content never deleted
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_memory_scope_type   ON memory_files(scope, type);
CREATE INDEX idx_memory_live         ON memory_files(project_id) WHERE superseded_by IS NULL;
CREATE INDEX idx_memory_virtual_path ON memory_files(virtual_path);

-- Represents "MEMORY.md index lines pointing at topic files" relationally instead of markdown links
CREATE TABLE memory_index_entries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  index_file_id     INTEGER NOT NULL REFERENCES memory_files(id) ON DELETE CASCADE,
  target_memory_id  INTEGER NOT NULL REFERENCES memory_files(id) ON DELETE CASCADE,
  display_order     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_memory_index_lookup ON memory_index_entries(index_file_id, display_order);

-- Per-session compact summary (was session-memory/summary.md)
CREATE TABLE session_summaries (
  session_id                  TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  content                     TEXT NOT NULL,
  token_count_at_extraction   INTEGER,
  tool_calls_since_last       INTEGER NOT NULL DEFAULT 0,
  updated_at                  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

---

### 4.7 Knowledge Graph (entities / relations / summaries / rules — kept, now the sole store)

```sql
CREATE TABLE entities (
  id                 TEXT PRIMARY KEY,                          -- `${type}_${name}`
  project_id         INTEGER REFERENCES projects(id),
  type               TEXT NOT NULL,                              -- environment_variable, concept, technology, path, version, endpoint, server_ip, metric...
  name               TEXT NOT NULL,
  attributes         TEXT NOT NULL DEFAULT '{}',                 -- JSON key-value
  source_session_id  TEXT REFERENCES sessions(id),
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (project_id, type, name)
);
CREATE INDEX idx_entities_type ON entities(project_id, type);

CREATE TABLE relations (
  source_id   TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id   TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                                     -- depends-on, implements, configures...
  project_id  INTEGER REFERENCES projects(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (source_id, target_id, type)
);
CREATE INDEX idx_relations_target ON relations(target_id);

CREATE TABLE kg_summaries (
  id          TEXT PRIMARY KEY,
  project_id  INTEGER REFERENCES projects(id),
  session_id  TEXT REFERENCES sessions(id),
  content     TEXT NOT NULL,
  keywords    TEXT NOT NULL DEFAULT '[]',                        -- JSON array
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE rules (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id         INTEGER REFERENCES projects(id),
  content            TEXT NOT NULL,
  source_session_id  TEXT REFERENCES sessions(id),
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (project_id, content)
);

CREATE TABLE conversation_arcs (
  session_id     TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  current_phase  TEXT NOT NULL DEFAULT 'init'
                   CHECK (current_phase IN ('init','exploring','implementing','reviewing','completed')),
  goals          TEXT NOT NULL DEFAULT '[]',                     -- JSON
  decisions      TEXT NOT NULL DEFAULT '[]',                     -- JSON
  milestones     TEXT NOT NULL DEFAULT '[]',                     -- JSON
  started_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

---

### 4.8 Unified Search Substrate (the retrieval upgrade — §5 covers how it's used)

```sql
CREATE TABLE search_documents (
  rowid              INTEGER PRIMARY KEY,                        -- FTS5 external-content needs a stable rowid
  doc_key            TEXT NOT NULL UNIQUE,                        -- e.g. 'message:<uuid>', 'memory:<id>', 'entity:<id>'
  object_type        TEXT NOT NULL CHECK (object_type IN (
                        'message','tool_call','tool_result','memory',
                        'entity','kg_summary','rule','session_summary'
                      )),
  object_id          TEXT NOT NULL,                                -- id in the source table (app-level FK, not enforceable across polymorphic tables)
  project_id         INTEGER,
  session_id         TEXT,
  title              TEXT,                                        -- short label for display / high-weight matching
  content             TEXT NOT NULL,                                -- normalized searchable text (may be a summary/snippet of a large row)
  metadata           TEXT NOT NULL DEFAULT '{}',                   -- JSON: type-specific extras
  importance_weight  REAL NOT NULL DEFAULT 1.0,                    -- tuned per object_type, see §5.2
  embedding          BLOB,                                         -- reserved for future vector search (unused in v1, see A4)
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_search_docs_type    ON search_documents(object_type, project_id);
CREATE INDEX idx_search_docs_session ON search_documents(session_id);

-- FTS5 external-content table: zero duplicate storage, BM25-ranked, auto-synced via triggers below
CREATE VIRTUAL TABLE search_fts USING fts5(
  title,
  content,
  object_type UNINDEXED,
  content = 'search_documents',
  content_rowid = 'rowid',
  tokenize = 'porter unicode61'
);

-- Keep FTS5 in sync automatically — this is what eliminates the old triple-write
CREATE TRIGGER trg_search_docs_ai AFTER INSERT ON search_documents BEGIN
  INSERT INTO search_fts(rowid, title, content, object_type)
  VALUES (new.rowid, new.title, new.content, new.object_type);
END;

CREATE TRIGGER trg_search_docs_ad AFTER DELETE ON search_documents BEGIN
  INSERT INTO search_fts(search_fts, rowid, title, content, object_type)
  VALUES ('delete', old.rowid, old.title, old.content, old.object_type);
END;

CREATE TRIGGER trg_search_docs_au AFTER UPDATE ON search_documents BEGIN
  INSERT INTO search_fts(search_fts, rowid, title, content, object_type)
  VALUES ('delete', old.rowid, old.title, old.content, old.object_type);
  INSERT INTO search_fts(rowid, title, content, object_type)
  VALUES (new.rowid, new.title, new.content, new.object_type);
END;
```

---

### 4.9 Denormalized counters (kept fresh via triggers, not application code)

```sql
CREATE TRIGGER trg_messages_ai AFTER INSERT ON messages BEGIN
  UPDATE sessions
     SET message_count = message_count + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE id = new.session_id;
END;

CREATE TRIGGER trg_memory_files_updated_at AFTER UPDATE ON memory_files BEGIN
  UPDATE memory_files SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = new.id;
END;

CREATE TRIGGER trg_entities_updated_at AFTER UPDATE ON entities BEGIN
  UPDATE entities SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = new.id;
END;
```

---

## 5. Retrieval: replacing Orama-as-store and `findRelevantMemories()`'s LLM call

### 5.1 Write-time: what populates `search_documents`

Every write to a "primary" table is mirrored into `search_documents` **in the same transaction** (app-level, since it's cross-table and polymorphic — SQLite can't trigger across arbitrary tables into one polymorphic target cleanly). Suggested mapping:

| Source table | `object_type` | `title` | `content` (what gets indexed) |
|---|---|---|---|
| `messages` (role=assistant/user, not removed) | `message` | first ~80 chars | full text content of the message |
| `tool_calls` + `tool_results` | `tool_result` | tool name | result content, capped for *indexing* only (full content still lives in `tool_results.content`) |
| `memory_files` (latest version only) | `memory` | `name` | `description` + `content` |
| `entities` | `entity` | `type:name` | `name` + flattened `attributes` |
| `kg_summaries` | `kg_summary` | first ~80 chars | `content` |
| `rules` | `rule` | first ~80 chars | `content` |
| `session_summaries` | `session_summary` | session title | `content` |

> Note on `tool_result` indexing: the **searchable snippet** in `search_documents.content` can reasonably be capped (e.g. first 4KB) purely for FTS token economy — this does not violate "no truncation," because `tool_results.content` (the actual stored row) remains the full, untruncated result. Indexing a summary of a 10MB log file is normal; losing the log file is not.

### 5.2 Read-time: `getUnifiedContext(query, sessionId?)`

```sql
-- Step 1: BM25-ranked candidates from FTS5
SELECT sd.doc_key, sd.object_type, sd.object_id, sd.project_id, sd.session_id,
       sd.importance_weight,
       bm25(search_fts, 2.0, 1.0) AS bm25_score   -- title weighted 2x over content
  FROM search_fts
  JOIN search_documents sd ON sd.rowid = search_fts.rowid
 WHERE search_fts MATCH :query
   AND sd.project_id = :project_id
 ORDER BY bm25_score
 LIMIT 50;
```

Then, in-process (no LLM call):

```
final_score = normalize(bm25_score)
             * importance_weight                         -- rule=2.0, memory(user/feedback)=1.8, entity=1.3,
                                                           -- kg_summary=1.2, memory(reference)=1.1, session_summary=1.1,
                                                           -- message=1.0, tool_result=0.9   (tunable table, not hardcoded in schema)
             * recency_decay(created_at)                  -- e.g. exp(-age_days / half_life_days)
             * (orama_score if available else 1.0)        -- optional second opinion, same MATCH query run against Orama
```

Top-K (e.g. 15) by `final_score` get their **full row** fetched from the origin table (`messages`, `tool_results`, `memory_files`, etc.) by `object_id` — this is where "full content, no truncation" is honored at read time too: the ranking layer works on lightweight snippets, but injection reads the authoritative full row.

This directly replaces:
- `findRelevantMemories()` (was: Sonnet call to pick 5 files) → now: FTS5 + weights, zero LLM cost.
- `getOrchestratedMemory()` / `getArcSummary()` (were: two separate BM25 paths, one KG-only) → now: one path spanning all object types.

### 5.3 Orama's new role

At process start (or on `sync_meta.last_update_time` mismatch, same pattern you use today for `knowledge.orama`):

1. Query `search_documents` for all rows.
2. Bulk-insert into an in-memory Orama index (same schema as today: `id, type, name, content, attributes`, sourced from `doc_key, object_type, title, content, metadata`).
3. Persist Orama's index to `<projectDir>/gakr_store.orama` purely as a **warm-start cache** (skip step 1–2 next boot if `sync_meta` timestamp matches).
4. If the `.orama` file is corrupt or missing: rebuild from SQLite. SQLite never depends on Orama being present.

`getUnifiedContext()` can run FTS5 alone (guaranteed correct, always available) and treat Orama's parallel score as a bonus signal, or use Orama exclusively for the initial candidate set and SQLite as the full-content fetch — either is architecturally fine now, because SQLite is authoritative and Orama is disposable either way.

---

## 6. Prompt Injection Format (unchanged shape, single source now)

```
--- [PROJECT MEMORY] ---
[rule] always use Postgres for persistence
[memory:feedback] testing-policy — don't mock DB, prefer real fixtures
[entity:environment_variable] DATABASE_URL: environment=production
[kg_summary] exploring phase: found config files, env vars...
[message:assistant] (session a1b2..., 2026-06-30) "Switched auth rewrite to..."
[tool_result:Bash] (session a1b2..., 2026-06-30) exit 0, 340 lines — full result available, id=tr_9f2c
```

Large `tool_result`/`message` entries are shown as a bounded preview + a stable `id` the model can `Read`-tool back for the full row — same UX as today's `<persisted-output>` pattern, just backed by a SQL row instead of a filesystem path.

---

## 7. File Layout (two-DB split, per Decision D8)

```
~/.gakrcli/workspace/
├── gakr_workspace.db          ← projects table, workspace-scope memory_files (MEMORY.md/USER.md/SOUL.md/
│                                  IDENTITY.md/RULEBOOK.md/GAKRCLI.md equivalents, scope='workspace'),
│                                  team-scope memory_files (scope='team')
├── gakr_workspace.orama       ← disposable cache, rebuildable from gakr_workspace.db
│
└── projects/<sanitized-cwd>/
    ├── gakr_store.db           ← sessions, messages, tool_calls/results, sub-agents, remote tasks,
    │                              project-scope memory_files, entities/relations/kg_summaries/rules,
    │                              search_documents + search_fts
    └── gakr_store.orama         ← disposable cache, rebuildable from gakr_store.db
```

Everything that used to be a directory full of files (`memory/`, `subagents/`, `tool-results/`, `remote-agents/`, dozens of `.jsonl`) becomes rows in one file per project. `/resume`, `/branch`, and cross-project search all become plain SQL queries instead of directory scans + JSONL parsing + `parentUuid` chain-walking in application code (the chain-walk logic in §4.4 still exists conceptually, but it's a recursive CTE now, not a JS loop):

```sql
WITH RECURSIVE chain(uuid, parent_uuid, depth) AS (
  SELECT uuid, parent_uuid, 0 FROM messages WHERE uuid = :leaf_uuid
  UNION ALL
  SELECT m.uuid, m.parent_uuid, c.depth + 1
    FROM messages m JOIN chain c ON m.uuid = c.parent_uuid
)
SELECT m.* FROM messages m
JOIN chain c ON m.uuid = c.uuid
WHERE m.removed_by_message_uuid IS NULL
ORDER BY c.depth DESC;
```

---

## 8. Migration Strategy (from current 3-tier layout)

1. **Knowledge graph:** read `knowledge_graph.json` (source of truth today) → insert into `entities`/`relations`/`kg_summaries`/`rules`, tag `source_session_id = NULL` (unknown provenance for historical data). Drop `knowledge.db` and `knowledge.orama` — both are rebuilt/regenerated.
2. **Auto-memory:** walk `memory/**/*.md`, parse frontmatter (`name`/`description`/`type`), insert as `memory_files` rows with `scope` inferred from directory (`team/` → `'team'`, everything else project-scope), `is_index=1` for `MEMORY.md` files, and populate `memory_index_entries` by parsing the markdown links in each index file.
3. **Sessions:** stream each `*.jsonl` line-by-line → insert into `sessions` (first `isNew` line) / `messages` / `message_boundaries` / `session_events` / `goals` depending on `type`/`subtype`. Sub-agent transcripts (`subagents/agent-<id>.jsonl`) become `sessions` rows with `session_kind='subagent'`.
4. **Oversized tool results:** for any `<persisted-output>` reference still on disk, read the referenced file and backfill `tool_results.content` with the *full* original content if still recoverable, else mark `metadata.migrated_from_preview = true` on that row (best-effort — previews were lossy by design, this is a known migration gap, not a schema gap).
5. **Populate `search_documents`** for all migrated rows in a single backfill pass, then let triggers take over from there.
6. Run once, verify counts (`SELECT count(*) FROM messages` should roughly match total JSONL line count minus subtype-only lines), then archive (don't delete) the old directory tree.

---

## 9. Indexing & Sizing Notes

- Every FK column has a supporting index (listed inline above) — the recursive chain-walk and per-session queries are the hottest paths.
- `idx_messages_live` (partial index, `WHERE removed_by_message_uuid IS NULL`) keeps the common "live transcript" query fast without scanning soft-deleted rows.
- FTS5 with `content=` (external content) mode stores **zero duplicate text** — the virtual table only holds the inverted index, `search_documents.content` remains the single copy of indexed text.
- Expect `gakr_store.db` to be substantially larger than today's `knowledge.db` alone (it now holds full transcripts + full tool results). This is the direct cost of "no truncation" — budget disk accordingly; `auto_vacuum=INCREMENTAL` keeps it from growing *unboundedly* due to page fragmentation, but logical growth (more sessions, more tool output) is expected and by design.
- Run `ANALYZE;` after large backfills so the query planner has fresh statistics for the FTS5 + join queries.

---

## 10. What's Explicitly Deferred (YAGNI, not forgotten)

- Vector/embedding-based semantic search (`embedding BLOB` column reserved, unpopulated).
- Cross-project global search UI (schema supports it via `gakr_workspace.db` + attaching project DBs with `ATTACH DATABASE`, not designed in this pass).
- Automatic archival/cold-storage tiering for very old sessions — flagged as an open question (§1), not designed until you confirm you want it.

---

Let me know if the two-DB split (A1/D8), inline-BLOB decision for large binaries (Open Q1), or the `importance_weight` defaults in §5.2 should change — those are the three points most likely to need a second pass before implementation starts.
