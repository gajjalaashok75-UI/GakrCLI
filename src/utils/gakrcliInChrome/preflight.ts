/**
 * Preflight for the GakrCLI-in-Chrome surfaces.
 *
 * The extension is side-loaded, so a working setup depends on runtime state
 * that can silently be wrong: an id that the native-messaging manifest does not
 * list, a manifest that was never written, Chrome not running, or the
 * terminal backend not started. Each entry point checks that state,
 * reports what is actually wrong, and then starts anyway — a hard failure here
 * would be worse than a degraded session, since the tool-call path already
 * reports its own errors.
 */

import { existsSync, readFileSync } from 'fs'
import { connect } from 'net'
import { GAKR_IN_CHROME_DOCS_URL } from './extensionId.js'
import { logForDebugging } from '../debug.js'
import { getGlobalConfig } from '../config.js'
import { getAllSocketPaths } from './common.js'
import { readDiscoveryPort } from './terminalBackend/discovery.js'
import {
  getConfiguredChromeExtensionId,
  getNativeHostManifestPaths,
  isChromeExtensionInstalled,
  type ChromeExtensionIdSource,
} from './setup.js'

export type GakrCLIInChromeSurface =
  | 'terminal'
  | 'mcp-server'
  | 'side-panel'
  | 'native-host'

type Warning = { level: 'error' | 'warning'; message: string; fix?: string }

export type GakrCLIInChromeStatus = {
  surface: GakrCLIInChromeSurface
  extensionId: string | null
  extensionIdSource: ChromeExtensionIdSource
  /** Set when ~/.gakrcli.json holds a value that is not a valid extension id. */
  invalidStoredExtensionId: string | null
  extensionInstalled: boolean
  nativeHostManifestPath: string | null
  nativeHostManifestAllowsId: boolean
  /** null when the surface does not need the native-host socket. */
  nativeHostReachable: boolean | null
  terminalBackendRunning: boolean
  warnings: Warning[]
  ready: boolean
}

/** Surfaces that talk to the extension through the native-host socket. */
function needsNativeHostSocket(surface: GakrCLIInChromeSurface): boolean {
  return surface === 'terminal' || surface === 'mcp-server'
}

const SET_ID_FIX = `Run /chrome → "Set Chrome extension ID" (or add chromeExtensionId to ~/.gakrcli.json). Guide: ${GAKR_IN_CHROME_DOCS_URL}`

/**
 * Checks that need no I/O: is an id configured, is the stored one valid, and
 * does the persisted manifest list it. Used on startup paths where an async
 * probe would delay the first paint (or the MCP handshake).
 */
export function getGakrCLIInChromeSyncWarnings(
  surface: GakrCLIInChromeSurface,
): Warning[] {
  const warnings: Warning[] = []
  const configured = getConfiguredChromeExtensionId()
  const stored = getGlobalConfig().chromeExtensionId
  const manifestPaths = getNativeHostManifestPaths()
  const existing = manifestPaths.filter(path => existsSync(path))
  // `--chrome` writes the manifest during setup, which runs after this
  // preflight, so a missing or stale manifest on the terminal surface is
  // expected on a first run and must not read as a failure the user cannot
  // fix by doing what they already did.
  const manifestLevel: Warning['level'] =
    surface === 'terminal' ? 'warning' : 'error'
  const manifestFix =
    surface === 'terminal'
      ? 'Setup writes it on this run; if the warning persists, run /chrome → "Re-register native host".'
      : 'Run /chrome → "Re-register native host", or gakrcli --chrome once so setup can write it.'

  if (stored && !configured.id) {
    warnings.push({
      level: 'error',
      message: `[gakrcli-in-chrome] chromeExtensionId in ~/.gakrcli.json is not a valid Chrome extension id: ${stored}`,
      fix: SET_ID_FIX,
    })
  }

  if (existing.length === 0) {
    warnings.push({
      level: manifestLevel,
      message:
        '[gakrcli-in-chrome] the native-messaging manifest is not installed; Chrome cannot start the native host',
      fix: manifestFix,
    })
  } else if (configured.id) {
    const manifest = readNativeHostManifest(existing[0]!)
    const allowed = manifest?.allowed_origins ?? []
    if (!allowed.includes(`chrome-extension://${configured.id}/`)) {
      warnings.push({
        level: manifestLevel,
        message: `[gakrcli-in-chrome] the native-messaging manifest does not allow extension ${configured.id}`,
        fix: manifestFix,
      })
    }
  }

  return warnings
}

function readNativeHostManifest(
  path: string,
): { allowed_origins?: string[] } | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as { allowed_origins?: string[] }
  } catch {
    return null
  }
}

/** True when something is listening on the native-host socket. */
async function probeNativeHostSocket(): Promise<boolean> {
  for (const path of getAllSocketPaths()) {
    const connected = await new Promise<boolean>(resolvePromise => {
      const conn = connect(path)
      const finish = (value: boolean): void => {
        clearTimeout(timer)
        conn.destroy()
        resolvePromise(value)
      }
      const timer = setTimeout(() => finish(false), 1_000)
      timer.unref?.()
      conn.once('connect', () => finish(true))
      conn.once('error', () => finish(false))
    })
    if (connected) {
      return true
    }
  }
  return false
}

/**
 * Warnings that depend on the live probe. Kept pure so the combinations can be
 * asserted without a browser or a socket.
 */
