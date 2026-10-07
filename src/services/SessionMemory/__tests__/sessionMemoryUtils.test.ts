import { beforeEach, describe, expect, test } from 'bun:test'
import {
  DEFAULT_SESSION_MEMORY_CONFIG,
  hasMetInitializationThreshold,
  hasMetUpdateThreshold,
  recordExtractionTokenCount,
  resetSessionMemoryState,
  setSessionMemoryConfig,
} from '../sessionMemoryUtils.js'

// Pure state-machine tests — no fs/network access needed, so no mock.module
// setup (mock.module is process-global and leaks across test files; see
// prompts.test.ts header and ISSUES.md).

const GROWTH = DEFAULT_SESSION_MEMORY_CONFIG.minimumTokensBetweenUpdate

describe('hasMetUpdateThreshold (basic cadence)', () => {
  beforeEach(() => resetSessionMemoryState())

  test('requires growth >= minimumTokensBetweenUpdate since last extraction', () => {
    recordExtractionTokenCount(100_000)
    expect(hasMetUpdateThreshold(100_000 + GROWTH - 1)).toBe(false)
    expect(hasMetUpdateThreshold(100_000 + GROWTH)).toBe(true)
  })

  test('no extraction recorded yet → any size >= GROWTH meets the threshold', () => {
    // tokensAtLastExtraction starts at 0
    expect(hasMetUpdateThreshold(GROWTH - 1)).toBe(false)
    expect(hasMetUpdateThreshold(GROWTH)).toBe(true)
  })
})

describe('hasMetUpdateThreshold (shrink re-anchoring after compaction)', () => {
  beforeEach(() => resetSessionMemoryState())

  test('context shrink below baseline re-anchors so updates stay reachable post-compact', () => {
    // Cycle 1: extraction near the pre-compact peak
    recordExtractionTokenCount(410_000)
    // Auto-compact drops context to ~40k. Without re-anchoring, the growth
    // threshold (410k + GROWTH) would be unreachable before the NEXT
    // auto-compact point — automatic updates would silently stop forever.
    expect(hasMetUpdateThreshold(40_000)).toBe(false)
    // Growth is now measured from the post-compaction size.
    expect(hasMetUpdateThreshold(40_000 + GROWTH - 1)).toBe(false)
    expect(hasMetUpdateThreshold(40_000 + GROWTH)).toBe(true)
  })

  test('repeated checks at the shrunk size keep the baseline anchored', () => {
    recordExtractionTokenCount(200_000)
    expect(hasMetUpdateThreshold(50_000)).toBe(false)
    expect(hasMetUpdateThreshold(50_000)).toBe(false)
    expect(hasMetUpdateThreshold(50_000 + GROWTH)).toBe(true)
  })

  test('microcompact/snip-style small dips re-anchor too', () => {
    recordExtractionTokenCount(90_000)
    expect(hasMetUpdateThreshold(89_000)).toBe(false)
    expect(hasMetUpdateThreshold(89_000 + GROWTH)).toBe(true)
  })

  test('a grow-then-shrink-then-grow cycle anchors at the latest shrink', () => {
    recordExtractionTokenCount(300_000)
    expect(hasMetUpdateThreshold(310_000)).toBe(true) // grew past threshold
    // new extraction recorded mid-cycle
    recordExtractionTokenCount(310_000)
    expect(hasMetUpdateThreshold(400_000)).toBe(true)
    recordExtractionTokenCount(400_000)
    // compact → shrink → re-anchor at 45k
    expect(hasMetUpdateThreshold(45_000)).toBe(false)
    expect(hasMetUpdateThreshold(45_000 + GROWTH)).toBe(true)
  })
})

describe('hasMetInitializationThreshold', () => {
  beforeEach(() => resetSessionMemoryState())

  test('uses minimumMessageTokensToInit from defaults', () => {
    const INIT = DEFAULT_SESSION_MEMORY_CONFIG.minimumMessageTokensToInit
    expect(hasMetInitializationThreshold(INIT - 1)).toBe(false)
    expect(hasMetInitializationThreshold(INIT)).toBe(true)
  })
})

describe('setSessionMemoryConfig (open-build tengu_sm_config shape)', () => {
  beforeEach(() => resetSessionMemoryState())

  test('planned 35k init / 20k growth thresholds behave as configured', () => {
    setSessionMemoryConfig({
      minimumMessageTokensToInit: 35_000,
      minimumTokensBetweenUpdate: 20_000,
    })
    expect(hasMetInitializationThreshold(34_999)).toBe(false)
    expect(hasMetInitializationThreshold(35_000)).toBe(true)
    // extraction near peak, then compact shrink → re-anchor applies with
    // the configured growth, not the default
    recordExtractionTokenCount(400_000)
    expect(hasMetUpdateThreshold(41_000)).toBe(false)
    expect(hasMetUpdateThreshold(61_000)).toBe(true)
  })
})
