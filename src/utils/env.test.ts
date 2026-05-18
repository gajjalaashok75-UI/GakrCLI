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

// getGlobalGakrcliFile — three migration branches

test('getGlobalGakrcliFile: new install returns .gakrcli.json when neither file exists', async () => {
  const { getGlobalGakrcliFile } = await importFreshEnvModule()
  expect(getGlobalGakrcliFile()).toBe(join(tempDir, '.gakrcli.json'))
})

test('getGlobalGakrcliFile: existing user keeps .gakrcli.json when only legacy file exists', async () => {
  writeFileSync(join(tempDir, '.gakrcli.json'), '{}')
  const { getGlobalGakrcliFile } = await importFreshEnvModule()
  expect(getGlobalGakrcliFile()).toBe(join(tempDir, '.gakrcli.json'))
})

test('getGlobalGakrcliFile: migrated user uses .gakrcli.json when both files exist', async () => {
  writeFileSync(join(tempDir, '.gakrcli.json'), '{}')
  writeFileSync(join(tempDir, '.gakrcli.json'), '{}')
  const { getGlobalGakrcliFile } = await importFreshEnvModule()
  expect(getGlobalGakrcliFile()).toBe(join(tempDir, '.gakrcli.json'))
})
