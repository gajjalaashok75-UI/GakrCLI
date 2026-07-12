import { describe, expect, test } from 'bun:test'
import { withMockMacro } from 'src/test/mockMacro.js'
import { getNativeInstallUnavailableFix } from './doctorDiagnostic.js'

describe('getNativeInstallUnavailableFix', () => {
  test('uses npm guidance when this build has no native distribution', () => {
    withMockMacro({ PACKAGE_URL: '@gakr-gakr/gakrcli' }, () => {
      for (const reason of [
        'local-config',
        'local-overlap',
        'global-permissions',
        'native-config',
      ] as const) {
        const fix = getNativeInstallUnavailableFix(reason, false)
        expect(fix).toContain('npm install -g @gakr-gakr/gakrcli@latest')
        expect(fix).not.toContain('gakrcli install')
        expect(fix).not.toContain('native installation')
      }
    })
  })

  test('preserves native install guidance for native-capable builds', () => {
    withMockMacro({ PACKAGE_URL: '@gakr-gakr/gakrcli' }, () => {
      expect(getNativeInstallUnavailableFix('local-config', true)).toContain(
        'gakrcli install',
      )
      expect(
        getNativeInstallUnavailableFix('global-permissions', true),
      ).toContain('native installation')
    })
  })
})
