import { afterEach, beforeEach, expect, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { getPromptCachingEnabled } from './gakrcli.js'

const trackedEnvKeys = [
  'GAKR_CODE_USE_OPENAI',
  'GAKR_CODE_USE_BEDROCK',
  'GAKR_CODE_USE_VERTEX',
  'GAKR_CODE_USE_FOUNDRY',
  'GAKR_CODE_USE_GEMINI',
  'GAKR_CODE_USE_GITHUB',
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
  'DISABLE_PROMPT_CACHING',
  'DISABLE_PROMPT_CACHING_HAIKU',
  'DISABLE_PROMPT_CACHING_SONNET',
  'DISABLE_PROMPT_CACHING_OPUS',
] as const

const originalEnv = Object.fromEntries(
  trackedEnvKeys.map(key => [key, process.env[key]]),
) as Record<(typeof trackedEnvKeys)[number], string | undefined>

function restoreEnv(key: (typeof trackedEnvKeys)[number]): void {
  const value = originalEnv[key]
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

let lockAcquired = false

beforeEach(async () => {
  await acquireSharedMutationLock('services/api/gakrcli.promptCaching.test.ts')
  lockAcquired = true
  for (const key of trackedEnvKeys) {
    delete process.env[key]
  }
})

afterEach(() => {
  try {
    for (const key of trackedEnvKeys) {
      restoreEnv(key)
    }
  } finally {
    if (lockAcquired) {
      releaseSharedMutationLock()
      lockAcquired = false
    }
  }
})

test('prompt caching stays enabled for GitHub Claude native Anthropic mode', () => {
  process.env.GAKR_CODE_USE_GITHUB = '1'
  process.env.OPENAI_MODEL = 'claude-sonnet-4-6'

  expect(getPromptCachingEnabled('claude-sonnet-4-6')).toBe(true)
})

test('prompt caching remains disabled for non-Claude GitHub models', () => {
  process.env.GAKR_CODE_USE_GITHUB = '1'
  process.env.OPENAI_MODEL = 'gpt-4o'

  expect(getPromptCachingEnabled('gpt-4o')).toBe(false)
})

test('prompt caching global disable still wins for GitHub Claude native mode', () => {
  process.env.GAKR_CODE_USE_GITHUB = '1'
  process.env.OPENAI_MODEL = 'claude-sonnet-4-6'
  process.env.DISABLE_PROMPT_CACHING = '1'

  expect(getPromptCachingEnabled('claude-sonnet-4-6')).toBe(false)
})
