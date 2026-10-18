import { afterEach, describe, expect, test } from 'bun:test'
import { CHROME_EXTENSION_ID_ENV_VAR } from './extensionId.js'
import {
  buildNativeHostAllowedOrigins,
  getConfiguredChromeExtensionId,
  resolveChromeExtensionIdInput,
  saveChromeExtensionId,
} from './setup.js'
import { getGlobalConfig } from '../config.js'

const CUSTOM_ID = 'abcdefghijklmnopabcdefghijklmnop'
const OTHER_ID = 'ponmlkjihgfedcbaponmlkjihgfedcba'

afterEach(() => {
  delete process.env[CHROME_EXTENSION_ID_ENV_VAR]
  saveChromeExtensionId(null)
})

describe('getConfiguredChromeExtensionId', () => {
  test('is unset until the user sets an id', () => {
    expect(getConfiguredChromeExtensionId()).toEqual({
      id: null,
      source: null,
    })
  })

  test('reads the id stored in the global config', () => {
    saveChromeExtensionId(CUSTOM_ID)
    expect(getConfiguredChromeExtensionId()).toEqual({
      id: CUSTOM_ID,
      source: 'config',
    })
  })

  test('lets the environment override the stored id', () => {
    saveChromeExtensionId(CUSTOM_ID)
    process.env[CHROME_EXTENSION_ID_ENV_VAR] = OTHER_ID
    expect(getConfiguredChromeExtensionId()).toEqual({
      id: OTHER_ID,
      source: 'env',
    })
  })

  test('treats a stored value that is not a valid id as unset', () => {
    saveChromeExtensionId('definitely-not-an-id')
    expect(getConfiguredChromeExtensionId()).toEqual({
      id: null,
      source: null,
    })
    // The bad value is still on disk, so the preflight can report it.
    expect(getGlobalConfig().chromeExtensionId).toBe('definitely-not-an-id')
  })

  test('clearing removes the stored id', () => {
    saveChromeExtensionId(CUSTOM_ID)
    saveChromeExtensionId(null)
    expect(getGlobalConfig().chromeExtensionId).toBeUndefined()
  })
})

describe('buildNativeHostAllowedOrigins', () => {
  test('lists the configured id before the built-in ones', () => {
    const origins = buildNativeHostAllowedOrigins([CUSTOM_ID, 'galhhbpfeohnjpakdahodhcpnohddjob'])
    expect(origins).toEqual([
      `chrome-extension://${CUSTOM_ID}/`,
      'chrome-extension://galhhbpfeohnjpakdahodhcpnohddjob/',
    ])
  })

  test('defaults to the ids currently in play', () => {
    saveChromeExtensionId(CUSTOM_ID)
    process.env[CHROME_EXTENSION_ID_ENV_VAR] = OTHER_ID
    const origins = buildNativeHostAllowedOrigins()
    expect(origins[0]).toBe(`chrome-extension://${OTHER_ID}/`)
    // The configured id is not in play while the env override wins, but the
    // built-in ids must stay listed so an already-working install keeps working.
    expect(origins).toContain(
      'chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/',
    )
  })
})

describe('resolveChromeExtensionIdInput', () => {
  test('accepts a bare id and a pasted extension URL', () => {
    expect(resolveChromeExtensionIdInput(CUSTOM_ID)).toEqual({
      ok: true,
      id: CUSTOM_ID,
    })
    expect(
      resolveChromeExtensionIdInput(`chrome-extension://${CUSTOM_ID}/sidepanel.html`),
    ).toEqual({ ok: true, id: CUSTOM_ID })
  })

  test('explains an empty and a malformed value', () => {
    const empty = resolveChromeExtensionIdInput('   ')
    expect(empty.ok).toBe(false)
    if (!empty.ok) {
      expect(empty.error).toContain('chrome://extensions')
    }

    const malformed = resolveChromeExtensionIdInput('hello')
    expect(malformed.ok).toBe(false)
    if (!malformed.ok) {
      expect(malformed.error).toContain('32 characters')
    }
  })
})
