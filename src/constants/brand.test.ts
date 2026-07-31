import { describe, expect, test } from 'bun:test'
import {
  BRAND_ACCENT_RGB,
  WORDMARK_GAKRCLI,
  WORDMARK_WIDTH,
} from './brand.js'

describe('wordmark', () => {
  test('contains at least one row', () => {
    expect(WORDMARK_GAKRCLI.length).toBeGreaterThan(0)
  })

  test('all rows are non-empty strings', () => {
    for (const row of WORDMARK_GAKRCLI) {
      expect(typeof row).toBe('string')
      expect(row.length).toBeGreaterThan(0)
    }
  })

  test('WORDMARK_WIDTH matches the longest rendered row', () => {
    const longestRow = Math.max(
      ...WORDMARK_GAKRCLI.map(row => row.length),
    )

    expect(WORDMARK_WIDTH).toBe(longestRow)
  })

  test('all rows fit within WORDMARK_WIDTH', () => {
    for (const row of WORDMARK_GAKRCLI) {
      expect(row.length).toBeLessThanOrEqual(WORDMARK_WIDTH)
    }
  })

  test('wordmark renders consistently', () => {
    expect(WORDMARK_GAKRCLI).toEqual([
      ' ██████╗  █████╗ ██╗  ██╗██████╗  ██████╗██╗     ██╗',
      '██╔════╝ ██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║     ██║',
      '██║  ███╗███████║█████╔╝ ██████╔╝██║     ██║     ██║',
      '██║   ██║██╔══██║██╔═██╗ ██╔══██╗██║     ██║     ██║',
      '╚██████╔╝██║  ██║██║  ██╗██║  ██║╚██████╗███████╗██║',
      ' ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝',
    ])
  })
})

describe('brand accent', () => {
  test('stays in rgb() form required by theme consumers', () => {
    expect(BRAND_ACCENT_RGB).toMatch(
      /^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/,
    )
  })
})