import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

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
let resolveCodexApiCredentials: typeof import('./providerConfig.js')['resolveCodexApiCredentials']

beforeEach(async () => {
  await acquireSharedMutationLock('services/api/providerConfig.codex.test.ts')
  lockAcquired = true
  mock.restore()
  mock.module('../../utils/codexCredentials.js', () => ({
    isCodexRefreshFailureCoolingDown: () => false,
    readCodexCredentials: () => undefined,
  }))
  resolveCodexApiCredentials = (await import(
    `./providerConfig.js?codex-no-secure-storage=${Date.now()}-${Math.random()}`
  )).resolveCodexApiCredentials
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
    mock.restore()
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
