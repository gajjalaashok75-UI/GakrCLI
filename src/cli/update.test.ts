import { describe, expect, test } from 'bun:test'
import { withMockMacro } from 'src/test/mockMacro.js'
import { getGlobalUpdateFailureHint } from './update.js'

describe('getGlobalUpdateFailureHint', () => {
  test('points npm-only builds at npm instead of the native installer', () => {
    withMockMacro({ PACKAGE_URL: '@gakr-gakr/gakrcli' }, () => {
      expect(getGlobalUpdateFailureHint(false)).toContain(
        'npm install -g @gakr-gakr/gakrcli@latest',
      )
      expect(getGlobalUpdateFailureHint(false)).not.toContain(
        'gakrcli install',
      )
    })
  })

  test('preserves native installer guidance for native-capable builds', () => {
    expect(getGlobalUpdateFailureHint(true)).toBe(
      'Or consider using native installation with: gakrcli install\n',
    )
  })
})
