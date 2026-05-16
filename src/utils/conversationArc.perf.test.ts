import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { 
  initializeArc, 
  updateArcPhase, 
  getArcSummary,
  resetArc 
} from './conversationArc.js'
import { resetGlobalGraph } from './knowledgeGraph.js'
import { setGakrcliConfigHomeDirForTesting } from './envUtils.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

function createMessage(content: string): any {
  return {
    message: { role: 'user', content, id: 'test', type: 'message', created_at: Date.now() },
    sender: 'user',
  }
}

describe('Conversation Arc Performance Benchmarks', () => {
  const originalConfigDir = process.env.GAKR_CONFIG_DIR
  let configDir: string | undefined

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
    await acquireSharedMutationLock('utils/conversationArc.perf.test.ts')
    configDir = mkdtempSync(join(tmpdir(), 'gakrcli-conversation-arc-perf-'))
    process.env.GAKR_CONFIG_DIR = configDir
    setGakrcliConfigHomeDirForTesting(configDir)
    resetArc()
    resetGlobalGraph()
    initializeArc()
  })

  afterEach(() => {
    try {
      resetArc()
      resetGlobalGraph()
      if (originalConfigDir === undefined) {
        delete process.env.GAKR_CONFIG_DIR
      } else {
        process.env.GAKR_CONFIG_DIR = originalConfigDir
      }
      setGakrcliConfigHomeDirForTesting(undefined)
    } finally {
      const dirToRemove = configDir
      configDir = undefined
      try {
        if (dirToRemove) {
          removeDirWithRetry(dirToRemove)
        }
      } finally {
        releaseSharedMutationLock()
      }
    }
  })

  it('keeps automatic fact extraction bounded', async () => {
    const iterations = 20
    const complexContent = 'Deploying version v1.2.3 to /opt/prod/server on https://api.prod.local with JIRA_URL=https://jira.corp'
    
    const startTime = performance.now()
    for (let i = 0; i < iterations; i++) {
      await updateArcPhase([createMessage(complexContent)])
    }
    const duration = performance.now() - startTime
    const averageTime = duration / iterations

    console.log(`[Benchmark] Avg extraction time: ${averageTime.toFixed(4)}ms`)
    
    // Includes persistent graph writes and Orama indexing; keep the guard loose
    // enough for Windows CI while still catching accidental runaway work.
    expect(averageTime).toBeLessThan(500.0)
  })

  it('generates summaries quickly even with a populated graph', async () => {
    // Populate graph with 50 facts
    for (let i = 0; i < 50; i++) {
      await updateArcPhase([createMessage(`Var_${i}=Value_${i} in /path/to/file_${i}`)])
    }

    const startTime = performance.now()
    const summary = await getArcSummary()
    const duration = performance.now() - startTime

    console.log(`[Benchmark] Summary generation time (50 entities): ${duration.toFixed(4)}ms`)
    expect(summary).toMatch(/Knowledge Graph/);
    expect(duration).toBeLessThan(500)
  })

  it('maintains a compact memory footprint', async () => {
    const arc = initializeArc()
    for (let i = 0; i < 100; i++) {
      await updateArcPhase([createMessage(`Fact_${i}=Value_${i}`)])
    }
    
    const serialized = JSON.stringify(arc)
    const sizeKB = serialized.length / 1024
    console.log(`[Benchmark] Memory footprint (100 facts): ${sizeKB.toFixed(2)}KB`)
    
    // Should be well under 100KB for 100 simple facts
    expect(sizeKB).toBeLessThan(100)
  })
})
