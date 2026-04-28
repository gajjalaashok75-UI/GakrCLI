import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  DEFAULT_CODEX_BASE_URL,
  DEFAULT_NVIDIA_BASE_URL,
  DEFAULT_NVIDIA_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  isCodexBaseUrl,
  resolveCodexApiCredentials,
  resolveProviderRequest,
} from '../services/api/providerConfig.ts'
import { parseChatgptAccountId } from '../services/api/codexOAuthShared.js'
import {
  getGoalDefaultOpenAIModel,
  normalizeRecommendationGoal,
  type RecommendationGoal,
} from './providerRecommendation.ts'
import { readGeminiAccessToken } from './geminiCredentials.ts'
import { getOllamaChatBaseUrl } from './providerDiscovery.ts'
import { getPrimaryModel } from './providerModels.ts'
import { getGakrcliConfigHomeDir, isEnvTruthy } from './envUtils.js'
import { getProviderValidationError } from './providerValidation.ts'
import { PROVIDERS } from './configConstants.js'
import {
  maskSecretForDisplay,
  redactSecretValueForDisplay,
  sanitizeApiKey,
  sanitizeProviderConfigValue,
} from './providerSecrets.ts'

export {
  maskSecretForDisplay,
  redactSecretValueForDisplay,
  sanitizeApiKey,
  sanitizeProviderConfigValue,
} from './providerSecrets.ts'

export const PROFILE_FILE_NAME = '.gakrcli-profile.json'
const LEGACY_PROFILE_FILE_NAME = '.opengakrcli-profile.json'
export const DEFAULT_GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai'
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'
export const DEFAULT_MISTRAL_BASE_URL = 'https://api.mistral.ai/v1'
export const DEFAULT_MISTRAL_MODEL = 'devstral-latest'

const PROFILE_ENV_KEYS = [
  'GAKR_CODE_USE_OPENAI',
  'GAKR_CODE_USE_GITHUB',
  'GAKR_CODE_USE_GEMINI',
  'GAKR_CODE_USE_MISTRAL',
  'GAKR_CODE_USE_NVIDIA',
  'GAKR_CODE_USE_BEDROCK',
  'GAKR_CODE_USE_VERTEX',
  'GAKR_CODE_USE_FOUNDRY',
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
  'OPENAI_API_FORMAT',
  'OPENAI_AUTH_HEADER',
  'OPENAI_AUTH_SCHEME',
  'OPENAI_AUTH_HEADER_VALUE',
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'CODEX_CREDENTIAL_SOURCE',
  'CHATGPT_ACCOUNT_ID',
  'CODEX_ACCOUNT_ID',
  'GEMINI_API_KEY',
  'GEMINI_AUTH_MODE',
  'GEMINI_ACCESS_TOKEN',
  'GEMINI_MODEL',
  'GEMINI_BASE_URL',
  'GOOGLE_API_KEY',
  'NVIDIA_NIM',
  'NVIDIA_API_KEY',
  'NVIDIA_MODEL',
  'NVIDIA_BASE_URL',
  'MINIMAX_API_KEY',
  'MINIMAX_BASE_URL',
  'MINIMAX_MODEL',
  'MISTRAL_BASE_URL',
  'MISTRAL_API_KEY',
  'MISTRAL_MODEL',
  'BANKR_BASE_URL',
  'BNKR_API_KEY',
  'BANKR_MODEL',
  'XAI_API_KEY',
] as const

const SECRET_ENV_KEYS = [
  'OPENAI_API_KEY',
  'OPENAI_AUTH_HEADER_VALUE',
  'CODEX_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'NVIDIA_API_KEY',
  'MINIMAX_API_KEY',
  'MISTRAL_API_KEY',
  'BNKR_API_KEY',
  'XAI_API_KEY',
] as const

export type ProviderProfile =
  | 'openai'
  | 'ollama'
  | 'codex'
  | 'gemini'
  | 'nvidia-nim'
  | 'atomic-chat'
  | 'minimax' 
  | 'mistral'
  | 'xai'

export type ProfileEnv = {
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
  OPENAI_API_FORMAT?: 'chat_completions' | 'responses'
  OPENAI_AUTH_HEADER?: string
  OPENAI_AUTH_SCHEME?: 'bearer' | 'raw'
  OPENAI_AUTH_HEADER_VALUE?: string
  OPENAI_API_KEY?: string
  CODEX_API_KEY?: string
  CODEX_CREDENTIAL_SOURCE?: 'oauth' | 'existing'
  CHATGPT_ACCOUNT_ID?: string
  CODEX_ACCOUNT_ID?: string
  GEMINI_API_KEY?: string
  GEMINI_AUTH_MODE?: 'api-key' | 'access-token' | 'adc'
  GEMINI_MODEL?: string
  GEMINI_BASE_URL?: string
  GOOGLE_API_KEY?: string
  NVIDIA_NIM?: string
  NVIDIA_API_KEY?: string
  NVIDIA_MODEL?: string
  NVIDIA_BASE_URL?: string
  MINIMAX_API_KEY?: string
  MINIMAX_BASE_URL?: string
  MINIMAX_MODEL?: string
  MISTRAL_BASE_URL?: string
  MISTRAL_API_KEY?: string
  MISTRAL_MODEL?: string
  BANKR_BASE_URL?: string
  BNKR_API_KEY?: string
  BANKR_MODEL?: string
  XAI_API_KEY?: string
}

