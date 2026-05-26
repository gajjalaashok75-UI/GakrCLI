import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

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
  'OPENAI_API_KEY',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'GEMINI_API_KEY',
  'MISTRAL_API_KEY',
  'MINIMAX_API_KEY',
  'XAI_API_KEY',
  'VENICE_API_KEY',
  'MIMO_API_KEY',
  'NVIDIA_NIM',
  'NVIDIA_API_KEY',
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
let getPromptCachingEnabled: typeof import('./gakrcli.js')['getPromptCachingEnabled']

function getTestAPIProvider(): string {
  if (process.env.GAKR_CODE_USE_GITHUB === '1') return 'github'
  if (process.env.GAKR_CODE_USE_GEMINI === '1') return 'gemini'
  if (process.env.GAKR_CODE_USE_MISTRAL === '1') return 'mistral'
  if (process.env.GAKR_CODE_USE_BEDROCK === '1') return 'bedrock'
  if (process.env.GAKR_CODE_USE_VERTEX === '1') return 'vertex'
  if (process.env.GAKR_CODE_USE_FOUNDRY === '1') return 'foundry'
  if (process.env.GAKR_CODE_USE_OPENAI === '1') return 'openai'
  return 'firstParty'
}

function isGithubNativeAnthropicMode(resolvedModel?: string): boolean {
  if (process.env.GAKR_CODE_USE_GITHUB !== '1') return false
  const model = resolvedModel?.trim() || process.env.OPENAI_MODEL?.trim() || ''
  return model.toLowerCase().includes('claude-')
}

function isFirstPartyAnthropicBaseUrl(): boolean {
  return true
}

beforeEach(async () => {
  await acquireSharedMutationLock('services/api/gakrcli.promptCaching.test.ts')
  lockAcquired = true
  mock.restore()
  mock.module('src/utils/model/providers.js', () => ({
    getAPIProvider: getTestAPIProvider,
    getAPIProviderForStatsig: getTestAPIProvider,
    isFirstPartyAnthropicBaseUrl,
    isGithubNativeAnthropicMode,
    usesAnthropicAccountFlow: () => getTestAPIProvider() === 'firstParty',
    usesGakrcliHostedAuthFlow: () => getTestAPIProvider() === 'firstParty',
  }))
  getPromptCachingEnabled = (await import(
    `./gakrcli.js?prompt-caching=${Date.now()}-${Math.random()}`
  )).getPromptCachingEnabled
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
    mock.restore()
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
