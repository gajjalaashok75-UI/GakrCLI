/**
 * Memdir lexical index — discovery, incremental indexing, and search.
 *
 * The index lives in a `memory.db` SQLite database (see ./memoryStore.ts) that
 * sits beside the memory directory. Markdown files under `memory/` and every
 * session's `session-memory/summary.md` are the sources of truth; the database
 * is a derived cache and can be deleted and rebuilt at any time.
 *
 * Change detection is per file: the file is read and hashed, and the stored
 * hash decides whether its chunks are rewritten. A stat-only corpus fingerprint
 * short-circuits the whole indexing pass while the corpus is unchanged, so the
 * common case (many model requests within one turn) costs a few stat calls
 * rather than a re-index.
 */

import { createHash } from 'crypto'
import { readFileSync, existsSync, readdirSync, statSync, Dirent } from 'fs'
import { join, relative, basename } from 'path'
import { parseFrontmatter } from '../utils/frontmatterParser.js'
import { getCwd } from '../utils/cwd.js'
import { getProjectDir } from '../utils/sessionStoragePortable.js'
import { logForDebugging } from '../utils/debug.js'
import { chunkMarkdown, type MemoryChunk } from './memoryChunk.js'
import {
  getMemoryIndexDiagnostic,
  openMemoryStore,
  type MemoryStore,
  type StoredSourceStats,
} from './memoryStore.js'
import { getMemoryDbPathForDir } from './paths.js'

export const SOURCE_TYPE_MEMORY = 'memory_markdown'
export const SOURCE_TYPE_SESSION_SUMMARY = 'session_summary'

const MAX_MEMORY_DEPTH = 4
const MAX_SESSION_SUMMARIES = 200

interface DiscoveredFile {
  fullPath: string
  sizeBytes: number
  mtimeNs: string
  ctimeNs: string
  /** Modification time in epoch ms — the source timestamp recorded on chunks. */
  mtimeMs: number
}

interface DiscoveredSource extends DiscoveredFile {
  sourceType: string
  /** Path shown in retrieval results; never an absolute home-dir path. */
  relPath: string
  sessionId: string | null
}

export interface MemdirIndexStats {
  indexed: number
  skipped: number
  removed: number
  errors: number
}

const EMPTY_STATS: MemdirIndexStats = { indexed: 0, skipped: 0, removed: 0, errors: 0 }

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function statFile(fullPath: string): DiscoveredFile | null {
  try {
    const st = statSync(fullPath, { bigint: true })
    return {
      fullPath,
      sizeBytes: Number(st.size),
      mtimeNs: st.mtimeNs.toString(),
      ctimeNs: st.ctimeNs.toString(),
      mtimeMs: Number(st.mtimeMs),
    }
  } catch {
    return null
  }
}

/**
 * Collect indexable markdown files under `memory/`. Symlinked entries are
 * skipped — a symlink could point outside the memory root and leak content.
 * `MEMORY.md` is the index entrypoint, not content, so it is excluded.
 */
export function discoverMemoryFiles(memoryDir: string): DiscoveredFile[] {
  const files: DiscoveredFile[] = []

  function walk(dir: string, depth: number) {
    if (depth > MAX_MEMORY_DEPTH) return
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    // Deterministic traversal order.
    entries.sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isSymbolicLink()) continue

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') || entry.name === '.facts') {
          walk(fullPath, depth + 1)
        }
        continue
      }
      if (!entry.name.endsWith('.md') || entry.name === 'MEMORY.md' || entry.name.startsWith('.')) {
        continue
      }
      const info = statFile(fullPath)
      if (info) files.push(info)
    }
  }

  walk(memoryDir, 0)
  return files.sort((a, b) => a.fullPath.localeCompare(b.fullPath))
}

/**
 * Every session summary belonging to the current project, newest first. The
 * session id is taken from the authoritative directory name
 * (`<projectDir>/<sessionId>/session-memory/summary.md`), never guessed from
 * file contents.
 */
export function discoverSessionSummaries(): DiscoveredSource[] {
  let projectDir: string
  try {
    projectDir = getProjectDir(getCwd())
  } catch {
    return []
  }

  let sessionIds: string[]
  try {
    sessionIds = readdirSync(projectDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && !entry.name.startsWith('.'))
      .map(entry => entry.name)
  } catch {
    return []
  }

  const found: DiscoveredSource[] = []
  for (const sessionId of sessionIds) {
    const fullPath = join(projectDir, sessionId, 'session-memory', 'summary.md')
    if (!existsSync(fullPath)) continue
    const info = statFile(fullPath)
    if (!info) continue
    found.push({
      ...info,
      sourceType: SOURCE_TYPE_SESSION_SUMMARY,
      relPath: join('session-summary', sessionId, 'summary.md'),
      sessionId,
    })
  }

  // Newest first, then bounded so a long-lived project can't flood the index.
  found.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return found.slice(0, MAX_SESSION_SUMMARIES)
}

