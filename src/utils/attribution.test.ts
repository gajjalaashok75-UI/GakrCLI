import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  getClientType,
  getMainLoopModelOverride,
  resetStateForTests,
  setClientType,
  setMainLoopModelOverride,
} from '../bootstrap/state.js'
import * as actualModel from './model/model.js'
import * as actualProviders from './model/providers.js'
import {
  resetSettingsCache,
  setSessionSettingsCache,
} from './settings/settingsCache.js'
import * as actualSettings from './settings/settings.js'
import type { SettingsJson } from './settings/types.js'

let getAttributionTexts: (typeof import('./attribution.js'))['getAttributionTexts']
let getDefaultCommitCoAuthorEmail: (typeof import('./attribution.js'))[
  'getDefaultCommitCoAuthorEmail'
]
let getDefaultCommitCoAuthorName: (typeof import('./attribution.js'))[
  'getDefaultCommitCoAuthorName'
]
let getEnhancedPRAttribution: (typeof import('./attribution.js'))[
  'getEnhancedPRAttribution'
]
let testSettings: SettingsJson = {}

const originalEnv = {
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED:
    process.env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED,
  GAKR_CODE_USE_BEDROCK: process.env.GAKR_CODE_USE_BEDROCK,
  GAKR_CODE_USE_FOUNDRY: process.env.GAKR_CODE_USE_FOUNDRY,
  GAKR_CODE_USE_GEMINI: process.env.GAKR_CODE_USE_GEMINI,
  GAKR_CODE_USE_GITHUB: process.env.GAKR_CODE_USE_GITHUB,
  GAKR_CODE_USE_MISTRAL: process.env.GAKR_CODE_USE_MISTRAL,
  GAKR_CODE_USE_OPENAI: process.env.GAKR_CODE_USE_OPENAI,
  GAKR_CODE_USE_VERTEX: process.env.GAKR_CODE_USE_VERTEX,
  GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID:
    process.env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID,
  NVIDIA_NIM: process.env.NVIDIA_NIM,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
  ANTHROPIC_DEFAULT_OPUS_MODEL:
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL,
  ANTHROPIC_DEFAULT_SONNET_MODEL:
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
  ANTHROPIC_DEFAULT_HAIKU_MODEL:
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  MISTRAL_MODEL: process.env.MISTRAL_MODEL,
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
  VENICE_API_KEY: process.env.VENICE_API_KEY,
  MIMO_API_KEY: process.env.MIMO_API_KEY,
  BNKR_API_KEY: process.env.BNKR_API_KEY,
  GAKR_DISABLE_CO_AUTHORED_BY:
    process.env.GAKR_DISABLE_CO_AUTHORED_BY,
  GAKR_CODE_REMOTE_SESSION_ID: process.env.GAKR_CODE_REMOTE_SESSION_ID,
  SESSION_INGRESS_URL: process.env.SESSION_INGRESS_URL,
  USER_TYPE: process.env.USER_TYPE,
}
const originalClientType = getClientType()
const originalMainLoopModelOverride = getMainLoopModelOverride()

const defaultPrAttribution =
  '🤖 Generated with [GakrCLI](https://github.com/gajjalaashok75-UI/gakrcli)'

