/**
 * SQLite-backed lexical index store for the memdir retrieval corpus.
 *
 * Replaces the Orama `.vector-index` blob with a `memory.db` database that is
 * the derived, rebuildable index for `memory/**\/*.md` and each session's
 * `session-memory/summary.md`. Source files remain the source of truth — the
 * database can be deleted at any time and rebuilt from disk.
 *
 * Layout (schema v1):
 *   sources      one row per indexed file (stable identity, hash, mtime, status)
 *   chunks       heading-scoped text chunks, denormalized for filtered search
 *   chunks_fts   FTS5 external-content index over text/heading/title/description,
 *                kept in sync by AFTER INSERT/UPDATE/DELETE triggers
 *
 * Ranking is FTS5 `bm25()`, which returns NEGATIVE numbers where more negative
 * is a better match, so the query orders by `rank ASC` and the caller-facing
 * score is `-rank`. The relevance gate combines BM25 with query-term coverage
 * (see `MIN_MATCHED_TERMS_*` and `MIN_RELEVANCE_SCORE`) so an unrelated prompt
 * yields no results rather than junk.
 *
 * The runtime is bun:sqlite in dev/test and node:sqlite under the distributed
 * CLI (bin/gakrcli runs `node dist/cli.mjs`); both ship FTS5. If neither has
 * FTS5 the store reports a diagnostic and refuses to index or search instead
 * of pretending lexical search works.
 */

import { existsSync, mkdirSync, rmSync } from 'fs'
import { dirname } from 'path'
import { createRequire } from 'module'

const _require = createRequire(import.meta.url)

export const SCHEMA_VERSION = 1

export type SqlValue = string | number | bigint | null

export interface SqlStatement {
  all(...params: SqlValue[]): unknown[]
  get(...params: SqlValue[]): unknown
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint }
  /** bun:sqlite only — node:sqlite statements are released on close/GC. */
  finalize?(): void
}

export interface SqlDatabase {
  exec(sql: string): void
  prepare(sql: string): SqlStatement
  close(): void
}

export interface SqliteRuntime {
  open(path: string): SqlDatabase
}

export class MemoryIndexError extends Error {
  constructor(
    readonly code: 'sqlite_unavailable' | 'fts5_unavailable' | 'schema_too_new',
    message: string,
  ) {
    super(message)
    this.name = 'MemoryIndexError'
  }
}

let runtimeOverride: SqliteRuntime | null = null
let runtime: SqliteRuntime | null = null

/** Test seam: force a runtime (e.g. one whose FTS5 support is missing). */
export function setSqliteRuntimeForTesting(next: SqliteRuntime | null): void {
  runtimeOverride = next
}

function loadSqliteRuntime(): SqliteRuntime {
  // bun:sqlite in dev/test, node:sqlite for the shipped CLI. Mirrors the loader
  // in utils/knowledgeGraph.ts. Only positional `?` parameters are used so the
  // two runtimes behave identically.
  try {
    const { Database } = _require('bun:sqlite')
    return { open: (path: string) => new Database(path) }
  } catch {
    /* not running under Bun — try the Node runtime */
  }
  try {
    const { DatabaseSync } = _require('node:sqlite')
    return { open: (path: string) => new DatabaseSync(path) }
  } catch {
    /* neither runtime available */
  }
  throw new MemoryIndexError(
    'sqlite_unavailable',
    'memory index unavailable: no SQLite runtime found (tried bun:sqlite and node:sqlite).',
  )
}

function getRuntime(): SqliteRuntime {
  if (runtimeOverride) return runtimeOverride
  runtime ??= loadSqliteRuntime()
  return runtime
}

/**
 * Run a one-off statement and release it. bun:sqlite keeps an open handle (and
 * on Windows the file lock) for every statement that is never finalized, so
 * anything that isn't cached in the store is finalized immediately.
 */
function withStatement<T>(db: SqlDatabase, sql: string, fn: (stmt: SqlStatement) => T): T {
  const stmt = db.prepare(sql)
  try {
    return fn(stmt)
  } finally {
    stmt.finalize?.()
  }
}

let lastDiagnostic: string | null = null

/** Most recent index diagnostic, or null when the store is healthy. */
export function getMemoryIndexDiagnostic(): string | null {
  return lastDiagnostic
}

