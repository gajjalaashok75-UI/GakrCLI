import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
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
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

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

beforeEach(async () => {
  await acquireSharedMutationLock('gakrcliPaths.test.ts')
})

afterEach(() => {
  try {
    process.env = { ...originalEnv }
    process.argv = [...originalArgv]
    mock.restore()
  } finally {
    releaseSharedMutationLock()
  }
})

describe('GakrCLI paths', () => {
  test('defaults user config home to ~/.gakrcli', async () => {
    delete process.env.GAKR_CONFIG_DIR
    const { resolveGakrcliConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveGakrcliConfigHomeDir({
        homeDir: homedir(),
      }),
    ).toBe(join(homedir(), '.gakrcli'))
  })

  test('hard-cuts user config home to ~/.gakrcli by default', async () => {
    delete process.env.GAKR_CONFIG_DIR
    const { resolveGakrcliConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveGakrcliConfigHomeDir({
        homeDir: homedir(),
      }),
    ).toBe(join(homedir(), '.gakrcli'))
  })

  test('migrates legacy config home and global config files to .gakrcli', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.claude', 'skills', 'legacy-skill'), {
        recursive: true,
      })
      writeFileSync(
        join(tempHome, '.claude', 'skills', 'legacy-skill', 'SKILL.md'),
        'legacy skill',
      )
      writeFileSync(join(tempHome, '.claude', 'settings.json'), '{}')
      writeFileSync(join(tempHome, '.claude.json'), '{"legacy":true}')
      writeFileSync(
        join(tempHome, '.claude-custom-oauth.json'),
        '{"custom":true}',
      )

      const { migrateLegacyGakrcliConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyGakrcliConfigHome({ homeDir: tempHome })).toBe(true)
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
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.claude', 'skills', 'legacy-skill'), {
        recursive: true,
      })
      mkdirSync(join(tempHome, '.gakrcli', 'skills'), { recursive: true })
      writeFileSync(join(tempHome, '.claude', 'settings.json'), 'legacy')
      writeFileSync(join(tempHome, '.gakrcli', 'settings.json'), 'current')
      writeFileSync(
        join(tempHome, '.claude', 'skills', 'legacy-skill', 'SKILL.md'),
        'legacy skill',
      )

      const { migrateLegacyGakrcliConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyGakrcliConfigHome({ homeDir: tempHome })).toBe(true)
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
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.claude'), { recursive: true })
      writeFileSync(join(tempHome, '.claude', 'settings.json'), 'legacy')

      const { migrateLegacyGakrcliConfigHome } = await importFreshEnvUtils()

      expect(
        migrateLegacyGakrcliConfigHome({
          configDirEnv: join(tempHome, 'custom-config'),
          homeDir: tempHome,
        }),
      ).toBe(true)
      expect(existsSync(join(tempHome, '.gakrcli'))).toBe(false)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('migration fails closed when .gakrcli collides with a non-directory', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      writeFileSync(join(tempHome, '.gakrcli'), 'not a directory')
      mkdirSync(join(tempHome, '.claude'), { recursive: true })
      writeFileSync(join(tempHome, '.claude', 'settings.json'), 'legacy')

      const { migrateLegacyGakrcliConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyGakrcliConfigHome({ homeDir: tempHome })).toBe(false)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('migration ignores non-directory legacy config homes', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      writeFileSync(join(tempHome, '.claude'), 'not a directory')

      const { migrateLegacyGakrcliConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyGakrcliConfigHome({ homeDir: tempHome })).toBe(true)
      expect(existsSync(join(tempHome, '.gakrcli'))).toBe(false)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('config home falls back to legacy when migration fails on a non-directory .gakrcli collision', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'gakrcli-paths-test-'))
    try {
      writeFileSync(join(tempHome, '.gakrcli'), 'not a directory')
      mkdirSync(join(tempHome, '.claude'), { recursive: true })
      mock.module('os', () => ({
        homedir: () => tempHome,
        tmpdir,
      }))
      delete process.env.GAKR_CONFIG_DIR

      const { getGakrcliConfigHomeDir } = await importFreshEnvUtils()

      expect(getGakrcliConfigHomeDir()).toBe(join(tempHome, '.claude'))
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('uses GAKR_CONFIG_DIR override when provided', async () => {
    process.env.GAKR_CONFIG_DIR = '/tmp/custom-gakrcli'
    const { getgakrcliConfigHomeDir, resolveGakrcliConfigHomeDir } =
      await importFreshEnvUtils()

    expect(getgakrcliConfigHomeDir()).toBe('/tmp/custom-gakrcli')
    expect(
      resolveGakrcliConfigHomeDir({
        configDirEnv: '/tmp/custom-gakrcli',
      }),
    ).toBe('/tmp/custom-gakrcli')
  })

  test('default plans directory uses ~/.gakrcli/plans', async () => {
    delete process.env.GAKR_CONFIG_DIR
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(getDefaultPlansDirectory({ homeDir: homedir() })).toBe(
      join(homedir(), '.gakrcli', 'plans'),
    )
  })

  test('default plans directory respects explicit GAKR_CONFIG_DIR', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/custom-gakrcli' }),
    ).toBe(join('/tmp/custom-gakrcli', 'plans'))
  })

  test('default plans directory normalizes generated path to NFC', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ homeDir: '/tmp/cafe\u0301' }),
    ).toBe(join('/tmp/caf\u00e9', '.gakrcli', 'plans'))
  })

  test('default plans directory normalizes explicit GAKR_CONFIG_DIR to NFC', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/cafe\u0301-gakrcli' }),
    ).toBe(join('/tmp/caf\u00e9-gakrcli', 'plans'))
  })

  test('project and local settings paths use .gakrcli', async () => {
    const { getRelativeSettingsFilePathForSource } = await importFreshSettings()

    expect(getRelativeSettingsFilePathForSource('projectSettings')).toBe(
      '.gakrcli/settings.json',
    )
    expect(getRelativeSettingsFilePathForSource('localSettings')).toBe(
      '.gakrcli/settings.local.json',
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
