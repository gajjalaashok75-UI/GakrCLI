import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { MemoryRecallTool } from './MemoryRecallTool.js'
import { getAutoMemPath } from '../../memdir/paths.js'
import { setGakrCLIConfigHomeDirForTesting } from '../../utils/envUtils.js'
import { getCwdState, setCwdState, setOriginalCwd } from '../../bootstrap/state.js'
import { sanitizePath } from '../../utils/sessionStoragePortable.js'
import { clearAllIndices } from '../../memdir/vectorIndex.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

function seedMemoryFile(
  dir: string,
  name: string,
  description: string,
  body: string,
): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, name),
    `---\ntitle: ${name.replace(/\.md$/, '')}\ntype: project\ndescription: "${description}"\n---\n\n${body}\n`,
  )
}

function writeSessionSummaryFile(
  configDir: string,
  cwdDir: string,
  sessionId: string,
  body: string,
): void {
  const summaryPath = join(
    configDir,
    'workspace',
    'projects',
    sanitizePath(cwdDir),
    sessionId,
    'session-memory',
    'summary.md',
  )
  mkdirSync(dirname(summaryPath), { recursive: true })
  writeFileSync(summaryPath, body)
}

describe('memory_recall tool', () => {
  let configDir: string | undefined
  let cwdDir: string | undefined
  let previousCwd: string
  const originalConfigDir = process.env.GAKR_CONFIG_DIR
  const originalDisableAutoMemory = process.env.GAKR_CODE_DISABLE_AUTO_MEMORY

  beforeEach(async () => {
    await acquireSharedMutationLock('tools/MemoryRecallTool/MemoryRecallTool.test.ts')
    clearAllIndices()
    configDir = mkdtempSync(join(tmpdir(), 'gakrcli-memory-recall-'))
    cwdDir = mkdtempSync(join(tmpdir(), 'gakrcli-memory-recall-cwd-'))
    process.env.GAKR_CONFIG_DIR = configDir
    setGakrCLIConfigHomeDirForTesting(configDir)
    previousCwd = getCwdState()
    setCwdState(cwdDir)
    setOriginalCwd(cwdDir)
    // Same provisioning contract as memdir/retrieval.test.ts: bun test has no
    // REPL bootstrap so isAutoMemoryEnabled() would default off.
    process.env.GAKR_CODE_DISABLE_AUTO_MEMORY = '0'
    getAutoMemPath.cache?.clear?.()
  })

  afterEach(() => {
    try {
      if (originalConfigDir === undefined) {
        delete process.env.GAKR_CONFIG_DIR
      } else {
        process.env.GAKR_CONFIG_DIR = originalConfigDir
      }
      if (originalDisableAutoMemory === undefined) {
        delete process.env.GAKR_CODE_DISABLE_AUTO_MEMORY
      } else {
        process.env.GAKR_CODE_DISABLE_AUTO_MEMORY = originalDisableAutoMemory
      }
      setGakrCLIConfigHomeDirForTesting(undefined)
      if (previousCwd !== undefined) {
        setCwdState(previousCwd)
        setOriginalCwd(previousCwd)
      }
      getAutoMemPath.cache?.clear?.()
      clearAllIndices()
    } finally {
      const dirsToRemove = [configDir, cwdDir]
      configDir = undefined
      cwdDir = undefined
      try {
        for (const dir of dirsToRemove) {
          if (dir) rmSync(dir, { recursive: true, force: true })
        }
      } finally {
        releaseSharedMutationLock()
      }
    }
  })

  it('is read-only, concurrency-safe, and classified by query', async () => {
    expect((MemoryRecallTool.isReadOnly as (input?: unknown) => boolean)({ query: 'x' })).toBe(true)
    expect(
      (MemoryRecallTool.isConcurrencySafe as (input?: unknown) => boolean)({ query: 'x' }),
    ).toBe(true)
    expect(MemoryRecallTool.checkPermissions).toBeDefined()
    const permission = await MemoryRecallTool.checkPermissions(
      { query: 'x' },
      {} as any,
    )
    expect(permission.behavior).toBe('allow')
    expect(MemoryRecallTool.toAutoClassifierInput({ query: 'find it' })).toBe(
      'find it',
    )
  })

  it('rejects an out-of-range limit', async () => {
    const result = await MemoryRecallTool.validateInput!({ query: 'x', limit: 99 })
    expect(result.result).toBe(false)
    const ok = await MemoryRecallTool.validateInput!({ query: 'x', limit: 5 })
    expect(ok.result).toBe(true)
  })

  it('returns grouped hits from memory files', async () => {
    const memDir = getAutoMemPath()
    seedMemoryFile(
      memDir,
      'deployment.md',
      'How the service is deployed',
      'Deploy with docker compose. The staging stack runs on port 8081.\nRollback: docker compose down && docker compose up --previous.',
    )
    seedMemoryFile(
      memDir,
      'unrelated.md',
      'Something else',
      'The purple monkey dishwasher quokka hops at dawn.',
    )

    const result = await MemoryRecallTool.call(
      { query: 'docker compose deployment' },
      {} as any,
      null as any,
      null as any,
      null as any,
    )
    expect(result.data.totalHits).toBeGreaterThan(0)
    expect(result.data.hits.length).toBeGreaterThan(0)
    expect(result.data.hits.length).toBeLessThanOrEqual(result.data.totalHits)
    expect(result.data.hits[0]!.path).toContain('deployment.md')
    expect(result.data.hits[0]!.sessionId).toBeNull()
    // Whole unique file per group, no duplicate paths.
    const paths = result.data.hits.map(hit => hit.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('finds prior session summaries with session provenance', async () => {
    const memDir = getAutoMemPath()
    writeSessionSummaryFile(
      configDir!,
      cwdDir!,
      'session-abc123',
      '---\ntitle: Earlier session\ntype: session\n---\n\nWe chose bun:sqlite over Orama for the memory index.\n',
    )

    const result = await MemoryRecallTool.call(
      { query: 'sqlite memory index' },
      {} as any,
      null as any,
      null as any,
      null as any,
    )
    expect(result.data.totalHits).toBeGreaterThan(0)
    const sessionHit = result.data.hits.find(hit => hit.sessionId != null)
    expect(sessionHit).toBeDefined()
    expect(sessionHit!.sessionId).toBe('session-abc123')
  })

  it('returns an empty result for an unrelated query', async () => {
    const memDir = getAutoMemPath()
    seedMemoryFile(
      memDir,
      'deployment.md',
      'How the service is deployed',
      'Deploy with docker compose on port 8081.',
    )

    const result = await MemoryRecallTool.call(
      { query: 'quantum teleportation protocol' },
      {} as any,
      null as any,
      null as any,
      null as any,
    )
    expect(result.data.totalHits).toBe(0)
    expect(result.data.hits).toEqual([])
  })

  it('serializes hits into a tool_result block with provenance', async () => {
    const memDir = getAutoMemPath()
    seedMemoryFile(
      memDir,
      'ports.md',
      'Port allocation',
      'The dev server uses port 3000; staging uses 8081.',
    )
    const result = await MemoryRecallTool.call(
      { query: 'port allocation server' },
      {} as any,
      null as any,
      null as any,
      null as any,
    )
    expect(result.data.totalHits).toBeGreaterThan(0)

    const block = MemoryRecallTool.mapToolResultToToolResultBlockParam(
      result.data,
      'tool-use-1',
    )
    expect(block.tool_use_id).toBe('tool-use-1')
    expect(block.type).toBe('tool_result')
    const text = typeof block.content === 'string' ? block.content : ''
    expect(text).toContain('ports.md')
    expect(text).toContain('staging uses 8081')

    const empty = MemoryRecallTool.mapToolResultToToolResultBlockParam(
      { query: 'nothing', totalHits: 0, hits: [] },
      'tool-use-2',
    )
    const emptyText = typeof empty.content === 'string' ? empty.content : ''
    expect(emptyText).toContain('No memory matches')
  })
})
