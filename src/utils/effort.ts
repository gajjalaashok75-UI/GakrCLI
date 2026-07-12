// biome-ignore-all assist/source/organizeImports: internal-only import markers must not be reordered
import { isUltrathinkEnabled } from './thinking.js'
import { getInitialSettings } from './settings/settings.js'
import { isProSubscriber, isMaxSubscriber, isTeamSubscriber } from './auth.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js'
import { getAPIProvider } from './model/providers.js'
import { get3PModelCapabilityOverride } from './model/modelSupportOverrides.js'
import { getAntModelOverrideConfig, resolveAntModel } from './model/antModels.js'
import { supportsCodexReasoningEffort } from '../services/api/providerConfig.js'
import { isEnvTruthy } from './envUtils.js'
import type { EffortLevel } from 'src/entrypoints/sdk/runtimeTypes.js'

export type { EffortLevel }

export const EFFORT_LEVELS = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultracode',
] as const satisfies readonly EffortLevel[]

export const OPENAI_EFFORT_LEVELS = [
  'low',
  'medium',
  'high',
  'xhigh',
] as const

export type OpenAIEffortLevel = typeof OPENAI_EFFORT_LEVELS[number]
export type EffortValue = EffortLevel | number

export type ReasoningControlResolution = {
  supportsReasoning: boolean
  controllable: boolean
  mode?: 'levels'
  levels: EffortLevel[]
  defaultLevel?: EffortValue
  wireFormat?: 'reasoning_effort' | 'deepseek_compatible' | 'zai_compatible'
  source: 'metadata' | 'capability' | 'compat' | 'legacy' | 'none'
}

export type ReasoningControlContext = {
  apiProvider?: ReturnType<typeof getAPIProvider>
  supportsCodexReasoningEffort?: boolean | ((model: string) => boolean)
  routeId?: string | null
  useRuntimeFallback?: boolean
  openaiShimConfig?: { thinkingRequestFormat?: string; removeBodyFields?: string[] }
  catalogEntries?: readonly { apiName: string; id: string; aliases?: string[]; capabilities?: { supportsReasoning?: boolean }; reasoning?: { mode?: string; levels?: string[]; defaultLevel?: string; wireFormat?: string }; modelDescriptorId?: string }[]
  modelDescriptors?: Readonly<Record<string, { capabilities?: { supportsReasoning?: boolean }; reasoning?: { mode?: string; levels?: string[]; defaultLevel?: string; wireFormat?: string } }>>
}

const DEFAULT_REASONING_LEVELS: EffortLevel[] = ['low', 'medium', 'high']
const DEEPSEEK_METADATA_COMPAT_LEVELS: EffortLevel[] = ['high', 'xhigh']
const ZAI_METADATA_COMPAT_LEVELS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh']

type OpenAIShimThinkingRequestFormat = 'deepseek-compatible' | 'zai-compatible' | 'none'

// ─── Context-aware helpers ─────────────────────────────────────────────

function getReasoningApiProvider(
  context?: ReasoningControlContext,
): ReturnType<typeof getAPIProvider> {
  return context?.apiProvider ?? getAPIProvider()
}

function modelSupportsCodexReasoningEffort(
  model: string,
  context?: ReasoningControlContext,
): boolean {
  const override = context?.supportsCodexReasoningEffort
  if (typeof override === 'function') {
    return override(model)
  }
  return override ?? supportsCodexReasoningEffort(model)
}

function isSupportedEffortLevel(level: string): level is EffortLevel {
  return (EFFORT_LEVELS as readonly string[]).includes(level)
}

function normalizeReasoningLevels(
  levels: string[] | undefined,
): EffortLevel[] {
  const normalized = (levels ?? DEFAULT_REASONING_LEVELS).filter(
    isSupportedEffortLevel,
  )
  return normalized.length > 0 ? normalized : [...DEFAULT_REASONING_LEVELS]
}