function useSettings(settings: SettingsJson): void {
  testSettings = settings
  setSessionSettingsCache({ settings, errors: [] })
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

beforeEach(async () => {
  mock.restore()
  resetStateForTests()
  resetSettingsCache()
  testSettings = {}
  setClientType('cli')
  setMainLoopModelOverride(undefined)
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GAKR_CODE_USE_GITHUB
  delete process.env.GAKR_CODE_USE_MISTRAL
  delete process.env.GAKR_CODE_USE_BEDROCK
  delete process.env.GAKR_CODE_USE_VERTEX
  delete process.env.GAKR_CODE_USE_FOUNDRY
  delete process.env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED
  delete process.env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID
  delete process.env.NVIDIA_NIM
  delete process.env.OPENAI_BASE_URL
  delete process.env.OPENAI_API_BASE
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_MODEL
  delete process.env.ANTHROPIC_BASE_URL
  delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
  delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
  delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
  delete process.env.GEMINI_MODEL
  delete process.env.MISTRAL_MODEL
  delete process.env.MINIMAX_API_KEY
  delete process.env.NVIDIA_API_KEY
  delete process.env.XAI_API_KEY
  delete process.env.VENICE_API_KEY
  delete process.env.MIMO_API_KEY
  delete process.env.BNKR_API_KEY
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_MODEL = 'gpt-5.5'
  setMainLoopModelOverride('gpt-5.5')
  delete process.env.GAKR_DISABLE_CO_AUTHORED_BY
  delete process.env.GAKR_CODE_REMOTE_SESSION_ID
  delete process.env.SESSION_INGRESS_URL
  delete process.env.USER_TYPE

  mock.module('./model/model.js', () => ({
    ...actualModel,
    getMainLoopModel: () => process.env.OPENAI_MODEL ?? 'gpt-5.5',
  }))
  mock.module('./model/providers.js', () => ({
    ...actualProviders,
    getAPIProvider: () => 'openai',
  }))
  // Stub settings directly so attribution.ts observes this test's intended
  // settings even when a previous serialized Bun test has mocked the settings
  // module or a nonced import creates a separate cache instance.
  mock.module('./settings/settings.js', () => ({
    ...actualSettings,
    getInitialSettings: () => testSettings,
    getSettings_DEPRECATED: () => testSettings,
  }))

  const attribution = await import(
    `./attribution.ts?attributionTest=${Date.now()}-${Math.random()}`
  )
  getAttributionTexts = attribution.getAttributionTexts
  getDefaultCommitCoAuthorEmail = attribution.getDefaultCommitCoAuthorEmail
  getDefaultCommitCoAuthorName = attribution.getDefaultCommitCoAuthorName
  getEnhancedPRAttribution = attribution.getEnhancedPRAttribution
})

afterEach(() => {
  mock.restore()
  resetStateForTests()
  resetSettingsCache()
  testSettings = {}
  setClientType(originalClientType)
  setMainLoopModelOverride(originalMainLoopModelOverride)
  mock.module('./model/model.js', () => actualModel)
  mock.module('./model/providers.js', () => actualProviders)
  mock.module('./settings/settings.js', () => actualSettings)
  restoreEnv()
})

describe('getDefaultCommitCoAuthorName', () => {
  it('does not label unknown non-Claude provider models as Opus', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'gpt-5.5',
        apiProvider: 'openai',
        isInternalRepo: false,
      }),
    ).toBe('GakrCLI (gpt-5.5)')
  })

  it('does not apply internal Claude formatting to non-Claude providers', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'gpt-5.5',
        apiProvider: 'openai',
        isInternalRepo: true,
      }),
    ).toBe('GakrCLI (gpt-5.5)')
  })

  it('keeps the codename-safe fallback for unknown first-party models', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'unreleased-internal-model',
        apiProvider: 'firstParty',
        isInternalRepo: false,
      }),
    ).toBe('claude opus 4.6')
  })

  it('sanitizes unknown internal Claude co-author names', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'bad\nmodel<id>',
        apiProvider: 'firstParty',
        isInternalRepo: true,
      }),
    ).toBe('GakrCLI (bad model id)')
  })

  it('does not duplicate the Claude prefix for Claude model names', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'Claude-opus-4-6',
        apiProvider: 'firstParty',
        isInternalRepo: false,
      }),
    ).toBe('claude opus 4.6')
  })

  it('uses the GakrCLI email for commit attribution across providers', () => {
    expect(getDefaultCommitCoAuthorEmail('openai')).toBe(
      'gakrcli@gakr-gakr.com',
    )
    expect(getDefaultCommitCoAuthorEmail('firstParty')).toBe(
      'gakrcli@gakr-gakr.com',
    )
  })
})

