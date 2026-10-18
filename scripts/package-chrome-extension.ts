/**
 * Rebuilds the Chrome extension bundle the docs page serves.
 *
 * The zip at web/public/docs/gakrcli-in-chrome/gakrcli-in-chrome.zip is a
 * committed build artifact with no link to its source, so it only stays honest
 * if regenerating it is a single command. WXT names its output after the
 * package, hence the copy.
 *
 * The bundle must not carry a manifest `key`: with a key, every install shares
 * one extension id; without it, Chrome derives a per-machine id, which is what
 * the CLI's chromeExtensionId setting and the docs describe. A local .env that
 * sets CHROME_EXTENSION_KEY would silently produce the wrong kind of bundle, so
 * that case is rejected instead of committed.
 *
 * Usage: bun run chrome:zip [--from <zip>]
 */

import { spawnSync } from 'node:child_process'
import { copyFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { unzipSync } from 'fflate'

const ROOT = join(import.meta.dir, '..')
const EXTENSION_DIR = join(ROOT, 'packages', 'chrome-extension')
const OUTPUT_DIR = join(EXTENSION_DIR, '.output')
const DEST = join(
  ROOT,
  'web',
  'public',
  'docs',
  'gakrcli-in-chrome',
  'gakrcli-in-chrome.zip',
)

type Manifest = {
  name?: string
  version?: string
  key?: string
  permissions?: string[]
  host_permissions?: string[]
}

async function newestChromeZip(): Promise<string> {
  const entries = await readdir(OUTPUT_DIR)
  const zips = entries.filter(name => name.endsWith('-chrome.zip'))
  if (zips.length === 0) {
    throw new Error(
      `No *-chrome.zip in ${OUTPUT_DIR}; run "bunx wxt zip" in packages/chrome-extension first.`,
    )
  }
  zips.sort()
  return join(OUTPUT_DIR, zips[zips.length - 1]!)
}

function readManifest(zip: Uint8Array): Manifest {
  const files = unzipSync(zip)
  const raw = files['manifest.json']
  if (!raw) {
    throw new Error('The zip has no manifest.json at its root; it is not a loadable extension.')
  }
  return JSON.parse(new TextDecoder().decode(raw)) as Manifest
}

async function main(): Promise<void> {
  const fromIndex = process.argv.indexOf('--from')
  const from = fromIndex === -1 ? undefined : process.argv[fromIndex + 1]
  let zipPath: string

  if (from) {
    zipPath = from
  } else {
    const result = spawnSync(process.execPath, ['x', 'wxt', 'zip'], {
      cwd: EXTENSION_DIR,
      stdio: 'inherit',
    })
    if (result.status !== 0) {
      throw new Error(`wxt zip failed (status ${result.status ?? 'none'})`)
    }
    zipPath = await newestChromeZip()
  }

  const zip = new Uint8Array(await Bun.file(zipPath).arrayBuffer())
  const manifest = readManifest(zip)

  if (manifest.key) {
    throw new Error(
      'This bundle has a manifest key, so every install would share one extension id. ' +
        'Unset CHROME_EXTENSION_KEY and rebuild: the docs and the chromeExtensionId setting assume a per-machine id.',
    )
  }
  if (!manifest.permissions?.includes('nativeMessaging')) {
    throw new Error('The bundle does not request nativeMessaging; the CLI could never reach it.')
  }

  await copyFile(zipPath, DEST)
  console.log(
    `Copied ${zipPath} → ${DEST} (version ${manifest.version ?? 'unknown'}, ${(zip.byteLength / 1024 / 1024).toFixed(1)} MB)`,
  )
}

await main()
