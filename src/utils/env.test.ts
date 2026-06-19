import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

const originalEnv = {
  GAKR_CONFIG_DIR: process.env.GAKR_CONFIG_DIR,
  GAKR_CODE_CUSTOM_OAUTH_URL: process.env.GAKR_CODE_CUSTOM_OAUTH_URL,
  USER_TYPE: process.env.USER_TYPE,
}

let tempDir: string

beforeEach(async () => {
  await acquireSharedMutationLock('env.test.ts')
  tempDir = mkdtempSync(join(tmpdir(), 'gakrcli-env-test-'))
  process.env.GAKR_CONFIG_DIR = tempDir
  delete process.env.GAKR_CODE_CUSTOM_OAUTH_URL
  delete process.env.USER_TYPE
})

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true })
    if (originalEnv.GAKR_CONFIG_DIR === undefined) {
      delete process.env.GAKR_CONFIG_DIR
    } else {
      process.env.GAKR_CONFIG_DIR = originalEnv.GAKR_CONFIG_DIR
    }
    if (originalEnv.GAKR_CODE_CUSTOM_OAUTH_URL === undefined) {
      delete process.env.GAKR_CODE_CUSTOM_OAUTH_URL
    } else {
      process.env.GAKR_CODE_CUSTOM_OAUTH_URL = originalEnv.GAKR_CODE_CUSTOM_OAUTH_URL
    }
    if (originalEnv.USER_TYPE === undefined) {
      delete process.env.USER_TYPE
    } else {
      process.env.USER_TYPE = originalEnv.USER_TYPE
    }
  } finally {
    releaseSharedMutationLock()
  }
})

async function importFreshEnvModule() {
  return import(`./env.js?ts=${Date.now()}-${Math.random()}`)
}

// getGlobalGakrCLIFile — default path plus explicit override compatibility

test('getGlobalGakrCLIFile: new install returns .gakrcli.json when neither file exists', async () => {
  const { getGlobalGakrCLIFile } = await importFreshEnvModule()
  expect(getGlobalGakrCLIFile()).toBe(join(tempDir, '.gakrcli.json'))
})

test('getGlobalGakrCLIFile: explicit config dir keeps .gakrcli.json fallback when only legacy file exists', async () => {
  writeFileSync(join(tempDir, '.gakrcli.json'), '{}')
  const { getGlobalGakrCLIFile } = await importFreshEnvModule()
  expect(getGlobalGakrCLIFile()).toBe(join(tempDir, '.gakrcli.json'))
})

test('getGlobalGakrCLIFile: migrated user uses .gakrcli.json when both files exist', async () => {
  writeFileSync(join(tempDir, '.gakrcli.json'), '{}')
  writeFileSync(join(tempDir, '.gakrcli.json'), '{}')
  const { getGlobalGakrCLIFile } = await importFreshEnvModule()
  expect(getGlobalGakrCLIFile()).toBe(join(tempDir, '.gakrcli.json'))
})

test('resolveGlobalGakrCLIFile: failed default migration keeps legacy file when new file is missing', async () => {
  writeFileSync(join(tempDir, '.gakrcli.json'), '{}')
  const { resolveGlobalGakrCLIFile } = await importFreshEnvModule()

  expect(
    resolveGlobalGakrCLIFile({
      homeDir: tempDir,
      migrationSucceeded: false,
      existsSync: path => path === join(tempDir, '.gakrcli.json'),
    }),
  ).toBe(join(tempDir, '.gakrcli.json'))
})
