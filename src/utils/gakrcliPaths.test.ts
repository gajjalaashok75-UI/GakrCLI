import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import * as fsPromises from 'fs/promises'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import { acquireEnvMutex, releaseEnvMutex } from '../entrypoints/sdk/shared.js'

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

async function importFreshPlans() {
  return import(`./plans.ts?ts=${Date.now()}-${Math.random()}`)
}

afterEach(() => {
  try {
    process.env = { ...originalEnv }
    process.argv = [...originalArgv]
    mock.restore()
  } finally {
    releaseEnvMutex()
  }
})

describe('GakrCLI paths', () => {
  test('defaults user config home to ~/.gakrcli', async () => {
    await acquireEnvMutex()
    delete process.env.GAKR_CONFIG_DIR
    const { resolveGakrCLIConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveGakrCLIConfigHomeDir({
        homeDir: homedir(),
      }),
    ).toBe(join(homedir(), '.gakrcli'))
  })

  test('hard-cuts user config home to ~/.gakrcli by default', async () => {
    await acquireEnvMutex()
    delete process.env.GAKR_CONFIG_DIR
    const { resolveGakrCLIConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveGakrCLIConfigHomeDir({
        homeDir: homedir(),
      }),
    ).toBe(join(homedir(), '.gakrcli'))
  })

  test('migrates legacy config home and global config files to .gakrcli', async () => {
    await acquireEnvMutex()
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.gakrcli', 'skills', 'legacy-skill'), {
        recursive: true,
      })
      writeFileSync(
        join(tempHome, '.gakrcli', 'skills', 'legacy-skill', 'SKILL.md'),
        'legacy skill',
      )
      writeFileSync(join(tempHome, '.gakrcli', 'settings.json'), '{}')
      writeFileSync(join(tempHome, '.gakrcli.json'), '{"legacy":true}')
      writeFileSync(
        join(tempHome, '.gakrcli-custom-oauth.json'),
        '{"custom":true}',
      )

      const { migrateLegacyGakrCLIConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyGakrCLIConfigHome({ homeDir: tempHome })).toBe(true)
      expect(
        readFileSync(
          join(tempHome, '.gakrcli', 'skills', 'legacy-skill', 'SKILL.md'),
          'utf8',
        ),
      ).toBe('legacy skill')
      expect(existsSync(join(tempHome, '.gakrcli', 'settings.json'))).toBe(
        true,
      )
      expect(readFileSync(join(tempHome, '.gakrcli.json'), 'utf8')).toBe(
        '{"legacy":true}',
      )
      expect(
        readFileSync(join(tempHome, '.gakrcli-custom-oauth.json'), 'utf8'),
      ).toBe('{"custom":true}')
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('migration preserves existing .gakrcli data while copying missing legacy data', async () => {
    await acquireEnvMutex()
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.gakrcli', 'skills', 'legacy-skill'), {
        recursive: true,
      })
      mkdirSync(join(tempHome, '.gakrcli', 'skills'), { recursive: true })
      writeFileSync(join(tempHome, '.gakrcli', 'settings.json'), 'legacy')
      writeFileSync(join(tempHome, '.gakrcli', 'settings.json'), 'current')
      writeFileSync(
        join(tempHome, '.gakrcli', 'skills', 'legacy-skill', 'SKILL.md'),
        'legacy skill',
      )

      const { migrateLegacyGakrCLIConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyGakrCLIConfigHome({ homeDir: tempHome })).toBe(true)
      expect(
        readFileSync(join(tempHome, '.gakrcli', 'settings.json'), 'utf8'),
      ).toBe('current')
      expect(
        readFileSync(
          join(tempHome, '.gakrcli', 'skills', 'legacy-skill', 'SKILL.md'),
          'utf8',
        ),
      ).toBe('legacy skill')
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('migration skips explicit GAKR_CONFIG_DIR overrides', async () => {
    await acquireEnvMutex()
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.gakrcli'), { recursive: true })
      writeFileSync(join(tempHome, '.gakrcli', 'settings.json'), 'legacy')

      const { migrateLegacyGakrCLIConfigHome } = await importFreshEnvUtils()

      expect(
        migrateLegacyGakrCLIConfigHome({
          configDirEnv: join(tempHome, 'custom-config'),
          homeDir: tempHome,
        }),
      ).toBe(true)
      expect(existsSync(join(tempHome, '.gakrcli'))).toBe(false)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('migration ignores non-directory legacy config homes', async () => {
    await acquireEnvMutex()
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      writeFileSync(join(tempHome, '.gakrcli'), 'not a directory')

      const { migrateLegacyGakrCLIConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyGakrCLIConfigHome({ homeDir: tempHome })).toBe(true)
      expect(existsSync(join(tempHome, '.gakrcli'))).toBe(true)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('config home falls back to legacy when migration fails on a non-directory .gakrcli collision', async () => {
    await acquireEnvMutex()
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      writeFileSync(join(tempHome, '.gakrcli'), 'not a directory')

      mock.module('os', () => ({
        homedir: () => tempHome,
        tmpdir,
      }))
      delete process.env.GAKR_CONFIG_DIR

      const { getGakrCLIConfigHomeDir } = await importFreshEnvUtils()

      expect(getGakrCLIConfigHomeDir()).toBe(join(tempHome, '.gakrcli'))
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('default plans directory uses ~/.gakrcli/plans', async () => {
    await acquireEnvMutex()
    delete process.env.GAKR_CONFIG_DIR
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(getDefaultPlansDirectory({ homeDir: homedir() })).toBe(
      join(homedir(), '.gakrcli', 'plans'),
    )
  })

  test('default plans directory respects explicit GAKR_CONFIG_DIR', async () => {
    await acquireEnvMutex()
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/custom-gakrcli' }),
    ).toBe(join('/tmp/custom-gakrcli', 'plans'))
  })

  test('default plans directory normalizes generated path to NFC', async () => {
    await acquireEnvMutex()
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ homeDir: '/tmp/cafe\u0301' }),
    ).toBe(join('/tmp/caf\u00e9', '.gakrcli', 'plans'))
  })

  test('default plans directory normalizes explicit GAKR_CONFIG_DIR to NFC', async () => {
    await acquireEnvMutex()
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/cafe\u0301-gakrcli' }),
    ).toBe(join('/tmp/caf\u00e9-gakrcli', 'plans'))
  })

  test('uses GAKR_CONFIG_DIR override when provided', async () => {
    await acquireEnvMutex()
    process.env.GAKR_CONFIG_DIR = '/tmp/custom-gakrcli'
    const { getGakrCLIConfigHomeDir, resolveGakrCLIConfigHomeDir } =
      await importFreshEnvUtils()

    expect(getGakrCLIConfigHomeDir()).toBe('/tmp/custom-gakrcli')
    expect(
      resolveGakrCLIConfigHomeDir({
        configDirEnv: '/tmp/custom-gakrcli',
      }),
    ).toBe('/tmp/custom-gakrcli')
  })

  test('project and local settings paths use .gakrcli', async () => {
    await acquireEnvMutex()
    const { getRelativeSettingsFilePathForSource } = await importFreshSettings()

    expect(getRelativeSettingsFilePathForSource('projectSettings')).toBe(
      '.gakrcli/settings.json',
    )
    expect(getRelativeSettingsFilePathForSource('localSettings')).toBe(
      '.gakrcli/settings.local.json',
    )
  })

  test('local installer uses gakrcli wrapper path', async () => {
    await acquireEnvMutex()
    // Force .gakrcli config home so the test doesn't fall back to
    // ~/.gakrcli when ~/.gakrcli doesn't exist on this machine.
    process.env.GAKR_CONFIG_DIR = join(homedir(), '.gakrcli')
    const { getLocalGakrCLIPath } = await importFreshLocalInstaller()

    expect(getLocalGakrCLIPath()).toBe(
      join(homedir(), '.gakrcli', 'local', 'gakrcli'),
    )
  })

  test('local installation detection matches .gakrcli path', async () => {
    await acquireEnvMutex()
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.gakrcli', 'local')}/node_modules/.bin/gakrcli`,
      ),
    ).toBe(true)
  })

  test('local installation detection still matches legacy .gakrcli path', async () => {
    await acquireEnvMutex()
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.gakrcli', 'local')}/node_modules/.bin/gakrcli`,
      ),
    ).toBe(true)
  })

  test('candidate local install dirs include both gakrcli and legacy gakrcli paths', async () => {
    await acquireEnvMutex()
    const { getCandidateLocalInstallDirs } = await importFreshLocalInstaller()

    expect(
      getCandidateLocalInstallDirs({
        configHomeDir: join(homedir(), '.gakrcli'),
        homeDir: homedir(),
      }),
    ).toEqual([
      join(homedir(), '.gakrcli', 'local'),
    ])
  })

  test('legacy local installs are detected when they still expose the gakrcli binary', async () => {
    await acquireEnvMutex()
    mock.module('fs/promises', () => ({
      ...fsPromises,
      access: async (path: string) => {
        if (
          path === join(homedir(), '.gakrcli', 'local', 'node_modules', '.bin', 'gakrcli')
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
      join(homedir(), '.gakrcli', 'local'),
    )
  })
})
