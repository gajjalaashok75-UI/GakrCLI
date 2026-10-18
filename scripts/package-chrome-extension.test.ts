/**
 * Guards the committed extension bundle against drift from its source.
 *
 * The docs page serves a built zip from web/public, so nothing in a normal
 * build would notice if the zip stopped matching packages/chrome-extension.
 * These checks fail when the bundle was built from a different version, when
 * it would give every install the same id (a manifest `key`), or when it does
 * not implement a tool the CLI advertises.
 *
 * Regenerate with: bun run chrome:zip
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { TOOL_SCHEMAS } from '@gakr-gakr/mcp-chrome-shared'

const ROOT = join(import.meta.dir, '..')
const ZIP_PATH = join(
  ROOT,
  'web',
  'public',
  'docs',
  'gakrcli-in-chrome',
  'gakrcli-in-chrome.zip',
)
const EXTENSION_PACKAGE_PATH = join(
  ROOT,
  'packages',
  'chrome-extension',
  'package.json',
)

type Manifest = {
  version?: string
  key?: string
  permissions?: string[]
}

const files = unzipSync(new Uint8Array(readFileSync(ZIP_PATH)))
const manifest = JSON.parse(
  new TextDecoder().decode(files['manifest.json']),
) as Manifest

describe('committed gakrcli-in-chrome.zip', () => {
  test('has a loadable manifest at the zip root', () => {
    expect(manifest.version).toBeString()
    expect(manifest.permissions).toContain('nativeMessaging')
  })

  test('was built from the current extension version', () => {
    const extensionPackage = JSON.parse(
      readFileSync(EXTENSION_PACKAGE_PATH, 'utf8'),
    ) as { version: string }
    expect(manifest.version).toBe(extensionPackage.version)
  })

  test('has no manifest key, so each install keeps its own id', () => {
    // With a key every install shares one id and the documented
    // chromeExtensionId flow would be unnecessary — and wrong.
    expect(manifest.key).toBeUndefined()
  })

  test('implements every tool the CLI advertises', () => {
    const bundle = Object.entries(files)
      .filter(([name]) => name.endsWith('.js'))
      .map(([, bytes]) => new TextDecoder().decode(bytes))
      .join('\n')

    const missing = TOOL_SCHEMAS.map(tool => tool.name).filter(
      name => !bundle.includes(name),
    )
    expect(missing).toEqual([])
  })
})