describe('getAttributionTexts', () => {
  it('returns no commit or PR attribution when no attribution settings are configured', () => {
    useSettings({})

    expect(getAttributionTexts()).toEqual({ commit: '', pr: '' })
  })

  it('honors custom commit attribution exactly and keeps omitted PR attribution off', () => {
    useSettings({
      attribution: { commit: 'Signed-off-by: Human <h@example.com>' },
    })

    expect(getAttributionTexts()).toEqual({
      commit: 'Signed-off-by: Human <h@example.com>',
      pr: '',
    })
  })

  it('keeps commit attribution off when configured as an empty string', () => {
    useSettings({ attribution: { commit: '' } })

    expect(getAttributionTexts()).toEqual({ commit: '', pr: '' })
  })

  it('honors custom PR attribution exactly and keeps omitted commit attribution off', () => {
    useSettings({ attribution: { pr: 'Reviewed by release engineering.' } })

    expect(getAttributionTexts()).toEqual({
      commit: '',
      pr: 'Reviewed by release engineering.',
    })
  })

  it('keeps PR attribution off when configured as an empty string', () => {
    useSettings({ attribution: { pr: '' } })

    expect(getAttributionTexts()).toEqual({ commit: '', pr: '' })
  })

  it('preserves includeCoAuthoredBy true as an explicit old-default opt-in', () => {
    useSettings({ includeCoAuthoredBy: true })

    const attribution = getAttributionTexts()
    expect(attribution.commit).toStartWith('Co-Authored-By: ')
    expect(attribution.commit).toEndWith(' <gakrcli@gakr-gakr.com>')
    expect(attribution.pr).toBe(defaultPrAttribution)
  })

  it('keeps attribution off when includeCoAuthoredBy is false', () => {
    useSettings({ includeCoAuthoredBy: false })

    expect(getAttributionTexts()).toEqual({ commit: '', pr: '' })
  })

  it('uses GAKR_DISABLE_CO_AUTHORED_BY to disable the old default co-author trailer', () => {
    process.env.GAKR_DISABLE_CO_AUTHORED_BY = '1'
    useSettings({ includeCoAuthoredBy: true })

    expect(getAttributionTexts()).toEqual({
      commit: '',
      pr: defaultPrAttribution,
    })
  })

  it('does not let GAKR_DISABLE_CO_AUTHORED_BY override explicit commit attribution', () => {
    process.env.GAKR_DISABLE_CO_AUTHORED_BY = '1'
    useSettings({
      attribution: { commit: 'Reviewed-by: Human <h@example.com>' },
    })

    expect(getAttributionTexts()).toEqual({
      commit: 'Reviewed-by: Human <h@example.com>',
      pr: '',
    })
  })

  it('preserves remote session attribution separately from local git attribution defaults', () => {
    setClientType('remote')
    process.env.GAKR_CODE_REMOTE_SESSION_ID = 'session_remote_123'
    useSettings({})

    expect(getAttributionTexts()).toEqual({
      commit: 'https://gakrcli.ai/code/session_remote_123',
      pr: 'https://gakrcli.ai/code/session_remote_123',
    })
  })
})

describe('getEnhancedPRAttribution', () => {
  it('returns no PR attribution when no attribution settings are configured', async () => {
    useSettings({})

    await expect(
      getEnhancedPRAttribution(() => {
        throw new Error('app state should not be read when attribution is off')
      }),
    ).resolves.toBe('')
  })

  it('honors custom PR attribution exactly', async () => {
    useSettings({ attribution: { pr: 'PR reviewed under repo policy.' } })

    await expect(
      getEnhancedPRAttribution(() => {
        throw new Error('app state should not be read for custom attribution')
      }),
    ).resolves.toBe('PR reviewed under repo policy.')
  })

  it('honors explicit empty PR attribution exactly', async () => {
    useSettings({ attribution: { pr: '' } })

    await expect(
      getEnhancedPRAttribution(() => {
        throw new Error('app state should not be read for empty attribution')
      }),
    ).resolves.toBe('')
  })

  it('preserves includeCoAuthoredBy true as an explicit opt-in to generated PR attribution', async () => {
    useSettings({ includeCoAuthoredBy: true })

    await expect(getEnhancedPRAttribution(() => ({} as never))).resolves.toBe(
      defaultPrAttribution,
    )
  })
})
