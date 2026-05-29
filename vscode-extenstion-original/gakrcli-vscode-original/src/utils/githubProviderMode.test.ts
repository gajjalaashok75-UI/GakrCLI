import { describe, expect, test } from 'bun:test'

import {
  applyGithubProviderProcessEnv,
  buildGithubProviderSettingsEnv,
  GITHUB_PROVIDER_DEFAULT_MODEL,
  normalizeGithubProviderModel,
} from './githubProviderMode.js'

describe('githubProviderMode', () => {
  test('builds settings env that clears stale provider routing keys', () => {
    const env = buildGithubProviderSettingsEnv(' github:copilot ')

    expect(env.GAKR_CODE_USE_GITHUB).toBe('1')
    expect(env.OPENAI_MODEL).toBe(GITHUB_PROVIDER_DEFAULT_MODEL)
    expect(env.GAKR_CODE_USE_OPENAI).toBeUndefined()
    expect(env.GAKR_CODE_USE_MISTRAL).toBeUndefined()
    expect(env.GAKR_CODE_USE_NVIDIA).toBeUndefined()
    expect(env.OPENAI_API_FORMAT).toBeUndefined()
    expect(env.OPENAI_AUTH_HEADER_VALUE).toBeUndefined()
    expect(env.MISTRAL_API_KEY).toBeUndefined()
    expect(env.NVIDIA_BASE_URL).toBeUndefined()
    expect(env.BNKR_API_KEY).toBeUndefined()
    expect(env.XAI_API_KEY).toBeUndefined()
    expect(env.VENICE_API_KEY).toBeUndefined()
    expect(env.MIMO_API_KEY).toBeUndefined()
  })

  test('applies GitHub mode and removes stale process env routing', () => {
    const env: NodeJS.ProcessEnv = {
      GAKR_CODE_USE_OPENAI: '1',
      GAKR_CODE_USE_MISTRAL: '1',
      GAKR_CODE_USE_NVIDIA: '1',
      OPENAI_BASE_URL: 'https://api.minimax.io/v1',
      OPENAI_API_KEY: 'sk-openai',
      OPENAI_API_FORMAT: 'responses',
      OPENAI_AUTH_HEADER_VALUE: 'secret-header',
      MISTRAL_API_KEY: 'mistral-key',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      BNKR_API_KEY: 'bankr-key',
      XAI_API_KEY: 'xai-key',
      VENICE_API_KEY: 'venice-key',
      MIMO_API_KEY: 'mimo-key',
      GITHUB_TOKEN: 'keep-github-token',
      GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED: '1',
      GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID: 'profile-id',
    }

    applyGithubProviderProcessEnv(' ', env)

    expect(env.GAKR_CODE_USE_GITHUB).toBe('1')
    expect(env.OPENAI_MODEL).toBe(GITHUB_PROVIDER_DEFAULT_MODEL)
    expect(env.GITHUB_TOKEN).toBe('keep-github-token')
    expect(env.GAKR_CODE_USE_OPENAI).toBeUndefined()
    expect(env.GAKR_CODE_USE_MISTRAL).toBeUndefined()
    expect(env.GAKR_CODE_USE_NVIDIA).toBeUndefined()
    expect(env.OPENAI_BASE_URL).toBeUndefined()
    expect(env.OPENAI_API_KEY).toBeUndefined()
    expect(env.OPENAI_API_FORMAT).toBeUndefined()
    expect(env.OPENAI_AUTH_HEADER_VALUE).toBeUndefined()
    expect(env.MISTRAL_API_KEY).toBeUndefined()
    expect(env.NVIDIA_BASE_URL).toBeUndefined()
    expect(env.BNKR_API_KEY).toBeUndefined()
    expect(env.XAI_API_KEY).toBeUndefined()
    expect(env.VENICE_API_KEY).toBeUndefined()
    expect(env.MIMO_API_KEY).toBeUndefined()
    expect(env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED).toBeUndefined()
    expect(env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID).toBeUndefined()
  })

  test('normalizes blank model to the GitHub default', () => {
    expect(normalizeGithubProviderModel('')).toBe(GITHUB_PROVIDER_DEFAULT_MODEL)
    expect(normalizeGithubProviderModel(' openai/gpt-5 ')).toBe('openai/gpt-5')
  })
})
