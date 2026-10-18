import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserPath } from './setupPortable.js'
import { detectExtensionInstallationPortable } from './setupPortable.js'

const PROD_EXTENSION_ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn'
const LOCAL_EXTENSION_ID = 'galhhbpfeohnjpakdahodhcpnohddjob'

const scratchDirs: string[] = []

async function makeBrowserBase(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gakrcli-chrome-detect-'))
  scratchDirs.push(dir)
  return dir
}

function asBrowserPath(path: string): BrowserPath[] {
  return [{ browser: 'chrome', path }]
}

afterEach(async () => {
  for (const dir of scratchDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true })
  }
})

describe('detectExtensionInstallationPortable', () => {
  test('detects a store install from the profile Extensions directory', async () => {
    const base = await makeBrowserBase()
    await mkdir(
      join(base, 'Default', 'Extensions', PROD_EXTENSION_ID, '1.0.0_0'),
      { recursive: true },
    )

    const result = await detectExtensionInstallationPortable(
      asBrowserPath(base),
      undefined,
    )

    expect(result.isInstalled).toBe(true)
    expect(result.browser).toBe('chrome')
  })

  test('detects a developer-mode load recorded only in Secure Preferences', async () => {
    const base = await makeBrowserBase()
    const profile = join(base, 'Default')
    await mkdir(profile, { recursive: true })
    // Chrome never unpacks a side-loaded extension into Extensions/<id>; this
    // settings entry is the only trace of it.
    await writeFile(
      join(profile, 'Secure Preferences'),
      `{"extensions":{"settings":{"${LOCAL_EXTENSION_ID}":{"location":4}}}}`,
    )

    const result = await detectExtensionInstallationPortable(
      asBrowserPath(base),
      undefined,
    )

    expect(result.isInstalled).toBe(true)
  })

  test('falls back to Preferences when Secure Preferences is absent', async () => {
    const base = await makeBrowserBase()
    const profile = join(base, 'Profile 15')
    await mkdir(profile, { recursive: true })
    await writeFile(
      join(profile, 'Preferences'),
      `{"extensions":{"settings":{"${PROD_EXTENSION_ID}":{"location":4}}}}`,
    )

    const result = await detectExtensionInstallationPortable(
      asBrowserPath(base),
      undefined,
    )

    expect(result.isInstalled).toBe(true)
  })

  test('ignores unrelated extensions in the profile settings', async () => {
    const base = await makeBrowserBase()
    const profile = join(base, 'Default')
    await mkdir(profile, { recursive: true })
    await writeFile(
      join(profile, 'Secure Preferences'),
      '{"extensions":{"settings":{"abcdefghijklmnopabcdefghijklmnop":{"location":4}}}}',
    )

    const result = await detectExtensionInstallationPortable(
      asBrowserPath(base),
      undefined,
    )

    expect(result.isInstalled).toBe(false)
    expect(result.browser).toBeNull()
  })

  test('returns not-installed when no profile mentions the extension', async () => {
    const base = await makeBrowserBase()
    await mkdir(join(base, 'Default'), { recursive: true })

    const result = await detectExtensionInstallationPortable(
      asBrowserPath(base),
      undefined,
    )

    expect(result.isInstalled).toBe(false)
    expect(result.browser).toBeNull()
  })

  test('returns not-installed for an empty browser path list', async () => {
    const result = await detectExtensionInstallationPortable([], undefined)
    expect(result.isInstalled).toBe(false)
  })

  test('detects an id the user configured for an unpacked load', async () => {
    // A side-loaded extension's id is derived from its install folder, so it is
    // not one of the built-in ids and only the configured list can match it.
    const configuredId = 'abcdefghijklmnopabcdefghijklmnop'
    const base = await makeBrowserBase()
    const profile = join(base, 'Default')
    await mkdir(profile, { recursive: true })
    await writeFile(
      join(profile, 'Secure Preferences'),
      `{"extensions":{"settings":{"${configuredId}":{"location":4}}}}`,
    )

    const withoutConfiguredId = await detectExtensionInstallationPortable(
      asBrowserPath(base),
      undefined,
    )
    expect(withoutConfiguredId.isInstalled).toBe(false)

    const result = await detectExtensionInstallationPortable(
      asBrowserPath(base),
      undefined,
      [configuredId],
    )
    expect(result.isInstalled).toBe(true)
    expect(result.browser).toBe('chrome')
  })

  test('detects a configured id from the unpacked Extensions directory layout', async () => {
    const configuredId = 'ponmlkjihgfedcbaponmlkjihgfedcba'
    const base = await makeBrowserBase()
    await mkdir(join(base, 'Default', 'Extensions', configuredId, '1.0.0_0'), {
      recursive: true,
    })

    const result = await detectExtensionInstallationPortable(
      asBrowserPath(base),
      undefined,
      [configuredId],
    )

    expect(result.isInstalled).toBe(true)
  })
})
