/**
 * Tests for `/cache-stats` command rendering.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import type { CacheMetrics } from '../../services/api/cacheMetrics.js'
import {
  _setHistoryCapForTesting,
  recordRequest,
  resetSessionCacheStats,
} from '../../services/api/cacheStatsTracker.js'
import { call } from './cacheStats.js'

function supported(partial: Partial<CacheMetrics>): CacheMetrics {
  return {
    read: 0,
    created: 0,
    total: 0,
    hitRate: null,
    supported: true,
    ...partial,
  }
}

const UNSUPPORTED: CacheMetrics = {
  read: 0,
  created: 0,
  total: 0,
  hitRate: null,
  supported: false,
}

const EMPTY_CTX = {} as Parameters<typeof call>[1]

async function runCommand(): Promise<string> {
  const result = await call('', EMPTY_CTX)
  if (result.type !== 'text') {
    throw new Error(
      `cacheStats command must return type:'text', got ${result.type}`,
    )
  }
  return result.value
}

beforeEach(() => {
  resetSessionCacheStats()
  _setHistoryCapForTesting(500)
})

describe('/cache-stats — empty session', () => {
  test('shows friendly "no requests yet" message', async () => {
    const value = await runCommand()
    expect(value).toContain('No API requests yet this session')
    expect(value).toContain('/cache-stats')
  })
})

describe('/cache-stats — supported-only session', () => {
  test('renders Cache stats header, turn and session summaries', async () => {
    recordRequest(
      supported({ read: 500, total: 1_000, hitRate: 0.5 }),
      'claude-sonnet-4',
    )
    const value = await runCommand()
    expect(value).toContain('Cache stats')
    expect(value).toContain('Current turn:')
    expect(value).toContain('Session total:')
    expect(value).toContain('claude-sonnet-4')
    expect(value).toContain('read')
  })

  test('omits the N/A footnote when every row is supported', async () => {
    recordRequest(supported({ read: 200, total: 400, hitRate: 0.5 }), 'model-A')
    const value = await runCommand()
    expect(value).not.toContain('N/A rows')
  })
})

describe('/cache-stats — mixed supported + unsupported', () => {
  test('renders N/A footnote when any row is unsupported', async () => {
    recordRequest(UNSUPPORTED, 'gpt-4-copilot')
    recordRequest(
      supported({ read: 100, total: 500, hitRate: 0.2 }),
      'claude-sonnet-4',
    )
    const value = await runCommand()
    expect(value).toContain(
      'N/A rows: provider API does not expose cache usage',
    )
    expect(value).toContain('GitHub Copilot')
    expect(value).toContain('Ollama')
  })
})

describe('/cache-stats — recent-rows cap', () => {
  test('caps the breakdown at 20 rows and reports omitted count', async () => {
    for (let i = 0; i < 25; i++) {
      recordRequest(
        supported({ read: i, total: 100, hitRate: i / 100 }),
        `model-${i}`,
      )
    }
    const value = await runCommand()
    expect(value).toContain('(20 of 25, 5 older omitted)')
    expect(value).toContain('model-24')
    expect(value).not.toContain('model-0 ')
  })

  test('does not mention "older omitted" when all rows fit', async () => {
    for (let i = 0; i < 5; i++) {
      recordRequest(supported({ read: i, total: 10 }), `m${i}`)
    }
    const value = await runCommand()
    expect(value).not.toContain('older omitted')
    expect(value).toContain('(5)')
  })
})

describe('/cache-stats — model label rendering', () => {
  test('truncates long model labels to fit the column width', async () => {
    const longLabel = 'some-extremely-long-model-identifier-that-wraps'
    recordRequest(supported({ read: 10, total: 100, hitRate: 0.1 }), longLabel)
    const value = await runCommand()
    expect(value).toContain(longLabel.slice(0, 28))
    expect(value).not.toContain(longLabel)
  })
})

describe('/cache-stats — timestamp rendering', () => {
  test('renders each row with full date and time (YYYY-MM-DD HH:MM:SS)', async () => {
    recordRequest(supported({ read: 5, total: 10, hitRate: 0.5 }), 'claude-x')
    const value = await runCommand()
    expect(value).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
    const timeOnlyInRow = /\n\s*#\s*\d+\s+\d{2}:\d{2}:\d{2}\s/.test(value)
    expect(timeOnlyInRow).toBe(false)
  })
})