function metadataWireFormatSupportsEffort(
  wireFormat: string | undefined,
): boolean {
  return wireFormat === 'reasoning_effort' ||
    wireFormat === 'deepseek_compatible' ||
    wireFormat === 'zai_compatible'
}

function normalizedBaseModel(model: string | undefined): string {
  return model?.trim().split('?', 1)[0]?.trim().toLowerCase() ?? ''
}

function providerScopedModelSegments(model: string): string[] {
  const segments = normalizedBaseModel(model)
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)
  const suffixes = segments
    .slice(1)
    .map((_, index) => segments.slice(index + 1).join('/'))
  const accountQualifiedSuffixes = suffixes
    .filter(suffix => /^[^/]+\/models\//.test(suffix))
    .map(suffix => `accounts/${suffix}`)

  return [...segments, ...suffixes, ...accountQualifiedSuffixes]
}

function modelLooksDeepSeekCompatible(model: string): boolean {
  return providerScopedModelSegments(model).some(segment =>
    segment.startsWith('deepseek'),
  )
}

function modelLooksZaiCompatible(model: string): boolean {
  const normalized = normalizedBaseModel(model)
  return normalized.startsWith('glm-') || normalized.startsWith('zai-org/glm-')
}

function supportsZaiReasoningEffort(model: string | undefined): boolean {
  const normalized = normalizedBaseModel(model)
  return normalized === 'glm-5.2' || normalized === 'zai-org/glm-5.2' || normalized.endsWith('/glm-5.2')
}

// ─── Compatibility wire-format resolution ──────────────────────────────

function resolveCompatibilityWireFormat(
  model: string,
  thinkingRequestFormat?: OpenAIShimThinkingRequestFormat,
  routeIdOverride?: string | null,
  _useRuntimeFallback = true,
): 'reasoning_effort' | 'deepseek_compatible' | 'zai_compatible' | undefined {
  if (thinkingRequestFormat === 'deepseek-compatible') {
    return 'deepseek_compatible'
  }
  if (thinkingRequestFormat === 'zai-compatible') {
    return 'zai_compatible'
  }
  if (thinkingRequestFormat === 'none') {
    return undefined
  }

  // Only resolve routeId from explicit override since we don't have
  // resolveActiveRouteIdFromEnv in this module.
  const routeId = routeIdOverride !== undefined ? routeIdOverride : undefined
  if (!routeId || routeId === 'anthropic' || routeId === 'openai') {
    return undefined
  }
  if (modelLooksDeepSeekCompatible(model)) {
    return 'deepseek_compatible'
  }
  if (routeId === 'zai' && modelLooksZaiCompatible(model)) {
    return 'zai_compatible'
  }
  return undefined
}

function resolveCompatibilityReasoningControl(
  model: string,
  thinkingRequestFormat?: OpenAIShimThinkingRequestFormat,
  removeBodyFields?: string[],
  context?: ReasoningControlContext,
): ReasoningControlResolution | undefined {
  const openaiShimConfig = context?.openaiShimConfig
  const resolvedThinkingRequestFormat =
    thinkingRequestFormat ?? openaiShimConfig?.thinkingRequestFormat as OpenAIShimThinkingRequestFormat | undefined
  const resolvedRemoveBodyFields =
    removeBodyFields ?? openaiShimConfig?.removeBodyFields
  const wireFormat = resolveCompatibilityWireFormat(
    model,
    resolvedThinkingRequestFormat,
    context?.routeId,
    context?.useRuntimeFallback ?? true,
  )
  if (!wireFormat) {
    return undefined
  }

  if (wireFormat === 'deepseek_compatible') {
    if (resolvedRemoveBodyFields?.includes('reasoning_effort')) {
      return undefined
    }
    return {
      supportsReasoning: true,
      controllable: true,
      mode: 'levels',
      levels: [...OPENAI_EFFORT_LEVELS] as EffortLevel[],
      defaultLevel: undefined,
      wireFormat,
      source: 'compat',
    }
  }

  if (wireFormat === 'zai_compatible') {
    const reasoningEffortStripped =
      resolvedRemoveBodyFields?.includes('reasoning_effort') === true
    const levels: EffortLevel[] = supportsZaiReasoningEffort(model) && !reasoningEffortStripped
      ? ['high', 'xhigh']
      : ['high']
    return {
      supportsReasoning: true,
      controllable: true,
      mode: 'levels',
      levels,
      defaultLevel: undefined,
      wireFormat,
      source: 'compat',
    }
  }

  return undefined
}