function discoverAllSources(memoryDir: string): DiscoveredSource[] {
  const memory = discoverMemoryFiles(memoryDir).map<DiscoveredSource>(file => ({
    ...file,
    sourceType: SOURCE_TYPE_MEMORY,
    relPath: relative(memoryDir, file.fullPath),
    sessionId: null,
  }))
  return [...memory, ...discoverSessionSummaries()]
}

/**
 * Stat-only fingerprint of the whole corpus (memory files + session
 * summaries). Never reads file bodies, so it is the cheap "did anything change"
 * signal used to skip the indexing pass entirely.
 */
export function getMemdirFingerprint(memoryDir: string): string {
  const hash = createHash('sha256')
  for (const source of discoverAllSources(memoryDir)) {
    hash.update(
      `${source.fullPath}\0${source.sizeBytes}\0${source.mtimeNs}\0${source.ctimeNs}\0${source.sessionId ?? ''}\0`,
    )
  }
  return hash.digest('hex')
}

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------

interface DirState {
  lastFingerprint: string | null
}

const states = new Map<string, DirState>()
const stores = new Map<string, MemoryStore>()
let unavailableDiagnosticLogged = false

function getState(memoryDir: string): DirState {
  let state = states.get(memoryDir)
  if (!state) {
    state = { lastFingerprint: null }
    states.set(memoryDir, state)
  }
  return state
}

function getStore(memoryDir: string): MemoryStore | null {
  const dbPath = getMemoryDbPathForDir(memoryDir)
  const existing = stores.get(dbPath)
  if (existing) return existing
  const store = openMemoryStore(dbPath)
  if (!store) return null
  stores.set(dbPath, store)
  return store
}