export function deriveGakrCLIInChromeWarnings({
  syncWarnings,
  extensionId,
  extensionInstalled,
  nativeHostReachable,
}: {
  syncWarnings: Warning[]
  extensionId: string | null
  extensionInstalled: boolean
  nativeHostReachable: boolean | null
}): Warning[] {
  const warnings = [...syncWarnings]

  if (!extensionInstalled) {
    warnings.push({
      level: 'warning',
      message:
        '[gakrcli-in-chrome] extension not found in any Chrome profile — load it unpacked from the docs site',
      fix: `Download and load: ${GAKR_IN_CHROME_DOCS_URL}`,
    })
    // An unset id is only worth reporting when nothing was detected: if a
    // built-in id matched, the user loaded a build that does not need this.
    if (!extensionId) {
      warnings.push({
        level: 'warning',
        message:
          '[gakrcli-in-chrome] no extension id configured, and no known id was detected',
        fix: SET_ID_FIX,
      })
    }
  }

  if (nativeHostReachable === false) {
    warnings.push({
      level: 'warning',
      message:
        '[gakrcli-in-chrome] no native-host socket — Chrome is closed, the extension is not enabled, or allowed_origins does not match',
      fix: 'Open Chrome with the extension enabled, then retry.',
    })
  }

  return warnings
}

/** Full status for the `/chrome` dialog and for startup logging. */
export async function getGakrCLIInChromeStatus(
  surface: GakrCLIInChromeSurface,
): Promise<GakrCLIInChromeStatus> {
  const configured = getConfiguredChromeExtensionId()
  const stored = getGlobalConfig().chromeExtensionId
  const syncWarnings = getGakrCLIInChromeSyncWarnings(surface)

  const [installed, reachable, port] = await Promise.all([
    isChromeExtensionInstalled().catch(() => false),
    needsNativeHostSocket(surface)
      ? probeNativeHostSocket()
      : Promise.resolve<boolean | null>(null),
    readDiscoveryPort(),
  ])

  const warnings = deriveGakrCLIInChromeWarnings({
    syncWarnings,
    extensionId: configured.id,
    extensionInstalled: installed,
    nativeHostReachable: reachable,
  })

  const manifestPaths = getNativeHostManifestPaths()
  const existing = manifestPaths.find(path => existsSync(path)) ?? null
  const allowed = existing
    ? (readNativeHostManifest(existing)?.allowed_origins ?? [])
    : []

  return {
    surface,
    extensionId: configured.id,
    extensionIdSource: configured.source,
    invalidStoredExtensionId:
      stored && !configured.id ? stored : null,
    extensionInstalled: installed,
    nativeHostManifestPath: existing,
    nativeHostManifestAllowsId:
      configured.id !== null && allowed.includes(`chrome-extension://${configured.id}/`),
    nativeHostReachable: reachable,
    terminalBackendRunning: port !== null,
    warnings,
    ready: !warnings.some(w => w.level === 'error'),
  }
}

export function formatGakrCLIInChromeWarnings(warnings: Warning[]): string[] {
  return warnings.flatMap(({ level, message, fix }) => [
    `${message}${level === 'error' ? ' (error)' : ''}`,
    ...(fix ? [`  → ${fix}`] : []),
  ])
}

/**
 * A preflight that fails must say so where the user can see it: the debug log
 * alone is invisible unless `--debug` is on, which is exactly when a silent
 * `null` is hardest to explain.
 */
function reportPreflightFailure(
  error: unknown,
  surface: GakrCLIInChromeSurface,
): void {
  const message = `[gakrcli-in-chrome] preflight failed: ${
    error instanceof Error ? error.message : String(error)
  }`
  logForDebugging(message)
  if (surface !== 'native-host') {
    writeLines([message], surface)
  }
}

function writeLines(lines: string[], surface: GakrCLIInChromeSurface): void {
  if (lines.length === 0) {
    return
  }
  // Chrome spawns the native host with its own pipes for the messaging
  // protocol, so that surface only ever writes to the debug log.
  if (surface === 'native-host') {
    for (const line of lines) {
      logForDebugging(line)
    }
    return
  }
  process.stderr.write(`${lines.join('\n')}\n`)
}

/**
 * Report the sync checks on a startup path. Never throws and never writes to
 * stdout — the stdio MCP server owns stdout for its protocol.
 */
export function logGakrCLIInChromeSyncPreflight(
  surface: GakrCLIInChromeSurface,
): void {
  try {
    writeLines(
      formatGakrCLIInChromeWarnings(getGakrCLIInChromeSyncWarnings(surface)),
      surface,
    )
  } catch (error) {
    reportPreflightFailure(error, surface)
  }
}

/**
 * Report the full status. `verbose` adds a one-line summary even when nothing
 * is wrong, which is only wanted on a foreground server process.
 */
export async function logGakrCLIInChromePreflight(
  surface: GakrCLIInChromeSurface,
  { verbose = false }: { verbose?: boolean } = {},
): Promise<GakrCLIInChromeStatus | null> {
  try {
    const status = await getGakrCLIInChromeStatus(surface)
    writeLines(formatGakrCLIInChromeWarnings(status.warnings), surface)
    if (verbose) {
      writeLines([summarize(status)], surface)
    }
    return status
  } catch (error) {
    reportPreflightFailure(error, surface)
    return null
  }
}

function summarize(status: GakrCLIInChromeStatus): string {
  const id = status.extensionId
    ? `${status.extensionId} (${status.extensionIdSource})`
    : 'not set'
  const parts = [
    `extension id: ${id}`,
    `extension: ${status.extensionInstalled ? 'detected' : 'not detected'}`,
    `native host: ${
      status.nativeHostReachable === null
        ? status.nativeHostManifestPath
          ? 'manifest installed'
          : 'manifest missing'
        : status.nativeHostReachable
          ? 'connected'
          : 'not connected'
    }`,
    `terminal backend: ${status.terminalBackendRunning ? 'running' : 'stopped'}`,
  ]
  return `[gakrcli-in-chrome] ${parts.join(' · ')}`
}