function reportDiagnostic(message: string): void {
  lastDiagnostic = message
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * BM25 column weights, in `chunks_fts` column order. Mirrors the old Orama
 * `SEARCH_BOOST` (frontmatter title/description weighted above body text) plus
 * a smaller bump for the section heading, which is a strong topical signal.
 */
const BM25_WEIGHTS = [1.0, 1.6, 2.0, 2.0] as const

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sources (
  id            INTEGER PRIMARY KEY,
  source_type   TEXT    NOT NULL,
  rel_path      TEXT    NOT NULL,
  abs_path      TEXT    NOT NULL,
  session_id    TEXT,
  content_hash  TEXT    NOT NULL,
  size_bytes    INTEGER NOT NULL,
  mtime_ns      TEXT    NOT NULL,
  ctime_ns      TEXT    NOT NULL,
  indexed_at    INTEGER NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'ok',
  error         TEXT,
  title         TEXT,
  description   TEXT,
  UNIQUE(source_type, abs_path)
);

CREATE TABLE IF NOT EXISTS chunks (
  id            INTEGER PRIMARY KEY,
  source_id     INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  chunk_key     TEXT    NOT NULL,
  text          TEXT    NOT NULL,
  heading       TEXT,
  title         TEXT,
  description   TEXT,
  session_id    TEXT,
  source_type   TEXT    NOT NULL,
  source_path   TEXT    NOT NULL,
  source_ts     INTEGER,
  metadata      TEXT,
  UNIQUE(source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_session ON chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(source_type);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text, heading, title, description,
  content='chunks',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, text, heading, title, description)
  VALUES (new.id, new.text, new.heading, new.title, new.description);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text, heading, title, description)
  VALUES ('delete', old.id, old.text, old.heading, old.title, old.description);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text, heading, title, description)
  VALUES ('delete', old.id, old.text, old.heading, old.title, old.description);
  INSERT INTO chunks_fts(rowid, text, heading, title, description)
  VALUES (new.id, new.text, new.heading, new.title, new.description);
