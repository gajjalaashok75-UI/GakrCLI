/**
 * Chrome extension identity for GakrCLI in Chrome.
 *
 * The extension is distributed as a packed/unpacked build hosted on the
 * GakrCLI docs site rather than the Chrome Web Store. A side-loaded extension
 * gets an id derived from its install path (or its manifest `key`), so the id
 * is *not* a compile-time constant: every user's id can differ. Everything
 * that has to name the extension — native-messaging `allowed_origins`,
 * install detection, and the connection preflight — reads the id from here.
 *
 * This module is intentionally dependency-free (no config, no fs) so the
 * portable detector and the VS Code extension can import it.
 */

/** Where the extension, its zip, and the setup guide live. */
export const GAKR_IN_CHROME_DOCS_URL =
  'https://gakrcli.netlify.app/docs/gakrcli-in-chrome/'

/** Publish-ready unpacked extension bundle served from the docs site. */
export const CHROME_EXTENSION_ZIP_URL = `${GAKR_IN_CHROME_DOCS_URL}gakrcli-in-chrome.zip`

/** Overrides the stored id, for scripts and CI. */
export const CHROME_EXTENSION_ID_ENV_VAR = 'GAKR_CHROME_EXTENSION_ID'

/** Id the CLI has historically registered for side-loaded local builds. */
export const LOCAL_EXTENSION_ID = 'galhhbpfeohnjpakdahodhcpnohddjob'
/** Id of the store-published extension, if it is ever published. */
export const PRODUCTION_EXTENSION_ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn'
/** Internal dev build. */
export const DEV_EXTENSION_ID = 'dihbgbndebgnbjfmelmegjepbnkhlgni'
/** Internal (ant) build. */
export const ANT_EXTENSION_ID = 'dngcpimnedloihjnnfngkgjoidhnaolf'

/**
 * Ids a normal install may have, in the order they have always been listed in
 * the native-host manifest — the manifest is only rewritten when its content
 * changes, so keeping the order avoids churning it (and the reconnect prompt)
 * for installs that are already working.
 */
export const DEFAULT_CHROME_EXTENSION_IDS: readonly string[] = [
  LOCAL_EXTENSION_ID,
  PRODUCTION_EXTENSION_ID,
]

/** Extra ids only internal (`USER_TYPE=ant`) installs carry. */
export const INTERNAL_CHROME_EXTENSION_IDS: readonly string[] = [
  DEV_EXTENSION_ID,
  ANT_EXTENSION_ID,
]

/** Chrome ids are 32 characters drawn from `a`-`p` (base16 of the key hash). */
export function isValidChromeExtensionId(id: string): boolean {
  return /^[a-p]{32}$/.test(id)
}

/**
 * Accept a pasted id in any of the shapes users copy it in — bare, from
 * `chrome-extension://<id>/...`, with surrounding whitespace or quotes — and
 * return the canonical 32-character id, or null when it is not a valid id.
 */
export function parseChromeExtensionId(raw: string): string | null {
  let value = raw.trim().replace(/^["'`]|["'`]$/g, '')
  value = value.replace(/^chrome-extension:\/\//i, '')
  value = value.split(/[/?#]/)[0] ?? ''
  value = value.trim().toLowerCase()
  return isValidChromeExtensionId(value) ? value : null
}

/** Read the env override, if one is set to a valid id. */
export function getChromeExtensionIdFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env[CHROME_EXTENSION_ID_ENV_VAR]
  return raw ? parseChromeExtensionId(raw) : null
}
