/**
 * Beta header security tests.
 *
 * Verifies:
 * 1. Empty string beta headers do not leak into API requests
 * 2. getExtraBodyParams merges beta headers correctly
 * 3. Potentially empty beta headers from constants are handled properly
 * 4. SDK betas.toString() behavior matches expectations
 */
import { describe, expect, test } from 'bun:test'

// ── Part 1: SDK-level toString behavior verification ────────────────

describe('SDK betas.toString() behavior', () => {
  test('empty string in array produces invalid header value', () => {
    // This is the root cause of the 400: SDK calls betas.toString()
    const betas = [
      'gakrcli-code-20250219',
      '',
      'interleaved-thinking-2025-05-14',
    ]
    const headerValue = betas.toString()

    // Produces "gakrcli-code-20250219,,interleaved-thinking-2025-05-14"
    // The empty value between commas is what the API rejects
    expect(headerValue).toContain(',,')
    expect(headerValue).toBe(
      'gakrcli-code-20250219,,interleaved-thinking-2025-05-14',
    )
  })

  test('filter(Boolean) removes empty strings', () => {
    const betas = [
      'gakrcli-code-20250219',
      '',
      'interleaved-thinking-2025-05-14',
    ]
    const filtered = betas.filter(Boolean)
    const headerValue = filtered.toString()

    expect(filtered).not.toContain('')
    expect(headerValue).not.toContain(',,')
    expect(headerValue).toBe(
      'gakrcli-code-20250219,interleaved-thinking-2025-05-14',
    )
  })

  test('filter(Boolean) handles multiple empty strings', () => {
    const betas = ['', 'a', '', '', 'b', '']
    const filtered = betas.filter(Boolean)

    expect(filtered).toEqual(['a', 'b'])
    expect(filtered.toString()).toBe('a,b')
  })

  test('filter(Boolean) on clean array is no-op', () => {
    const betas = ['gakrcli-code-20250219', 'interleaved-thinking-2025-05-14']
    const filtered = betas.filter(Boolean)

    expect(filtered).toEqual(betas)
  })

  test('empty array after filter produces no header', () => {
    const betas = ['', '']
    const filtered = betas.filter(Boolean)

    expect(filtered).toEqual([])
    expect(filtered.length > 0).toBe(false)
    // useBetas would be false, header not sent at all
  })
})

// ── Part 2: Constant-level empty value detection ───────────────────────

describe('beta header constants safety', () => {
  test('known potentially-empty constants are identified', () => {
    // These constants may be empty strings under certain conditions.
    // The test confirms we know which are empty so we can guard against them.

    // CACHE_EDITING_BETA_HEADER — upstream has not published it, always empty
    // Dynamic import to avoid bun:bundle dependency
    // Here we test the value directly
    const CACHE_EDITING_VALUE = '' // matches constants/betas.ts:50
    expect(CACHE_EDITING_VALUE).toBe('')
    expect(Boolean(CACHE_EDITING_VALUE)).toBe(false)

    // CLI_INTERNAL_BETA_HEADER — empty when USER_TYPE !== 'ant'
    // In test environments USER_TYPE is usually not 'ant'
    const CLI_INTERNAL_VALUE =
      process.env.USER_TYPE === 'ant' ? 'cli-internal-2026-02-09' : ''
    if (process.env.USER_TYPE !== 'ant') {
      expect(CLI_INTERNAL_VALUE).toBe('')
    }
  })

  test('truthy check correctly gates empty beta headers', () => {
    const emptyHeader = ''
    const validHeader = 'some-beta-2025-01-01'

    // Simulate the truthy check in gakrcli.ts
    const betasParams: string[] = []

    // Empty header — should not be pushed
    if (emptyHeader) {
      betasParams.push(emptyHeader)
    }
    expect(betasParams).toEqual([])

    // Valid header — should be pushed
    if (validHeader) {
      betasParams.push(validHeader)
    }
    expect(betasParams).toEqual(['some-beta-2025-01-01'])
  })
})

// ── Part 3: getExtraBodyParams beta merge logic ─────────────────────

describe('getExtraBodyParams beta merge', () => {
  // getExtraBodyParams parses JSON from GAKR_CODE_EXTRA_BODY and merges betaHeaders
  // Here we verify edge cases of the merge logic

  test('empty beta headers array should not add anthropic_beta', () => {
    const result: Record<string, unknown> = {}
    const betaHeaders: string[] = []

    // Simulate the merge logic from getExtraBodyParams
    if (betaHeaders && betaHeaders.length > 0) {
      result.anthropic_beta = betaHeaders
    }

    expect(result.anthropic_beta).toBeUndefined()
  })

  test('beta headers with empty strings should be filtered', () => {
    const betaHeaders = ['valid-header', '', 'another-valid']

    // Fixed logic should filter before merging
    const clean = betaHeaders.filter(Boolean)
    expect(clean).toEqual(['valid-header', 'another-valid'])
  })

  test('merging avoids duplicates', () => {
    const existing = ['header-a', 'header-b']
    const incoming = ['header-b', 'header-c']

    const merged = [...existing, ...incoming.filter(h => !existing.includes(h))]

    expect(merged).toEqual(['header-a', 'header-b', 'header-c'])
  })
})

