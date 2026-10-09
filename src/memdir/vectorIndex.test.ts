import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
  utimesSync,
  statSync,
} from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import {
  clearAllIndices,
  discoverMemoryFiles,
  discoverSessionSummaries,
  ensureMemdirIndex,
  getIndexPath,
  getMemdirFingerprint,
  initMemdirIndex,
  rebuildIndex,
  searchMemdirIndex,
} from './vectorIndex.js'
import {
  getMemoryIndexDiagnostic,
  openMemoryStore,
  setSqliteRuntimeForTesting,
  type SqliteRuntime,
} from './memoryStore.js'
import { setGakrCLIConfigHomeDirForTesting } from '../utils/envUtils.js'
import { getCwdState, setCwdState, setOriginalCwd } from '../bootstrap/state.js'
import { sanitizePath } from '../utils/sessionStoragePortable.js'
import { acquireSharedMutationLock, releaseSharedMutationLock } from '../test/sharedMutationLock.js'

function writeMemFile(
  memDir: string,
  relPath: string,
  fields: { title?: string; name?: string; description?: string; body: string },
): string {
  const full = join(memDir, relPath)
  mkdirSync(dirname(full), { recursive: true })
  const frontmatter = [
    fields.title ? `title: ${fields.title}` : null,
    fields.name ? `name: ${fields.name}` : null,
    `type: reference`,
    fields.description ? `description: ${fields.description}` : null,
  ].filter((line): line is string => line !== null)
  writeFileSync(full, `---\n${frontmatter.join('\n')}\n---\n\n${fields.body}\n`, 'utf-8')
  return full
}