// ─── Metadata-based resolution (stub — needs catalog infra) ────────────

function resolveMetadataReasoningControl(
  _model: string,
  _context?: ReasoningControlContext,
): ReasoningControlResolution | undefined {
  // Root module doesn't have catalog/runtime-metadata imports.
  // Resolution via explicit context entries is not supported here.
  return undefined
}

// ─── Legacy resolution (current root logic, context-aware) ─────────────

function legacyModelSupportsEffort(
  model: string,
  context?: ReasoningControlContext,
): boolean {
  const m = model.toLowerCase()
  if (isEnvTruthy(process.env.GAKR_CODE_ALWAYS_ENABLE_EFFORT)) {
    return true
  }
  const supported3P = get3PModelCapabilityOverride(model, 'effort')
  if (supported3P !== undefined) {
    return supported3P
  }
  if (modelUsesOpenAIEffort(model, context) && modelSupportsCodexReasoningEffort(model, context)) {
    return true
  }
  // GakrCLI 4 models that support effort. Mirrors the Anthropic /messages
  // shim's isAdaptive || isOpus45 set (openaiShim.ts:2292-2297) — only
  // these models serialize low/medium as anthropicBody.effort. Older
  // variants (opus-4-1, sonnet-4-5, haiku) only emit thinking for
  // high/max, so advertising effort for them would silently drop
  // low/medium on the wire. The substring match also covers prefix
  // variations (e.g. `claude-opus-4-7`, `opencode-claude-opus-4-8`).
  if (m.includes('opus-4-5') || m.includes('opus-4-6') ||
      m.includes('opus-4-7') || m.includes('opus-4-8') ||
      m.includes('sonnet-4-6')) {
    return true
  }
  // OpenCode Gemini models that support thinking via /models/gemini-* endpoint
  if (m.includes('gemini-3')) {
    return true
  }
  // Exclude any other known legacy models (haiku, older opus/sonnet variants)
  if (m.includes('haiku') || m.includes('sonnet') || m.includes('opus')) {
    return false
  }

  // IMPORTANT: Do not change the default effort support without notifying
  // the model launch DRI and research. This is a sensitive setting that can
  // greatly affect model quality and bashing.

  // Default to true for unknown model strings on 1P.
  // Do not default to true for 3P as they have different formats for their
  // model strings (ex. anthropics/gakrcli-code#30795)
  return getReasoningApiProvider(context) === 'firstParty'
}

function legacyModelSupportsMaxEffort(model: string): boolean {
  const supported3P = get3PModelCapabilityOverride(model, 'max_effort')
  if (supported3P !== undefined) {
    return supported3P
  }
  if (model.toLowerCase().includes('opus-4-6') || model.toLowerCase().includes('opus-4-7') || model.toLowerCase().includes('opus-4-8')) {
    return true
  }
  if (process.env.USER_TYPE === 'ant' && resolveAntModel(model)) {
    return true
  }
  return false
}

function legacyModelSupportsXHighEffort(
  model: string,
  context?: ReasoningControlContext,
): boolean {
  if (!legacyModelSupportsEffort(model, context)) {
    return false
  }
  const supported3P = get3PModelCapabilityOverride(model, 'xhigh_effort')
  if (supported3P !== undefined) {
    return supported3P
  }
  if (modelUsesOpenAIEffort(model, context)) {
    return true
  }
  if (model.toLowerCase().includes('opus-4-7') || model.toLowerCase().includes('opus-4-8')) {
    return true
  }
  return false
}

