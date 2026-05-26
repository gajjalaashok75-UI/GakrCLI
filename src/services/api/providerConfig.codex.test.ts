import { afterEach, beforeEach, expect, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { resolveCodexApiCredentials } from './providerConfig.js'

const ENV_KEYS = [
  'CODEX_API_KEY',
  'CODEX_ACCOUNT_ID',
  'CHATGPT_ACCOUNT_ID',
  'CODEX_AUTH_JSON_PATH',
  'CODEX_HOME',
] as const

const originalEnv: Record<string, string | undefined> = {}
for (const key of ENV_KEYS) {
  originalEnv[key] = process.env[key]
}

let lockAcquired = false

beforeEach(async () => {
  await acquireSharedMutationLock('services/api/providerConfig.codex.test.ts')
  lockAcquired = true
})

afterEach(() => {
  try {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  } finally {
    if (lockAcquired) {
      releaseSharedMutationLock()
      lockAcquired = false
    }
  }
})

test('Codex credential resolution can ignore default ~/.codex/auth.json discovery', () => {
  const credentials = resolveCodexApiCredentials({} as NodeJS.ProcessEnv, {
    includeDefaultAuthJson: false,
  })

  expect(credentials).toEqual({
    apiKey: '',
    source: 'none',
  })
})

test('Codex credential resolution still honors explicit env credentials without default auth discovery', () => {
  const credentials = resolveCodexApiCredentials(
    {
      CODEX_API_KEY: 'codex-live',
      CHATGPT_ACCOUNT_ID: 'acct_live',
    } as NodeJS.ProcessEnv,
    {
      includeDefaultAuthJson: false,
    },
  )

  expect(credentials).toMatchObject({
    apiKey: 'codex-live',
    accountId: 'acct_live',
    source: 'env',
  })
})
