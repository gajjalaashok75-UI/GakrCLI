import { describe, expect, test } from 'bun:test'

import type { OptionWithDescription } from './select.js'
import { optionsNavigateEqual } from './use-select-navigation.js'

function option<T>(
  value: T,
  overrides: Partial<OptionWithDescription<T>> = {},
): OptionWithDescription<T> {
  return {
    label: String(value),
    value,
    ...overrides,
  }
}

describe('optionsNavigateEqual', () => {
  test('ignores identity-unstable labels and callbacks', () => {
    const first = [
      option('a', {
        label: { type: 'text', props: { children: 'A' } },
        onChange: () => undefined,
      }),
    ]
    const second = [
      option('a', {
        label: { type: 'text', props: { children: 'A' } },
        onChange: () => undefined,
      }),
    ]

    expect(optionsNavigateEqual(first, second)).toBe(true)
  })

  test('detects navigation-relevant option changes', () => {
    expect(optionsNavigateEqual([option('a')], [option('b')])).toBe(false)
    expect(
      optionsNavigateEqual(
        [option('a', { disabled: false })],
        [option('a', { disabled: true })],
      ),
    ).toBe(false)
    expect(
      optionsNavigateEqual(
        [option('a', { type: 'text' })],
        [option('a', { type: 'input', onChange: () => undefined })],
      ),
    ).toBe(false)
  })
})