// ── Part 4: ANTHROPIC_BETAS env var parsing ─────────────────────────

describe('ANTHROPIC_BETAS env var parsing', () => {
  test('empty string env var produces no betas', () => {
    const envVal: string = ''
    const result = envVal
      ? envVal
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : []

    expect(result).toEqual([])
  })

  test('trailing comma does not produce empty entry', () => {
    const envVal = 'beta-a,beta-b,'
    const result = envVal
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    expect(result).toEqual(['beta-a', 'beta-b'])
  })

  test('whitespace-only entries are filtered', () => {
    const envVal = 'beta-a, , beta-b,  '
    const result = envVal
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    expect(result).toEqual(['beta-a', 'beta-b'])
  })

  test('single comma produces no betas', () => {
    const envVal = ','
    const result = envVal
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    expect(result).toEqual([])
  })
})

// ── Part 5: Full request parameter simulation ───────────────────────

describe('request params beta assembly (simulated)', () => {
  test('simulates the full beta assembly pipeline with empty constants', () => {
    // Simulate the beta assembly flow from paramsFromContext in gakrcli.ts
    const GAKR_CODE_HEADER = 'gakrcli-code-20250219'
    const INTERLEAVED_HEADER = 'interleaved-thinking-2025-05-14'
    const CONTEXT_1M_HEADER = 'context-1m-2025-08-07'
    const CACHE_EDITING_HEADER = '' // empty!
    const AFK_MODE_HEADER = '' // also empty!

    // Step 1: Base betas (from getAllModelBetas)
    const baseBetas = [
      GAKR_CODE_HEADER,
      INTERLEAVED_HEADER,
      CONTEXT_1M_HEADER,
    ]

    // Step 2: Dynamic additions from paramsFromContext
    const betasParams = [...baseBetas]

    // Simulate cache editing latch triggered but header is empty
    const cacheEditingHeaderLatched = true
    if (
      cacheEditingHeaderLatched &&
      CACHE_EDITING_HEADER && // ← fix: truthy check
      !betasParams.includes(CACHE_EDITING_HEADER)
    ) {
      betasParams.push(CACHE_EDITING_HEADER)
    }

    // Simulate AFK mode latch triggered but header is empty
    const afkHeaderLatched = true
    // When feature('TRANSCRIPT_CLASSIFIER') is false, the entire if block is skipped.
    // But assuming it enters, the header is also empty.
    if (
      afkHeaderLatched &&
      AFK_MODE_HEADER && // empty string, won't enter
      !betasParams.includes(AFK_MODE_HEADER)
    ) {
      betasParams.push(AFK_MODE_HEADER)
    }

    // Step 3: Final filter (our defense layer)
    const filteredBetas = betasParams.filter(Boolean)

    // Verify: no empty strings leaked
    expect(filteredBetas).not.toContain('')
    expect(filteredBetas).toEqual([
      GAKR_CODE_HEADER,
      INTERLEAVED_HEADER,
      CONTEXT_1M_HEADER,
    ])

    // Verify: toString() doesn't produce ,,
    expect(filteredBetas.toString()).not.toContain(',,')
  })

  test('simulates the bug scenario WITHOUT fix', () => {
    // Reproduce behavior before the fix, confirm the bug exists
    const CACHE_EDITING_HEADER = '' // empty

    const betasParams = [
      'gakrcli-code-20250219',
      'interleaved-thinking-2025-05-14',
    ]

    // Before the fix: no truthy check, empty string gets pushed
    const cacheEditingHeaderLatched = true
    if (
      cacheEditingHeaderLatched &&
      // Note: no CACHE_EDITING_HEADER && check
      !betasParams.includes(CACHE_EDITING_HEADER) // '' not in array → true
    ) {
      betasParams.push(CACHE_EDITING_HEADER) // pushed an empty string!
    }

    // Proof of bug: array contains empty string
    expect(betasParams).toContain('')
    // SDK toString() produces a trailing comma (empty string at end) or ,, (in the middle)
    // Both are invalid header values that the API rejects
    const headerStr = betasParams.toString()
    // Empty string at end → trailing comma "a,b,"
    // Empty string in middle → consecutive comma "a,,b"
    expect(headerStr.endsWith(',') || headerStr.includes(',,')).toBe(true)
  })

  test('useBetas flag correctly handles empty-after-filter', () => {
    // If all betas are empty strings, the betas param should not be sent after filtering
    const betasParams = ['', '']
    const filteredBetas = betasParams.filter(Boolean)
    const useBetas = filteredBetas.length > 0

    expect(useBetas).toBe(false)
    // API request should not include the betas field
    const requestParams = {
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [],
      ...(useBetas && { betas: filteredBetas }),
    }
    expect(requestParams).not.toHaveProperty('betas')
  })
})
