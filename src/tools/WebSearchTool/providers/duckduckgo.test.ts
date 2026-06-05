import { describe, expect, test } from 'bun:test'
import { duckduckgoProvider } from './duckduckgo.js'

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
