import { getMainLoopModel } from './model/model.js'
import { getAPIProvider } from './model/providers.js'

function getModelFamily(model: string): 'haiku' | 'sonnet' | 'opus' | null {
  if (/haiku/i.test(model)) return 'haiku'
  if (/opus/i.test(model)) return 'opus'
  if (/sonnet/i.test(model)) return 'sonnet'
  return null
}

function resolveOpenAIModel(anthropicModel: string): string {
  if (process.env.OPENAI_MODEL) {
    return process.env.OPENAI_MODEL
  }

  const cleanModel = anthropicModel.replace(/\[1m\]$/, '')
  const family = getModelFamily(cleanModel)
  if (family) {
    const openaiEnvVar = `OPENAI_DEFAULT_${family.toUpperCase()}_MODEL`
    const openaiOverride = process.env[openaiEnvVar]
    if (openaiOverride) return openaiOverride

    const anthropicEnvVar = `ANTHROPIC_DEFAULT_${family.toUpperCase()}_MODEL`
    const anthropicOverride = process.env[anthropicEnvVar]
    if (anthropicOverride) return anthropicOverride
  }

  const defaultMap: Record<string, string> = {
    'claude-sonnet-4-20250514': 'gpt-4o',
    'claude-sonnet-4-5-20250929': 'gpt-4o',
    'claude-sonnet-4-6': 'gpt-4o',
    'claude-opus-4-20250514': 'o3',
    'claude-opus-4-1-20250805': 'o3',
    'claude-opus-4-5-20251101': 'o3',
    'claude-opus-4-6': 'o3',
    'claude-haiku-4-5-20251001': 'gpt-4o-mini',
    'claude-3-5-haiku-20241022': 'gpt-4o-mini',
    'claude-3-7-sonnet-20250219': 'gpt-4o',
    'claude-3-5-sonnet-20241022': 'gpt-4o',
  }
  return defaultMap[cleanModel] ?? cleanModel
}

function resolveGrokModel(anthropicModel: string): string {
  if (process.env.GROK_MODEL) {
    return process.env.GROK_MODEL
  }

  const cleanModel = anthropicModel.replace(/\[1m\]$/, '')
  const family = getModelFamily(cleanModel)

  if (family) {
    const grokEnvVar = `GROK_DEFAULT_${family.toUpperCase()}_MODEL`
    const grokOverride = process.env[grokEnvVar]
    if (grokOverride) return grokOverride

    const anthropicEnvVar = `ANTHROPIC_DEFAULT_${family.toUpperCase()}_MODEL`
    const anthropicOverride = process.env[anthropicEnvVar]
    if (anthropicOverride) return anthropicOverride
  }

  const defaultMap: Record<string, string> = {
    'claude-sonnet-4-20250514': 'grok-3-mini-fast',
    'claude-sonnet-4-5-20250929': 'grok-3-mini-fast',
    'claude-sonnet-4-6': 'grok-3-mini-fast',
    'claude-opus-4-20250514': 'grok-4.20-reasoning',
    'claude-opus-4-1-20250805': 'grok-4.20-reasoning',
    'claude-opus-4-5-20251101': 'grok-4.20-reasoning',
    'claude-opus-4-6': 'grok-4.20-reasoning',
    'claude-haiku-4-5-20251001': 'grok-3-mini-fast',
    'claude-3-5-haiku-20241022': 'grok-3-mini-fast',
    'claude-3-7-sonnet-20250219': 'grok-3-mini-fast',
    'claude-3-5-sonnet-20241022': 'grok-3-mini-fast',
  }
  return defaultMap[cleanModel] ?? cleanModel
}

function resolveGeminiModel(anthropicModel: string): string {
  if (process.env.GEMINI_MODEL) {
    return process.env.GEMINI_MODEL
  }

  const cleanModel = anthropicModel.replace(/\[1m\]$/i, '')
  const family = getModelFamily(cleanModel)

  if (!family) {
    return cleanModel
  }

  const geminiEnvVar = `GEMINI_DEFAULT_${family.toUpperCase()}_MODEL`
  const geminiModel = process.env[geminiEnvVar]
  if (geminiModel) {
    return geminiModel
  }

  const sharedEnvVar = `ANTHROPIC_DEFAULT_${family.toUpperCase()}_MODEL`
  const resolvedModel = process.env[sharedEnvVar]
  if (resolvedModel) {
    return resolvedModel
  }

  throw new Error(
    `Gemini provider requires GEMINI_MODEL or ${geminiEnvVar} (or ${sharedEnvVar} for backward compatibility) to be configured.`,
  )
}

function resolveProviderModel(anthropicModel: string): string {
  switch (getAPIProvider()) {
    case 'openai':
      return resolveOpenAIModel(anthropicModel)
    case 'gemini':
      return resolveGeminiModel(anthropicModel)
    case 'grok':
      return resolveGrokModel(anthropicModel)
    default:
      return anthropicModel
  }
}

export function getRealModelName(): string {
  return resolveProviderModel(getMainLoopModel())
}