END;
`

// ---------------------------------------------------------------------------
// Query parsing and relevance policy
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'a', 'about', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'but', 'by', 'can',
  'do', 'does', 'for', 'from', 'get', 'had', 'has', 'have', 'how', 'i', 'if',
  'in', 'into', 'is', 'it', 'its', 'me', 'my', 'not', 'of', 'on', 'or', 'our',
  'should', 'so', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'to', 'up', 'us', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your',
])

const MIN_TERM_LENGTH = 2
const MAX_QUERY_TERMS = 16

/**
 * Split a raw prompt into searchable terms. FTS5 operators and punctuation are
 * dropped entirely (terms are re-quoted when the MATCH expression is built), so
 * quotes, parentheses, `*`, and `-` in a user prompt can never produce a syntax
 * error, and a punctuation-only query yields no terms and therefore no results.
 */
export function tokenizeQuery(query: string): string[] {
  const terms = (query.normalize('NFC').toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [])
    .filter(term => term.length >= MIN_TERM_LENGTH)
    .filter(term => !STOPWORDS.has(term))
  return [...new Set(terms)].slice(0, MAX_QUERY_TERMS)
}

/**
 * Relevance policy: a chunk is relevant only if it contains at least this many
 * distinct query terms. A single-term query can only ever match one term; a
 * longer prompt must match at least two, which is what stops an unrelated
 * prompt from injecting a chunk that happens to share one common word.
 *
 * There is deliberately NO numeric BM25 floor. Calibration against the real
 * 12-file memory corpus showed why one is unusable: FTS5's bm25 converges to
 * ~1e-6 (still negative, so "best") for a term that appears in every document,
 * so any score floor rejects the most broadly matching chunks. Ranking is
 * bm25's job; relevance is coverage's job. On that corpus the policy returns
 * 0 results for the negative controls ("what model handles chat requests",
 * "purple monkey dishwasher quokka", empty, punctuation-only) while positive
 * queries put the correct file first with bm25 scores of ~3.8-13.6.
 */
export const MIN_MATCHED_TERMS_SHORT = 1
export const MIN_MATCHED_TERMS_LONG = 2

export function requiredTermCoverage(termCount: number): number {
  return termCount <= 2 ? MIN_MATCHED_TERMS_SHORT : MIN_MATCHED_TERMS_LONG
}

const CANDIDATE_LIMIT = 50
const DEFAULT_LIMIT = 10

export interface RecallOptions {
  limit?: number
  candidateLimit?: number
  sourceTypes?: readonly string[]
  sessionId?: string
  /** Only chunks whose display path starts with this prefix. */
  pathPrefix?: string
  /** Only chunks whose source timestamp is >= this epoch-ms value. */
  since?: number
}

export interface RecallResult {
  text: string
  heading: string | null
  title: string | null
  description: string | null
  sessionId: string | null
  sourceType: string
  sourcePath: string
  /** From the source itself; null when the source carries no timestamp. */
  sourceTimestamp: number | null
  chunkKey: string
  chunkIndex: number
  /** FTS5 bm25, negated so higher is better. */
  score: number
  /** Number of distinct query terms present in the chunk. */
  matchedTerms: number
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, ch => `\\${ch}`)
}

function normalizeForDedupe(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function countMatchedTerms(haystack: string, terms: readonly string[]): number {
  let matched = 0
  for (const term of terms) {
    if (haystack.includes(term)) matched++
  }
  return matched
}

export interface RecallDebug {
  terms: string[]
  candidates: number
  rejectedByCoverage: number
  duplicates: number
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface MemorySourceRow {
  sourceType: string
  relPath: string
  absPath: string
  sessionId: string | null
  contentHash: string
  sizeBytes: number
  mtimeNs: string
  ctimeNs: string
  title: string | null
  description: string | null
  /**
   * The source file's modification time. It is the only timestamp the current
   * sources carry (memory markdown and session summaries have no in-content
   * date), so nothing is invented — session .jsonl records will supply real
   * event timestamps later. null means the source supplied none.
   */
  sourceTs: number | null
}

export interface MemoryChunkInput {
  index: number
  key: string
  text: string
  heading: string | null
}

export interface StoredSourceStats {
  contentHash: string
  sizeBytes: number
  mtimeNs: string
  ctimeNs: string
  status: string
}

export class MemoryStore {
  private closed = false
  private readonly statements = new Map<string, SqlStatement>()

  constructor(
    readonly dbPath: string,
    private readonly db: SqlDatabase,
    readonly fts5: boolean,
  ) {}

  private prepare(sql: string): SqlStatement {
    let stmt = this.statements.get(sql)
    if (!stmt) {
      stmt = this.db.prepare(sql)
      this.statements.set(sql, stmt)
    }
    return stmt
  }

  private all<T>(sql: string, params: readonly SqlValue[] = []): T[] {
    return this.prepare(sql).all(...params) as T[]
  }

  private get<T>(sql: string, params: readonly SqlValue[] = []): T | undefined {
    const row = this.prepare(sql).get(...params)
    return (row ?? undefined) as T | undefined
  }

  private run(sql: string, params: readonly SqlValue[] = []): void {
    this.prepare(sql).run(...params)
  }

  /** Single write transaction; rolls back on any failure so tables and FTS stay in step. */
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* transaction already rolled back */
      }
      throw error
    }
  }

  listSourceStats(sourceType: string): Map<string, StoredSourceStats> {
    const rows = this.all<{
      abs_path: string
      content_hash: string
      size_bytes: number
      mtime_ns: string
      ctime_ns: string
      status: string
    }>(
      'SELECT abs_path, content_hash, size_bytes, mtime_ns, ctime_ns, status FROM sources WHERE source_type = ?',
      [sourceType],
    )
    return new Map(
      rows.map(row => [
        row.abs_path,
        {
          contentHash: row.content_hash,
          sizeBytes: Number(row.size_bytes),
          mtimeNs: row.mtime_ns,
          ctimeNs: row.ctime_ns,
          status: row.status,
        },
      ]),
    )
  }

  /** Atomically replace a source's chunks (triggers keep the FTS index in sync). */
  upsertSource(source: MemorySourceRow, chunks: readonly MemoryChunkInput[]): void {
    this.transaction(() => {
      const existing = this.get<{ id: number }>(
        'SELECT id FROM sources WHERE source_type = ? AND abs_path = ?',
        [source.sourceType, source.absPath],
      )
      const now = Date.now()
      let sourceId: number
      if (existing) {
        sourceId = Number(existing.id)
        this.run(
          `UPDATE sources SET rel_path = ?, session_id = ?, content_hash = ?, size_bytes = ?,
             mtime_ns = ?, ctime_ns = ?, indexed_at = ?, status = 'ok', error = NULL,
             title = ?, description = ?
           WHERE id = ?`,
          [
            source.relPath, source.sessionId, source.contentHash, source.sizeBytes,
            source.mtimeNs, source.ctimeNs, now, source.title, source.description, sourceId,
          ],
        )
      } else {
        const result = this.prepare(
          `INSERT INTO sources
             (source_type, rel_path, abs_path, session_id, content_hash, size_bytes,
              mtime_ns, ctime_ns, indexed_at, status, error, title, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', NULL, ?, ?)`,
        ).run(
          source.sourceType, source.relPath, source.absPath, source.sessionId,
          source.contentHash, source.sizeBytes, source.mtimeNs, source.ctimeNs, now,
          source.title, source.description,
        )
        sourceId = Number(result.lastInsertRowid)
      }

      this.run('DELETE FROM chunks WHERE source_id = ?', [sourceId])

      const insert = this.prepare(
        `INSERT INTO chunks
           (source_id, chunk_index, chunk_key, text, heading, title, description,
            session_id, source_type, source_path, source_ts, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      for (const chunk of chunks) {
        insert.run(
          sourceId, chunk.index, chunk.key, chunk.text, chunk.heading,
          source.title, source.description, source.sessionId, source.sourceType,
          source.relPath, source.sourceTs ?? null,
        )
      }
    })
  }

  /**
   * Record an unreadable source and drop any chunks previously indexed for it,
   * so a file that becomes unreadable stops being served. The stored hash is
   * cleared so a later successful read always re-indexes.
   */
  markSourceError(
    source: Pick<MemorySourceRow, 'sourceType' | 'relPath' | 'absPath' | 'sessionId'>,
    message: string,
  ): void {
    this.transaction(() => {
      const existing = this.get<{ id: number }>(
        'SELECT id FROM sources WHERE source_type = ? AND abs_path = ?',
        [source.sourceType, source.absPath],
      )
      const now = Date.now()
      let sourceId: number
      if (existing) {
        sourceId = Number(existing.id)
        this.run(
          `UPDATE sources SET rel_path = ?, session_id = ?, content_hash = '', size_bytes = 0,
             mtime_ns = '', ctime_ns = '', indexed_at = ?, status = 'error', error = ?,
             title = NULL, description = NULL
           WHERE id = ?`,
          [source.relPath, source.sessionId, now, message, sourceId],
        )
      } else {
        const result = this.prepare(
          `INSERT INTO sources
             (source_type, rel_path, abs_path, session_id, content_hash, size_bytes,
              mtime_ns, ctime_ns, indexed_at, status, error, title, description)
           VALUES (?, ?, ?, ?, '', 0, '', '', ?, 'error', ?, NULL, NULL)`,
        ).run(source.sourceType, source.relPath, source.absPath, source.sessionId, now, message)
        sourceId = Number(result.lastInsertRowid)
      }
      this.run('DELETE FROM chunks WHERE source_id = ?', [sourceId])
    })
  }

  /** Remove sources of `sourceType` that are no longer discovered on disk. */
  pruneMissingSources(sourceType: string, keepAbsPaths: ReadonlySet<string>): number {
    const rows = this.all<{ id: number; abs_path: string }>(
      'SELECT id, abs_path FROM sources WHERE source_type = ?',
      [sourceType],
    )
    const stale = rows.filter(row => !keepAbsPaths.has(row.abs_path))
    if (stale.length === 0) return 0
    this.transaction(() => {
      for (const row of stale) {
        // Delete chunks explicitly rather than relying on FK cascade, so the
        // FTS delete triggers are guaranteed to fire before the source row goes.
        this.run('DELETE FROM chunks WHERE source_id = ?', [row.id])
        this.run('DELETE FROM sources WHERE id = ?', [row.id])
      }
    })
    return stale.length
  }

  countSources(): number {
    const row = this.get<{ count: number }>('SELECT COUNT(*) AS count FROM sources')
    return Number(row?.count ?? 0)
  }

  countChunks(): number {
    const row = this.get<{ count: number }>('SELECT COUNT(*) AS count FROM chunks')
    return Number(row?.count ?? 0)
  }

  /** Drop every indexed row — the first step of a full rebuild. */
  clearAll(): void {
    this.transaction(() => {
      this.run('DELETE FROM chunks')
      this.run('DELETE FROM sources')
    })
  }

  /** Throws when the FTS index has drifted from the chunks table (test aid). */
  verifyFtsIntegrity(): void {
    this.db.exec("INSERT INTO chunks_fts(chunks_fts) VALUES('integrity-check')")
  }

  /**
   * Lexical recall. Returns only chunks that clear the relevance policy, best
   * first, with no duplicates — or an empty array.
   */
  recall(query: string, options: RecallOptions = {}): RecallResult[] {
    return this.recallWithDebug(query, options).results
  }

  recallWithDebug(query: string, options: RecallOptions = {}): { results: RecallResult[]; debug: RecallDebug } {
    const debug: RecallDebug = {
      terms: [], candidates: 0, rejectedByCoverage: 0, duplicates: 0,
    }
    if (!this.fts5 || this.closed) return { results: [], debug }

    const terms = tokenizeQuery(query)
    debug.terms = terms
    if (terms.length === 0) return { results: [], debug }

    // Every term is double-quoted so FTS5 treats it as a literal token — user
    // punctuation can style the expression but never break it.
    const match = terms.map(term => `"${term}"`).join(' OR ')

    const filters: string[] = []
    const params: SqlValue[] = [match]
    if (options.sourceTypes?.length) {
      filters.push(`c.source_type IN (${options.sourceTypes.map(() => '?').join(', ')})`)
      params.push(...options.sourceTypes)
    }
    if (options.sessionId) {
      filters.push('c.session_id = ?')
      params.push(options.sessionId)
    }
    if (options.pathPrefix) {
      filters.push("c.source_path LIKE ? ESCAPE '\\'")
      params.push(`${escapeLike(options.pathPrefix)}%`)
    }
    if (typeof options.since === 'number') {
      filters.push('c.source_ts >= ?')
      params.push(options.since)
    }
    const candidateLimit = options.candidateLimit ?? CANDIDATE_LIMIT
    params.push(candidateLimit)

    const where = filters.length ? `AND ${filters.join(' AND ')}` : ''
    const sql = `
      SELECT c.text, c.heading, c.title, c.description, c.session_id, c.source_type,
             c.source_path, c.source_ts, c.chunk_key, c.chunk_index,
             bm25(chunks_fts, ${BM25_WEIGHTS.join(', ')}) AS rank
      FROM chunks_fts
      JOIN chunks c ON c.id = chunks_fts.rowid
      WHERE chunks_fts MATCH ? ${where}
      ORDER BY rank ASC
      LIMIT ?`

    const rows = this.all<{
      text: string
      heading: string | null
      title: string | null
      description: string | null
      session_id: string | null
      source_type: string
      source_path: string
      source_ts: number | null
      chunk_key: string
      chunk_index: number
      rank: number
    }>(sql, params)

    debug.candidates = rows.length

    const required = requiredTermCoverage(terms.length)
    const seen = new Set<string>()
    const results: RecallResult[] = []

    for (const row of rows) {
      const haystack = [row.text, row.heading, row.title, row.description]
        .filter((value): value is string => typeof value === 'string')
        .join('\n')
        .toLowerCase()
      const matchedTerms = countMatchedTerms(haystack, terms)
      if (matchedTerms < required) {
        debug.rejectedByCoverage++
        continue
      }
      const score = -row.rank
      // Frontmatter-only chunks have empty text; they are distinguishable only
      // by title/path, so they are never treated as duplicates.
      const fingerprint = normalizeForDedupe(row.text)
      if (fingerprint) {
        if (seen.has(fingerprint)) {
          debug.duplicates++
          continue
        }
        seen.add(fingerprint)
      }
      results.push({
        text: row.text,
        heading: row.heading,
        title: row.title,
        description: row.description,
        sessionId: row.session_id,
        sourceType: row.source_type,
        sourcePath: row.source_path,
        sourceTimestamp: row.source_ts === null ? null : Number(row.source_ts),
        chunkKey: row.chunk_key,
        chunkIndex: Number(row.chunk_index),
        score,
        matchedTerms,
      })
    }

    return { results: results.slice(0, options.limit ?? DEFAULT_LIMIT), debug }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    try {
      // Checkpoint so the WAL content lands in the main database file rather
      // than outliving the handle as a sibling `-wal` file.
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch {
      /* checkpoint is best-effort */
    }
    // Finalize every cached statement before closing. bun:sqlite holds a file
    // lock for each statement that is never finalized, which leaves the
    // database (and its WAL/SHM sidecars) undeletable on Windows even after
    // close() — that breaks index removal and test teardown.
    for (const stmt of this.statements.values()) {
      try {
        stmt.finalize?.()
      } catch {
        /* statement already released */
      }
    }
    this.statements.clear()
    try {
      this.db.close()
    } catch {
      /* already closed */
    }
  }
}

function removeDbArtifacts(dbPath: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(`${dbPath}${suffix}`, { force: true })
    } catch {
      /* best-effort cleanup of a corrupt database */
    }
  }
}

function hasFts5(db: SqlDatabase): boolean {
  try {
    db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS __fts5_probe USING fts5(x)')
    db.exec('DROP TABLE IF EXISTS __fts5_probe')
    return true
  } catch {
    return false
  }
}

/**
 * Filesystem-safe journal setup. WAL is kept (readers don't block the indexer)
 * and every statement is finalized on close so the sidecars can still be
 * removed — see MemoryStore.close().
 */
function configureConnection(db: SqlDatabase): void {
  try {
    // A network filesystem may refuse WAL; the default journal is still
    // consistent, just less concurrent.
    withStatement(db, 'PRAGMA journal_mode = WAL', stmt => stmt.get())
  } catch {
    /* keep the default journal mode */
  }
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA synchronous = NORMAL')
}

function migrate(db: SqlDatabase): void {
  const row = withStatement(db, 'PRAGMA user_version', stmt => stmt.get()) as
    | { user_version?: number }
    | null
    | undefined
  const version = Number(row?.user_version ?? 0)
  if (version > SCHEMA_VERSION) {
    throw new MemoryIndexError(
      'schema_too_new',
      `memory index unavailable: ${'memory.db'} was written by a newer GakrCLI (schema v${version} > v${SCHEMA_VERSION}).`,
    )
  }
  if (version === SCHEMA_VERSION) return
  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec(SCHEMA_SQL)
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
    db.exec('COMMIT')
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw error
  }
}

function openStore(dbPath: string): MemoryStore {
  const directory = dirname(dbPath)
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true })

  const db = getRuntime().open(dbPath)
  try {
    configureConnection(db)

    if (!hasFts5(db)) {
      throw new MemoryIndexError(
        'fts5_unavailable',
        'memory index unavailable: this SQLite build has no FTS5 support, so BM25 lexical search cannot run. Indexing is disabled rather than pretending search works.',
      )
    }

    migrate(db)
    return new MemoryStore(dbPath, db, true)
  } catch (error) {
    try {
      db.close()
    } catch {
      /* ignore */
    }
    throw error
  }
}

/**
 * Open (creating if needed) the index database. Returns null when the index is
 * unusable; `getMemoryIndexDiagnostic()` then explains why. A corrupt or
 * unreadable database is deleted and recreated — it is a derived cache, and
 * rebuilding it is always safe.
 */
export function openMemoryStore(dbPath: string): MemoryStore | null {
  try {
    const store = openStore(dbPath)
    lastDiagnostic = null
    return store
  } catch (error) {
    if (error instanceof MemoryIndexError) {
      reportDiagnostic(error.message)
      return null
    }
    removeDbArtifacts(dbPath)
    try {
      const store = openStore(dbPath)
      lastDiagnostic = null
      return store
    } catch (retryError) {
      const message = retryError instanceof Error ? retryError.message : String(retryError)
      reportDiagnostic(`memory index unavailable: could not open ${dbPath}: ${message}`)
      return null
    }
  }
}