function reportUnavailable(): void {
  if (unavailableDiagnosticLogged) return
  unavailableDiagnosticLogged = true
  const diagnostic = getMemoryIndexDiagnostic()
  if (diagnostic) {
    // Never logs memory text — the diagnostic describes the index, not content.
    logForDebugging(`[memdir] ${diagnostic}`, { level: 'warn' })
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** One-line byte size for debug logs (never logs content). */
function chunksNote(raw: string): string {
  return `${raw.length} bytes`
}

function frontmatterString(frontmatter: Record<string, unknown> | undefined, key: string): string | null {
  const value = frontmatter?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function firstHeading(body: string): string | null {
  for (const line of body.split('\n')) {
    const match = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (match) return match[1].trim() || null
    if (line.trim()) return null
  }
  return null
}

function indexOne(
  store: MemoryStore,
  source: DiscoveredSource,
  known: Map<string, StoredSourceStats>,
  force: boolean,
  stats: MemdirIndexStats,
): void {
  let raw: string
  try {
    raw = readFileSync(source.fullPath, 'utf-8')
  } catch (error) {
    // One unreadable file must not stop the run; record it and move on.
    stats.errors++
    logForDebugging(`[memdir] index error (unreadable): ${source.relPath}: ${errorMessage(error)}`, { level: 'warn' })
    store.markSourceError({ ...source, absPath: source.fullPath }, errorMessage(error))
    return
  }

  const contentHash = createHash('sha256').update(raw).digest('hex')
  const previous = known.get(source.fullPath)
  if (!force && previous?.status === 'ok' && previous.contentHash === contentHash) {
    stats.skipped++
    return
  }
  const changed = Boolean(previous) || force
  logForDebugging(`[memdir] indexing (${previous ? 'changed' : force ? 'forced' : 'new'}): ${source.relPath} (${chunksNote(raw)})`)

  try {
    const parsed = parseFrontmatter(raw)
    const frontmatter = parsed?.frontmatter as Record<string, unknown> | undefined
    const body = parsed?.content ?? ''
    const isSessionSummary = source.sourceType === SOURCE_TYPE_SESSION_SUMMARY

    const title = isSessionSummary
      ? frontmatterString(frontmatter, 'title') ??
        frontmatterString(frontmatter, 'name') ??
        firstHeading(body) ??
        `Session summary ${source.sessionId?.slice(0, 8) ?? ''}`.trim()
      : frontmatterString(frontmatter, 'title') ??
        frontmatterString(frontmatter, 'name') ??
        basename(source.fullPath).replace(/\.md$/, '')
    const description = frontmatterString(frontmatter, 'description') ?? ''

    let chunks: MemoryChunk[] = chunkMarkdown(body)
    if (chunks.length === 0 && (title || description)) {
      // Frontmatter-only file: keep the headline/description searchable without
      // inventing body text. (An empty `text` renders no excerpt.)
      chunks = [{ index: 0, key: 'frontmatter#0', text: '', heading: null }]
    }

    store.upsertSource(
      {
        sourceType: source.sourceType,
        relPath: source.relPath,
        absPath: source.fullPath,
        sessionId: source.sessionId,
        contentHash,
        sizeBytes: source.sizeBytes,
        mtimeNs: source.mtimeNs,
        ctimeNs: source.ctimeNs,
        title,
        description,
        sourceTs: source.mtimeMs,
      },
      chunks,
    )
    stats.indexed++
    logForDebugging(`[memdir] indexed: ${source.relPath}`)
  } catch (error) {
    stats.errors++
    logForDebugging(`[memdir] index error: ${source.relPath}: ${errorMessage(error)}`, { level: 'warn' })
    store.markSourceError({ ...source, absPath: source.fullPath }, errorMessage(error))
  }
}

/**
 * Bring the index in line with the corpus, then return what changed in THIS
 * call. An unchanged corpus fingerprint skips the pass entirely (no work, so
 * all counters stay 0); `force` drops every row first (full rebuild).
 */
export function ensureMemdirIndex(memoryDir: string, force = false): MemdirIndexStats {
  const state = getState(memoryDir)
  const fingerprint = getMemdirFingerprint(memoryDir)
  if (!force && state.lastFingerprint === fingerprint) return EMPTY_STATS

  const store = getStore(memoryDir)
  if (!store) {
    reportUnavailable()
    state.lastFingerprint = fingerprint
    return EMPTY_STATS
  }

  if (force) store.clearAll()

  const stats: MemdirIndexStats = { ...EMPTY_STATS }
  const memorySources = discoverMemoryFiles(memoryDir).map<DiscoveredSource>(file => ({
    ...file,
    sourceType: SOURCE_TYPE_MEMORY,
    relPath: relative(memoryDir, file.fullPath),
    sessionId: null,
  }))
  const memoryKnown = store.listSourceStats(SOURCE_TYPE_MEMORY)
  for (const source of memorySources) {
    indexOne(store, source, memoryKnown, force, stats)
  }
  stats.removed += store.pruneMissingSources(
    SOURCE_TYPE_MEMORY,
    new Set(memorySources.map(source => source.fullPath)),
  )

  const sessionSources = discoverSessionSummaries()
  const sessionKnown = store.listSourceStats(SOURCE_TYPE_SESSION_SUMMARY)
  for (const source of sessionSources) {
    indexOne(store, source, sessionKnown, force, stats)
  }
  stats.removed += store.pruneMissingSources(
    SOURCE_TYPE_SESSION_SUMMARY,
    new Set(sessionSources.map(source => source.fullPath)),
  )

  state.lastFingerprint = getMemdirFingerprint(memoryDir)
  logForDebugging(
    `[memdir] index pass done (${force ? 'forced' : 'corpus changed'}): indexed=${stats.indexed}` +
      ` skipped=${stats.skipped} removed=${stats.removed} errors=${stats.errors}`,
  )
  return stats
}

// ---------------------------------------------------------------------------
// Public API (kept stable for callers and tests)
// ---------------------------------------------------------------------------

/** Path of the persistent index database for a memory directory. */
export function getIndexPath(memoryDir: string): string {
  return getMemoryDbPathForDir(memoryDir)
}

export async function initMemdirIndex(memoryDir: string): Promise<void> {
  ensureMemdirIndex(memoryDir, false)
}

export async function rebuildIndex(memoryDir: string): Promise<void> {
  ensureMemdirIndex(memoryDir, true)
}

export interface MemdirSearchHit {
  /** Display path: relative for memory files, `session-summary/<id>/summary.md`. */
  path: string
  title: string
  description: string
  /** The chunk text (may be empty for a frontmatter-only file). */
  content: string
  heading: string | null
  sessionId: string | null
  sourceType: string
  timestamp: number | null
  /** Higher is better (`-bm25`). */
  score: number
  matchedTerms: number
}

export async function searchMemdirIndex(
  query: string,
  memoryDir: string,
  limit = 10,
): Promise<MemdirSearchHit[]> {
  ensureMemdirIndex(memoryDir, false)
  const store = getStore(memoryDir)
  if (!store) return []

  try {
    const { results, debug } = store.recallWithDebug(query, { limit })
    logForDebugging(
      `[memdir] search: ${debug.terms.length} term(s), candidates=${debug.candidates}` +
        ` rejectedByCoverage=${debug.rejectedByCoverage} duplicates=${debug.duplicates}` +
        ` → ${results.length} result(s)` +
        (results.length > 0
          ? ` topScore=${results[0]!.score.toFixed(2)}`
          : ''),
    )
    return results.map(result => ({
      path: result.sourcePath,
      title: result.title ?? '',
      description: result.description ?? '',
      content: result.text,
      heading: result.heading,
      sessionId: result.sessionId,
      sourceType: result.sourceType,
      timestamp: result.sourceTimestamp,
      score: result.score,
      matchedTerms: result.matchedTerms,
    }))
  } catch (error) {
    logForDebugging(`[memdir] memory search failed: ${errorMessage(error)}`, { level: 'warn' })
    return []
  }
}

/** Close and forget the index for one memory directory. */
export function clearIndex(memoryDir: string): void {
  const dbPath = getMemoryDbPathForDir(memoryDir)
  stores.get(dbPath)?.close()
  stores.delete(dbPath)
  states.delete(memoryDir)
}

export function clearAllIndices(): void {
  for (const store of stores.values()) store.close()
  stores.clear()
  states.clear()
  unavailableDiagnosticLogged = false
}
