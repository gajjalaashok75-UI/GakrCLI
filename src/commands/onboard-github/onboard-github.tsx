import * as React from 'react'
import { useCallback, useState } from 'react'
import { Select } from '../../components/CustomSelect/select.js'
import { Spinner } from '../../components/Spinner.js'
import TextInput from '../../components/TextInput.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text } from '../../ink.js'
import {
  exchangeForCopilotToken,
  openVerificationUri,
  pollAccessToken,
  requestDeviceCode,
} from '../../services/github/deviceFlow.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import type { GithubModelsCredentialBlob } from '../../utils/githubModelsCredentials.js'
import {
  hydrateGithubModelsTokenFromSecureStorage,
  readGithubModelsToken,
  saveGithubModelsToken,
} from '../../utils/githubModelsCredentials.js'
import { getDisplayPath } from '../../utils/file.js'
import {
  getSettingsFilePathForSource,
  getSettingsForSource,
  updateSettingsForSource,
} from '../../utils/settings/settings.js'

const DEFAULT_MODEL = 'github:copilot'
const FORCE_RELOGIN_ARGS = new Set([
  'force',
  '--force',
  'relogin',
  '--relogin',
  'reauth',
  '--reauth',
])

type Step = 'menu' | 'ghe-url' | 'copilot-key' | 'device-busy' | 'error'

const PROVIDER_SPECIFIC_KEYS = new Set([
  'GAKR_CODE_USE_OPENAI',
  'GAKR_CODE_USE_GEMINI',
  'GAKR_CODE_USE_BEDROCK',
  'GAKR_CODE_USE_VERTEX',
  'GAKR_CODE_USE_FOUNDRY',
  'GITHUB_COPILOT_KEY',
  'GITHUB_ENTERPRISE_URL',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_BASE_URL',
  'GEMINI_MODEL',
  'GEMINI_ACCESS_TOKEN',
  'GEMINI_AUTH_MODE',
])

export function shouldForceGithubRelogin(args?: string): boolean {
  const normalized = (args ?? '').trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return normalized.split(/\s+/).some(arg => FORCE_RELOGIN_ARGS.has(arg))
}

const GITHUB_PAT_PREFIXES = ['ghp_', 'gho_','ghs_', 'ghr_', 'github_pat_']

function isGithubPat(token: string): boolean {
  return GITHUB_PAT_PREFIXES.some(prefix => token.startsWith(prefix))
}

function getUserSettingsDisplayPath(): string {
  const userSettingsPath = getSettingsFilePathForSource('userSettings')
  return userSettingsPath ? getDisplayPath(userSettingsPath) : 'settings'
}

function getExistingGithubEnterpriseUrl(
  env: NodeJS.ProcessEnv = process.env,
  settingsEnv?: Record<string, string | undefined>,
): string | undefined {
  const envUrl = env.GITHUB_ENTERPRISE_URL?.trim()
  if (envUrl) return envUrl
  if (settingsEnv?.GITHUB_ENTERPRISE_URL?.trim()) {
    return settingsEnv.GITHUB_ENTERPRISE_URL.trim()
  }
  // Check user settings as fallback
  const userSettings = getSettingsForSource('userSettings')
  const settingsEnterpriseUrl = userSettings?.env?.GITHUB_ENTERPRISE_URL?.trim()
  if (settingsEnterpriseUrl) return settingsEnterpriseUrl
  return undefined
}

export function hasExistingGithubModelsLoginToken(
  env: NodeJS.ProcessEnv = process.env,
  storedToken?: string,
): boolean {
  const envToken = env.GITHUB_TOKEN?.trim() || env.GH_TOKEN?.trim()
  if (envToken) {
    // PATs are no longer supported - require OAuth re-auth
    if (isGithubPat(envToken)) {
      return false
    }
    return true
  }
  const persisted = (storedToken ?? readGithubModelsToken())?.trim()
  // PATs are no longer supported - require OAuth re-auth
  if (persisted && isGithubPat(persisted)) {
    return false
  }
  return Boolean(persisted)
}