function getLegacyAvailableEffortLevels(
  model: string,
  context?: ReasoningControlContext,
): EffortLevel[] {
  if (!legacyModelSupportsEffort(model, context)) {
    return []
  }
  // OpenCode GakrCLI and Gemini models use /messages or /models/gemini-*
  // (Anthropic/Google format) even though getAPIProvider() returns 'openai'.
  // Show standard levels (max) not OpenAI levels (xhigh).
  const m = model.toLowerCase()
  const isOpenCodeNativeFormat = (
    m.includes('claude-opus-4') || m.includes('claude-sonnet-4') ||
    m.includes('opus-4') || m.includes('sonnet-4') ||
    m.includes('gemini-3')
  ) && getReasoningApiProvider(context) === 'openai'
  if (modelUsesOpenAIEffort(model, context) && !isOpenCodeNativeFormat) {
    return [...OPENAI_EFFORT_LEVELS] as EffortLevel[]
  }
  const levels: EffortLevel[] = ['low', 'medium', 'high']
  if (legacyModelSupportsXHighEffort(model, context)) {
    levels.push('xhigh')
  }
  if (legacyModelSupportsMaxEffort(model)) {
    levels.push('max')
  }
  if (
    context?.apiProvider === 'firstParty' &&
    legacyModelSupportsXHighEffort(model, context)
  ) {
    levels.push('ultracode')
  }
  return levels
}

function appendUltracodeLevel(
  levels: EffortLevel[],
  context?: ReasoningControlContext,
): EffortLevel[] {
  if (
    context?.apiProvider === 'firstParty' &&
    levels.includes('xhigh') &&
    !levels.includes('ultracode')
  ) {
    return [...levels, 'ultracode']
  }
  return levels
}

function resolveLegacyReasoningControl(
  model: string,
  context?: ReasoningControlContext,
): ReasoningControlResolution {
  if (!legacyModelSupportsEffort(model, context)) {
    return {
      supportsReasoning: false,
      controllable: false,
      levels: [],
      source: 'none',
    }
  }

  return {
    supportsReasoning: true,
    controllable: true,
    mode: 'levels',
    levels: getLegacyAvailableEffortLevels(model, context),
    defaultLevel: getDefaultEffortForModel(model, context),
    wireFormat: 'reasoning_effort',
    source: 'legacy',
  }
}

export function resolveModelReasoningControl(
  model: string,
  context?: ReasoningControlContext,
): ReasoningControlResolution {
  const metadata = resolveMetadataReasoningControl(model, context)
  if (metadata?.source === 'metadata') {
    return metadata
  }

  const compatibility = resolveCompatibilityReasoningControl(model, undefined, undefined, context)
  if (compatibility) {
    return compatibility
  }

  if (metadata) {
    return metadata
  }

  return resolveLegacyReasoningControl(model, context)
}

// @[MODEL LAUNCH]: Add the new model to the allowlist if it supports the effort parameter.
export function modelSupportsEffort(model: string, context?: ReasoningControlContext): boolean {
  const m = model.toLowerCase()
  if (isEnvTruthy(process.env.GAKR_CODE_ALWAYS_ENABLE_EFFORT)) {
    return true
  }
  const supported3P = get3PModelCapabilityOverride(model, 'effort')
  if (supported3P !== undefined) {
    return supported3P
  }
  if (modelUsesOpenAIEffort(model, context) && supportsCodexReasoningEffort(model)) {
    return true
  }
  // GakrCLI 4 models that support effort. Mirrors the Anthropic /messages
  // shim's isAdaptive || isOpus45 set (openaiShim.ts:2292-2297) — only
  // these models serialize low/medium as anthropicBody.effort. Older
  // variants (opus-4-1, sonnet-4-5, haiku) only emit thinking for
  // high/max, so advertising effort for them would silently drop
  // low/medium on the wire. The substring match also covers prefix
  // variations (e.g. `claude-opus-4-7`, `opencode-claude-opus-4-8`).
  if (m.includes('opus-4-5') || m.includes('opus-4-6') ||
      m.includes('opus-4-7') || m.includes('opus-4-8') ||
      m.includes('sonnet-4-6')) {
    return true
  }
  // OpenCode Gemini models that support thinking via /models/gemini-* endpoint
  if (m.includes('gemini-3')) {
    return true
  }
  // Exclude any other known legacy models (haiku, older opus/sonnet variants)
  if (m.includes('haiku') || m.includes('sonnet') || m.includes('opus')) {
    return false
  }

  // IMPORTANT: Do not change the default effort support without notifying
  // the model launch DRI and research. This is a sensitive setting that can
  // greatly affect model quality and bashing.

  // Default to true for unknown model strings on 1P.
  // Do not default to true for 3P as they have different formats for their
  // model strings (ex. anthropics/gakrcli-code#30795)
  return getAPIProvider() === 'firstParty'
}