export type ProfileFile = {
  profile: ProviderProfile
  env: ProfileEnv
  createdAt: string
}

type SecretValueSource = Partial<
  Record<
    | 'OPENAI_API_KEY'
    | 'OPENAI_AUTH_HEADER_VALUE'
    | 'CODEX_API_KEY'
    | 'GEMINI_API_KEY'
    | 'GOOGLE_API_KEY'
    | 'NVIDIA_API_KEY'
    | 'MINIMAX_API_KEY'
    | 'MISTRAL_API_KEY'
    | 'BNKR_API_KEY'
    | 'XAI_API_KEY',
    string | undefined
  >
>

type ProfileFileLocation = {
  cwd?: string
  filePath?: string
}

function normalizeProfileModel(
  value: string | undefined | null,
): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }

  const primary = getPrimaryModel(trimmed)
  return primary.length > 0 ? primary : undefined
}

function resolveProfileFilePath(options?: ProfileFileLocation): string {
  if (options?.filePath) {
    return options.filePath
  }

  // If cwd is explicitly provided (e.g., for testing), use it
  if (options?.cwd) {
    return resolve(options.cwd, PROFILE_FILE_NAME)
  }

  // Otherwise, store in ~/.gakrcli/ instead of CWD
  const configHome = getGakrcliConfigHomeDir()
  return join(configHome, PROFILE_FILE_NAME)
}

function resolveLegacyProfileFilePath(options?: ProfileFileLocation): string {
  if (options?.filePath) {
    return options.filePath
  }

  // If cwd is explicitly provided (e.g., for testing), use it
  if (options?.cwd) {
    return resolve(options.cwd, LEGACY_PROFILE_FILE_NAME)
  }

  // Otherwise, store in ~/.gakrcli/ instead of CWD
  const configHome = getGakrcliConfigHomeDir()
  return join(configHome, LEGACY_PROFILE_FILE_NAME)
}

export function isProviderProfile(value: unknown): value is ProviderProfile {
  return (
    value === 'openai' ||
    value === 'ollama' ||
    value === 'codex' ||
    value === 'gemini' ||
    value === 'nvidia-nim' ||
    value === 'atomic-chat' ||
    value === 'minimax' ||
    value === 'mistral' ||
    value === 'xai'
  )
}

export function buildOllamaProfileEnv(
  model: string,
  options: {
    baseUrl?: string | null
    getOllamaChatBaseUrl: (baseUrl?: string) => string
  },
): ProfileEnv {
  return {
    OPENAI_BASE_URL: options.getOllamaChatBaseUrl(options.baseUrl ?? undefined),
    OPENAI_MODEL: model,
  }
}

export function buildAtomicChatProfileEnv(
  model: string,
  options: {
    baseUrl?: string | null
    getAtomicChatChatBaseUrl: (baseUrl?: string) => string
  },
): ProfileEnv {
  return {
    OPENAI_BASE_URL: options.getAtomicChatChatBaseUrl(options.baseUrl ?? undefined),
    OPENAI_MODEL: model,
  }
}

