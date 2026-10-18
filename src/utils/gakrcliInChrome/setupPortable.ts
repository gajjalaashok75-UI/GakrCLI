import type { Dirent } from 'fs'
import { readFile, readdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { isFsInaccessible } from '../errors.js'
import {
  DEFAULT_CHROME_EXTENSION_IDS,
  GAKR_IN_CHROME_DOCS_URL,
} from './extensionId.js'

/** Setup guide; the extension is side-loaded from here, not the Web Store. */
export const CHROME_EXTENSION_URL = GAKR_IN_CHROME_DOCS_URL

// Must match ChromiumBrowser from common.ts
export type ChromiumBrowser =
  | 'chrome'
  | 'brave'
  | 'arc'
  | 'chromium'
  | 'edge'
  | 'vivaldi'
  | 'opera'

export type BrowserPath = {
  browser: ChromiumBrowser
  path: string
}

type Logger = (message: string) => void

// Browser detection order - must match BROWSER_DETECTION_ORDER from common.ts
const BROWSER_DETECTION_ORDER: ChromiumBrowser[] = [
  'chrome',
  'brave',
  'arc',
  'edge',
  'chromium',
  'vivaldi',
  'opera',
]

type BrowserDataConfig = {
  macos: string[]
  linux: string[]
  windows: { path: string[]; useRoaming?: boolean }
}

// Must match CHROMIUM_BROWSERS dataPath from common.ts
const CHROMIUM_BROWSERS: Record<ChromiumBrowser, BrowserDataConfig> = {
  chrome: {
    macos: ['Library', 'Application Support', 'Google', 'Chrome'],
    linux: ['.config', 'google-chrome'],
    windows: { path: ['Google', 'Chrome', 'User Data'] },
  },
  brave: {
    macos: ['Library', 'Application Support', 'BraveSoftware', 'Brave-Browser'],
    linux: ['.config', 'BraveSoftware', 'Brave-Browser'],
    windows: { path: ['BraveSoftware', 'Brave-Browser', 'User Data'] },
  },
  arc: {
    macos: ['Library', 'Application Support', 'Arc', 'User Data'],
    linux: [],
    windows: { path: ['Arc', 'User Data'] },
  },
  chromium: {
    macos: ['Library', 'Application Support', 'Chromium'],
    linux: ['.config', 'chromium'],
    windows: { path: ['Chromium', 'User Data'] },
  },
  edge: {
    macos: ['Library', 'Application Support', 'Microsoft Edge'],
    linux: ['.config', 'microsoft-edge'],
    windows: { path: ['Microsoft', 'Edge', 'User Data'] },
  },
  vivaldi: {
    macos: ['Library', 'Application Support', 'Vivaldi'],
    linux: ['.config', 'vivaldi'],
    windows: { path: ['Vivaldi', 'User Data'] },
  },
  opera: {
    macos: ['Library', 'Application Support', 'com.operasoftware.Opera'],
    linux: ['.config', 'opera'],
    windows: { path: ['Opera Software', 'Opera Stable'], useRoaming: true },
  },
}

/**
 * Get all browser data paths to check for extension installation.
 * Portable version that uses process.platform directly.
 */
export function getAllBrowserDataPathsPortable(): BrowserPath[] {
  const home = homedir()
  const paths: BrowserPath[] = []

  for (const browserId of BROWSER_DETECTION_ORDER) {
    const config = CHROMIUM_BROWSERS[browserId]
    let dataPath: string[] | undefined

    switch (process.platform) {
      case 'darwin':
        dataPath = config.macos
        break
      case 'linux':
        dataPath = config.linux
        break
      case 'win32': {
        if (config.windows.path.length > 0) {
          const appDataBase = config.windows.useRoaming
            ? join(home, 'AppData', 'Roaming')
            : join(home, 'AppData', 'Local')
          paths.push({
            browser: browserId,
            path: join(appDataBase, ...config.windows.path),
          })
        }
        continue
      }
    }

    if (dataPath && dataPath.length > 0) {
      paths.push({
        browser: browserId,
        path: join(home, ...dataPath),
      })
    }
  }

  return paths
}

/**
 * Detects if the GakrCLI in Chrome extension is installed by checking the Extensions
 * directory across all supported Chromium-based browsers and their profiles.
 *
 * This is a portable version that can be used by both TUI and VS Code extension.
 *
 * @param browserPaths - Array of browser data paths to check (from getAllBrowserDataPaths)
 * @param log - Optional logging callback for debug messages
 * @param extensionIds - Ids to look for; defaults to the built-in ones. Callers
 *   pass the configured id first, because a side-loaded extension's id differs
 *   per machine and none of the built-in ids would match.
 * @returns Object with isInstalled boolean and the browser where the extension was found
 */
export async function detectExtensionInstallationPortable(
  browserPaths: BrowserPath[],
  log?: Logger,
  extensionIds: readonly string[] = DEFAULT_CHROME_EXTENSION_IDS,
): Promise<{
  isInstalled: boolean
  browser: ChromiumBrowser | null
}> {
  if (browserPaths.length === 0) {
    log?.(`[GakrCLI in Chrome] No browser paths to check`)
    return { isInstalled: false, browser: null }
  }

  // Check each browser for the extension
  for (const { browser, path: browserBasePath } of browserPaths) {
    let browserProfileEntries: Dirent[] = []

    try {
      browserProfileEntries = await readdir(browserBasePath, {
        withFileTypes: true,
      })
    } catch (e) {
      // Browser not installed or path doesn't exist, continue to next browser
      if (isFsInaccessible(e)) continue
      throw e
    }

    const profileDirs = browserProfileEntries
      .filter(entry => entry.isDirectory())
      .filter(
        entry => entry.name === 'Default' || entry.name.startsWith('Profile '),
      )
      .map(entry => entry.name)

    if (profileDirs.length > 0) {
      log?.(
        `[GakrCLI in Chrome] Found ${browser} profiles: ${profileDirs.join(', ')}`,
      )
    }

    // Check each profile for any of the extension IDs
    for (const profile of profileDirs) {
      for (const extensionId of extensionIds) {
        const extensionPath = join(
          browserBasePath,
          profile,
          'Extensions',
          extensionId,
        )

        try {
          await readdir(extensionPath)
          log?.(
            `[GakrCLI in Chrome] Extension ${extensionId} found in ${browser} ${profile}`,
          )
          return { isInstalled: true, browser }
        } catch {
          // Not installed from the store in this profile; the settings
          // fallback below covers developer-mode loads.
        }
      }

      // Chrome never unpacks a developer-mode extension into
      // `<profile>/Extensions/<id>`; it records it only in the profile's
      // extension settings. Without this check a side-loaded extension reads
      // as "not installed", disabling auto-enable and the reconnect prompt.
      for (const extensionId of extensionIds) {
        if (
          await profileExtensionSettingsContain(
            browserBasePath,
            profile,
            extensionId,
          )
        ) {
          log?.(
            `[GakrCLI in Chrome] Extension ${extensionId} found in ${browser} ${profile} extension settings (unpacked)`,
          )
          return { isInstalled: true, browser }
        }
      }
    }
  }

  log?.(`[GakrCLI in Chrome] Extension not found in any browser`)
  return { isInstalled: false, browser: null }
}

/** Profile files that hold the `extensions.settings` map. */
const EXTENSION_SETTINGS_FILES = ['Secure Preferences', 'Preferences']

/**
 * True when the profile's extension settings contain an entry for this id.
 *
 * The id is the JSON key its settings entry is filed under, so a quoted-id
 * substring match avoids parsing multi-megabyte preference files.
 */
async function profileExtensionSettingsContain(
  browserBasePath: string,
  profile: string,
  extensionId: string,
): Promise<boolean> {
  const needle = `"${extensionId}"`
  for (const fileName of EXTENSION_SETTINGS_FILES) {
    try {
      const raw = await readFile(
        join(browserBasePath, profile, fileName),
        'utf8',
      )
      if (raw.includes(needle)) {
        return true
      }
    } catch (e) {
      if (!isFsInaccessible(e)) {
        throw e
      }
    }
  }
  return false
}

/**
 * Simple wrapper that returns just the boolean result
 */
export async function isChromeExtensionInstalledPortable(
  browserPaths: BrowserPath[],
  log?: Logger,
  extensionIds?: readonly string[],
): Promise<boolean> {
  const result = await detectExtensionInstallationPortable(
    browserPaths,
    log,
    extensionIds,
  )
  return result.isInstalled
}

/**
 * Convenience function that gets browser paths automatically.
 * Use this when you don't need to provide custom browser paths.
 */
export function isChromeExtensionInstalled(log?: Logger): Promise<boolean> {
  const browserPaths = getAllBrowserDataPathsPortable()
  return isChromeExtensionInstalledPortable(browserPaths, log)
}
