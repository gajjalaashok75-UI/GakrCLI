/**
 * Locate the TypeScript Bridge script across every layout the CLI ships in.
 *
 * The previous implementation used a bare `__dirname`, which Bun's bundler
 * rewrites to an absolute build-machine path (e.g. `/home/ci/repo/src/utils/...`).
 * That string ships inside `dist/cli.mjs` and is meaningless on any other
 * machine. Resolve from `distRoot` instead, which is derived at runtime from
 * `import.meta.url` and is therefore correct wherever the bundle lands.
 *
 * Layouts:
 * - dev (`bun run src/...`):  distRoot = <repo root>
 *                             → <repo>/src/utils/computerUse/win32/bridge.ts
 * - dist (`node dist/cli.mjs`): distRoot = <repo root>/dist
 *                             → <dist>/computerUse/bridge.js (compiled by build.ts)
 * - compiled binary:          read from Bun.embeddedFiles
 */

import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import * as path from 'path'

import { isInBundledMode } from '../../bundledMode.js'
import { distRoot } from '../../distRoot.js'
import { bunEmbeddedFiles } from '../bunCompat.js'

const BRIDGE_BASENAME_PY = 'bridge.py'

let cachedPath: string | null | undefined

function devPath(): string {
  return path.join(
    distRoot,
    'src',
    'utils',
    'computerUse',
    'win32',
    BRIDGE_BASENAME_PY,
  )
}

function distPath(): string {
  return path.join(distRoot, 'computerUse', BRIDGE_BASENAME_PY)
}

/**
 * In a compiled binary the asset is embedded rather than on disk. Bun exposes
 * embedded files as Blobs; names preserve the path they were added with, so
 * match on basename and materialize to a temp file for the interpreter.
 */
function extractEmbedded(): string | null {
  const embedded = bunEmbeddedFiles()
  if (!embedded) return null

  const match = embedded.find(
    f => path.basename(f.name) === BRIDGE_BASENAME_PY,
  )
  if (!match) return null

  const basename = path.basename(match.name)
  // Bun.embeddedFiles entries are Blobs; read once and cache on disk.
  const blob = match as unknown as Blob
  if (typeof blob.arrayBuffer !== 'function') return null
  const dir = mkdtempSync(path.join(tmpdir(), 'gakrcli-cu-'))
  const dest = path.join(dir, basename)
  // Synchronous materialization: callers invoke this from a sync path.
  const bytes = blob as unknown as { text?: () => string }
  if (typeof bytes.text === 'function') {
    writeFileSync(dest, bytes.text(), 'utf-8')
  } else {
    return null
  }
  return dest
}

/**
 * Absolute path to the bridge script, or null when the asset is missing.
 * Returns the compiled `.js` path in dist/compiled binary mode, or the
 * source `.ts` path in dev mode.
 */
export function resolveBridgeScript(): string | null {
  if (cachedPath !== undefined) return cachedPath

  const override = process.env.GAKRCLI_BRIDGE_SCRIPT
  if (override && existsSync(override)) {
    return (cachedPath = override)
  }

  for (const candidate of [distPath(), devPath()]) {
    if (existsSync(candidate)) {
      return (cachedPath = candidate)
    }
  }

  if (isInBundledMode()) {
    const extracted = extractEmbedded()
    if (extracted) return (cachedPath = extracted)
  }

  return (cachedPath = null)
}

/** Resolve the bridge script path (alias for backward compatibility). */
export const resolveBridgePy = resolveBridgeScript

/** Read the bridge script contents — used by tests to assert the asset is real. */
export function readBridgeScript(): string | null {
  const p = resolveBridgeScript()
  return p ? readFileSync(p, 'utf-8') : null
}

/** Read the bridge script contents (alias for backward compatibility). */
export const readBridgePy = readBridgeScript

export { BRIDGE_BASENAME_PY as BRIDGE_BASENAME }