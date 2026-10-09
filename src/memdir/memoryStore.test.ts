import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  SCHEMA_VERSION,
  getMemoryIndexDiagnostic,
  openMemoryStore,
  setSqliteRuntimeForTesting,
  type MemoryChunkInput,
  type MemorySourceRow,
  type MemoryStore,
  type SqliteRuntime,
} from './memoryStore.js'

function makeSource(
  relPath: string,
  overrides: Partial<MemorySourceRow> = {},
): MemorySourceRow {
  return {
    sourceType: 'memory_markdown',
    relPath,
    absPath: `/abs/${relPath}`,
    sessionId: null,
    contentHash: `hash-${relPath}`,
    sizeBytes: 10,
    mtimeNs: '1000',
    ctimeNs: '2000',
    title: null,
    description: null,
    sourceTs: null,
    ...overrides,
  }
}

function chunksOf(...texts: string[]): MemoryChunkInput[] {
  return texts.map((text, index) => ({ index, key: `c${index}`, text, heading: null }))
}

function readUserVersion(dbPath: string): number {
  const { Database } = require('bun:sqlite')
  const db = new Database(dbPath)
  const stmt = db.prepare('PRAGMA user_version')
  try {
    return Number((stmt.get() as { user_version?: number })?.user_version ?? 0)
  } finally {
    stmt.finalize?.()
    db.close()
  }
}

