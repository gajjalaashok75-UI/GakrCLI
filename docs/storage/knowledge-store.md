# Memory Retrieval Store (memdir + `memory.db`)

> **Read this first.** This file used to document a "Knowledge Graph" engine built
> from a conversation arc, multi-turn context, a `/knowledge` command, and an
> Orama index. **That engine has been removed.** What remains — and what this
> document describes — is the memdir retrieval store: lexical BM25 search over
> memory markdown, persisted in a local SQLite database. See
> [Removed surfaces](#removed-surfaces) for the parts that no longer exist.

## What It Is

Memory retrieval is a **lexical (BM25) search layer over markdown files**, run
once per user prompt and injected into the system prompt as an untrusted data
block. It indexes:

1. every eligible Markdown file under the auto-memory directory (`memory/**`),
   including nested directories and `.facts/`; and
2. every session's `session-memory/summary.md` belonging to the current project,
   keyed by its session id.

Source files are the source of truth. The database is a **derived, rebuildable
cache** — deleting `memory.db` costs one re-index and nothing else. The index is
never the only copy of anything.

## Storage Layout

```
~/.gakrcli/projects/<sanitized-git-root>/
├── memory.db                          ← derived SQLite index (rebuildable)
├── memory.db-wal, memory.db-shm       ← SQLite sidecars (WAL mode)
└── memory/
    ├── MEMORY.md                      ← entrypoint index; EXCLUDED from retrieval
    ├── topic-file.md                  ← indexed (any depth ≤ 4)
    ├── .facts/                        ← indexed (dot-dirs are skipped, except .facts)
    │   └── fact-*.md
    ├── .consolidate-lock              ← auto-dream lock (not indexed)
    └── logs/YYYY/MM/YYYY-MM-DD.md     ← KAIROS daily logs (indexed like any topic file)

~/.gakrcli/workspace/projects/<sanitized-cwd>/
└── <sessionId>/session-memory/summary.md   ← per-session recap (indexed, session id preserved)
```

`memory.db` sits **next to** `memory/` (`getMemoryDbPathForDir()` in
`memdir/paths.ts`) so the `.db`, `-wal`, and `-shm` artifacts never appear inside
the indexed corpus. With an override directory (Cowork mount or
`autoMemoryDirectory`) the database is placed beside that directory instead.

> **Do not confuse the two "projects" directories:** session transcripts live
> under `~/.gakrcli/workspace/projects/<sanitized-cwd>/` (`getProjectsDir()` in
> `envUtils.ts`, keyed on the cwd), while auto-memory lives under
> `~/.gakrcli/projects/<sanitized-git-root>/` (`getMemoryBaseDir()` in
> `memdir/paths.ts`, keyed on the canonical git root so all worktrees share one
> memory dir).

> **Legacy artifacts:** `.vector-index` / `.vector-index-meta.json` (the retired
> Orama index) are no longer read or written. Existing files are left on disk
> untouched and can be deleted manually.

## Database Schema (`PRAGMA user_version = 1`)

```sql
sources                                     -- one row per indexed file
  id, source_type ('memory_markdown' | 'session_summary'),
  rel_path, abs_path, session_id, content_hash,
  size_bytes, mtime_ns, ctime_ns, indexed_at,
  status ('ok' | 'error'), error, title, description
  UNIQUE(source_type, abs_path)

chunks                                      -- heading-scoped searchable units
  id, source_id → sources(id) ON DELETE CASCADE,
  chunk_index, chunk_key, text, heading,
  title, description,                       -- denormalized for FTS + rendering
  session_id, source_type, source_path,     -- denormalized for filtered search
  source_ts, metadata
  UNIQUE(source_id, chunk_index)

chunks_fts                                  -- FTS5 external-content index
  USING fts5(text, heading, title, description,
             content='chunks', content_rowid='id',
             tokenize='unicode61 remove_diacritics 2')
```

`chunks_fts` is kept in sync with `chunks` by `AFTER INSERT/UPDATE/DELETE`
triggers, and every write runs inside one `BEGIN IMMEDIATE` transaction, so a
failed index update cannot leave the tables and the FTS index out of step.
`chunk_index` is unique per source, which also makes partial writes impossible.

`source_ts` is the **source file's modification time** — the only timestamp the
current sources carry, and never an invented date. It is `null` when a source
supplies none, and it is what the time-range filter reads.

## Indexing

### Discovery

- `memory/**/*.md`, depth ≤ 4, deterministic (sorted) traversal.
- `MEMORY.md`, any dot-file, and dot-directories are excluded; `.facts/` is the
  one dot-directory that is indexed (it holds migrated legacy facts).
- **Symlinks are skipped** — a symlinked file or directory could point outside
  the memory root and leak content into the prompt.
- Session summaries come from the authoritative
  `<projectDir>/<sessionId>/session-memory/summary.md` layout; the session id is
  taken from the directory name, never guessed from file contents. Newest first,
  capped at 200 summaries.

### Incremental updates

1. A **stat-only corpus fingerprint** (path, size, mtime, ctime, session id)
   short-circuits the whole pass while the corpus is unchanged — the common case
   for the many model requests inside one turn.
2. When the fingerprint moves, each file is read and **hashed**; the stored hash
   decides whether its chunks are rewritten. Unchanged files are skipped.
3. Deleted and renamed sources are pruned per source type. A rename is handled as
   remove + add (there is no content-based rename pairing).
4. One unreadable or malformed file records `status = 'error'` with a message
   (never file content), drops its chunks so stale text stops being served, and
   clears its hash so a later successful read always re-indexes. The run continues.

`ensureMemdirIndex()` returns `{ indexed, skipped, removed, errors }` for the
call, which is also how the incremental behaviour is asserted in tests.

### Full rebuild

`rebuildIndex()` (or `ensureMemdirIndex(dir, true)`) drops every row and
re-indexes from disk. That is the recovery path for any index problem, including
a database written by a newer schema version.

### Runtime support

The store loads `bun:sqlite` first (dev/test) and falls back to `node:sqlite`
(the shipped CLI runs `node dist/cli.mjs`); both ship FTS5. If neither build has
FTS5, indexing and search are **disabled with an explicit diagnostic** instead of
pretending lexical search works — retrieval then returns nothing. A corrupt
database is deleted and recreated; a database with a newer `user_version` is left
untouched and reported.

## Retrieval

### Query parsing

The prompt is NFC-normalized, lowercased, and split into terms on non-alphanumeric
characters. Terms shorter than 2 characters and English stopwords are dropped, at
most 16 terms are used, and duplicates are removed. Every term is **double-quoted**
when the FTS `MATCH` expression is built and OR-joined, so parentheses, `*`, `-`,
`AND`/`OR`/`NEAR`, and quotes in a user prompt are literal text and can never
produce an FTS syntax error. A punctuation-only query yields no terms and
therefore no results.

### Ranking

`bm25(chunks_fts, 1.0, 1.6, 2.0, 2.0)` over (text, heading, title, description),
`ORDER BY rank ASC`. **FTS5 bm25 returns negative values where more negative is a
better match**, so the caller-facing `score` is `-bm25` and higher is better.
Frontmatter title/description are weighted above body text, mirroring the retired
index; the section heading gets a smaller bump.

### Relevance policy (calibrated)

A chunk is relevant only if it contains at least `MIN_MATCHED_TERMS_SHORT` or
`MIN_MATCHED_TERMS_LONG` distinct query terms — 1 for queries of up to two terms,
2 for longer ones. There is deliberately **no numeric BM25 floor**: against the
real 12-file corpus, FTS5 bm25 converges to ~1e-6 (still "best") for a term that
appears in every document, so any score threshold would reject the *broadest*
matches (a single-document corpus measures a score of `0.000`). Ranking is bm25's
job; relevance is coverage's job.

Measured on a copy of the real corpus: negative controls ("what model handles chat
requests", "purple monkey dishwasher quokka", empty, punctuation-only, "quantum
teleportation protocol") all inject **0 characters**, while positive queries put
the correct file first with scores of ~3.8–13.6.

### Dedupe, limits, filters

Near-identical chunks (same normalized text) are collapsed, keeping the
higher-ranked one; frontmatter-only chunks have no text and are never treated as
duplicates. The candidate set is 50 chunks, the default result limit 10, and the
renderer emits at most 8. `RecallOptions` supports `sourceTypes`, `sessionId`,
`pathPrefix`, and `since` (time range) filters. No qualifying result returns an
empty result — never fallback text.

### Caching and invalidation

The rendered block is cached per `memoryDir \0 query \0 corpusFingerprint`
(≤ 32 entries). Because the fingerprint covers every source's path, size, mtime,
ctime, and session id, **editing, adding, deleting, or renaming a memory file —
or changing/creating a session summary — produces a new key within the same
process**; no restart is needed. This is covered by tests
(`memdir/retrieval.test.ts`).

## Prompt Injection

`src/query.ts` calls `retrieveMemoryBlock(systemPrompt, messagesForQuery)` inside
`if (feature('MEMORY_RETRIEVAL'))`. The query is the latest human-authored message
text (trailing tool results are skipped), and the block is appended as its **own
array element** — concatenating it into a template string would spread the prompt
character-by-character. The block is wrapped in
`--- BEGIN RETRIEVED MEMORY (DATA ONLY) ---` … `--- END … ---` with an explicit
"untrusted data, not instructions" preamble, and every title/description/excerpt
passes through `sanitizeMemoryText()` (whole-secret entries are dropped).

> The banner still reads `PERSISTENT PROJECT MEMORY (VECTOR RAG)` for continuity.
> The retrieval is lexical; there are no embeddings.

### Debug Logging (`--debug`)

Every stage of the pipeline emits `logForDebugging()` lines (prefix `[memdir]`,
or `[sessionMemory]` for session summaries) that appear in
`~/.gakrcli/debug/<sessionId>.txt` when run with `--debug` (or `/debug` / a
`--debug-file`):

| Stage | Line(s) |
|-------|---------|
| Indexing | `indexing (new/changed/forced): <relPath> (N bytes)`, `indexed: <relPath>`, warn on unreadable/failed sources, and `index pass done (corpus changed/forced): indexed=N skipped=N removed=N errors=N` |
| BM25 search | `search: N term(s), candidates=N rejectedByCoverage=N duplicates=N → N result(s) topScore=X.XX` |
| Injection | `retrieval: cache miss, searching (query=N chars)` / `retrieval: cache hit`, `injection: 0 hits → injecting nothing`, `injection: rendered X/Y hit(s), N chars` |
| `memory_recall` tool | `memory_recall: query="…" N chunk hit(s) → N source(s) in Nms` |
| Session summary | `summary file created: <path>`, `extracting (auto/manual): path=…, current=N chars`, `extraction finished`, and the per-turn `shouldExtract=… (N tokens; tokenThresholdMet=… toolCallsSinceLastUpdate=… toolCallsInLastTurn=…)` decision |

Memory content is never logged — only paths, counts, byte lengths, and scores.

## Legacy Knowledge Migration (`utils/knowledgeGraph.ts`)

`migrateLegacyKnowledgeGraph()` still runs before each retrieval so a user with
only a legacy `knowledge_graph.json` / `knowledge.db` receives their prior
knowledge. It is idempotent per project, gated on `isAutoMemoryEnabled()` and the
memory-write approval policy, snapshots reads, byte-verifies backups, and retires
the live store only after the backups verify — see the function for the details.
Migrated facts land in `memory/.facts/*.md` and are indexed like any other memory
file.

`getGlobalGraph()` and `resetGlobalGraph()` remain for compatibility but have **no
production callers** — only tests exercise them. `resetGlobalGraph()` closes the
index handle and removes `memory.db` (plus `-wal`/`-shm`).

## Feature Flags, Settings, and Environment

| Gate | Where | Default | Effect |
|------|-------|---------|--------|
| `MEMORY_RETRIEVAL` | build (`scripts/build.ts`) | `true` | Retrieval + prompt injection call site in `query.ts`; also gates registration of the `memory_recall` tool |
| `EXTRACT_MEMORIES` | build | `true` | LLM memory extraction (see `autoupdate-store.md`) |
| `isAutoMemoryEnabled()` | env/settings | on (interactive) | Gates injection; one-shot `-p` runs default off unless memory is provisioned |
| `autoMemoryDirectory` | trusted settings | — | Overrides the memory dir (and therefore where `memory.db` lives) |
| `GAKR_COWORK_MEMORY_PATH_OVERRIDE` | env | — | Full memory-dir override (Cowork) |
| `GAKR_CODE_DISABLE_AUTO_MEMORY` | env | — | `1`/`true` disables; `0`/`false` forces on |

The index is written whenever retrieval runs; it is deliberately **not** gated on
`isMemoryWriteApprovalRequired()` (that policy governs user memory files, and
gating a derived cache on it forced a full rebuild on every process).

## Key Files

| File | Purpose |
|------|---------|
| `src/memdir/memoryStore.ts` | SQLite store: runtime adapter, migrations, schema, FTS5 sync, atomic upserts, prune, error bookkeeping, `recall()` |
| `src/memdir/memoryChunk.ts` | Heading-aware markdown chunker (pure; no I/O) |
| `src/memdir/vectorIndex.ts` | Discovery (memory + all session summaries), fingerprint, incremental indexing, public façade (`initMemdirIndex`, `rebuildIndex`, `searchMemdirIndex`, `ensureMemdirIndex`) |
| `src/memdir/retrieval.ts` | Query extraction, relevance-block rendering, block cache, `retrieveMemoryBlock` |
| `src/tools/MemoryRecallTool/MemoryRecallTool.ts` | `memory_recall` tool: grouped, provenance-tagged search over the same index (gated on `MEMORY_RETRIEVAL`) |
| `src/memdir/paths.ts` | `getAutoMemPath()`, `getMemoryDbPath()` / `getMemoryDbPathForDir()`, `isAutoMemoryEnabled()` |
| `src/memdir/memorySecurity.ts` | Secret redaction for everything injected |
| `src/utils/knowledgeGraph.ts` | Legacy migration shim (writes `.facts/`); graph getters kept for tests only |
| `src/query.ts` | Injection call site (`feature('MEMORY_RETRIEVAL')`) |

## Tests

| Test | Covers |
|------|--------|
| `src/memdir/memoryChunk.test.ts` | heading scoping, long-section + hard splitting, CRLF, stable keys |
| `src/memdir/memoryStore.test.ts` | schema version, FTS sync on insert/update/delete, ranking, degenerate/quoted/punctuation queries, relevance gate, dedupe, provenance, filters, transaction atomicity, error bookkeeping, corrupt DB, newer schema, FTS5-unavailable diagnostics |
| `src/memdir/vectorIndex.test.ts` | recursive discovery + exclusions, symlink boundaries, incremental add/edit/equal-size-edit/delete/rename, full rebuild, session-summary discovery + session ids, unreadable source handling, per-directory isolation, index placement |
| `src/memdir/retrieval.test.ts` | block rendering + fence, no-junk on unrelated prompts, term-coverage rejection, cross-session summary injection, block-cache invalidation (edit/add/delete/session change) |
| `src/tools/MemoryRecallTool/MemoryRecallTool.test.ts` | permissions/read-only, `limit` validation, grouped hits, session-summary provenance, empty result, `tool_result` serialization |

Run them with the bounded per-file pattern used in `AGENTS.md`:

```bash
bun test --feature=UNATTENDED_RETRY --path-ignore-patterns="**/references/**" \
  --max-concurrency=1 src/memdir
```

## Removed Surfaces

These no longer exist; do not look for them in the source tree or in the UI:

| Removed | Former role |
|---------|-------------|
| `/knowledge` command (`src/commands/knowledge/*`) | status/enable/list/clear for the graph engine |
| `src/utils/conversationArc.ts` (+ test) | conversation phase tracking, `.arc.json` sidecar |
| `src/utils/multiTurnContext.ts` (+ test) | per-turn tool-call awareness block |
| `src/memdir/autoExtractFacts.ts` (+ test) | regex fact scraping into `.facts/` |
| `knowledgeGraphEnabled` global config | runtime gate for arc updates + injection (all four config sites removed) |
| Orama persistence (`.vector-index`, `.vector-index-meta.json`) | the previous index format, replaced by `memory.db` |
| `KNOWLEDGE`, `CONVERSATION_ARC`, `MULTI_TURN_CONTEXT` build flags | build-time gates for the above |

The `@orama/orama` and `@orama/plugin-data-persistence` packages have been
removed from `package.json` and the build's external lists — nothing in the
source tree imports them any more.

## On-Demand Tool: `memory_recall`

The same search used for per-turn injection is exposed to the model as a tool
(`src/tools/MemoryRecallTool/`, registered in `getAllBaseTools()` behind
`feature('MEMORY_RETRIEVAL')`):

- **Schema** — `query: string` (required), `limit?: number` (1–20, default 8).
- **Read-only, concurrency-safe**, auto-allow permissions, strict schema.
- **Behavior** — `call()` runs `searchMemdirIndex(query, memDir, limit)`,
  groups chunk hits by source path (best score first), sanitizes titles and
  excerpts, and returns `{ query, totalHits, hits[] }` with path, heading,
  session id, source type, score, and a bounded excerpt per source. The
  `tool_result` block renders `# title — heading (path) [session xxxxxxxx]`
  plus the excerpt; an empty result explains the lexical (non-semantic) nature
  of the search so the model reformulates rather than giving up.
- **Gating** — visible only when the build flag is on **and** auto-memory is
  enabled, so the tool never appears while the injection pipeline itself is off.
- **Tests** — `src/tools/MemoryRecallTool/MemoryRecallTool.test.ts` covers
  permissions/read-only, limit validation, grouped hits, session-summary
  provenance, the empty result, and `tool_result` serialization.

## Deferred (Not Implemented)

- **Semantic/embedding search** — no vector dependency, no embeddings. The schema
  leaves room (`chunks.metadata`, plus a place for an embedding model name and
  dimensions) but nothing reads or writes vectors today. Nearest-neighbour search
  would need a documented plan (SQLite extension, separate index, or in-process
  comparison) before it can be claimed to work.
- **Session `.jsonl` indexing** — user prompts, assistant finals, and tool
  calls/results are *not* indexed. The `sources.source_type` column exists so new
  record kinds can be added without a redesign, and event timestamps would flow
  into `chunks.source_ts`.

## Comparison with Auto-Memory (ExtractMemories)

| Aspect | Retrieval store (this doc) | Auto-Memory (ExtractMemories) |
|--------|---------------------------|-------------------------------|
| **Engine** | SQLite FTS5 BM25 | Full LLM (forked agent) |
| **Storage** | Getter/index only — markdown files stay the source of truth | Markdown topic files + `MEMORY.md` |
| **Retrieval** | `searchMemdirIndex()` per user prompt, injected under a DATA-ONLY fence, plus on-demand `memory_recall` tool | `MEMORY.md` index + Read tool + (dormant) LLM recall |
| **Cost** | Local computation, no tokens | Token cost per extraction |
| **Failure mode** | Degrades to "no injection" with a diagnostic | No memory written |