export function buildGithubOnboardingSettingsEnv(
  model: string,
  gheUrl?: string,
): Record<string, string | undefined> {
  return {
    GAKR_CODE_USE_GITHUB: '1',
    OPENAI_MODEL: model,
    ...(gheUrl ? { GITHUB_ENTERPRISE_URL: gheUrl } : {}),
    OPENAI_API_KEY: undefined,
    OPENAI_ORG: undefined,
    OPENAI_PROJECT: undefined,
    OPENAI_ORGANIZATION: undefined,
    OPENAI_BASE_URL: undefined,
    OPENAI_API_BASE: undefined,
    GAKR_CODE_USE_OPENAI: undefined,
    GAKR_CODE_USE_GEMINI: undefined,
    GAKR_CODE_USE_BEDROCK: undefined,
    GAKR_CODE_USE_VERTEX: undefined,
    GAKR_CODE_USE_FOUNDRY: undefined,
  }
}

export function applyGithubOnboardingProcessEnv(
  model: string,
  env: NodeJS.ProcessEnv = process.env,
  gheUrl?: string,
): void {
  env.GAKR_CODE_USE_GITHUB = '1'
  env.OPENAI_MODEL = model

  if (gheUrl) {
    env.GITHUB_ENTERPRISE_URL = gheUrl
  } else {
    delete env.GITHUB_ENTERPRISE_URL
  }

  delete env.OPENAI_API_KEY
  delete env.OPENAI_ORG
  delete env.OPENAI_PROJECT
  delete env.OPENAI_ORGANIZATION
  delete env.OPENAI_BASE_URL
  delete env.OPENAI_API_BASE

  delete env.GAKR_CODE_USE_OPENAI
  delete env.GAKR_CODE_USE_GEMINI
  delete env.GAKR_CODE_USE_BEDROCK
  delete env.GAKR_CODE_USE_VERTEX
  delete env.GAKR_CODE_USE_FOUNDRY
  delete env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED
  delete env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID
}

function mergeUserSettingsEnv(
  model: string,
  gheUrl?: string,
): { ok: boolean; detail?: string } {
  const currentSettings = getSettingsForSource('userSettings')
  const currentEnv = currentSettings?.env ?? {}

  const newEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(currentEnv)) {
    if (!PROVIDER_SPECIFIC_KEYS.has(key)) {
      newEnv[key] = value
    }
  }

  newEnv.GAKR_CODE_USE_GITHUB = '1'
  newEnv.OPENAI_MODEL = model
  if (gheUrl) {
    newEnv.GITHUB_ENTERPRISE_URL = gheUrl
  } else {
    delete newEnv.GITHUB_ENTERPRISE_URL
  }

  const { error } = updateSettingsForSource('userSettings', {
    env: newEnv,
  })
  if (error) {
    return { ok: false, detail: error.message }
  }
  return { ok: true }
}

export function activateGithubOnboardingMode(
  model: string = DEFAULT_MODEL,
  options?: {
    mergeSettingsEnv?: (model: string, gheUrl?: string) => { ok: boolean; detail?: string }
    applyProcessEnv?: (model: string, gheUrl?: string) => void
    hydrateToken?: () => void
    onChangeAPIKey?: () => void
    gheUrl?: string
  },
): { ok: boolean; detail?: string } {
  const normalizedModel = model.trim() || DEFAULT_MODEL
  const mergeSettingsEnv = options?.mergeSettingsEnv ?? mergeUserSettingsEnv
  const applyProcessEnv = options?.applyProcessEnv ?? applyGithubOnboardingProcessEnv
  const hydrateToken =
    options?.hydrateToken ?? hydrateGithubModelsTokenFromSecureStorage

  const gheUrl = options?.gheUrl ?? getExistingGithubEnterpriseUrl()
  const merged = mergeSettingsEnv(normalizedModel, gheUrl)
  if (!merged.ok) {
    return merged
  }

  applyProcessEnv(normalizedModel, gheUrl)
  hydrateToken()
  options?.onChangeAPIKey?.()
  return { ok: true }
}