// @[MODEL LAUNCH]: Add the new model to the allowlist if it supports 'max' effort.
// Per API docs, 'max' is Opus 4.6 only for public models — other models return an error.
export function modelSupportsMaxEffort(model: string, context?: ReasoningControlContext): boolean {
  const control = resolveModelReasoningControl(model, context)
  if (control.source === 'metadata' || control.source === 'capability' || control.source === 'compat') {
    return control.levels.includes('max')
  }
  return legacyModelSupportsMaxEffort(model)
}

// @[MODEL LAUNCH]: Add the new model to the allowlist if it supports 'xhigh' effort.
// xhigh is reserved for OpenAI/Codex models and OpenCode claude opus 4-7 / 4-8.
// All other effort-supporting models reject xhigh at the API.
export function modelSupportsXHighEffort(model: string, context?: ReasoningControlContext): boolean {
  if (!modelSupportsEffort(model, context)) {
    return false
  }
  const supported3P = get3PModelCapabilityOverride(model, 'xhigh_effort')
  if (supported3P !== undefined) {
    return supported3P
  }
  if (modelUsesOpenAIEffort(model, context)) {
    return true
  }
  if (model.toLowerCase().includes('opus-4-7') || model.toLowerCase().includes('opus-4-8')) {
    return true
  }
  return false
}

export function isEffortLevel(value: string): value is EffortLevel {
  return (EFFORT_LEVELS as readonly string[]).includes(value)
}

export function isOpenAIEffortLevel(value: string): value is OpenAIEffortLevel {
  return (OPENAI_EFFORT_LEVELS as readonly string[]).includes(value)
}

export function modelUsesOpenAIEffort(model: string, context?: ReasoningControlContext): boolean {
  const provider = getReasoningApiProvider(context)
  if (provider !== 'openai' && provider !== 'codex') {
    return false
  }
  // Native GakrCLI/Gemini models on OpenCode use Anthropic/Google format
  // even though the OpenCode shim is provider=openai. They should not be
  // classified as OpenAI-style for effort routing.
  const m = model.toLowerCase()
  if (m.includes('gakrcli-') || m.includes('claude-') || m.includes('gemini-')) {
    return false
  }
  return true
}

export function getAvailableEffortLevels(model: string, context?: ReasoningControlContext): EffortLevel[] {
  const control = resolveModelReasoningControl(model, context)
  if (control.source === 'metadata' || control.source === 'capability' || control.source === 'compat') {
    return appendUltracodeLevel([...control.levels], context)
  }
  return getLegacyAvailableEffortLevels(model, context)
}

export function getEffortLevelLabel(level: EffortLevel | OpenAIEffortLevel): string {
  if (level === 'xhigh') return 'Extra High'
  if (level === 'max') return 'Max'
  return capitalize(level)
}

export function openAIEffortToStandard(level: OpenAIEffortLevel): EffortLevel {
  return level as EffortLevel
}

export function standardEffortToOpenAI(level: EffortLevel): OpenAIEffortLevel {
  if (level === 'max') return 'xhigh'
  return level as OpenAIEffortLevel
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function parseEffortValue(value: unknown): EffortValue | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (typeof value === 'number' && isValidNumericEffort(value)) {
    return value
  }
  const str = String(value).toLowerCase()
  if (isEffortLevel(str)) {
    return str
  }
  const numericValue = parseInt(str, 10)
  if (!isNaN(numericValue) && isValidNumericEffort(numericValue)) {
    return numericValue
  }
  return undefined
}

