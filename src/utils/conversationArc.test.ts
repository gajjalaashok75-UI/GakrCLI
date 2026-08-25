import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  initializeArc,
  getArc,
  updateArcPhase,
  addGoal,
  updateGoalStatus,
  addDecision,
  addMilestone,
  addEntity,
  addRelation,
  getGraphSummary,
  getArcSummary,
  resetArc,
  getArcStats,
  finalizeArcTurn,
  appendArcToSystemPrompt,
} from './conversationArc.js'
import { getGlobalGraph, resetGlobalGraph, clearMemoryOnly } from './knowledgeGraph.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'
import { setGakrCLIConfigHomeDirForTesting } from './envUtils.js'
import { setGovernancePolicySettingsForSourceForTesting } from './governancePolicy.js'
import { getAutoMemPath } from '../memdir/paths.js'

function createMessage(role: string, content: string): any {
  return {
    message: { role, content, id: 'test', type: 'message', created_at: Date.now() },
    sender: role,
  }
}

describe('conversationArc', () => {
  // The arc's vector-RAG tier resolves the auto-memory directory and indexes
  // every fact under it. Without an override these tests would index — and,
  // with write-approval disabled below, write to — the developer's real memory
  // corpus, which makes them destructive and unboundedly slow (the index build
  // is proportional to corpus size). Redirect memory at a temp dir, matching
  // query.conversationArc.test.ts.
  let configDir: string
  let memoryDir: string
  const originalMemoryOverride = process.env.GAKR_COWORK_MEMORY_PATH_OVERRIDE
  const originalDisableAutoMemory = process.env.GAKR_CODE_DISABLE_AUTO_MEMORY

  // On Windows the graph/vector-index files under these temp dirs can still be
  // held open briefly after the handles are dropped, so a straight rmSync
  // intermittently raises EBUSY/EPERM and fails an otherwise-passing test.
  // Retry, then give up: leftover os.tmpdir() entries are reclaimed by the OS.
  // Same helper as knowledgeGraph.test.ts.
  const removeDirWithRetry = (dir: string) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        rmSync(dir, { recursive: true, force: true })
        return
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'EBUSY' && code !== 'EPERM') {
          throw error
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1))
      }
    }

    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EBUSY' && code !== 'EPERM') {
        throw error
      }
    }
  }

  beforeEach(async () => {
    await acquireSharedMutationLock('conversationArc')
    configDir = mkdtempSync(join(tmpdir(), 'conversation-arc-config-'))
    memoryDir = mkdtempSync(join(tmpdir(), 'conversation-arc-memory-'))
    setGakrCLIConfigHomeDirForTesting(configDir)
    process.env.GAKR_COWORK_MEMORY_PATH_OVERRIDE = memoryDir
    delete process.env.GAKR_CODE_DISABLE_AUTO_MEMORY
    // getAutoMemPath is memoized on the project root, so the redirect only
    // takes effect once the previously memoized path is dropped.
    getAutoMemPath.cache?.clear?.()
    // Fact extraction and vector-index writes respect the memory-write approval
    // policy; opt in so the memdir tier behaves as it does in production with
    // require-approval=false.
    setGovernancePolicySettingsForSourceForTesting(() => ({
      memory: { requireApprovalBeforeWrite: false },
    }))
    resetArc()
    resetGlobalGraph()
    clearMemoryOnly()
  })

  afterEach(() => {
    try {
      // Ordered before the override is restored so the graph and vector-index
      // artifacts these clear are the temp ones, not the real ones.
      resetArc()
      resetGlobalGraph()
      clearMemoryOnly()
      setGovernancePolicySettingsForSourceForTesting(null)
      setGakrCLIConfigHomeDirForTesting(undefined)
      if (originalMemoryOverride === undefined) {
        delete process.env.GAKR_COWORK_MEMORY_PATH_OVERRIDE
      } else {
        process.env.GAKR_COWORK_MEMORY_PATH_OVERRIDE = originalMemoryOverride
      }
      if (originalDisableAutoMemory === undefined) {
        delete process.env.GAKR_CODE_DISABLE_AUTO_MEMORY
      } else {
        process.env.GAKR_CODE_DISABLE_AUTO_MEMORY = originalDisableAutoMemory
      }
      getAutoMemPath.cache?.clear?.()
      removeDirWithRetry(memoryDir)
      removeDirWithRetry(configDir)
    } finally {
      releaseSharedMutationLock()
    }
  })

  describe('initializeArc', () => {
    it('creates new arc', () => {
      const arc = initializeArc()
      expect(arc.id).toBeDefined()
      expect(arc.currentPhase).toBe('init')
      expect(arc.goals).toEqual([])
      expect(arc.decisions).toEqual([])
    })
  })

  describe('Knowledge Graph', () => {
    it('adds entities and relations', async () => {
      initializeArc()
      const e1 = await addEntity('system', 'RHEL9', { version: '9.4' })
      const e2 = await addEntity('credential', 'Jira PAT')

      expect(e1.name).toBe('RHEL9')
      expect(e1.attributes.version).toBe('9.4')

      await addRelation(e1.id, e2.id, 'requires')

      const graph = getGlobalGraph()
      expect(Object.keys(graph.entities).length).toBeGreaterThanOrEqual(2)
      expect(graph.relations.some(r => r.type === 'requires')).toBe(true)
    })

    it('generates a knowledge graph summary', async () => {
      resetGlobalGraph()
      initializeArc()
      const e1 = await addEntity('system', 'RHEL-TEST', { os: 'linux' })
      const e2 = await addEntity('feature', 'GakrCLI-TEST')
      await addRelation(e2.id, e1.id, 'runs_on')

      const summary = await getArcSummary()
      expect(summary).toMatch(/Knowledge Graph/)
      expect(summary).toContain('[system] RHEL-TEST')
      expect(summary).toMatch(/os: linux/)
    })

    it('automatically learns facts from message content', async () => {
      resetGlobalGraph()
      initializeArc()
      const complexMessage = createMessage(
        'user',
        'Set JIRA_URL_TEST=https://jira.local and look in /opt/app/bin/test version v1.2.3',
      )

      await updateArcPhase([complexMessage])

      const summary = getGraphSummary()
      expect(summary).toContain('JIRA_URL_TEST')
      expect(summary).toContain('jira.local')
      expect(summary).toContain('/opt/app/bin/test')
      expect(summary).toContain('v1.2.3')
    })

    it('throws error when adding relation to non-existent entity', async () => {
      initializeArc()
      await expect(addRelation('invalid1', 'invalid2', 'test')).rejects.toThrow(
        'Source or target entity not found in graph',
      )
    })
  })

  describe('finalizeArcTurn', () => {
    it('generates and persists a summary of the turn', async () => {
      initializeArc()
      addGoal('Build RAG engine')
      updateGoalStatus(getArc()!.goals[0].id, 'completed')
      addDecision('Use JSON for storage')

      await finalizeArcTurn()

      const summary = getGraphSummary()
      expect(summary).toMatch(/Knowledge Graph/)
      // searchGlobalGraph should now find it
      const ragResult = await getArcSummary('Tell me about the RAG engine')
      expect(ragResult).toContain('Build RAG engine')
      expect(ragResult).toContain('Use JSON for storage')
    })

    it('summarizes only facts learned during the active arc', async () => {
      const firstArc = initializeArc()
      await addEntity('tool', 'pre-existing-tool')
      await finalizeArcTurn()

      resetArc()
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5)
      initializeArc()
      await addEntity('tool', 'fresh-tool')
      await finalizeArcTurn()

      const graph = getGlobalGraph()
      const latestSummary = graph.summaries[graph.summaries.length - 1]
      expect(latestSummary.content).toContain('fresh-tool')
      expect(latestSummary.content).not.toContain('pre-existing-tool')
      expect(firstArc.id).toBeDefined()
    })
  })

  describe('resetArc', () => {
    it('returns existing arc or creates new', () => {
      const arc1 = getArc()
      const arc2 = getArc()
      expect(arc1?.id).toBe(arc2?.id)
    })
  })

  describe('updateArcPhase', () => {
    it('detects exploring phase', async () => {
      initializeArc()
      await updateArcPhase([createMessage('user', 'Find the file')])

      expect(getArc()?.currentPhase).toBe('exploring')
    })

    it('detects phase from block array content', async () => {
      initializeArc()
      const blockMessage = {
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'I will now implement the requested changes.' }],
          id: 'test',
          type: 'message',
          created_at: Date.now(),
        },
        sender: 'assistant',
      }
      await updateArcPhase([blockMessage as any])

      expect(getArc()?.currentPhase).toBe('implementing')
    })

    it('progresses phases forward only', async () => {
      initializeArc()
      await updateArcPhase([createMessage('user', 'Write code')])
      await updateArcPhase([createMessage('user', 'Find file')])

      // Phase should remain at implementing since it was detected first
      expect(getArc()?.currentPhase).toBe('implementing')
    })
  })

  describe('goal management', () => {
    it('adds goal', () => {
      initializeArc()
      const goal = addGoal('Fix the bug')
      expect(goal.description).toBe('Fix the bug')
      expect(goal.status).toBe('pending')
    })

    it('updates goal status', () => {
      initializeArc()
      const goal = addGoal('Test feature')
      updateGoalStatus(goal.id, 'completed')

      const updated = getArc()?.goals.find(g => g.id === goal.id)
      expect(updated?.status).toBe('completed')
      expect(updated?.completedAt).toBeDefined()
    })
  })

  describe('addDecision', () => {
    it('adds decision', () => {
      initializeArc()
      const decision = addDecision('Use TypeScript', 'Type safety')
      expect(decision.description).toBe('Use TypeScript')
      expect(decision.rationale).toBe('Type safety')
    })
  })

  describe('addMilestone', () => {
    it('adds milestone', () => {
      initializeArc()
      const milestone = addMilestone('Phase 1 complete')
      expect(milestone.description).toBe('Phase 1 complete')
      expect(milestone.achievedAt).toBeDefined()
    })
  })

  describe('getArcSummary', () => {
    it('returns summary string', async () => {
      initializeArc()
      addGoal('Test goal')
      const summary = await getArcSummary()

      expect(summary).toContain('Phase:')
      expect(summary).toContain('Goals:')
    })
  })

  describe('getArcStats', () => {
    it('returns statistics', () => {
      initializeArc()
      addGoal('Goal 1')
      addDecision('Decision 1')

      const stats = getArcStats()
      expect(stats?.goalCount).toBe(1)
      expect(stats?.decisionCount).toBe(1)
    })
  })

  describe('appendArcToSystemPrompt', () => {
    it('appends arc memory as one fenced element without mutating messages', async () => {
      initializeArc()
      await updateArcPhase([
        createMessage('user', 'implement authentication system'),
      ])
      const goal = addGoal('Add JWT auth')
      updateGoalStatus(goal.id, 'completed')
      await finalizeArcTurn()

      const systemPrompt = ['# System Instructions', 'You are an assistant.']
      // `type` (not `sender`) is what the production Message union carries, and
      // it is what selects the human-authored text used as the retrieval query.
      const messages = [
        {
          type: 'user',
          message: { role: 'user', content: 'add login endpoint' },
        },
      ] as unknown as Parameters<typeof appendArcToSystemPrompt>[1]

      const promptWithArc = await appendArcToSystemPrompt(
        systemPrompt,
        messages,
      )

      // One extra element: arc content must never be concatenated into an
      // existing entry, and the user message must not be rewritten.
      expect(promptWithArc.length).toBe(systemPrompt.length + 1)
      const joined = promptWithArc.join('\n')
      expect(joined).toContain('Phase:')
      expect(joined).toContain('Add JWT auth')
      expect(joined).toContain('BEGIN RETRIEVED MEMORY (DATA ONLY)')
      expect(joined).toContain('END RETRIEVED MEMORY (DATA ONLY)')
      // Exactly one envelope — a nested fence trains the model to ignore it.
      expect(joined.split('BEGIN RETRIEVED MEMORY (DATA ONLY)')).toHaveLength(2)
      expect(messages[0].message.content).toBe('add login endpoint')
    })

    it('renders the arc block with real newlines, not escaped ones', async () => {
      initializeArc()
      addGoal('Keep the prompt readable')
      const promptWithArc = await appendArcToSystemPrompt(['# System'], [])
      const arcBlock = promptWithArc[promptWithArc.length - 1]
      expect(arcBlock).toContain('Phase: ')
      expect(arcBlock).toContain('\n')
      // A literal backslash-n would collapse the block into one physical line.
      expect(arcBlock).not.toContain('\\n')
    })
  })
})