function OnboardGithub(props: {
  onDone: Parameters<LocalJSXCommandCall>[0]
  onChangeAPIKey: () => void
}): React.ReactNode {
  const { onDone, onChangeAPIKey } = props
  const [step, setStep] = useState<Step>('menu')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deviceHint, setDeviceHint] = useState<{
    user_code: string
    verification_uri: string
  } | null>(null)
  const [gheUrl, setGheUrl] = useState<string | undefined>(
    getExistingGithubEnterpriseUrl(),
  )
  const [gheUrlInput, setGheUrlInput] = useState(gheUrl ?? '')
  const [copilotKey, setCopilotKey] = useState(
    process.env.GITHUB_COPILOT_KEY?.trim() || '',
  )

  const finalize = useCallback(
    async (
      token: string,
      model: string = DEFAULT_MODEL,
      oauthToken?: string,
      credentialType?: GithubModelsCredentialBlob['credentialType'],
    ) => {
      const saved = saveGithubModelsToken(token, oauthToken, {
        credentialType,
      })
      if (!saved.success) {
        setErrorMsg(saved.warning ?? 'Could not save token to secure storage.')
        setStep('error')
        return
      }
      const activated = activateGithubOnboardingMode(model, {
        gheUrl,
        onChangeAPIKey,
      })
      if (!activated.ok) {
        setErrorMsg(
          `Token saved, but settings were not updated: ${activated.detail ?? 'unknown error'}. ` +
            `Add env GAKR_CODE_USE_GITHUB=1 and OPENAI_MODEL to ~/.gakrcli/settings.json manually.`,
        )
        setStep('error')
        return
      }
      // Clear stale provider-specific env vars from the current session
      // so resolveProviderRequest() doesn't pick up a previous provider's
      // base URL or key after onboarding completes.
      for (const key of PROVIDER_SPECIFIC_KEYS) {
        delete process.env[key]
      }
      process.env.GAKR_CODE_USE_GITHUB = '1'
      process.env.OPENAI_MODEL = model.trim() || DEFAULT_MODEL
      hydrateGithubModelsTokenFromSecureStorage()
      onChangeAPIKey()
      onDone(
        'GitHub Copilot onboard complete. Copilot token and OAuth token stored in secure storage (Windows/Linux: ~/.gakrcli/.credentials.json, macOS: Keychain fallback to ~/.gakrcli/.credentials.json); user settings updated. Restart if the model does not switch.',
        { display: 'user' },
      )
    },
    [gheUrl, onChangeAPIKey, onDone],
  )

  const runDeviceFlow = useCallback(
    async (params?: { gheUrl?: string }) => {
      setStep('device-busy')
      setErrorMsg(null)
      setDeviceHint(null)
      try {
        const copilotKeyVal = copilotKey.trim()
        if (copilotKeyVal) {
          const tokenFromKey = copilotKeyVal
          if (tokenFromKey) {
            await finalize(tokenFromKey, DEFAULT_MODEL, undefined, 'copilot_key')
            return
          }
        }
        const device = await requestDeviceCode({ gheUrl: params?.gheUrl })
        setDeviceHint({
          user_code: device.user_code,
          verification_uri: device.verification_uri,
        })
        await openVerificationUri(device.verification_uri)
        const oauthToken = await pollAccessToken(device.device_code, {
          initialInterval: device.interval,
          timeoutSeconds: device.expires_in,
          gheUrl: params?.gheUrl,
        })
        const copilotToken = await exchangeForCopilotToken(
          oauthToken,
          undefined,
          params?.gheUrl,
        )
        await finalize(
          copilotToken.token,
          DEFAULT_MODEL,
          oauthToken,
          'copilot_token',
        )
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e))
        setStep('error')
      }
    },
    [finalize, copilotKey],
  )

  if (step === 'error' && errorMsg) {
    const options = [
      {
        label: 'Back to menu',
        value: 'back' as const,
      },
      {
        label: 'Exit',
        value: 'exit' as const,
      },
    ]
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="red">{errorMsg}</Text>
        <Select
          options={options}
          onChange={(v: string) => {
            if (v === 'back') {
              setStep('menu')
              setErrorMsg(null)
            } else {
              onDone('GitHub onboard cancelled', { display: 'system' })
            }
          }}
        />
      </Box>
    )
  }

  if (step === 'device-busy') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text>GitHub Copilot sign-in</Text>
        {deviceHint ? (
          <>
            <Text>
              Enter code <Text bold>{deviceHint.user_code}</Text> at{' '}
              {deviceHint.verification_uri}
            </Text>
            <Text dimColor>
              A browser window may have opened. Waiting for authorization...
            </Text>
          </>
        ) : (
          <Text dimColor>Requesting device code from GitHub...</Text>
        )}
        <Spinner />
      </Box>
    )
  }

  const termsWidth = useTerminalSize()?.columns ?? 80

  if (step === 'ghe-url') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>GitHub Enterprise Server URL</Text>
        <TextInput
          value={gheUrlInput}
          placeholder="https://github.example.com"
          onChange={setGheUrlInput}
          onSubmit={() => {
            const trimmed = gheUrlInput.trim()
            if (trimmed) {
              setGheUrl(trimmed)
              setGheUrlInput(trimmed)
              setStep('menu')
            } else {
              setGheUrl(undefined)
              setGheUrlInput('')
              setStep('menu')
            }
          }}
          width={Math.min(termsWidth - 4, 60)}
        />
        <Text dimColor>
          Enter your GitHub Enterprise Server URL to use Copilot with a
          self-hosted instance. Leave empty and press Enter to use github.com.
        </Text>
      </Box>
    )
  }

  if (step === 'copilot-key') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>GitHub Copilot API Key</Text>
        <TextInput
          value={copilotKey}
          placeholder="Paste your Copilot API key..."
          onChange={setCopilotKey}
          onSubmit={() => {
            void runDeviceFlow()
          }}
          width={Math.min(termsWidth - 4, 60)}
        />
        <Text dimColor>
          Paste your GitHub Copilot API Key. This is an alternative to the
          device-flow OAuth sign-in. You can get it from your GitHub settings.
        </Text>
      </Box>
    )
  }

  const menuOptions = [
    {
      label: 'Sign in with browser',
      value: 'device' as const,
    },
    ...(gheUrl
      ? [
          {
            label: `Switch Enterprise URL (${
              gheUrl.length > 30
                ? gheUrl.slice(0, 30) + '...'
                : gheUrl
            })`,
            value: 'ghe-url' as const,
          },
        ]
      : [
          {
            label: 'Use Enterprise Server',
            value: 'ghe-url' as const,
          },
        ]),
    {
      label: 'Paste Copilot API Key',
      value: 'copilot-key' as const,
    },
    {
      label: 'Cancel',
      value: 'cancel' as const,
    },
  ]

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>GitHub Copilot setup</Text>
      <Text dimColor>
        Stores your token in the OS credential store (macOS Keychain when available)
        and enables GAKR_CODE_USE_GITHUB in your user settings - no export
        GITHUB_TOKEN needed for future runs.
      </Text>
      <Select
        options={menuOptions}
        onChange={(v: string) => {
          if (v === 'cancel') {
            onDone('GitHub onboard cancelled', { display: 'system' })
            return
          }
          if (v === 'ghe-url') {
            setStep('ghe-url')
            return
          }
          if (v === 'copilot-key') {
            setStep('copilot-key')
            return
          }
          void runDeviceFlow({ gheUrl })
        }}
      />
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const forceRelogin = shouldForceGithubRelogin(args)
  const existingGheUrl = getExistingGithubEnterpriseUrl()
  if (hasExistingGithubModelsLoginToken() && !forceRelogin) {
    const activated = activateGithubOnboardingMode(DEFAULT_MODEL, {
      gheUrl: existingGheUrl,
      onChangeAPIKey: context.onChangeAPIKey,
    })
    if (!activated.ok) {
      onDone(
        `GitHub token detected, but settings activation failed: ${activated.detail ?? 'unknown error'}. ` +
          'Set GAKR_CODE_USE_GITHUB=1 and OPENAI_MODEL=github:copilot in user settings manually.',
        { display: 'system' },
      )
      return null
    }

    onDone(
      'GitHub Models already authorized. Activated GitHub Models mode using your existing token. Use /onboard-github --force to re-authenticate.',
      { display: 'user' },
    )
    return null
  }

  return (
    <OnboardGithub
      onDone={onDone}
      onChangeAPIKey={context.onChangeAPIKey}
    />
  )
}