/**
 * Numeric values are model-default only and not persisted.
 * 'max' can now be persisted by all users.
 * 'xhigh' is a first-class EffortLevel (supported by OpenCode GakrCLI 4.7+)
 * and is persisted as 'xhigh' — no normalization needed.
 * Write sites call this before saving to settings so the Zod schema
 * (which only accepts string levels) never rejects a write.
 */
export function toPersistableEffort(
  value: EffortValue | undefined,
): EffortLevel | undefined {
  if (
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'max' ||
    value === 'xhigh'
  ) {
    return value
  }
  return undefined
}

export function getInitialEffortSetting(): EffortLevel | undefined {
  // toPersistableEffort validates 'max' on read, so a manually
  // edited settings.json with an invalid level doesn't leak into a fresh session.
  return toPersistableEffort(getInitialSettings().effortLevel)
}

/**
 * Decide what effort level (if any) to persist when the user selects a model
 * in ModelPicker. Keeps an explicit prior /effort choice sticky even when it
 * matches the picked model's default, while letting purely-default and
 * session-ephemeral effort (CLI --effort, EffortCallout default) fall through
 * to undefined so it follows future model-default changes.
 *
 * priorPersisted must come from userSettings on disk
 * (getSettingsForSource('userSettings')?.effortLevel), NOT merged settings
 * (project/policy layers would leak into the user's global settings.json)
 * and NOT AppState.effortValue (includes session-scoped sources that
 * deliberately do not write to settings.json).
 */
export function resolvePickerEffortPersistence(
  picked: EffortLevel | undefined,
  modelDefault: EffortLevel,
  priorPersisted: EffortLevel | undefined,
  toggledInPicker: boolean,
): EffortLevel | undefined {
  const hadExplicit = priorPersisted !== undefined || toggledInPicker
  return hadExplicit || picked !== modelDefault ? picked : undefined
}

export function getEffortEnvOverride(): EffortValue | null | undefined {
  const envOverride = process.env.GAKR_CODE_EFFORT_LEVEL
  return envOverride?.toLowerCase() === 'unset' ||
    envOverride?.toLowerCase() === 'auto'
    ? null
    : parseEffortValue(envOverride)
}

export function clampUltracodeEffort(
  effort: EffortValue | undefined,
  model: string,
  context?: ReasoningControlContext,
): EffortValue | undefined {
  if (effort === 'ultracode' && !getAvailableEffortLevels(model, context).includes('ultracode')) {
    return modelSupportsXHighEffort(model, context) ? 'xhigh' : 'high'
  }
  return effort
}

/**
 * Resolve the effort value that will actually be sent to the API for a given
 * model, following the full precedence chain:
 *   env GAKR_CODE_EFFORT_LEVEL → appState.effortValue → model default
 *
 * Returns undefined when no effort parameter should be sent (env set to
 * 'unset', or no default exists for the model).
 */
export function resolveAppliedEffort(
  model: string,
  appStateEffortValue: EffortValue | undefined,
  context?: ReasoningControlContext,
): EffortValue | undefined {
  const envOverride = getEffortEnvOverride()
  if (envOverride === null) {
    return undefined
  }
  if (!modelSupportsEffort(model, context)) {
    return undefined
  }

  const resolved =
    envOverride ?? appStateEffortValue ?? getDefaultEffortForModel(model, context)
  // API rejects 'max' on non-Opus-4.6 Anthropic models — downgrade to 'high'.
  // OpenAI/Codex models use 'max' as the standard form of 'xhigh'; the client
  // shim converts it back to 'xhigh' on the wire, so don't clamp it here.
  if (
    resolved === 'max' &&
    !modelSupportsMaxEffort(model, context) &&
    !modelUsesOpenAIEffort(model, context)
  ) {
    return 'high'
  }
  // xhigh is reserved for OpenAI/Codex models and OpenCode opus-4-7/4-8.
  // For all other models, downgrade to 'high' so a stale persisted setting
  // doesn't surface as an API error.
  if (resolved === 'xhigh' && !modelSupportsXHighEffort(model, context)) {
    return 'high'
  }
  // ultracode is a meta-level: map it to xhigh (or high if unsupported).
  if (resolved === 'ultracode') {
    return modelSupportsXHighEffort(model, context) ? 'xhigh' : 'high'
  }
  return resolved
}

