export const GITHUB_PROVIDER_DEFAULT_MODEL = 'github:copilot'

export const GITHUB_PROVIDER_CLEANUP_ENV_KEYS = [
  'OPENAI_API_KEY',
  'OPENAI_ORG',
  'OPENAI_PROJECT',
  'OPENAI_ORGANIZATION',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
  'OPENAI_API_FORMAT',
  'OPENAI_AUTH_HEADER',
  'OPENAI_AUTH_SCHEME',
  'OPENAI_AUTH_HEADER_VALUE',
  'GAKR_CODE_USE_OPENAI',
  'GAKR_CODE_USE_GEMINI',
  'GAKR_CODE_USE_MISTRAL',
  'GAKR_CODE_USE_NVIDIA',
  'GAKR_CODE_USE_BEDROCK',
  'GAKR_CODE_USE_VERTEX',
  'GAKR_CODE_USE_FOUNDRY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_BASE_URL',
  'GEMINI_MODEL',
  'GEMINI_ACCESS_TOKEN',
  'GEMINI_AUTH_MODE',
  'MISTRAL_BASE_URL',
  'MISTRAL_MODEL',
  'MISTRAL_API_KEY',
  'NVIDIA_NIM',
  'NVIDIA_API_KEY',
  'NVIDIA_MODEL',
  'NVIDIA_BASE_URL',
  'MINIMAX_API_KEY',
  'MINIMAX_BASE_URL',
  'MINIMAX_MODEL',
  'BANKR_BASE_URL',
  'BNKR_API_KEY',
  'BANKR_MODEL',
  'XAI_API_KEY',
  'VENICE_API_KEY',
  'MIMO_API_KEY',
] as const

export type GithubProviderCleanupEnvKey =
  (typeof GITHUB_PROVIDER_CLEANUP_ENV_KEYS)[number]

export function normalizeGithubProviderModel(model?: string): string {
  return model?.trim() || GITHUB_PROVIDER_DEFAULT_MODEL
}

export function buildGithubProviderSettingsEnv(
  model: string = GITHUB_PROVIDER_DEFAULT_MODEL,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    GAKR_CODE_USE_GITHUB: '1',
    OPENAI_MODEL: normalizeGithubProviderModel(model),
  }

  for (const key of GITHUB_PROVIDER_CLEANUP_ENV_KEYS) {
    env[key] = undefined
  }

  return env
}

export function applyGithubProviderProcessEnv(
  model: string = GITHUB_PROVIDER_DEFAULT_MODEL,
  env: NodeJS.ProcessEnv = process.env,
): void {
  env.GAKR_CODE_USE_GITHUB = '1'
  env.OPENAI_MODEL = normalizeGithubProviderModel(model)

  for (const key of GITHUB_PROVIDER_CLEANUP_ENV_KEYS) {
    delete env[key]
  }

  delete env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED
  delete env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID
}
