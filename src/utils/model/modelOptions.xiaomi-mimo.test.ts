import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

import { resetModelStringsForTestingOnly } from '../../bootstrap/state.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { saveGlobalConfig } from '../config.js'
import {
  resetSettingsCache,
  setSessionSettingsCache,
} from '../settings/settingsCache.js'

const originalEnv = {
  GAKR_CODE_USE_OPENAI: process.env.GAKR_CODE_USE_OPENAI,
  GAKR_CODE_USE_GEMINI: process.env.GAKR_CODE_USE_GEMINI,
  GAKR_CODE_USE_GITHUB: process.env.GAKR_CODE_USE_GITHUB,
  GAKR_CODE_USE_MISTRAL: process.env.GAKR_CODE_USE_MISTRAL,
  GAKR_CODE_USE_BEDROCK: process.env.GAKR_CODE_USE_BEDROCK,
  GAKR_CODE_USE_VERTEX: process.env.GAKR_CODE_USE_VERTEX,
  GAKR_CODE_USE_FOUNDRY: process.env.GAKR_CODE_USE_FOUNDRY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  MIMO_API_KEY: process.env.MIMO_API_KEY,
  GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED:
    process.env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED,
  GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID:
    process.env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID,
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  NVIDIA_NIM: process.env.NVIDIA_NIM,
  VENICE_API_KEY: process.env.VENICE_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
  ANTHROPIC_CUSTOM_MODEL_OPTION: process.env.ANTHROPIC_CUSTOM_MODEL_OPTION,
}
let getCachedXiaomiMimoModelOptions: typeof import('./xiaomi-mimoModels.js')['getCachedXiaomiMimoModelOptions']
let isXiaomiMimoProvider: typeof import('./xiaomi-mimoModels.js')['isXiaomiMimoProvider']
let getModelOptions: typeof import('./modelOptions.js')['getModelOptions']

function getTestAPIProvider(): string {
  if (
    process.env.GAKR_CODE_USE_OPENAI === '1' &&
    (process.env.OPENAI_BASE_URL ?? process.env.OPENAI_API_BASE ?? '').includes(
      'xiaomimimo.com',
    )
  ) {
    return 'xiaomi-mimo'
  }
  if (process.env.GAKR_CODE_USE_OPENAI === '1') return 'openai'
  if (process.env.MIMO_API_KEY) return 'xiaomi-mimo'
  return 'firstParty'
}

function isFirstPartyAnthropicBaseUrl(): boolean {
  return true
}

function isGithubNativeAnthropicMode(): boolean {
  return false
}

function restoreEnvValue(key: keyof typeof originalEnv): void {
  const value = originalEnv[key]
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

beforeEach(async () => {
  await acquireSharedMutationLock('utils/model/modelOptions.xiaomi-mimo.test.ts')
  mock.restore()
  mock.module('./providers.js', () => ({
    getAPIProvider: getTestAPIProvider,
    getAPIProviderForStatsig: getTestAPIProvider,
    isFirstPartyAnthropicBaseUrl,
    isGithubNativeAnthropicMode,
    usesAnthropicAccountFlow: () => getTestAPIProvider() === 'firstParty',
    usesGakrcliHostedAuthFlow: () => getTestAPIProvider() === 'firstParty',
  }))
  setSessionSettingsCache({ settings: {}, errors: [] })
  for (const key of Object.keys(originalEnv) as (keyof typeof originalEnv)[]) {
    delete process.env[key]
  }
  resetModelStringsForTestingOnly()
  const nonce = `${Date.now()}-${Math.random()}`
  const xiaomiMimoModels = await import(`./xiaomi-mimoModels.js?mimo=${nonce}`)
  const modelOptions = await import(`./modelOptions.js?mimo=${nonce}`)
  getCachedXiaomiMimoModelOptions =
    xiaomiMimoModels.getCachedXiaomiMimoModelOptions
  isXiaomiMimoProvider = xiaomiMimoModels.isXiaomiMimoProvider
  getModelOptions = modelOptions.getModelOptions
})

afterEach(() => {
  try {
    resetSettingsCache()
    for (const key of Object.keys(originalEnv) as (keyof typeof originalEnv)[]) {
      restoreEnvValue(key)
    }
    saveGlobalConfig(current => ({
      ...current,
      additionalModelOptionsCache: [],
      additionalModelOptionsCacheScope: undefined,
      openaiAdditionalModelOptionsCache: [],
      openaiAdditionalModelOptionsCacheByProfile: {},
      providerProfiles: [],
      activeProviderProfileId: undefined,
    }))
    resetModelStringsForTestingOnly()
  } finally {
    mock.restore()
    releaseSharedMutationLock()
  }
})

test('Xiaomi MiMo provider exposes MiMo catalog models in /model options', async () => {
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_BASE_URL = 'https://api.xiaomimimo.com/v1'
  process.env.OPENAI_MODEL = 'mimo-v2.5-pro'
  process.env.MIMO_API_KEY = 'mimo-live-key'

  const options = getCachedXiaomiMimoModelOptions()
  const values = options.map(option => option.value)

  expect(isXiaomiMimoProvider()).toBe(true)
  expect(values).toContain('mimo-v2.5-pro')
  expect(values).toContain('mimo-v2-flash')
  expect(
    options.some(option => option.label === 'MiMo V2.5 Pro'),
  ).toBe(true)
})

test('/model options include Xiaomi MiMo catalog when MiMo provider is active', async () => {
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_BASE_URL = 'https://api.xiaomimimo.com/v1'
  process.env.OPENAI_MODEL = 'mimo-v2.5-pro'
  process.env.MIMO_API_KEY = 'mimo-live-key'

  const options = getModelOptions()
  const values = options.map(option => option.value)

  expect(values).toContain(null)
  expect(values).toContain('mimo-v2.5-pro')
  expect(values).toContain('mimo-v2-flash')
  expect(options.find(option => option.value === 'mimo-v2.5-pro')?.label).toBe(
    'MiMo V2.5 Pro',
  )
})

test('Xiaomi MiMo provider does not activate for unrelated OpenAI-compatible mimo-prefixed models', async () => {
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_BASE_URL = 'https://api.example.com/v1'
  process.env.OPENAI_MODEL = 'mimo-custom'

  expect(isXiaomiMimoProvider()).toBe(false)
})
