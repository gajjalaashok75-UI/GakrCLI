import { describe, expect, test } from 'bun:test'
import { duckduckgoProvider } from './duckduckgo.js'

describe('DuckDuckGo SafeSearchType', () => {
  test('SafeSearchType.STRICT === 0 (matches previous raw value)', async () => {
    const { SafeSearchType } = await import('duck-duck-scrape')
    expect(SafeSearchType.STRICT).toBe(0)
  })

  test('SafeSearchType enum values are sane', async () => {
    const { SafeSearchType } = await import('duck-duck-scrape')
    expect(SafeSearchType.STRICT).toBe(0)
    expect(SafeSearchType.MODERATE).toBe(-1)
    expect(SafeSearchType.OFF).toBe(-2)
  })
})

describe('duckduckgoProvider', () => {
  test('is always configured because it is the no-key fallback', () => {
    expect(duckduckgoProvider.isConfigured()).toBe(true)
  })

  test('aborts before starting network work', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      duckduckgoProvider.search({ query: 'test' }, controller.signal),
    ).rejects.toThrow(/aborted/i)
  })
})