describe('memdir index (memory.db)', () => {
  let projectDir: string
  let memDir: string
  let projectCwd: string
  let configDir: string
  let previousCwd: string
  const originalConfigDir = process.env.GAKR_CONFIG_DIR

  beforeEach(async () => {
    await acquireSharedMutationLock('memdir/vectorIndex.test.ts')
    setSqliteRuntimeForTesting(null)
    clearAllIndices()
    projectDir = mkdtempSync(join(tmpdir(), 'memdir-index-'))
    memDir = join(projectDir, 'memory')
    mkdirSync(memDir, { recursive: true })
    projectCwd = mkdtempSync(join(tmpdir(), 'memdir-cwd-'))
    configDir = mkdtempSync(join(tmpdir(), 'memdir-config-'))
    process.env.GAKR_CONFIG_DIR = configDir
    setGakrCLIConfigHomeDirForTesting(configDir)
    // Session-summary discovery resolves `<projectDir>/<sessionId>/session-memory`
    // from the session cwd (utils/cwd.ts, same source as getSessionMemoryDir),
    // so point the cwd at a temp dir to keep the real config home untouched.
    previousCwd = getCwdState()
    setCwdState(projectCwd)
    setOriginalCwd(projectCwd)
  })

  afterEach(() => {
    try {
      setSqliteRuntimeForTesting(null)
      clearAllIndices()
      if (originalConfigDir === undefined) delete process.env.GAKR_CONFIG_DIR
      else process.env.GAKR_CONFIG_DIR = originalConfigDir
      setGakrCLIConfigHomeDirForTesting(undefined)
      if (previousCwd !== undefined) {
        setCwdState(previousCwd)
        setOriginalCwd(previousCwd)
      }
      for (const dir of [projectDir, projectCwd, configDir]) {
        rmSync(dir, { recursive: true, force: true })
      }
    } finally {
      releaseSharedMutationLock()
    }
  })

  function sessionSummaryPath(sessionId: string): string {
    return join(
      configDir,
      'workspace',
      'projects',
      sanitizePath(projectCwd),
      sessionId,
      'session-memory',
      'summary.md',
    )
  }

  function writeSessionSummary(sessionId: string, body: string): void {
    const full = sessionSummaryPath(sessionId)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body, 'utf-8')
  }

  describe('discovery and indexing', () => {
    it('builds the index from memory files and searches by body text', async () => {
      writeMemFile(memDir, 'reference-pg.md', {
        title: 'PostgreSQL Config',
        description: 'DB setup',
        body: 'Database runs on port 5432',
      })
      writeMemFile(memDir, 'user-role.md', {
        title: 'Data Scientist',
        description: 'Role info',
        body: 'User is a data scientist',
      })

      await initMemdirIndex(memDir)

      const results = await searchMemdirIndex('database port', memDir)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].title).toBe('PostgreSQL Config')
      expect(results[0].path).toBe('reference-pg.md')
    })

    it('finds nothing on an empty memory dir', async () => {
      await initMemdirIndex(memDir)
      expect(await searchMemdirIndex('anything', memDir)).toHaveLength(0)
    })

    it('searches by description', async () => {
      writeMemFile(memDir, 'feedback-test.md', {
        title: 'Testing approach',
        description: 'prefer integration tests',
        body: 'Always use a real database',
      })
      await initMemdirIndex(memDir)

      const results = await searchMemdirIndex('integration', memDir)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].description).toContain('integration')
    })

    it('falls back to the frontmatter name when there is no title', async () => {
      writeMemFile(memDir, 'project-web-browser-tool.md', {
        name: 'WebBrowserTool architecture',
        description: 'engine dispatch port',
        body: 'The engine dispatches actions to server methods.',
      })
      await initMemdirIndex(memDir)

      const [hit] = await searchMemdirIndex('engine dispatch', memDir)
      expect(hit.title).toBe('WebBrowserTool architecture')
    })

    it('indexes nested directories and .facts but not MEMORY.md or dotfiles', async () => {
      writeMemFile(memDir, 'nested/deep/topic.md', {
        title: 'Nested',
        description: 'nested note',
        body: 'nesteddistincttoken',
      })
      writeMemFile(memDir, '.facts/fact-rule.md', {
        title: 'Rule',
        description: 'rule note',
        body: 'factstoken',
      })
      writeMemFile(memDir, 'MEMORY.md', { title: 'Index', description: 'entrypoint', body: 'memoryindextoken' })
      writeMemFile(memDir, '.hidden/secret.md', { title: 'Hidden', description: 'hidden', body: 'hiddentoken' })

      const discovered = discoverMemoryFiles(memDir).map(f => f.fullPath)
      expect(discovered.some(p => p.endsWith(join('nested', 'deep', 'topic.md')))).toBe(true)
      expect(discovered.some(p => p.endsWith(join('.facts', 'fact-rule.md')))).toBe(true)
      expect(discovered.some(p => p.endsWith('MEMORY.md'))).toBe(false)
      expect(discovered.some(p => p.includes('.hidden'))).toBe(false)

      await initMemdirIndex(memDir)
      expect((await searchMemdirIndex('nesteddistincttoken', memDir)).length).toBe(1)
      expect((await searchMemdirIndex('factstoken', memDir)).length).toBe(1)
      expect(await searchMemdirIndex('memoryindextoken', memDir)).toHaveLength(0)
      expect(await searchMemdirIndex('hiddentoken', memDir)).toHaveLength(0)
    })

    it('does not index a frontmatter-only file on body text but keeps its headline searchable', async () => {
      writeFileSync(
        join(memDir, 'stub.md'),
        '---\ntitle: Stub Headline\ndescription: stubdescriptiontoken\n---\n',
        'utf-8',
      )
      await initMemdirIndex(memDir)

      const results = await searchMemdirIndex('stubdescriptiontoken', memDir)
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Stub Headline')
      expect(results[0].content).toBe('')
    })
  })

  describe('symlink boundary', () => {
    it('does not follow symlinked directories', async () => {
      const outsideDir = mkdtempSync(join(tmpdir(), 'memdir-outside-'))
      try {
        writeFileSync(
          join(outsideDir, 'secret.md'),
          '---\ntitle: Outside Secret\ntype: reference\ndescription: Outside content\n---\n\nUNIQUE_OUTSIDE_TRIGGER_TOKEN',
          'utf-8',
        )
        try {
          symlinkSync(outsideDir, join(memDir, 'linked'), 'dir')
        } catch {
          return // symlinks unavailable on this platform
        }
        writeMemFile(memDir, 'legit.md', { title: 'Legit', description: 'inside', body: 'insidecontenttoken' })

        await initMemdirIndex(memDir)

        expect(await searchMemdirIndex('UNIQUE_OUTSIDE_TRIGGER_TOKEN', memDir)).toHaveLength(0)
        expect((await searchMemdirIndex('insidecontenttoken', memDir)).length).toBe(1)
      } finally {
        rmSync(outsideDir, { recursive: true, force: true })
      }
    })

    it('skips symlinked files', async () => {
      const outsideDir = mkdtempSync(join(tmpdir(), 'memdir-outside-file-'))
      try {
        const outsideFile = join(outsideDir, 'outside.md')
        writeFileSync(
          outsideFile,
          '---\ntitle: Outside File\ntype: reference\ndescription: Outside file\n---\n\nOUTSIDE_FILE_CONTENT',
          'utf-8',
        )
        try {
          symlinkSync(outsideFile, join(memDir, 'outside.md'), 'file')
        } catch {
          return
        }
        writeMemFile(memDir, 'legit.md', { title: 'Legit', description: 'inside', body: 'insidecontenttoken' })

        await initMemdirIndex(memDir)

        expect(await searchMemdirIndex('OUTSIDE_FILE_CONTENT', memDir)).toHaveLength(0)
        expect((await searchMemdirIndex('insidecontenttoken', memDir)).length).toBe(1)
      } finally {
        rmSync(outsideDir, { recursive: true, force: true })
      }
    })

    it('skips a symlinked markdown path whose target is a directory', async () => {
      const outsideDir = mkdtempSync(join(tmpdir(), 'memdir-outside-dir-link-'))
      try {
        writeFileSync(
          join(outsideDir, 'inside.md'),
          '---\ntitle: Inside Dir Link\ntype: reference\ndescription: Inside link\n---\n\nDIR_LINK_CONTENT',
          'utf-8',
        )
        try {
          symlinkSync(outsideDir, join(memDir, 'linked-dir.md'), 'dir')
        } catch {
          return
        }
        await initMemdirIndex(memDir)
        expect(await searchMemdirIndex('DIR_LINK_CONTENT', memDir)).toHaveLength(0)
      } finally {
        rmSync(outsideDir, { recursive: true, force: true })
      }
    })
  })

  describe('incremental updates', () => {
    it('does not re-scan a stable corpus', async () => {
      writeMemFile(memDir, 'a.md', { title: 'A', description: 'first', body: 'alphatoken' })
      const first = ensureMemdirIndex(memDir)
      expect(first).toMatchObject({ indexed: 1, skipped: 0, removed: 0, errors: 0 })

      // Nothing changed, so the fingerprint short-circuits the whole pass.
      const second = ensureMemdirIndex(memDir)
      expect(second).toMatchObject({ indexed: 0, skipped: 0, removed: 0, errors: 0 })
    })

    it('skips an unchanged file whose mtime changed, without rewriting its chunks', async () => {
      const file = writeMemFile(memDir, 'a.md', { title: 'A', description: 'first', body: 'alphatoken' })
      expect(ensureMemdirIndex(memDir).indexed).toBe(1)

      const future = new Date(Date.now() + 5000)
      utimesSync(file, future, future)

      const stats = ensureMemdirIndex(memDir)
      expect(stats.indexed).toBe(0)
      expect(stats.skipped).toBe(1)
      expect(await searchMemdirIndex('alphatoken', memDir)).toHaveLength(1)
    })

    it('picks up a newly added file on the next search', async () => {
      writeMemFile(memDir, 'v1.md', { title: 'V1 Project', description: 'initial', body: 'version one project' })
      await initMemdirIndex(memDir)
      expect((await searchMemdirIndex('version one', memDir)).length).toBeGreaterThan(0)

      writeMemFile(memDir, 'v2.md', { title: 'V2 Project', description: 'new', body: 'version two project' })
      const results = await searchMemdirIndex('version two', memDir)
      expect(results.some(r => r.title === 'V2 Project')).toBe(true)
    })

    it('picks up an edited file and drops the old text', async () => {
      writeMemFile(memDir, 'config.md', { title: 'Config', description: 'db config', body: 'Using MySQL' })
      await initMemdirIndex(memDir)
      expect((await searchMemdirIndex('MySQL', memDir)).length).toBeGreaterThan(0)

      writeMemFile(memDir, 'config.md', { title: 'Config', description: 'db config', body: 'Using PostgreSQL' })
      expect((await searchMemdirIndex('PostgreSQL', memDir)).length).toBeGreaterThan(0)
      const stale = await searchMemdirIndex('MySQL', memDir)
      expect(stale.some(r => r.content.includes('MySQL'))).toBe(false)
    })

    it('detects an equal-size edit whose mtime was restored', async () => {
      const file = writeMemFile(memDir, 'deploy.md', {
        title: 'Deployment',
        description: 'deploy steps',
        body: 'Deploy with oldword on port 5000',
      })
      await initMemdirIndex(memDir)
      expect((await searchMemdirIndex('oldword', memDir)).length).toBeGreaterThan(0)

      const originalMtime = statSync(file).mtime
      writeMemFile(memDir, 'deploy.md', {
        title: 'Deployment',
        description: 'deploy steps',
        body: 'Deploy with newword on port 5000',
      })
      utimesSync(file, originalMtime, originalMtime)

      const fresh = await searchMemdirIndex('newword', memDir)
      expect(fresh.some(r => r.content.includes('newword'))).toBe(true)
      expect((await searchMemdirIndex('oldword', memDir)).some(r => r.content.includes('oldword'))).toBe(false)
    })

    it('removes entries for deleted files', async () => {
      writeMemFile(memDir, 'keep.md', { title: 'Keep', description: 'kept file', body: 'keptcontent' })
      writeMemFile(memDir, 'remove.md', { title: 'Remove', description: 'removed file', body: 'removedcontent' })
      await initMemdirIndex(memDir)
      expect((await searchMemdirIndex('keptcontent', memDir)).length).toBe(1)

      rmSync(join(memDir, 'remove.md'))
      const stats = ensureMemdirIndex(memDir)
      expect(stats.removed).toBe(1)
      expect(await searchMemdirIndex('removedcontent', memDir)).toHaveLength(0)
      expect((await searchMemdirIndex('keptcontent', memDir)).length).toBe(1)
    })

    it('moves an entry to its new path when a file is renamed', async () => {
      writeMemFile(memDir, 'old-name.md', { title: 'Renamable', description: 'trace', body: 'renametoken' })
      await initMemdirIndex(memDir)
      expect((await searchMemdirIndex('renametoken', memDir))[0].path).toBe('old-name.md')

      // Same content, new filename: a rename looks like add + remove.
      writeMemFile(memDir, 'new-name.md', { title: 'Renamable', description: 'trace', body: 'renametoken' })
      rmSync(join(memDir, 'old-name.md'))

      const stats = ensureMemdirIndex(memDir)
      expect(stats.removed).toBe(1)
      expect(stats.indexed).toBe(1)
      const hits = await searchMemdirIndex('renametoken', memDir)
      expect(hits).toHaveLength(1)
      expect(hits[0].path).toBe('new-name.md')
    })

    it('supports a full rebuild', async () => {
      writeMemFile(memDir, 'a.md', { title: 'A', description: 'a', body: 'alphatoken' })
      writeMemFile(memDir, 'b.md', { title: 'B', description: 'b', body: 'betatoken' })
      await initMemdirIndex(memDir)

      await rebuildIndex(memDir)
      const stats = ensureMemdirIndex(memDir, true)
      expect(stats.indexed).toBe(2)
      expect(stats.removed).toBe(0)
      const store = openMemoryStore(getIndexPath(memDir))!
      expect(store.countChunks()).toBe(2)
      expect(() => store.verifyFtsIntegrity()).not.toThrow()
      store.close()

      expect((await searchMemdirIndex('alphatoken', memDir)).length).toBe(1)
    })
  })

  describe('session summaries', () => {
    it('discovers every session summary and associates its session id', async () => {
      writeSessionSummary('session-aaa', 'Worked on the deploy pipeline and blocked on credentials.')
      writeSessionSummary('session-bbb', 'Refactored the vector index into a SQLite store.')

      const discovered = discoverSessionSummaries()
      expect(discovered.map(s => s.sessionId).sort()).toEqual(['session-aaa', 'session-bbb'])
      expect(discovered[0].sourceType).toBe('session_summary')

      await initMemdirIndex(memDir)
      const [hit] = await searchMemdirIndex('deploy pipeline credentials', memDir)
      expect(hit.sessionId).toBe('session-aaa')
      expect(hit.sourceType).toBe('session_summary')
      expect(hit.path).toBe(join('session-summary', 'session-aaa', 'summary.md'))
      expect(hit.timestamp).toBeGreaterThan(0)
    })

    it('indexes memory files and session summaries side by side', async () => {
      writeMemFile(memDir, 'topic.md', { title: 'Topic', description: 'topic', body: 'projectmemorytoken' })
      writeSessionSummary('session-ccc', 'Session note about projectmemorytoken too.')

      await initMemdirIndex(memDir)
      const hits = await searchMemdirIndex('projectmemorytoken', memDir)
      expect(hits.map(h => h.sourceType).sort()).toEqual(['memory_markdown', 'session_summary'])
    })

    it('records an unreadable session summary as an error without stopping the run', async () => {
      writeMemFile(memDir, 'topic.md', { title: 'Topic', description: 'topic', body: 'survivestoken' })
      // A directory where summary.md is expected: discovery finds it, reading it throws.
      mkdirSync(sessionSummaryPath('session-broken'), { recursive: true })

      const stats = ensureMemdirIndex(memDir)
      expect(stats.errors).toBe(1)
      expect(stats.indexed).toBe(1)
      expect((await searchMemdirIndex('survivestoken', memDir)).length).toBe(1)

      const store = openMemoryStore(getIndexPath(memDir))!
      const sessionStats = store.listSourceStats('session_summary')
      expect(sessionStats.size).toBe(1)
      expect([...sessionStats.values()][0].status).toBe('error')
      store.close()
    })
  })

  describe('index placement and isolation', () => {
    it('keeps memory.db beside the memory dir', () => {
      expect(getIndexPath(memDir)).toBe(join(projectDir, 'memory.db'))
      expect(existsSync(getIndexPath(memDir))).toBe(false)
      ensureMemdirIndex(memDir)
      expect(existsSync(getIndexPath(memDir))).toBe(true)
    })

    it('maintains separate index state for each memory directory', async () => {
      const otherProject = mkdtempSync(join(tmpdir(), 'memdir-index-2-'))
      const otherMem = join(otherProject, 'memory')
      mkdirSync(otherMem, { recursive: true })
      try {
        writeMemFile(memDir, 'dog.md', { title: 'Dog', description: 'dog info', body: 'Dogs are mammals' })
        writeMemFile(otherMem, 'cat.md', { title: 'Cat', description: 'cat info', body: 'Cats are mammals' })

        await initMemdirIndex(memDir)
        await initMemdirIndex(otherMem)

        const dogs = await searchMemdirIndex('dog mammal', memDir)
        expect(dogs.some(r => r.title === 'Dog')).toBe(true)
        expect(dogs.every(r => r.title !== 'Cat')).toBe(true)

        const cats = await searchMemdirIndex('cat mammal', otherMem)
        expect(cats.some(r => r.title === 'Cat')).toBe(true)
        expect(await searchMemdirIndex('cat mammal', memDir)).toHaveLength(0)
        expect(await searchMemdirIndex('dog mammal', otherMem)).toHaveLength(0)
      } finally {
        clearAllIndices()
        rmSync(otherProject, { recursive: true, force: true })
      }
    })

    it('returns no results, not junk, when the index is unavailable', async () => {
      writeMemFile(memDir, 'a.md', { title: 'A', description: 'a', body: 'alphatoken' })
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

      const stats = ensureMemdirIndex(memDir)
      expect(stats).toMatchObject({ indexed: 0, skipped: 0 })
      expect(await searchMemdirIndex('alphatoken', memDir)).toEqual([])
      expect(getMemoryIndexDiagnostic()).toContain('FTS5')
    })
  })

  it('changes the fingerprint when the corpus changes', () => {
    writeMemFile(memDir, 'a.md', { title: 'A', description: 'a', body: 'one' })
    const before = getMemdirFingerprint(memDir)
    writeMemFile(memDir, 'b.md', { title: 'B', description: 'b', body: 'two' })
    expect(getMemdirFingerprint(memDir)).not.toBe(before)
  })
})