export function buildGeminiProfileEnv(options: {
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  authMode?: 'api-key' | 'access-token' | 'adc'
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const authMode = options.authMode ?? 'api-key'
  const key = sanitizeApiKey(
    options.apiKey ??
      processEnv.GEMINI_API_KEY ??
      processEnv.GOOGLE_API_KEY,
  )
  if (authMode === 'api-key' && !key) {
    return null
  }

  const secretSource: SecretValueSource = key ? { GEMINI_API_KEY: key } : {}

  const env: ProfileEnv = {
    GEMINI_AUTH_MODE: authMode,
    GEMINI_MODEL:
      sanitizeProviderConfigValue(options.model, secretSource) ||
      sanitizeProviderConfigValue(processEnv.GEMINI_MODEL, secretSource) ||
      DEFAULT_GEMINI_MODEL,
  }

  if (authMode === 'api-key' && key) {
    env.GEMINI_API_KEY = key
  }

  const baseUrl =
    sanitizeProviderConfigValue(options.baseUrl, secretSource) ||
    sanitizeProviderConfigValue(processEnv.GEMINI_BASE_URL, secretSource)
  if (baseUrl) {
    env.GEMINI_BASE_URL = baseUrl
  }

  return env
}

export function buildNvidiaNimProfileEnv(options: {
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const key = sanitizeApiKey(options.apiKey ?? processEnv.NVIDIA_API_KEY)
  if (!key) {
    return null
  }

  const env: ProfileEnv = {
    NVIDIA_MODEL:
      sanitizeProviderConfigValue(
        options.model,
        { NVIDIA_API_KEY: key },
        processEnv,
      ) ||
      sanitizeProviderConfigValue(
        processEnv.NVIDIA_MODEL,
        { NVIDIA_API_KEY: key },
        processEnv,
      ) ||
      DEFAULT_NVIDIA_MODEL,
    NVIDIA_API_KEY: key,
  }

  const baseUrl =
    sanitizeProviderConfigValue(
      options.baseUrl,
      { NVIDIA_API_KEY: key },
      processEnv,
    ) ||
    sanitizeProviderConfigValue(
      processEnv.NVIDIA_BASE_URL,
      { NVIDIA_API_KEY: key },
      processEnv,
    )
  if (baseUrl) {
    env.NVIDIA_BASE_URL = baseUrl
  }

  return env
}

export function buildMiniMaxProfileEnv(options: {
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const key = sanitizeApiKey(options.apiKey ?? processEnv.MINIMAX_API_KEY)
  if (!key) {
    return null
  }

  const defaultBaseUrl = 'https://api.minimax.io/v1'
  const defaultModel = 'MiniMax-M2.5'
  const secretSource: SecretValueSource = { OPENAI_API_KEY: key }

  return {
    OPENAI_BASE_URL:
      sanitizeProviderConfigValue(options.baseUrl, secretSource) ||
      sanitizeProviderConfigValue(processEnv.OPENAI_BASE_URL, secretSource) ||
      defaultBaseUrl,
    OPENAI_MODEL:
      sanitizeProviderConfigValue(options.model, secretSource) ||
      sanitizeProviderConfigValue(processEnv.OPENAI_MODEL, secretSource) ||
      defaultModel,
    OPENAI_API_KEY: key,
    MINIMAX_API_KEY: key,
    MINIMAX_BASE_URL: defaultBaseUrl,
    MINIMAX_MODEL: defaultModel,
  }
}

export function buildOpenAIProfileEnv(options: {
  goal?: RecommendationGoal
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  apiFormat?: 'chat_completions' | 'responses' | null
  authHeader?: string | null
  authScheme?: 'bearer' | 'raw' | null
  authHeaderValue?: string | null
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const key = sanitizeApiKey(options.apiKey ?? processEnv.OPENAI_API_KEY)
  const authHeaderValue = sanitizeApiKey(
    options.authHeaderValue ?? processEnv.OPENAI_AUTH_HEADER_VALUE,
  )
  if (!key && !authHeaderValue) {
    return null
  }

  const goal = options.goal ?? 'balanced'
  const defaultModel = getGoalDefaultOpenAIModel(goal)
  const secretSource: SecretValueSource = {
    OPENAI_API_KEY: key,
    OPENAI_AUTH_HEADER_VALUE: authHeaderValue,
  }
  const shellOpenAIModel = sanitizeProviderConfigValue(
    processEnv.OPENAI_MODEL,
    secretSource,
    processEnv,
  )
  const shellOpenAIBaseUrl = sanitizeProviderConfigValue(
    processEnv.OPENAI_BASE_URL,
    secretSource,
    processEnv,
  )
  const shellOpenAIRequest = resolveProviderRequest({
    model: shellOpenAIModel,
    baseUrl: shellOpenAIBaseUrl,
    fallbackModel: defaultModel,
    apiFormat: processEnv.OPENAI_API_FORMAT,
  })
  const useShellOpenAIConfig = shellOpenAIRequest.transport !== 'codex_responses'

  return {
    OPENAI_BASE_URL:
      sanitizeProviderConfigValue(
        options.baseUrl,
        secretSource,
        processEnv,
      ) ||
      (useShellOpenAIConfig ? shellOpenAIBaseUrl : undefined) ||
      DEFAULT_OPENAI_BASE_URL,
    OPENAI_MODEL:
      normalizeProfileModel(
        sanitizeProviderConfigValue(
          options.model,
          secretSource,
          processEnv,
        ),
      ) ||
      normalizeProfileModel(
        useShellOpenAIConfig ? shellOpenAIModel : undefined,
      ) ||
      defaultModel,
    ...(options.apiFormat ? { OPENAI_API_FORMAT: options.apiFormat } : {}),
    ...(options.authHeader ? { OPENAI_AUTH_HEADER: options.authHeader } : {}),
    ...(options.authScheme ? { OPENAI_AUTH_SCHEME: options.authScheme } : {}),
    ...(authHeaderValue ? { OPENAI_AUTH_HEADER_VALUE: authHeaderValue } : {}),
    ...(key ? { OPENAI_API_KEY: key } : {}),
  }
}

export function buildCodexProfileEnv(options: {
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  credentialSource?: 'oauth' | 'existing'
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const key = sanitizeApiKey(options.apiKey ?? processEnv.CODEX_API_KEY)
  const credentialEnv = key
    ? ({ ...processEnv, CODEX_API_KEY: key } as NodeJS.ProcessEnv)
    : processEnv
  const credentials = resolveCodexApiCredentials(credentialEnv)
  if (!credentials.apiKey || !credentials.accountId) {
    return null
  }
  const credentialSource =
    options.credentialSource ??
    (credentials.source === 'secure-storage' ? 'oauth' : 'existing')

  const env: ProfileEnv = {
    OPENAI_BASE_URL: options.baseUrl || DEFAULT_CODEX_BASE_URL,
    OPENAI_MODEL: options.model || 'codexplan',
    CODEX_CREDENTIAL_SOURCE: credentialSource,
  }

  if (key) {
    env.CODEX_API_KEY = key
  }

  env.CHATGPT_ACCOUNT_ID = credentials.accountId

  return env
}

export function buildMistralProfileEnv(options: {
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const key = sanitizeApiKey(options.apiKey ?? processEnv.MISTRAL_API_KEY)
  if (!key) {
    return null
  }

  const env: ProfileEnv = {
    MISTRAL_API_KEY: key,
    MISTRAL_MODEL:
      sanitizeProviderConfigValue(options.model, { MISTRAL_API_KEY: key }) ||
      sanitizeProviderConfigValue(
        processEnv.MISTRAL_MODEL,
        { MISTRAL_API_KEY: key },
      ) ||
      DEFAULT_MISTRAL_MODEL,
  }

  const baseUrl =
    sanitizeProviderConfigValue(options.baseUrl, { MISTRAL_API_KEY: key }) ||
    sanitizeProviderConfigValue(
      processEnv.MISTRAL_BASE_URL,
      { MISTRAL_API_KEY: key },
    )
  if (baseUrl) {
    env.MISTRAL_BASE_URL = baseUrl
  }

  return env
}

export function buildBankrProfileEnv(options: {
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const key = sanitizeApiKey(options.apiKey ?? processEnv.BNKR_API_KEY)
  if (!key) {
    return null
  }

  const env: ProfileEnv = {
    BNKR_API_KEY: key,
    BANKR_MODEL:
      sanitizeProviderConfigValue(options.model, { BNKR_API_KEY: key }) ||
      sanitizeProviderConfigValue(
        processEnv.BANKR_MODEL,
        { BNKR_API_KEY: key },
      ) ||
      'claude-opus-4.6',
  }

  const baseUrl =
    sanitizeProviderConfigValue(options.baseUrl, { BNKR_API_KEY: key }) ||
    sanitizeProviderConfigValue(
      processEnv.BANKR_BASE_URL,
      { BNKR_API_KEY: key },
    )
  if (baseUrl) {
    env.BANKR_BASE_URL = baseUrl
  }

  return env
}

export function buildCodexOAuthProfileEnv(
  tokens: {
    accessToken: string
    idToken?: string
    accountId?: string
  },
): ProfileEnv | null {
  const accountId =
    tokens.accountId ??
    parseChatgptAccountId(tokens.idToken) ??
    parseChatgptAccountId(tokens.accessToken)

  if (!accountId) {
    return null
  }

  return {
    OPENAI_BASE_URL: DEFAULT_CODEX_BASE_URL,
    OPENAI_MODEL: 'codexplan',
    CHATGPT_ACCOUNT_ID: accountId,
    CODEX_CREDENTIAL_SOURCE: 'oauth',
  }
}

export function createProfileFile(
  profile: ProviderProfile,
  env: ProfileEnv,
): ProfileFile {
  return {
    profile,
    env,
    createdAt: new Date().toISOString(),
  }
}

export function isPersistedCodexOAuthProfile(
  persisted: ProfileFile | null,
): boolean {
  return (
    persisted?.profile === 'codex' &&
    persisted.env.CODEX_CREDENTIAL_SOURCE === 'oauth'
  )
}

export function clearPersistedCodexOAuthProfile(
  options?: ProfileFileLocation,
): string | null {
  const persisted = loadProfileFile(options)
  if (!isPersistedCodexOAuthProfile(persisted)) {
    return null
  }

  return deleteProfileFile(options)
}

function readProfileFile(filePath: string): ProfileFile | null {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ProfileFile>
    if (!isProviderProfile(parsed.profile) || !parsed.env || typeof parsed.env !== 'object') {
      return null
    }

    return {
      profile: parsed.profile,
      env: parsed.env,
      createdAt:
        typeof parsed.createdAt === 'string'
          ? parsed.createdAt
          : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function loadProfileFile(options?: ProfileFileLocation): ProfileFile | null {
  const filePath = resolveProfileFilePath(options)
  const primary = readProfileFile(filePath)
  if (primary) {
    return primary
  }

  if (options?.filePath) {
    return null
  }

  return readProfileFile(resolveLegacyProfileFilePath(options))
}

export function saveProfileFile(
  profileFile: ProfileFile,
  options?: ProfileFileLocation,
): string {
  const filePath = resolveProfileFilePath(options)
  writeFileSync(filePath, JSON.stringify(profileFile, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  })
  return filePath
}

export function deleteProfileFile(options?: ProfileFileLocation): string {
  const filePath = resolveProfileFilePath(options)
  rmSync(filePath, { force: true })
  if (!options?.filePath) {
    rmSync(resolveLegacyProfileFilePath(options), { force: true })
  }
  return filePath
}

export function hasExplicitProviderSelection(
  processEnv: NodeJS.ProcessEnv = process.env,
): boolean {
  // If env was already applied from a provider profile, preserve it.
  if (processEnv.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED === '1') {
    return true
  }
  return (
    processEnv.GAKR_CODE_USE_OPENAI !== undefined ||
    processEnv.GAKR_CODE_USE_GITHUB !== undefined ||
    processEnv.GAKR_CODE_USE_GEMINI !== undefined ||
    processEnv.GAKR_CODE_USE_NVIDIA !== undefined ||
    processEnv.GAKR_CODE_USE_BEDROCK !== undefined ||
    processEnv.GAKR_CODE_USE_VERTEX !== undefined ||
    processEnv.GAKR_CODE_USE_FOUNDRY !== undefined ||
    processEnv.GAKR_CODE_USE_MISTRAL !== undefined
  )
}

export function selectAutoProfile(
  recommendedOllamaModel: string | null,
): ProviderProfile {
  return recommendedOllamaModel ? 'ollama' : 'openai'
}

export async function buildLaunchEnv(options: {
  profile: ProviderProfile
  persisted: ProfileFile | null
  goal: RecommendationGoal
  processEnv?: NodeJS.ProcessEnv
  getOllamaChatBaseUrl?: (baseUrl?: string) => string
  resolveOllamaDefaultModel?: (goal: RecommendationGoal) => Promise<string>
  getAtomicChatChatBaseUrl?: (baseUrl?: string) => string
  resolveAtomicChatDefaultModel?: () => Promise<string | null>
  readGeminiAccessToken?: () => string | undefined
}): Promise<NodeJS.ProcessEnv> {
  const processEnv = options.processEnv ?? process.env
  const persistedEnv =
    options.persisted?.profile === options.profile
      ? options.persisted.env ?? {}
      : {}
  const persistedOpenAIModel = sanitizeProviderConfigValue(
    persistedEnv.OPENAI_MODEL,
    persistedEnv,
  )
  const persistedOpenAIBaseUrl = sanitizeProviderConfigValue(
    persistedEnv.OPENAI_BASE_URL,
    persistedEnv,
  )
  const persistedOpenAIApiFormat = persistedEnv.OPENAI_API_FORMAT
  const persistedOpenAIAuthHeader = persistedEnv.OPENAI_AUTH_HEADER
  const persistedOpenAIAuthScheme = persistedEnv.OPENAI_AUTH_SCHEME
  const persistedOpenAIAuthHeaderValue = sanitizeApiKey(
    persistedEnv.OPENAI_AUTH_HEADER_VALUE,
  )
  const shellOpenAIModel = sanitizeProviderConfigValue(
    processEnv.OPENAI_MODEL,
    processEnv as SecretValueSource,
  )
  const shellOpenAIBaseUrl = sanitizeProviderConfigValue(
    processEnv.OPENAI_BASE_URL,
    processEnv as SecretValueSource,
  )
  const persistedGeminiModel = sanitizeProviderConfigValue(
    persistedEnv.GEMINI_MODEL,
    persistedEnv,
  )
  const persistedGeminiBaseUrl = sanitizeProviderConfigValue(
    persistedEnv.GEMINI_BASE_URL,
    persistedEnv,
  )
  const persistedNvidiaModel = sanitizeProviderConfigValue(
    persistedEnv.NVIDIA_MODEL,
    persistedEnv,
  )
  const persistedNvidiaBaseUrl = sanitizeProviderConfigValue(
    persistedEnv.NVIDIA_BASE_URL,
    persistedEnv,
  )
  const shellGeminiModel = sanitizeProviderConfigValue(
    processEnv.GEMINI_MODEL,
    processEnv as SecretValueSource,
  )
  const shellGeminiBaseUrl = sanitizeProviderConfigValue(
    processEnv.GEMINI_BASE_URL,
    processEnv as SecretValueSource,
  )
  const shellGeminiAccessToken =
    processEnv.GEMINI_ACCESS_TOKEN?.trim() || undefined
  const storedGeminiAccessToken =
    options.readGeminiAccessToken?.() ?? readGeminiAccessToken()

  const shellGeminiKey = sanitizeApiKey(
    processEnv.GEMINI_API_KEY ?? processEnv.GOOGLE_API_KEY,
  )
  const persistedGeminiKey = sanitizeApiKey(persistedEnv.GEMINI_API_KEY)
  const persistedGeminiAuthMode = persistedEnv.GEMINI_AUTH_MODE
  
  // Let env vars override the profile, but only if the profile is one that
  // can be set by env vars (i.e., it's in the PROVIDERS array).
  // Profiles not in PROVIDERS (like nvidia-nim, ollama, atomic-chat) are
  // explicitly set and should not be overridden by env vars.
  const canBeOverriddenByEnv = PROVIDERS.includes(options.profile as any)
  if (hasExplicitProviderSelection(processEnv) && canBeOverriddenByEnv) {
    for (let provider of PROVIDERS) {
      if (provider === "anthropic") {
        continue;
      }

      const env_key_name = `GAKR_CODE_USE_${provider.toUpperCase()}`

      if (env_key_name in processEnv && isEnvTruthy(processEnv[env_key_name])) {
        options.profile = provider;
      }
    }
  }
  
  const shellNvidiaModel = sanitizeProviderConfigValue(
    processEnv.NVIDIA_MODEL,
    processEnv,
  )
  const shellNvidiaBaseUrl = sanitizeProviderConfigValue(
    processEnv.NVIDIA_BASE_URL,
    processEnv,
  )
  const shellNvidiaKey = sanitizeApiKey(processEnv.NVIDIA_API_KEY)
  const persistedNvidiaKey = sanitizeApiKey(persistedEnv.NVIDIA_API_KEY)

  if (options.profile === 'gemini') {
    const env: NodeJS.ProcessEnv = {
      ...processEnv,
      GAKR_CODE_USE_GEMINI: '1',
    }

    delete env.GAKR_CODE_USE_OPENAI
    delete env.GAKR_CODE_USE_GITHUB
    delete env.GAKR_CODE_USE_NVIDIA
    delete env.CODEX_CREDENTIAL_SOURCE

    env.GEMINI_MODEL =
      shellGeminiModel ||
      persistedGeminiModel ||
      DEFAULT_GEMINI_MODEL
    env.GEMINI_BASE_URL =
      shellGeminiBaseUrl ||
      persistedGeminiBaseUrl ||
      DEFAULT_GEMINI_BASE_URL

    const geminiAuthMode =
      persistedGeminiAuthMode === 'access-token' ||
      persistedGeminiAuthMode === 'adc'
        ? persistedGeminiAuthMode
        : 'api-key'
    const geminiKey = shellGeminiKey || persistedGeminiKey
    if (geminiKey) {
      env.GEMINI_API_KEY = geminiKey
    } else {
      delete env.GEMINI_API_KEY
    }
    env.GEMINI_AUTH_MODE = geminiAuthMode
    if (geminiAuthMode === 'access-token') {
      const geminiAccessToken =
        shellGeminiAccessToken || storedGeminiAccessToken
      if (geminiAccessToken) {
        env.GEMINI_ACCESS_TOKEN = geminiAccessToken
      } else {
        delete env.GEMINI_ACCESS_TOKEN
      }
    } else {
      delete env.GEMINI_ACCESS_TOKEN
    }
    delete env.GOOGLE_API_KEY
    delete env.OPENAI_BASE_URL
    delete env.OPENAI_MODEL
    delete env.OPENAI_API_KEY
    delete env.CODEX_API_KEY
    delete env.CHATGPT_ACCOUNT_ID
    delete env.CODEX_ACCOUNT_ID
    delete env.NVIDIA_API_KEY
    delete env.NVIDIA_MODEL
    delete env.NVIDIA_BASE_URL

    return env
  }

  if (options.profile === 'mistral') {
    const env: NodeJS.ProcessEnv = {
      ...processEnv,
      GAKR_CODE_USE_MISTRAL: '1',
    }

    delete env.GAKR_CODE_USE_OPENAI
    delete env.GAKR_CODE_USE_GITHUB
    delete env.GAKR_CODE_USE_GEMINI
    delete env.GAKR_CODE_USE_BEDROCK
    delete env.GAKR_CODE_USE_VERTEX
    delete env.GAKR_CODE_USE_FOUNDRY

    const shellMistralModel = sanitizeProviderConfigValue(
      processEnv.MISTRAL_MODEL,
    )
    const persistedMistralModel = sanitizeProviderConfigValue(
      persistedEnv.MISTRAL_MODEL,
    )
    const shellMistralBaseUrl = sanitizeProviderConfigValue(
      processEnv.MISTRAL_BASE_URL,
    )
    const persistedMistralBaseUrl = sanitizeProviderConfigValue(
      persistedEnv.MISTRAL_BASE_URL,
    )

    env.MISTRAL_MODEL =
      shellMistralModel || persistedMistralModel || DEFAULT_MISTRAL_MODEL

    const shellMistralKey = sanitizeApiKey(
      processEnv.MISTRAL_API_KEY,
    )
    const persistedMistralKey = sanitizeApiKey(persistedEnv.MISTRAL_API_KEY)
    const mistralKey = shellMistralKey || persistedMistralKey

    if (mistralKey) {
      env.MISTRAL_API_KEY = mistralKey
    } else {
      delete env.MISTRAL_API_KEY
    }

    if (shellMistralBaseUrl || persistedMistralBaseUrl) {
      env.MISTRAL_BASE_URL = shellMistralBaseUrl || persistedMistralBaseUrl
    } else {
      delete env.MISTRAL_BASE_URL
    }

    delete env.GEMINI_API_KEY
    delete env.GEMINI_AUTH_MODE
    delete env.GEMINI_ACCESS_TOKEN
    delete env.GEMINI_MODEL
    delete env.GEMINI_BASE_URL
    delete env.GOOGLE_API_KEY
    delete env.OPENAI_BASE_URL
    delete env.OPENAI_MODEL
    delete env.OPENAI_API_KEY
    delete env.CODEX_API_KEY
    delete env.CHATGPT_ACCOUNT_ID
    delete env.CODEX_ACCOUNT_ID

    return env
  }

  if (options.profile === 'nvidia-nim') {
    const env: NodeJS.ProcessEnv = {
      ...processEnv,
      GAKR_CODE_USE_NVIDIA: '1',
    }

    delete env.GAKR_CODE_USE_OPENAI
    delete env.GAKR_CODE_USE_GITHUB
    delete env.GAKR_CODE_USE_GEMINI

    env.NVIDIA_MODEL =
      shellNvidiaModel ||
      persistedNvidiaModel ||
      DEFAULT_NVIDIA_MODEL
    env.NVIDIA_BASE_URL =
      shellNvidiaBaseUrl ||
      persistedNvidiaBaseUrl ||
      DEFAULT_NVIDIA_BASE_URL

    const nvidiaKey = shellNvidiaKey || persistedNvidiaKey
    if (nvidiaKey) {
      env.NVIDIA_API_KEY = nvidiaKey
    } else {
      delete env.NVIDIA_API_KEY
    }

    delete env.GEMINI_API_KEY
    delete env.GEMINI_MODEL
    delete env.GEMINI_BASE_URL
    delete env.GOOGLE_API_KEY
    delete env.OPENAI_BASE_URL
    delete env.OPENAI_MODEL
    delete env.OPENAI_API_KEY
    delete env.CODEX_API_KEY
    delete env.CHATGPT_ACCOUNT_ID
    delete env.CODEX_ACCOUNT_ID

    return env
  }

  const env: NodeJS.ProcessEnv = {
    ...processEnv,
    GAKR_CODE_USE_OPENAI: '1',
  }

  delete env.GAKR_CODE_USE_MISTRAL
  delete env.GAKR_CODE_USE_BEDROCK
  delete env.GAKR_CODE_USE_VERTEX
  delete env.GAKR_CODE_USE_FOUNDRY
  delete env.GAKR_CODE_USE_GEMINI
  delete env.GAKR_CODE_USE_GITHUB
  delete env.CODEX_CREDENTIAL_SOURCE
  delete env.GAKR_CODE_USE_NVIDIA
  delete env.GEMINI_API_KEY
  delete env.GEMINI_AUTH_MODE
  delete env.GEMINI_ACCESS_TOKEN
  delete env.GEMINI_MODEL
  delete env.GEMINI_BASE_URL
  delete env.GOOGLE_API_KEY
  delete env.NVIDIA_API_KEY
  delete env.NVIDIA_MODEL
  delete env.NVIDIA_BASE_URL

  if (options.profile === 'ollama') {
    const getOllamaBaseUrl =
      options.getOllamaChatBaseUrl ?? (() => 'http://localhost:11434/v1')
    const resolveOllamaModel =
      options.resolveOllamaDefaultModel ?? (async () => 'llama3.1:8b')

    env.OPENAI_BASE_URL = persistedOpenAIBaseUrl || getOllamaBaseUrl()
    env.OPENAI_MODEL =
      persistedOpenAIModel ||
      (await resolveOllamaModel(options.goal))

    delete env.OPENAI_API_KEY
    delete env.CODEX_API_KEY
    delete env.CHATGPT_ACCOUNT_ID
    delete env.CODEX_ACCOUNT_ID

    return env
  }

  if (options.profile === 'atomic-chat') {
    const getAtomicChatBaseUrl =
      options.getAtomicChatChatBaseUrl ?? (() => 'http://127.0.0.1:1337/v1')
    const resolveModel =
      options.resolveAtomicChatDefaultModel ?? (async () => null as string | null)

    env.OPENAI_BASE_URL = persistedEnv.OPENAI_BASE_URL || getAtomicChatBaseUrl()
    env.OPENAI_MODEL =
      persistedEnv.OPENAI_MODEL ||
      (await resolveModel()) ||
      ''

    delete env.OPENAI_API_KEY
    delete env.CODEX_API_KEY
    delete env.CHATGPT_ACCOUNT_ID
    delete env.CODEX_ACCOUNT_ID

    return env
  }

  if (options.profile === 'codex') {
    env.OPENAI_BASE_URL =
      persistedOpenAIBaseUrl && isCodexBaseUrl(persistedOpenAIBaseUrl)
        ? persistedOpenAIBaseUrl
        : DEFAULT_CODEX_BASE_URL
    env.OPENAI_MODEL = persistedOpenAIModel || 'codexplan'
    delete env.OPENAI_API_KEY

    const codexKey =
      sanitizeApiKey(processEnv.CODEX_API_KEY) ||
      sanitizeApiKey(persistedEnv.CODEX_API_KEY)
    const liveCodexCredentials = resolveCodexApiCredentials(processEnv)
    const codexAccountId =
      processEnv.CHATGPT_ACCOUNT_ID ||
      processEnv.CODEX_ACCOUNT_ID ||
      liveCodexCredentials.accountId ||
      persistedEnv.CHATGPT_ACCOUNT_ID ||
      persistedEnv.CODEX_ACCOUNT_ID
    if (codexKey) {
      env.CODEX_API_KEY = codexKey
    } else {
      delete env.CODEX_API_KEY
    }

    if (codexAccountId) {
      env.CHATGPT_ACCOUNT_ID = codexAccountId
    } else {
      delete env.CHATGPT_ACCOUNT_ID
    }
    delete env.CODEX_ACCOUNT_ID

    return env
  }

  const defaultOpenAIModel = getGoalDefaultOpenAIModel(options.goal)
  const shellOpenAIRequest = resolveProviderRequest({
    model: shellOpenAIModel,
    baseUrl: shellOpenAIBaseUrl,
    fallbackModel: defaultOpenAIModel,
  })
  const persistedOpenAIRequest = resolveProviderRequest({
    model: persistedOpenAIModel,
    baseUrl: persistedOpenAIBaseUrl,
    fallbackModel: defaultOpenAIModel,
  })
  const useShellOpenAIConfig = shellOpenAIRequest.transport === 'chat_completions'
  const usePersistedOpenAIConfig =
    (!persistedOpenAIModel && !persistedOpenAIBaseUrl) ||
    persistedOpenAIRequest.transport === 'chat_completions'

  env.OPENAI_BASE_URL =
    (useShellOpenAIConfig ? shellOpenAIBaseUrl : undefined) ||
    (usePersistedOpenAIConfig ? persistedOpenAIBaseUrl : undefined) ||
    DEFAULT_OPENAI_BASE_URL
  env.OPENAI_MODEL =
    (useShellOpenAIConfig ? shellOpenAIModel : undefined) ||
    (usePersistedOpenAIConfig ? persistedOpenAIModel : undefined) ||
    defaultOpenAIModel
  const openAIApiFormat =
    processEnv.OPENAI_API_FORMAT ||
    (usePersistedOpenAIConfig ? persistedOpenAIApiFormat : undefined)
  if (openAIApiFormat) {
    env.OPENAI_API_FORMAT = openAIApiFormat
  } else {
    delete env.OPENAI_API_FORMAT
  }
  const openAIAuthHeader =
    processEnv.OPENAI_AUTH_HEADER ||
    (usePersistedOpenAIConfig ? persistedOpenAIAuthHeader : undefined)
  if (openAIAuthHeader) {
    env.OPENAI_AUTH_HEADER = openAIAuthHeader
  } else {
    delete env.OPENAI_AUTH_HEADER
  }
  const openAIAuthScheme =
    processEnv.OPENAI_AUTH_SCHEME ||
    (usePersistedOpenAIConfig ? persistedOpenAIAuthScheme : undefined)
  if (openAIAuthScheme) {
    env.OPENAI_AUTH_SCHEME = openAIAuthScheme
  } else {
    delete env.OPENAI_AUTH_SCHEME
  }
  const openAIAuthHeaderValue =
    sanitizeApiKey(processEnv.OPENAI_AUTH_HEADER_VALUE) ||
    (usePersistedOpenAIConfig ? persistedOpenAIAuthHeaderValue : undefined)
  if (openAIAuthHeaderValue) {
    env.OPENAI_AUTH_HEADER_VALUE = openAIAuthHeaderValue
  } else {
    delete env.OPENAI_AUTH_HEADER_VALUE
  }
  const openAIKey = processEnv.OPENAI_API_KEY || persistedEnv.OPENAI_API_KEY
  if (openAIKey) {
    env.OPENAI_API_KEY = openAIKey
  } else {
    delete env.OPENAI_API_KEY
  }
  delete env.CODEX_API_KEY
  delete env.CHATGPT_ACCOUNT_ID
  delete env.CODEX_ACCOUNT_ID
  return env
}

export async function buildStartupEnvFromProfile(options?: {
  persisted?: ProfileFile | null
  goal?: RecommendationGoal
  processEnv?: NodeJS.ProcessEnv
  getOllamaChatBaseUrl?: (baseUrl?: string) => string
  resolveOllamaDefaultModel?: (goal: RecommendationGoal) => Promise<string>
  readGeminiAccessToken?: () => string | undefined
}): Promise<NodeJS.ProcessEnv> {
  const processEnv = options?.processEnv ?? process.env
  const persisted = options?.persisted ?? loadProfileFile()

  const profileManagedEnv = processEnv.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED === '1'

  // The legacy single-profile file (~/.gakrcli-profile.json) is a
  // first-run / fallback mechanism. The newer plural provider-profile
  // system (`/provider` presets + activeProviderProfileId in config) is
  // applied earlier in the bootstrap via applyActiveProviderProfileFromConfig
  // and signals completion with GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED=1.
  //
  // If the plural system has already set env, trust it — do NOT overlay the
  // legacy file. addProviderProfile() does not sync the legacy file, so a
  // stale legacy file (e.g. OpenAI defaults from an earlier manual setup)
  // would otherwise overwrite the correct plural env and surface as the
  // "banner shows gpt-4o / api.openai.com even though my saved profile is
  // Moonshot" bug.
  if (profileManagedEnv) {
    return processEnv
  }

  if (isEnvTruthy(processEnv.GAKR_CODE_USE_GITHUB)) {
    return processEnv
  }

  if (!persisted) {
    return processEnv
  }

  return buildLaunchEnv({
    profile: persisted.profile,
    persisted,
    goal:
      options?.goal ??
      normalizeRecommendationGoal(
        processEnv.GAKR_PROFILE_GOAL ??
          processEnv.OPENGAKR_PROFILE_GOAL,
      ),
    processEnv,
    getOllamaChatBaseUrl:
      options?.getOllamaChatBaseUrl ?? getOllamaChatBaseUrl,
    resolveOllamaDefaultModel: options?.resolveOllamaDefaultModel,
    readGeminiAccessToken: options?.readGeminiAccessToken,
  })
}

export function applyProfileEnvToProcessEnv(
  targetEnv: NodeJS.ProcessEnv,
  nextEnv: NodeJS.ProcessEnv,
): void {
  for (const key of PROFILE_ENV_KEYS) {
    delete targetEnv[key]
  }

  Object.assign(targetEnv, nextEnv)
}
export async function applySavedProfileToCurrentSession(options: {
  profileFile: ProfileFile
  processEnv?: NodeJS.ProcessEnv
}): Promise<string | null> {
  const processEnv = options.processEnv ?? process.env
  const baseEnv = { ...processEnv }
  const isCodexOAuthProfile =
    options.profileFile.profile === 'codex' &&
    options.profileFile.env.CODEX_CREDENTIAL_SOURCE === 'oauth'

  delete baseEnv.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED
  delete baseEnv.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID
  if (isCodexOAuthProfile) {
    delete baseEnv.CODEX_API_KEY
    delete baseEnv.CODEX_ACCOUNT_ID
    delete baseEnv.CHATGPT_ACCOUNT_ID
  }

  const nextEnv = await buildLaunchEnv({
    profile: options.profileFile.profile,
    persisted: options.profileFile,
    goal: normalizeRecommendationGoal(processEnv.OPENGAKR_PROFILE_GOAL),
    processEnv: baseEnv,
    getOllamaChatBaseUrl,
    readGeminiAccessToken,
  })
  const validationError = await getProviderValidationError(nextEnv)
  if (validationError) {
    return validationError
  }

  delete processEnv.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED
  delete processEnv.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID
  applyProfileEnvToProcessEnv(processEnv, nextEnv)
  return null
}
