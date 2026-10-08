import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getOrchestratedMemory,
  retrieveMemoryBlock,
  extractRetrievalQuery,
} from './retrieval.js'
import { getAutoMemPath } from './paths.js'
import { setGakrCLIConfigHomeDirForTesting } from '../utils/envUtils.js'
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

describe('memdir retrieval', () => {
  let configDir: string | undefined
  const originalConfigDir = process.env.GAKR_CONFIG_DIR
  const originalDisableAutoMemory = process.env.GAKR_CODE_DISABLE_AUTO_MEMORY

  beforeEach(async () => {
    await acquireSharedMutationLock('memdir/retrieval.test.ts')
    clearAllIndices()
    configDir = mkdtempSync(join(tmpdir(), 'gakrcli-retrieval-'))
    process.env.GAKR_CONFIG_DIR = configDir
    setGakrCLIConfigHomeDirForTesting(configDir)
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
      getAutoMemPath.cache?.clear?.()
      clearAllIndices()
    } finally {
      const dirToRemove = configDir
      configDir = undefined
      try {
        if (dirToRemove) {
          rmSync(dirToRemove, { recursive: true, force: true })
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