describe('memdir memoryStore', () => {
  let dir: string
  let dbPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'memory-store-'))
    dbPath = join(dir, 'memory.db')
  })

  afterEach(() => {
    setSqliteRuntimeForTesting(null)
    rmSync(dir, { recursive: true, force: true })
  })

  function open(): MemoryStore {
    const store = openMemoryStore(dbPath)
    if (!store) throw new Error(`store unavailable: ${getMemoryIndexDiagnostic()}`)
    return store
  }

  it('creates a versioned schema and reopens without re-applying it', () => {
    const first = open()
    first.upsertSource(makeSource('a.md'), chunksOf('alpha content'))
    first.close()

    expect(readUserVersion(dbPath)).toBe(SCHEMA_VERSION)

    const second = open()
    expect(second.countSources()).toBe(1)
    expect(second.countChunks()).toBe(1)
    second.close()
  })

  it('keeps the FTS index in sync across insert, update, and delete', () => {
    const store = open()

    store.upsertSource(makeSource('doc.md'), chunksOf('alpha uniquetoken'))
    expect(store.recall('uniquetoken')).toHaveLength(1)
    expect(() => store.verifyFtsIntegrity()).not.toThrow()

    // Update: the old text must stop matching and the new text must start.
    store.upsertSource(
      makeSource('doc.md', { contentHash: 'hash-2' }),
      chunksOf('alpha replacementtoken'),
    )
    expect(store.recall('uniquetoken')).toHaveLength(0)
    expect(store.recall('replacementtoken')).toHaveLength(1)
    expect(store.countChunks()).toBe(1)
    expect(() => store.verifyFtsIntegrity()).not.toThrow()

    // Delete via prune.
    expect(store.pruneMissingSources('memory_markdown', new Set())).toBe(1)
    expect(store.recall('replacementtoken')).toHaveLength(0)
    expect(store.countChunks()).toBe(0)
    expect(() => store.verifyFtsIntegrity()).not.toThrow()

    store.close()
  })

  it('ranks the chunk that matches more query terms first', () => {
    const store = open()
    store.upsertSource(makeSource('both.md'), chunksOf('alpha beta gamma'))
    store.upsertSource(makeSource('one.md'), chunksOf('alpha delta epsilon'))

    const results = store.recall('alpha beta')
    expect(results).toHaveLength(2)
    expect(results[0].sourcePath).toBe('both.md')
    expect(results[0].matchedTerms).toBe(2)
    expect(results[0].score).toBeGreaterThan(results[1].score)

    store.close()
  })

  it('returns nothing when no chunk matches, and for degenerate queries', () => {
    const store = open()
    store.upsertSource(makeSource('a.md'), chunksOf('alpha beta gamma'))

    expect(store.recall('purple monkey dishwasher')).toEqual([])
    expect(store.recall('')).toEqual([])
    expect(store.recall('   ')).toEqual([])
    expect(store.recall('!!! ???')).toEqual([])

    store.close()
  })

  it('treats FTS operators and punctuation in a query as literal text', () => {
    const store = open()
    store.upsertSource(makeSource('a.md'), chunksOf('quoted words inside'))

    // None of these may throw, and none may be interpreted as FTS syntax.
    expect(() => store.recall('"quoted" OR (words)*')).not.toThrow()
    expect(() => store.recall('NEAR(words, inside)')).not.toThrow()
    expect(() => store.recall('a AND b NOT c')).not.toThrow()
    expect(store.recall('"quoted" words')[0]?.sourcePath).toBe('a.md')

    store.close()
  })

  describe('relevance gate (query-term coverage)', () => {
    it('one-term query: matches any chunk containing the term', () => {
      const store = open()
      store.upsertSource(makeSource('a.md'), chunksOf('alpha beta gamma'))
      expect(store.recall('alpha')).toHaveLength(1)
      store.close()
    })

    it('one-term negative control: nothing when the term is absent', () => {
      const store = open()
      store.upsertSource(makeSource('a.md'), chunksOf('alpha beta gamma'))
      expect(store.recall('quokka')).toEqual([])
      expect(store.recall('Project')).toEqual([])
      store.close()
    })

    it('two-term query admits a single-term match (documented recall trade-off)', () => {
      const store = open()
      store.upsertSource(makeSource('a.md'), chunksOf('deploy credentials rotate weekly'))
      // One of two terms is enough here; requiring both would drop a memory that
      // is about the same topic as the prompt.
      expect(store.recall('deploy quantum')).toHaveLength(1)
      store.close()
    })

    it('longer query rejects a chunk matching only one term, including common words', () => {
      const store = open()
      store.upsertSource(makeSource('rules.md'), chunksOf('the project uses pnpm for installs'))
      // Four query terms, only "project" present -> rejected, not injected.
      expect(store.recall('project quantum teleportation protocol')).toEqual([])
      // Two of three present -> admitted.
      expect(store.recall('project pnpm installs')).toHaveLength(1)
      store.close()
    })

    it('quotes are literal words, not FTS phrase operators', () => {
      const store = open()
      store.upsertSource(makeSource('a.md'), chunksOf('alpha section\n\nbeta is far from alpha'))
      // A quoted phrase does not require adjacency: the terms still match
      // separately, so "beta alpha" matches this chunk.
      expect(store.recall('"beta alpha"')).toHaveLength(1)
      store.close()
    })

    it('honours a configurable candidate set and result limit', () => {
      const store = open()
      store.upsertSource(makeSource('a.md'), chunksOf('shared alpha token'))
      store.upsertSource(makeSource('b.md'), chunksOf('shared beta token'))
      expect(store.recall('shared')).toHaveLength(2)
      expect(store.recall('shared', { limit: 1 })).toHaveLength(1)
      expect(store.recallWithDebug('shared', { candidateLimit: 1 }).debug.candidates).toBe(1)
      store.close()
    })
  })

  it('deduplicates near-identical chunks', () => {
    const store = open()
    const shared = 'the same sentence repeated across two different memory files'
    store.upsertSource(makeSource('one.md'), chunksOf(shared))
    store.upsertSource(makeSource('two.md'), chunksOf(shared))

    const results = store.recall('sentence repeated')
    expect(results).toHaveLength(1)
    expect(results[0].sourcePath).toBe('one.md')

    store.close()
  })

  it('returns provenance: path, heading, session id, and source timestamp', () => {
    const store = open()
    store.upsertSource(
      makeSource('session-summary/sess-9/summary.md', {
        sourceType: 'session_summary',
        sessionId: 'sess-9',
        sourceTs: 12345,
      }),
      [{ index: 0, key: 'blockers#0', text: 'blocked on the deploy pipeline', heading: 'Blockers' }],
    )

    const [hit] = store.recall('deploy pipeline')
    expect(hit.sourcePath).toBe('session-summary/sess-9/summary.md')
    expect(hit.sourceType).toBe('session_summary')
    expect(hit.sessionId).toBe('sess-9')
    expect(hit.heading).toBe('Blockers')
    expect(hit.sourceTimestamp).toBe(12345)
    expect(hit.chunkKey).toBe('blockers#0')

    store.close()
  })

  it('filters by source type, session, path prefix, and time range', () => {
    const store = open()
    store.upsertSource(
      makeSource('memory/notes.md', { sourceTs: 1000 }),
      chunksOf('shared topic about alpha'),
    )
    store.upsertSource(
      makeSource('session-summary/s1/summary.md', {
        sourceType: 'session_summary',
        sessionId: 's1',
        sourceTs: 9000,
      }),
      chunksOf('shared topic about beta'),
    )

    expect(store.recall('shared topic')).toHaveLength(2)
    expect(store.recall('shared topic', { sourceTypes: ['memory_markdown'] })).toHaveLength(1)
    expect(store.recall('shared topic', { sessionId: 's1' })[0].sourcePath).toContain('s1')
    expect(store.recall('shared topic', { pathPrefix: 'session-summary/' })).toHaveLength(1)
    expect(store.recall('shared topic', { since: 5000 })).toHaveLength(1)
    expect(store.recall('shared topic', { since: 5000 })[0].sourceType).toBe('session_summary')
    expect(store.recall('shared topic', { sessionId: 'does-not-exist' })).toEqual([])

    store.close()
  })

  it('is atomic: a failed chunk insert leaves the previous chunks intact', () => {
    const store = open()
    store.upsertSource(makeSource('doc.md'), chunksOf('keep this text'))

    // Two chunks claiming the same (source_id, chunk_index) violate the UNIQUE
    // constraint partway through the write transaction.
    const duplicateIndex: MemoryChunkInput[] = [
      { index: 0, key: 'a', text: 'first', heading: null },
      { index: 0, key: 'b', text: 'second', heading: null },
    ]
    expect(() => store.upsertSource(makeSource('doc.md'), duplicateIndex)).toThrow()

    expect(store.countChunks()).toBe(1)
    expect(store.recall('keep this text')).toHaveLength(1)
    expect(store.recall('first second')).toHaveLength(0)
    expect(() => store.verifyFtsIntegrity()).not.toThrow()

    store.close()
  })

  it('drops a source\'s chunks and clears its hash when it is marked as errored', () => {
    const store = open()
    const source = makeSource('broken.md')
    store.upsertSource(source, chunksOf('served before the error'))

    store.markSourceError(source, 'EISDIR: illegal operation on a directory')

    expect(store.recall('served')).toHaveLength(0)
    expect(store.countSources()).toBe(1)
    const stats = store.listSourceStats('memory_markdown').get(source.absPath)
    expect(stats?.status).toBe('error')
    // An empty hash means a later successful read always re-indexes.
    expect(stats?.contentHash).toBe('')

    store.close()
  })

  it('recreates a corrupt database instead of failing forever', () => {
    writeFileSync(dbPath, 'this is not a sqlite database')

    const store = open()
    store.upsertSource(makeSource('a.md'), chunksOf('fresh content'))
    expect(store.recall('fresh content')).toHaveLength(1)
    store.close()
  })

  it('refuses a database written by a newer schema and explains why', () => {
    const store = open()
    store.upsertSource(makeSource('a.md'), chunksOf('alpha'))
    store.close()
    const { Database } = require('bun:sqlite')
    const raw = new Database(dbPath)
    raw.exec('PRAGMA user_version = 999')
    raw.close()

    expect(openMemoryStore(dbPath)).toBeNull()
    expect(getMemoryIndexDiagnostic()).toContain('newer GakrCLI')
    // The newer database is left untouched rather than silently downgraded.
    expect(existsSync(dbPath)).toBe(true)
  })

  it('reports a clear diagnostic when FTS5 is unavailable, and never claims BM25', () => {
    const fts5lessRuntime: SqliteRuntime = {
      open: () => ({
        exec(sql: string) {
          if (/fts5/i.test(sql)) throw new Error('no such module: fts5')
        },
        prepare() {
          throw new Error('no such module: fts5')
        },
        close() {},
      }),
    }
    setSqliteRuntimeForTesting(fts5lessRuntime)

    expect(openMemoryStore(dbPath)).toBeNull()
    expect(getMemoryIndexDiagnostic()).toContain('FTS5')
    expect(getMemoryIndexDiagnostic()).toContain('BM25')
  })
})
