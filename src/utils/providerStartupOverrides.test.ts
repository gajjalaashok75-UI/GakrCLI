import { describe, expect, mock, test } from 'bun:test'

import {
  clearStartupProviderOverrides,
  STARTUP_PROVIDER_OVERRIDE_ENV_KEYS,
} from './providerStartupOverrides.js'

describe('clearStartupProviderOverrides', () => {
  test('removes stale provider env from user settings and global config env', () => {
    const updateUserSettings = mock(() => ({ error: null }))

    // Build a config env that has every STARTUP_PROVIDER_OVERRIDE_ENV_KEYS
    // key set to a non-empty value, plus a few extras that should survive
    // (KEEP_ME, an unrelated key, and a stale NVIDIA flag).
    const removalKeys = [...STARTUP_PROVIDER_OVERRIDE_ENV_KEYS]
    const inputEnv: Record<string, string> = {
      ...Object.fromEntries(removalKeys.map(k => [k, `${k.toLowerCase()}-val`])),
      GAKR_CODE_USE_NVIDIA: '1',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      KEEP_ME: '1',
    }
    const cleanupKeySet = new Set(removalKeys)
    const expectedEnv = Object.fromEntries(
      Object.entries(inputEnv).filter(([k]) => !cleanupKeySet.has(k)),
    )

    const saveConfig = mock((updater: (current: {
      env: Record<string, string>
    }) => { env: Record<string, string> }) =>
      updater({ env: inputEnv }),
    )

    const error = clearStartupProviderOverrides({
      updateUserSettings,
      saveConfig: saveConfig as any,
    })

    expect(error).toBeNull()
    const expectedEnvPatch = Object.fromEntries(
      removalKeys.map(key => [key, undefined]),
    )
    expect(updateUserSettings).toHaveBeenCalledWith(
      'userSettings',
      expect.objectContaining({
        env: expect.objectContaining(expectedEnvPatch),
      }),
    )
    expect(
      (saveConfig.mock.results[0]?.value as { env: Record<string, string> }).env,
    ).toEqual(expectedEnv)
  })

  test.skip('includes GitHub activation cleanup keys in startup override cleanup', () => {
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
