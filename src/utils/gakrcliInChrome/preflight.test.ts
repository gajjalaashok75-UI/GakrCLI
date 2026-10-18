import { afterEach, describe, expect, test } from 'bun:test'
import { CHROME_EXTENSION_ID_ENV_VAR } from './extensionId.js'
import {
  deriveGakrCLIInChromeWarnings,
  formatGakrCLIInChromeWarnings,
  getGakrCLIInChromeSyncWarnings,
} from './preflight.js'
import { saveChromeExtensionId } from './setup.js'

afterEach(() => {
  delete process.env[CHROME_EXTENSION_ID_ENV_VAR]
  saveChromeExtensionId(null)
})

describe('getGakrCLIInChromeSyncWarnings', () => {
  test('reports a stored value that is not a valid extension id', () => {
    saveChromeExtensionId('definitely-not-an-id')
    const warnings = getGakrCLIInChromeSyncWarnings('mcp-server')
    const invalid = warnings.find(w => w.message.includes('not a valid Chrome extension id'))
    expect(invalid).toBeDefined()
    expect(invalid?.level).toBe('error')
    expect(invalid?.message).toContain('definitely-not-an-id')
  })

  test('does not report the id on its own — the manifest check covers mismatches', () => {
    const warnings = getGakrCLIInChromeSyncWarnings('terminal')
    expect(warnings.some(w => w.message.includes('no extension id configured'))).toBe(
      false,
    )
  })
})

describe('deriveGakrCLIInChromeWarnings', () => {
  const base = {
    syncWarnings: [],
    extensionId: null,
    extensionInstalled: true,
    nativeHostReachable: true,
  }

  test('is silent when the extension is detected and the host answers', () => {
    expect(deriveGakrCLIInChromeWarnings(base)).toEqual([])
  })

  test('asks for an id only when no known id was detected', () => {
    const warnings = deriveGakrCLIInChromeWarnings({
      ...base,
      extensionInstalled: false,
    })
    const unset = warnings.find(w => w.message.includes('no extension id configured'))
    expect(unset).toBeDefined()
    expect(unset?.fix).toContain('/chrome')

    const withId = deriveGakrCLIInChromeWarnings({
      ...base,
      extensionInstalled: false,
      extensionId: 'abcdefghijklmnopabcdefghijklmnop',
    })
    expect(
      withId.some(w => w.message.includes('no extension id configured')),
    ).toBe(false)
  })

  test('reports a missing extension even when an id is configured', () => {
    const warnings = deriveGakrCLIInChromeWarnings({
      ...base,
      extensionInstalled: false,
      extensionId: 'abcdefghijklmnopabcdefghijklmnop',
    })
    expect(warnings.some(w => w.message.includes('extension not found'))).toBe(true)
  })

  test('reports the socket only for surfaces that use it', () => {
    const terminal = deriveGakrCLIInChromeWarnings({
      ...base,
      nativeHostReachable: false,
    })
    expect(terminal.some(w => w.message.includes('no native-host socket'))).toBe(true)

    // null means the surface does not probe the socket at all.
    const sidePanel = deriveGakrCLIInChromeWarnings({
      ...base,
      nativeHostReachable: null,
    })
    expect(sidePanel.some(w => w.message.includes('no native-host socket'))).toBe(
      false,
    )
  })

  test('keeps the sync warnings it was given', () => {
    const warnings = deriveGakrCLIInChromeWarnings({
      ...base,
      syncWarnings: [{ level: 'error', message: 'manifest missing' }],
    })
    expect(warnings[0]?.message).toBe('manifest missing')
  })
})

describe('formatGakrCLIInChromeWarnings', () => {
  test('emits the message and an indented fix line', () => {
    expect(
      formatGakrCLIInChromeWarnings([
        { level: 'error', message: 'broken', fix: 'run /chrome' },
        { level: 'warning', message: 'maybe' },
      ]),
    ).toEqual(['broken (error)', '  → run /chrome', 'maybe'])
  })

  test('produces no lines for a healthy setup', () => {
    expect(formatGakrCLIInChromeWarnings([])).toEqual([])
  })
})
