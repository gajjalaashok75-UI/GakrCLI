import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import {
  getOrchestratedMemory,
  retrieveMemoryBlock,
  extractRetrievalQuery,
} from './retrieval.js'
import { getAutoMemPath } from './paths.js'
import { setGakrCLIConfigHomeDirForTesting } from '../utils/envUtils.js'
import { getCwdState, setCwdState, setOriginalCwd } from '../bootstrap/state.js'
import { sanitizePath } from '../utils/sessionStoragePortable.js'
import { clearAllIndices } from './vectorIndex.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

function createMessage(type: string, content: string): any {
  return {
    type,
    message: { role: type === 'user' ? 'user' : 'assistant', content },
  }
}

function seedMemoryFile(dir: string, name: string, description: string, body: string): void {
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

describe('memdir retrieval', () => {
  let configDir: string | undefined
  let cwdDir: string | undefined
  let previousCwd: string
  const originalConfigDir = process.env.GAKR_CONFIG_DIR
  const originalDisableAutoMemory = process.env.GAKR_CODE_DISABLE_AUTO_MEMORY

  beforeEach(async () => {
    await acquireSharedMutationLock('memdir/retrieval.test.ts')
    clearAllIndices()
    configDir = mkdtempSync(join(tmpdir(), 'gakrcli-retrieval-'))
    cwdDir = mkdtempSync(join(tmpdir(), 'gakrcli-retrieval-cwd-'))
    process.env.GAKR_CONFIG_DIR = configDir
    setGakrCLIConfigHomeDirForTesting(configDir)
    // Session summaries resolve from the session cwd; keep the real one untouched.
    previousCwd = getCwdState()
    setCwdState(cwdDir)
    setOriginalCwd(cwdDir)
    // Bun test has no REPL bootstrap, so the session looks non-interactive
    // and isAutoMemoryEnabled() would default off. Provision explicitly —
    // paths.ts treats this env override as deliberate opt-in.
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

  describe('getOrchestratedMemory', () => {
    it('returns a fenced block with matching memory for a keyword query', async () => {
      const memDir = getAutoMemPath()
      seedMemoryFile(
        memDir,
        'web-browser-tool.md',
        'WebBrowserTool engine dispatches to Server methods via AbortSignal',
        'The engine dispatches actions to server methods.',
      )

      const result = await getOrchestratedMemory('web browser tool engine dispatch')
      expect(result).toContain('--- BEGIN RETRIEVED MEMORY (DATA ONLY) ---')
      expect(result).toContain('--- END RETRIEVED MEMORY (DATA ONLY) ---')
      expect(result).toContain('PERSISTENT PROJECT MEMORY (VECTOR RAG)')
      expect(result).toContain('web-browser-tool')
    })

    it('returns empty string when the memory dir has no md files', async () => {
      const result = await getOrchestratedMemory('anything at all')
      expect(result).toBe('')
    })

    it('returns empty string for an empty query', async () => {
      const result = await getOrchestratedMemory('')
      expect(result).toBe('')
    })
  })

  describe('extractRetrievalQuery', () => {
    it('walks back to the latest user-authored text, skipping tool results', () => {
      const messages = [
        createMessage('user', 'fix the login bug'),
        createMessage('assistant', 'looking into it'),
        {
          type: 'user',
          message: { role: 'user', content: [{ type: 'tool_result', content: 'tool output' }] },
        },
      ]
      expect(extractRetrievalQuery(messages)).toBe('fix the login bug')
    })

    it('returns empty string when there is no user text', () => {
      expect(extractRetrievalQuery([createMessage('assistant', 'hi')])).toBe('')
    })
  })

  describe('retrieveMemoryBlock', () => {
    it('appends the retrieved block as a separate array element', async () => {
      const memDir = getAutoMemPath()
      seedMemoryFile(
        memDir,
        'checkpointing.md',
        'File checkpointing enables code rewind across edits',
        'Checkpoints track file states.',
      )

      const systemPrompt = ['base prompt']
      const messages = [createMessage('user', 'explain file checkpointing')]
      const result = await retrieveMemoryBlock(systemPrompt, messages)

      expect(result).toHaveLength(2)
      expect(result[0]).toBe('base prompt')
      expect(result[1]).toContain('BEGIN RETRIEVED MEMORY (DATA ONLY)')
      expect(result[1]).toContain('checkpointing')
    })

    it('returns the prompt unchanged when the corpus has no relevant match', async () => {
      // Empty dir → index empty → no hits at all.
      const result = await retrieveMemoryBlock(['base prompt'], [
        createMessage('user', 'quantum teleportation protocol'),
      ])
      expect(result).toHaveLength(1)
    })

    it('injects nothing from a populated corpus when the prompt is unrelated', async () => {
      seedMemoryFile(
        getAutoMemPath(),
        'project-vendor-browser-bundles.md',
        'Vendoring third-party browser bundles',
        'UMD bundles live in assets/ and are injected into pages at runtime.',
      )

      const result = await retrieveMemoryBlock(['base prompt'], [
        createMessage('user', 'purple monkey dishwasher quokka'),
      ])
      expect(result).toHaveLength(1)
    })

    it('rejects a chunk that matches only one term of a longer prompt', async () => {
      seedMemoryFile(
        getAutoMemPath(),
        'project-vendoring.md',
        'Vendoring notes',
        'The vendoring process injects a bundle at runtime.',
      )

      // Four query terms: only "vendoring" appears, so the term-coverage rule
      // (2 of 4) must reject it rather than inject a partial match.
      const result = await retrieveMemoryBlock(['base prompt'], [
        createMessage('user', 'vendoring quantum teleportation protocol'),
      ])
      expect(result).toHaveLength(1)
    })

    it('injects a prior session summary together with its session id', async () => {
      const sessionId = '11111111-2222-3333-4444-555555555555'
      writeSessionSummaryFile(
        configDir!,
        cwdDir!,
        sessionId,
        'Blocked on the deploymentCredentials rotation window.\n',
      )

      const result = await retrieveMemoryBlock(['base prompt'], [
        createMessage('user', 'deploymentCredentials rotation window'),
      ])

      expect(result).toHaveLength(2)
      expect(result[1]).toContain('BEGIN RETRIEVED MEMORY (DATA ONLY)')
      expect(result[1]).toContain('Session summary 11111111')
      expect(result[1]).toContain('session 11111111')
      expect(result[1]).toContain('deploymentCredentials')
    })

    it('invalidates the cached block when a memory file is edited', async () => {
      const memDir = getAutoMemPath()
      // Equal-length replacement: the corpus fingerprint must catch this on
      // mtime/ctime alone, not just on file size.
      seedMemoryFile(memDir, 'config.md', 'Database settings', 'the database uses MySQL')
      const messages = [createMessage('user', 'which database engine')]

      const before = await retrieveMemoryBlock(['base prompt'], messages)
      expect(before).toHaveLength(2)
      expect(before[1]).toContain('MySQL')

      seedMemoryFile(memDir, 'config.md', 'Database settings', 'the database uses NoSQL')

      // Same process, same query, no restart.
      const after = await retrieveMemoryBlock(['base prompt'], messages)
      expect(after).toHaveLength(2)
      expect(after[1]).toContain('NoSQL')
      expect(after[1]).not.toContain('MySQL')
    })

    it('invalidates the cached block when a memory file is added', async () => {
      const messages = [createMessage('user', 'checkpointing behaviour')]
      const empty = await retrieveMemoryBlock(['base prompt'], messages)
      expect(empty).toHaveLength(1)

      seedMemoryFile(
        getAutoMemPath(),
        'checkpointing.md',
        'File checkpointing across edits',
        'Checkpoints track file states.',
      )

      const after = await retrieveMemoryBlock(['base prompt'], messages)
      expect(after).toHaveLength(2)
      expect(after[1]).toContain('checkpointing')
    })

    it('invalidates the cached block when a memory file is deleted', async () => {
      const memDir = getAutoMemPath()
      seedMemoryFile(memDir, 'deploy.md', 'Deploy pipeline notes', 'Thedeploytoken guards the pipeline.')
      const messages = [createMessage('user', 'Thedeploytoken pipeline guards')]

      const before = await retrieveMemoryBlock(['base prompt'], messages)
      expect(before).toHaveLength(2)

      rmSync(join(memDir, 'deploy.md'), { force: true })

      const after = await retrieveMemoryBlock(['base prompt'], messages)
      expect(after).toHaveLength(1)
    })

    it('invalidates the cached block when a session summary changes', async () => {
      const sessionId = '99999999-8888-7777-6666-555555555555'
      const messages = [createMessage('user', 'rotationsummarytoken window')]
      writeSessionSummaryFile(configDir!, cwdDir!, sessionId, 'The rotationsummarytoken window is Sunday.\n')

      const before = await retrieveMemoryBlock(['base prompt'], messages)
      expect(before).toHaveLength(2)
      expect(before[1]).toContain('Sunday')

      writeSessionSummaryFile(configDir!, cwdDir!, sessionId, 'The rotationsummarytoken window is Tuesday\n')

      const after = await retrieveMemoryBlock(['base prompt'], messages)
      expect(after).toHaveLength(2)
      expect(after[1]).toContain('Tuesday')
      expect(after[1]).not.toContain('Sunday')
    })

    it('returns the prompt unchanged when no user message exists', async () => {
      const memDir = getAutoMemPath()
      seedMemoryFile(memDir, 'a.md', 'alpha', 'alpha content')
      const systemPrompt = ['base prompt']
      const messages = [createMessage('assistant', 'hello')]
      const result = await retrieveMemoryBlock(systemPrompt, messages)
      expect(result).toBe(systemPrompt)
    })
  })
})
