import * as React from 'react'
import { useCallback, useState } from 'react'
import { Select } from '../../components/CustomSelect/select.js'
import { Spinner } from '../../components/Spinner.js'
import TextInput from '../../components/TextInput.js'
import { Box, Text } from '../../ink.js'
import {
  exchangeForCopilotToken,
  openVerificationUri,
  pollAccessToken,
  requestDeviceCode,
} from '../../services/github/deviceFlow.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  hydrateGithubModelsTokenFromSecureStorage,
  readGithubModelsToken,
  saveGithubModelsToken,
} from '../../utils/githubModelsCredentials.js'
import {
  applyGithubProviderProcessEnv,
  buildGithubProviderSettingsEnv,
  GITHUB_PROVIDER_DEFAULT_MODEL,
  normalizeGithubProviderModel,
} from '../../utils/githubProviderMode.js'
import { updateSettingsForSource } from '../../utils/settings/settings.js'
import { useSetAppState } from '../../state/AppState.js'

const FORCE_RELOGIN_ARGS = new Set([
  'force',
  '--force',
  'relogin',
  '--relogin',
  'reauth',
  '--reauth',
])

const GITHUB_PAT_PREFIXES = ['ghp_', 'gho_', 'ghs_', 'ghr_', 'github_pat_']

type Step = 'menu' | 'device-busy' | 'pat' | 'error'

export function shouldForceGithubRelogin(args?: string): boolean {
  const normalized = (args ?? '').trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return normalized.split(/\s+/).some(arg => FORCE_RELOGIN_ARGS.has(arg))
}

function isGithubPat(token: string): boolean {
  return GITHUB_PAT_PREFIXES.some(prefix => token.startsWith(prefix))
}

export function hasExistingGithubModelsLoginToken(
  env: NodeJS.ProcessEnv = process.env,
  storedToken?: string,
): boolean {
  const envToken = env.GITHUB_TOKEN?.trim() || env.GH_TOKEN?.trim()
  if (envToken) {
    return !isGithubPat(envToken)
  }

  const persisted = (storedToken ?? readGithubModelsToken())?.trim()
  if (persisted && isGithubPat(persisted)) {
    return false
  }
  return Boolean(persisted)
}

export async function saveGithubDeviceFlowToken(
  oauthToken: string,
  deps?: {
    exchangeForCopilotToken?: typeof exchangeForCopilotToken
    saveGithubModelsToken?: typeof saveGithubModelsToken
  },
): Promise<{ success: boolean; warning?: string }> {
  const trimmedOauthToken = oauthToken.trim()
  if (!trimmedOauthToken) {
    return { success: false, warning: 'Token is empty.' }
  }

  const exchange = deps?.exchangeForCopilotToken ?? exchangeForCopilotToken
  const save = deps?.saveGithubModelsToken ?? saveGithubModelsToken
  const copilotToken = await exchange(trimmedOauthToken)
  return save(copilotToken.token, trimmedOauthToken)
}

export function buildGithubOnboardingSettingsEnv(
  model: string,
): Record<string, string | undefined> {
  return buildGithubProviderSettingsEnv(model)
}

export function applyGithubOnboardingProcessEnv(
  model: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  applyGithubProviderProcessEnv(model, env)
}

function mergeUserSettingsEnv(model: string): { ok: boolean; detail?: string } {
  const { error } = updateSettingsForSource('userSettings', {
    env: buildGithubOnboardingSettingsEnv(model),
  })
  if (error) {
    return { ok: false, detail: error.message }
  }
  return { ok: true }
}

export function activateGithubOnboardingMode(
  model: string = GITHUB_PROVIDER_DEFAULT_MODEL,
  options?: {
    mergeSettingsEnv?: (model: string) => { ok: boolean; detail?: string }
    applyProcessEnv?: (model: string) => void
    hydrateToken?: () => void
    onChangeAPIKey?: () => void
  },
): { ok: boolean; detail?: string } {
  const normalizedModel = normalizeGithubProviderModel(model)
  const mergeSettingsEnv = options?.mergeSettingsEnv ?? mergeUserSettingsEnv
  const applyProcessEnv = options?.applyProcessEnv ?? applyGithubOnboardingProcessEnv
  const hydrateToken = options?.hydrateToken ?? hydrateGithubModelsTokenFromSecureStorage

  const merged = mergeSettingsEnv(normalizedModel)
  if (!merged.ok) {
    return merged
  }

  applyProcessEnv(normalizedModel)
  hydrateToken()
  options?.onChangeAPIKey?.()
  return { ok: true }
}

function useSwitchGithubSessionModel(): (model?: string) => void {
  const setAppState = useSetAppState()
  return useCallback(
    (model: string = GITHUB_PROVIDER_DEFAULT_MODEL) => {
      setAppState(prev => ({
        ...prev,
        mainLoopModel: normalizeGithubProviderModel(model),
        mainLoopModelForSession: null,
      }))
    },
    [setAppState],
  )
}

