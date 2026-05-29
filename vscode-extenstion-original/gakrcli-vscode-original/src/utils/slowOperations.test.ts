import { describe, expect, test } from 'bun:test'

import { jsonParse } from './slowOperations.js'

describe('jsonParse', () => {
  test('accepts JSON files with a UTF-8 BOM', () => {
    expect(jsonParse('\uFEFF{"name":"gakrcli-plugins-official"}')).toEqual({
      name: 'gakrcli-plugins-official',
    })
  })

  test('keeps reviver behavior when stripping a BOM', () => {
    const parsed = jsonParse('\uFEFF{"enabled":true}', (key, value) =>
      key === 'enabled' ? false : value,
    )

    expect(parsed).toEqual({ enabled: false })
  })
})
