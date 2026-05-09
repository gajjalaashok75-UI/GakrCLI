import { afterEach, describe, expect, mock, test } from 'bun:test'
import * as fsPromises from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const originalEnv = { ...process.env }
const originalArgv = [...process.argv]

async function importFreshEnvUtils() {
  return import(`./envUtils.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshSettings() {
  return import(`./settings/settings.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshLocalInstaller() {
  return import(`./localInstaller.ts?ts=${Date.now()}-${Math.random()}`)
}

afterEach(() => {
  process.env = { ...originalEnv }
  process.argv = [...originalArgv]
  mock.restore()
})

describe('GakrCLI paths', () => {
  test('defaults user config home to ~/.gakrcli', async () => {
    delete process.env.GAKR_CONFIG_DIR
    const { resolveGakrcliConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveGakrcliConfigHomeDir({
        homeDir: homedir(),
        gakrcliExists: true,
        legacyClaudeExists: false,
      }),
    ).toBe(join(homedir(), '.gakrcli'))
  })

  test('falls back to ~/.claude when legacy config exists and ~/.openclaude does not', async () => {
    delete process.env.GAKR_CONFIG_DIR
    const { resolveGakrcliConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveGakrcliConfigHomeDir({
        homeDir: homedir(),
        gakrcliExists: false,
        legacyClaudeExists: true,
      }),
    ).toBe(join(homedir(), '.claude'))
  })

  test('uses GAKR_CONFIG_DIR override when provided', async () => {
    process.env.GAKR_CONFIG_DIR = '/tmp/custom-gakrcli'
    const { getgakrcliConfigHomeDir, resolveGakrcliConfigHomeDir } =
      await importFreshEnvUtils()

    expect(getClaudeConfigHomeDir()).toBe('/tmp/custom-gakrcli')
    expect(
      resolveClaudeConfigHomeDir({
        configDirEnv: '/tmp/custom-gakrcli',
      }),
    ).toBe('/tmp/custom-gakrcli')
  })

  test('project and local settings paths use .gakrcli', async () => {
    const { getRelativeSettingsFilePathForSource } = await importFreshSettings()

    expect(getRelativeSettingsFilePathForSource('projectSettings')).toBe(
      '.openclaude/settings.json',
    )
    expect(getRelativeSettingsFilePathForSource('localSettings')).toBe(
      '.openclaude/settings.local.json',
    )
  })

  test('local installer uses gakrcli wrapper path', async () => {
    // Force .gakrcli config home so the test doesn't fall back to
    // ~/.claude when ~/.gakrcli doesn't exist on this machine.
    process.env.GAKR_CONFIG_DIR = join(homedir(), '.gakrcli')
    const { getLocalGakrcliPath } = await importFreshLocalInstaller()

    expect(getLocalGakrcliPath()).toBe(
      join(homedir(), '.gakrcli', 'local', 'gakrcli'),
    )
  })

  test('local installation detection matches .gakrcli path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.gakrcli', 'local')}/node_modules/.bin/gakrcli`,
      ),
    ).toBe(true)
  })

  test('local installation detection still matches legacy .claude path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.claude', 'local')}/node_modules/.bin/gakrcli`,
      ),
    ).toBe(true)
  })

  test('candidate local install dirs include both gakrcli and legacy claude paths', async () => {
    const { getCandidateLocalInstallDirs } = await importFreshLocalInstaller()

    expect(
      getCandidateLocalInstallDirs({
        configHomeDir: join(homedir(), '.gakrcli'),
        homeDir: homedir(),
      }),
    ).toEqual([
      join(homedir(), '.gakrcli', 'local'),
      join(homedir(), '.claude', 'local'),
    ])
  })

  test('legacy local installs are detected when they still expose the claude binary', async () => {
    mock.module('fs/promises', () => ({
      ...fsPromises,
      access: async (path: string) => {
        if (
          path === join(homedir(), '.claude', 'local', 'node_modules', '.bin', 'claude')
        ) {
          return
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      },
    }))

    const { getDetectedLocalInstallDir, localInstallationExists } =
      await importFreshLocalInstaller()

    expect(await localInstallationExists()).toBe(true)
    expect(await getDetectedLocalInstallDir()).toBe(
      join(homedir(), '.claude', 'local'),
    )
  })
})
