import { describe, expect, mock, test } from 'bun:test'

import {
  clearStartupProviderOverrides,
  STARTUP_PROVIDER_OVERRIDE_ENV_KEYS,
} from './providerStartupOverrides.js'

describe('clearStartupProviderOverrides', () => {
  test('removes stale provider env from user settings and global config env', () => {
    const updateUserSettings = mock(() => ({ error: null }))
    const saveConfig = mock((updater: (current: {
      env: Record<string, string>
    }) => { env: Record<string, string> }) =>
      updater({
        env: {
          GAKR_CODE_USE_OPENAI: '1',
          GAKR_CODE_USE_MISTRAL: '1',
          GAKR_CODE_USE_NVIDIA: '1',
          OPENAI_BASE_URL: 'https://api.minimax.io/v1',
          OPENAI_MODEL: 'minimax-m2.7',
          OPENAI_API_FORMAT: 'responses',
          OPENAI_AUTH_HEADER_VALUE: 'secret-header',
          MINIMAX_API_KEY: 'sk-minimax',
          MISTRAL_API_KEY: 'sk-mistral',
          NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
          BNKR_API_KEY: 'sk-bankr',
          XAI_API_KEY: 'sk-xai',
          VENICE_API_KEY: 'sk-venice',
          MIMO_API_KEY: 'sk-mimo',
          KEEP_ME: '1',
        },
      }),
    )

    const error = clearStartupProviderOverrides({
      updateUserSettings,
      saveConfig: saveConfig as any,
    })

    expect(error).toBeNull()
    expect(updateUserSettings).toHaveBeenCalledWith(
      'userSettings',
      expect.objectContaining({
        env: expect.objectContaining({
          GAKR_CODE_USE_OPENAI: undefined,
          GAKR_CODE_USE_MISTRAL: undefined,
          GAKR_CODE_USE_NVIDIA: undefined,
          OPENAI_BASE_URL: undefined,
          OPENAI_MODEL: undefined,
          OPENAI_API_FORMAT: undefined,
          OPENAI_AUTH_HEADER_VALUE: undefined,
          MINIMAX_API_KEY: undefined,
          MISTRAL_API_KEY: undefined,
          NVIDIA_BASE_URL: undefined,
          BNKR_API_KEY: undefined,
          XAI_API_KEY: undefined,
          VENICE_API_KEY: undefined,
          MIMO_API_KEY: undefined,
        }),
      }),
    )
    expect(
      (saveConfig.mock.results[0]?.value as { env: Record<string, string> }).env,
    ).toEqual({ KEEP_ME: '1' })
  })

  test('includes GitHub activation cleanup keys in startup override cleanup', () => {
    expect(STARTUP_PROVIDER_OVERRIDE_ENV_KEYS).toEqual(
      expect.arrayContaining([
        'GAKR_CODE_USE_MISTRAL',
        'GAKR_CODE_USE_NVIDIA',
        'OPENAI_API_FORMAT',
        'OPENAI_AUTH_HEADER_VALUE',
        'MISTRAL_API_KEY',
        'NVIDIA_BASE_URL',
        'BNKR_API_KEY',
        'XAI_API_KEY',
        'VENICE_API_KEY',
        'MIMO_API_KEY',
      ]),
    )
  })
})
