import type { ModelCatalogEntry } from './descriptors.js'

/**
 * Exclusion-only filter for ids returned by an OpenAI-compatible
 * `GET /models` endpoint.
 *
 * Most aggregating providers serve embeddings, rerankers, image/video
 * generators, speech models, and moderation endpoints from the same catalog as
 * their chat models. Those cannot be used as a main-loop model, so admitting
 * them would bury the usable entries in the `/model` picker.
 *
 * This is deliberately an exclusion list rather than an allowlist: chat model
 * ids vary far too much across providers (`glm-5`, `auto`, `inkling`,
 * `mindai/macaron-v1-tall`) for a positive pattern to be safe, and dropping a
 * real chat model is worse than admitting one stray non-chat entry. Routes with
 * an unusual catalog (NVIDIA NIM) keep their own stricter filter.
 */
const NON_CHAT_MODEL_PATTERN =
  /(?:^|[/\-_.])(?:text-)?(?:embed(?:ding)?s?|(?:re)?rank(?:ing|er)?s?|retrieval|bert|bge|gte|labse|moderation|guard(?:rail)?s?|whisper|tts|stt|transcribe|speech|audio|voxtral|sonic|realtime|dall-?e|flux|stable-?diffusion|sdxl|imagen|image|video|veo|sora|ocr|vision-?encoder|privacy-filter|search-preview|computer-use)(?:[/\-_.]|$)/i

/**
 * Legacy OpenAI completion-only families that predate the chat API and would
 * fail against `/chat/completions`.
 */
const LEGACY_COMPLETION_MODEL_PATTERN =
  /^(?:babbage|davinci|curie|ada|text-davinci|gpt-3\.5-turbo-instruct)/i

export function isNonChatModelId(id: string): boolean {
  return (
    NON_CHAT_MODEL_PATTERN.test(id) || LEGACY_COMPLETION_MODEL_PATTERN.test(id)
  )
}

const CONTEXT_WINDOW_FIELDS = [
  'context_length',
  'context_window',
  'contextWindow',
  'max_context_length',
  'max_input_tokens',
] as const

const MAX_OUTPUT_FIELDS = [
  'max_output_length',
  'max_output_tokens',
  'maxCompletionTokens',
  'max_completion_tokens',
] as const

function readPositiveInt(
  raw: Record<string, unknown>,
  fields: readonly string[],
): number | undefined {
  for (const field of fields) {
    const value = raw[field]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value
    }
  }
  return undefined
}

/**
 * Maps one raw `GET /models` record to a catalog entry, dropping models that
 * cannot serve as a main-loop chat model.
 *
 * Pass this as a route catalog's `discovery.mapModel` for any OpenAI-compatible
 * provider whose catalog mixes chat with non-chat models.
 */
export function mapOpenAIChatCatalogModel(
  raw: unknown,
): ModelCatalogEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const record = raw as Record<string, unknown>
  const id = record.id
  if (typeof id !== 'string' || id.length === 0) {
    return null
  }
  // Providers that expose availability inline (NVIDIA-style `active`, Venice
  // `isAvailable`) should not surface retired models.
  if (record.active === false || record.isAvailable === false) {
    return null
  }
  if (isNonChatModelId(id)) {
    return null
  }

  const contextWindow = readPositiveInt(record, CONTEXT_WINDOW_FIELDS)
  const maxOutputTokens = readPositiveInt(record, MAX_OUTPUT_FIELDS)

  return {
    id,
    apiName: id,
    label: id,
    ...(contextWindow ? { contextWindow } : {}),
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
  }
}
