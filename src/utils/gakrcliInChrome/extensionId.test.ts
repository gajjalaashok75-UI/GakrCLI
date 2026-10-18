import { describe, expect, test } from 'bun:test'
import {
  CHROME_EXTENSION_ID_ENV_VAR,
  CHROME_EXTENSION_ZIP_URL,
  DEFAULT_CHROME_EXTENSION_IDS,
  GAKR_IN_CHROME_DOCS_URL,
  LOCAL_EXTENSION_ID,
  PRODUCTION_EXTENSION_ID,
  getChromeExtensionIdFromEnv,
  isValidChromeExtensionId,
  parseChromeExtensionId,
} from './extensionId.js'

describe('isValidChromeExtensionId', () => {
  test('accepts 32 characters from a-p', () => {
    expect(isValidChromeExtensionId(LOCAL_EXTENSION_ID)).toBe(true)
    expect(isValidChromeExtensionId(PRODUCTION_EXTENSION_ID)).toBe(true)
  })

  test('rejects wrong length, out-of-range characters, and empty input', () => {
    expect(isValidChromeExtensionId('')).toBe(false)
    expect(isValidChromeExtensionId('abcd')).toBe(false)
    expect(isValidChromeExtensionId('galhhbpfeohnjpakdahodhcpnohddjo')).toBe(false)
    expect(isValidChromeExtensionId('zalhhbpfeohnjpakdahodhcpnohddjob')).toBe(
      false,
    )
  })
})

describe('parseChromeExtensionId', () => {
  test('accepts a bare id, including surrounding whitespace and quotes', () => {
    expect(parseChromeExtensionId(LOCAL_EXTENSION_ID)).toBe(LOCAL_EXTENSION_ID)
    expect(parseChromeExtensionId(`  "${LOCAL_EXTENSION_ID}"  `)).toBe(
      LOCAL_EXTENSION_ID,
    )
  })

  test('accepts a pasted extension URL', () => {
    expect(
      parseChromeExtensionId(`chrome-extension://${LOCAL_EXTENSION_ID}/sidepanel.html`),
    ).toBe(LOCAL_EXTENSION_ID)
    expect(parseChromeExtensionId(`chrome-extension://${LOCAL_EXTENSION_ID}/`)).toBe(
      LOCAL_EXTENSION_ID,
    )
  })

  test('lowercases and returns null for anything that is not an id', () => {
    expect(parseChromeExtensionId(LOCAL_EXTENSION_ID.toUpperCase())).toBe(
      LOCAL_EXTENSION_ID,
    )
    expect(parseChromeExtensionId('not-an-id')).toBeNull()
    expect(parseChromeExtensionId('')).toBeNull()
  })
})

describe('getChromeExtensionIdFromEnv', () => {
  test('reads the override variable', () => {
    expect(
      getChromeExtensionIdFromEnv({
        [CHROME_EXTENSION_ID_ENV_VAR]: LOCAL_EXTENSION_ID,
      }),
    ).toBe(LOCAL_EXTENSION_ID)
  })

  test('returns null when unset or invalid', () => {
    expect(getChromeExtensionIdFromEnv({})).toBeNull()
    expect(
      getChromeExtensionIdFromEnv({ [CHROME_EXTENSION_ID_ENV_VAR]: 'nope' }),
    ).toBeNull()
  })
})

describe('docs URLs', () => {
  test('the zip download lives under the docs page', () => {
    expect(GAKR_IN_CHROME_DOCS_URL).toBe(
      'https://gakrcli.netlify.app/docs/gakrcli-in-chrome/',
    )
    expect(CHROME_EXTENSION_ZIP_URL).toBe(
      `${GAKR_IN_CHROME_DOCS_URL}gakrcli-in-chrome.zip`,
    )
  })

  test('built-in ids remain valid and distinct', () => {
    expect(new Set(DEFAULT_CHROME_EXTENSION_IDS).size).toBe(
      DEFAULT_CHROME_EXTENSION_IDS.length,
    )
    for (const id of DEFAULT_CHROME_EXTENSION_IDS) {
      expect(isValidChromeExtensionId(id)).toBe(true)
    }
  })
})
