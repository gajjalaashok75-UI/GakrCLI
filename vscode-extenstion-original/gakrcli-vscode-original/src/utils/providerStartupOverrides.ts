import { saveGlobalConfig, type GlobalConfig } from './config.js'
import { GITHUB_PROVIDER_CLEANUP_ENV_KEYS } from './githubProviderMode.js'
import { updateSettingsForSource } from './settings/settings.js'

export const STARTUP_PROVIDER_OVERRIDE_ENV_KEYS = [
  ...GITHUB_PROVIDER_CLEANUP_ENV_KEYS,
  'GAKR_CODE_USE_GITHUB',
  'OPENAI_MODEL',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_CUSTOM_HEADERS',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'CODEX_API_KEY',
  'CODEX_CREDENTIAL_SOURCE',
  'CHATGPT_ACCOUNT_ID',
  'CODEX_ACCOUNT_ID',
] as const

type GlobalConfigWithEnv = {
  env?: Record<string, string>
}

type SettingsEnvPatch = Partial<
  Record<(typeof STARTUP_PROVIDER_OVERRIDE_ENV_KEYS)[number], string>
>

const DELETE_SETTINGS_ENV_VALUE = undefined as unknown as string

export function clearStartupProviderOverrides(options?: {
  updateUserSettings?: typeof updateSettingsForSource
  saveConfig?: (
    updater: (current: GlobalConfigWithEnv) => GlobalConfigWithEnv,
  ) => unknown
}): string | null {
  const updateUserSettings = options?.updateUserSettings ?? updateSettingsForSource
  const saveConfig =
    options?.saveConfig ??
    ((updater: (current: GlobalConfigWithEnv) => GlobalConfigWithEnv) =>
      saveGlobalConfig(
        updater as unknown as (currentConfig: GlobalConfig) => GlobalConfig,
      ))
  const envPatch = Object.fromEntries(
    STARTUP_PROVIDER_OVERRIDE_ENV_KEYS.map(key => [
      key,
      DELETE_SETTINGS_ENV_VALUE,
    ]),
  ) as SettingsEnvPatch

  const { error } = updateUserSettings('userSettings', { env: envPatch })

  let globalConfigError: string | null = null
  try {
    saveConfig((current: GlobalConfigWithEnv) => {
      const currentEnv = current.env ?? {}
      let changed = false
      const nextEnv = { ...currentEnv }
      for (const key of STARTUP_PROVIDER_OVERRIDE_ENV_KEYS) {
        if (key in nextEnv) {
          delete nextEnv[key]
          changed = true
        }
      }
      return changed ? { ...current, env: nextEnv } : current
    })
  } catch (configError) {
    globalConfigError =
      configError instanceof Error ? configError.message : String(configError)
  }

  return error?.message ?? globalConfigError
}