function isEffectiveUltracodeDisplay(
  model: string,
  effort: EffortValue | undefined,
  context?: ReasoningControlContext,
): boolean {
  return (
    effort === 'ultracode' &&
    getAvailableEffortLevels(model, context).includes('ultracode')
  )
}

/**
 * Resolve the effort level to show the user. Wraps resolveAppliedEffort
 * with the 'high' fallback (what the API uses when no effort param is sent).
 * Single source of truth for the status bar and /effort output (CC-1088).
 */
export function getDisplayedEffortLevel(
  model: string,
  appStateEffort: EffortValue | undefined,
  context?: ReasoningControlContext,
): EffortLevel {
  // `ultracode` is a meta-mode (the standing multi-agent permission), not just
  // an API effort alias, so surface it as the current level rather than the
  // `xhigh`/`high` it maps to at the API boundary — but only when it is the
  // EFFECTIVE effort. GAKR_CODE_EFFORT_LEVEL takes precedence over app state
  // (see resolveAppliedEffort), so `--effort ultracode` with
  // GAKR_CODE_EFFORT_LEVEL=high must show high, matching the API and the
  // permission gate rather than the stale session value.
  const envOverride = getEffortEnvOverride()
  const effectiveEffort =
    envOverride === null ? undefined : (envOverride ?? appStateEffort)
  if (isEffectiveUltracodeDisplay(model, effectiveEffort, context)) {
    return 'ultracode'
  }
  const resolved = resolveAppliedEffort(model, appStateEffort, context) ?? 'high'
  return convertEffortValueToLevel(resolved)
}

/**
 * Build the ` with {level} effort` suffix shown in Logo/Spinner.
 * Returns empty string if the user hasn't explicitly set an effort value.
 * Delegates to resolveAppliedEffort() so the displayed level matches what
 * the API actually receives (including max→high clamp for non-Opus models).
 */
export function getEffortSuffix(
  model: string,
  effortValue: EffortValue | undefined,
  context?: ReasoningControlContext,
): string {
  if (effortValue === undefined) return ''
  // Surface the ultracode meta-mode here too (Logo/Spinner), consistent with
  // getDisplayedEffortLevel — but only when it is the EFFECTIVE effort, so a
  // GAKR_CODE_EFFORT_LEVEL override wins over the session value rather than
  // showing ultracode for a turn the API runs at a different effort.
  const envOverride = getEffortEnvOverride()
  const effectiveEffort =
    envOverride === null ? undefined : (envOverride ?? effortValue)
  if (isEffectiveUltracodeDisplay(model, effectiveEffort, context)) {
    return ' with ultracode effort'
  }
  const resolved = resolveAppliedEffort(model, effortValue, context)
  if (resolved === undefined) return ''
  return ` with ${convertEffortValueToLevel(resolved)} effort`
}

export function isValidNumericEffort(value: number): boolean {
  return Number.isInteger(value)
}

export function convertEffortValueToLevel(value: EffortValue): EffortLevel {
  if (typeof value === 'string') {
    // Runtime guard: value may come from remote config (GrowthBook) where
    // TypeScript types can't help us. Coerce unknown strings to 'high'
    // rather than passing them through unchecked.
    return isEffortLevel(value) ? value : 'high'
  }
  if (process.env.USER_TYPE === 'ant' && typeof value === 'number') {
    if (value <= 50) return 'low'
    if (value <= 85) return 'medium'
    if (value <= 100) return 'high'
    return 'max'
  }
  return 'high'
}