function ActivateExistingGithubLogin(props: {
  onDone: Parameters<LocalJSXCommandCall>[0]
  onChangeAPIKey: () => void
}): React.ReactNode {
  const { onDone, onChangeAPIKey } = props
  const switchSessionModel = useSwitchGithubSessionModel()
  const ranRef = React.useRef(false)

  React.useEffect(() => {
    if (ranRef.current) {
      return
    }
    ranRef.current = true

    const activated = activateGithubOnboardingMode(GITHUB_PROVIDER_DEFAULT_MODEL, {
      onChangeAPIKey,
    })
    if (!activated.ok) {
      onDone(
        `GitHub token detected, but settings activation failed: ${activated.detail ?? 'unknown error'}. ` +
          'Set GAKR_CODE_USE_GITHUB=1 and OPENAI_MODEL=github:copilot in user settings manually.',
        { display: 'system' },
      )
      return
    }

    switchSessionModel(GITHUB_PROVIDER_DEFAULT_MODEL)
    onDone(
      'GitHub Models already authorized. Activated GitHub Models mode using your existing token and switched this session to github:copilot. Use /onboard-github --force to re-authenticate.',
      { display: 'user' },
    )
  }, [onChangeAPIKey, onDone, switchSessionModel])

  return null
}

function OnboardGithub(props: {
  onDone: Parameters<LocalJSXCommandCall>[0]
  onChangeAPIKey: () => void
}): React.ReactNode {
  const { onDone, onChangeAPIKey } = props
  const switchSessionModel = useSwitchGithubSessionModel()
  const [step, setStep] = useState<Step>('menu')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deviceHint, setDeviceHint] = useState<{
    user_code: string
    verification_uri: string
  } | null>(null)
  const [patDraft, setPatDraft] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)

  const finalize = useCallback(
    async (token: string, model: string = GITHUB_PROVIDER_DEFAULT_MODEL) => {
      const saved = saveGithubModelsToken(token)
      if (!saved.success) {
        setErrorMsg(saved.warning ?? 'Could not save token to secure storage.')
        setStep('error')
        return
      }

      const activated = activateGithubOnboardingMode(model, { onChangeAPIKey })
      if (!activated.ok) {
        setErrorMsg(
          `Token saved, but settings were not updated: ${activated.detail ?? 'unknown error'}. ` +
            `Add env GAKR_CODE_USE_GITHUB=1 and OPENAI_MODEL to ~/.gakrcli/settings.json manually.`,
        )
        setStep('error')
        return
      }

      switchSessionModel(model)
      onDone(
        'GitHub Models onboard complete. Token stored in secure storage; user settings updated; this session switched to github:copilot.',
        { display: 'user' },
      )
    },
    [onChangeAPIKey, onDone],
  )

  const runDeviceFlow = useCallback(async () => {
    setStep('device-busy')
    setErrorMsg(null)
    setDeviceHint(null)
    try {
      const device = await requestDeviceCode()
      setDeviceHint({
        user_code: device.user_code,
        verification_uri: device.verification_uri,
      })
      await openVerificationUri(device.verification_uri)
      const token = await pollAccessToken(device.device_code, {
        initialInterval: device.interval,
        timeoutSeconds: device.expires_in,
      })
      const saved = await saveGithubDeviceFlowToken(token)
      if (!saved.success) {
        setErrorMsg(saved.warning ?? 'Could not save token to secure storage.')
        setStep('error')
        return
      }

      const activated = activateGithubOnboardingMode(GITHUB_PROVIDER_DEFAULT_MODEL, {
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

      switchSessionModel(GITHUB_PROVIDER_DEFAULT_MODEL)
      onDone(
        'GitHub Models onboard complete. Token stored in secure storage; user settings updated; this session switched to github:copilot.',
        { display: 'user' },
      )
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStep('error')
    }
  }, [onChangeAPIKey, onDone])

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
        <Text>GitHub device login</Text>
        {deviceHint ? (
          <>
            <Text>
              Enter code <Text bold>{deviceHint.user_code}</Text> at{' '}
              {deviceHint.verification_uri}
            </Text>
            <Text dimColor>
              A browser window may have opened. Waiting for authorization…
            </Text>
          </>
        ) : (
          <Text dimColor>Requesting device code from GitHub…</Text>
        )}
        <Spinner />
      </Box>
    )
  }

  if (step === 'pat') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text>Paste a GitHub personal access token with access to GitHub Models.</Text>
        <Text dimColor>Input is masked. Enter to submit; Esc to go back.</Text>
        <TextInput
          value={patDraft}
          mask="*"
          onChange={setPatDraft}
          onSubmit={async (value: string) => {
            const t = value.trim()
            if (!t) {
              return
            }
            await finalize(t, GITHUB_PROVIDER_DEFAULT_MODEL)
          }}
          onExit={() => {
            setStep('menu')
            setPatDraft('')
          }}
          columns={80}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
        />
      </Box>
    )
  }

  const menuOptions = [
    {
      label: 'Sign in with browser (device code)',
      value: 'device' as const,
    },
    {
      label: 'Paste personal access token',
      value: 'pat' as const,
    },
    {
      label: 'Cancel',
      value: 'cancel' as const,
    },
  ]

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>GitHub Models setup</Text>
      <Text dimColor>
        Stores your token in the OS credential store (macOS Keychain when available)
        and enables GAKR_CODE_USE_GITHUB in your user settings — no export
        GITHUB_TOKEN needed for future runs.
      </Text>
      <Select
        options={menuOptions}
        onChange={(v: string) => {
          if (v === 'cancel') {
            onDone('GitHub onboard cancelled', { display: 'system' })
            return
          }
          if (v === 'pat') {
            setStep('pat')
            return
          }
          void runDeviceFlow()
        }}
      />
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const forceRelogin = shouldForceGithubRelogin(args)
  if (hasExistingGithubModelsLoginToken() && !forceRelogin) {
    return (
      <ActivateExistingGithubLogin
        onDone={onDone}
        onChangeAPIKey={context.onChangeAPIKey}
      />
    )
  }

  return (
    <OnboardGithub
      onDone={onDone}
      onChangeAPIKey={context.onChangeAPIKey}
    />
  )
}