/**
 * Get user-facing description for effort levels
 *
 * @param level The effort level to describe
 * @returns Human-readable description
 */
export function getEffortLevelDescription(level: EffortLevel | OpenAIEffortLevel): string {
  switch (level) {
    case 'low':
      return 'Quick, straightforward implementation with minimal overhead'
    case 'medium':
      return 'Balanced approach with standard implementation and testing'
    case 'high':
      return 'Comprehensive implementation with extensive testing and documentation'
    case 'max':
      return 'Maximum capability with deepest reasoning (Opus 4.6+)'
    case 'xhigh':
      return 'Extra high reasoning effort for complex tasks'
  }
}

/**
 * Get user-facing description for effort values (both string and numeric)
 *
 * @param value The effort value to describe
 * @returns Human-readable description
 */
export function getEffortValueDescription(value: EffortValue): string {
  if (process.env.USER_TYPE === 'ant' && typeof value === 'number') {
    return `[internal-only] Numeric effort value of ${value}`
  }

  if (typeof value === 'string') {
    return getEffortLevelDescription(value)
  }
  return 'Balanced approach with standard implementation and testing'
}

export type OpusDefaultEffortConfig = {
  enabled: boolean
  dialogTitle: string
  dialogDescription: string
}

const OPUS_DEFAULT_EFFORT_CONFIG_DEFAULT: OpusDefaultEffortConfig = {
  enabled: true,
  dialogTitle: 'We recommend medium effort for Opus',
  dialogDescription:
    'Effort determines how long GakrCLI thinks for when completing your task. We recommend medium effort for most tasks to balance speed and intelligence and maximize rate limits. Use ultrathink to trigger high effort when needed.',
}

export function getOpusDefaultEffortConfig(): OpusDefaultEffortConfig {
  const config = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_grey_step2',
    OPUS_DEFAULT_EFFORT_CONFIG_DEFAULT,
  )
  return {
    ...OPUS_DEFAULT_EFFORT_CONFIG_DEFAULT,
    ...config,
  }
}

// @[MODEL LAUNCH]: Update the default effort levels for new models
export function getDefaultEffortForModel(
  model: string,
  context?: ReasoningControlContext,
): EffortValue | undefined {
  if (process.env.USER_TYPE === 'ant') {
    const config = getAntModelOverrideConfig()
    const isDefaultModel =
      config?.defaultModel !== undefined &&
      model.toLowerCase() === config.defaultModel.toLowerCase()
    if (isDefaultModel && config?.defaultModelEffortLevel) {
      return config.defaultModelEffortLevel
    }
    const antModel = resolveAntModel(model)
    if (antModel) {
      if (antModel.defaultEffortLevel) {
        return antModel.defaultEffortLevel
      }
      if (antModel.defaultEffortValue !== undefined) {
        return antModel.defaultEffortValue
      }
    }
    // Always default ants to undefined/high
    return undefined
  }

  // IMPORTANT: Do not change the default effort level without notifying
  // the model launch DRI and research. Default effort is a sensitive setting
  // that can greatly affect model quality and bashing.

  // Default effort on Opus 4.6+ to medium for Pro.
  // Max/Team also get medium when the tengu_grey_step2 config is enabled.
  if (
    model.toLowerCase().includes('opus-4-8') ||
    model.toLowerCase().includes('opus-4-7') ||
    model.toLowerCase().includes('opus-4-6')
  ) {
    if (isProSubscriber()) {
      return 'medium'
    }
    if (
      getOpusDefaultEffortConfig().enabled &&
      (isMaxSubscriber() || isTeamSubscriber())
    ) {
      return 'medium'
    }
  }

  // When ultrathink feature is on, default effort to medium (ultrathink bumps to high)
  if (isUltrathinkEnabled() && modelSupportsEffort(model, context)) {
    return 'medium'
  }

  // Fallback to undefined, which means we don't set an effort level. This
  // should resolve to high effort level in the API.
  return undefined
}
