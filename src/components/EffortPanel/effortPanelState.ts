import type { EffortValue } from '../../utils/effort.js'

/**
 * Cursor position on the panel. Internal use only — not stored in AppState / settings / API.
 * 'ultracode' is not an EffortLevel; it serves as a visual placeholder and copy guidance in this panel.
 */
export type PanelPosition =
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'ultracode'

export const PANEL_POSITIONS: readonly PanelPosition[] = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultracode',
] as const

export const HOME_POSITION: PanelPosition = 'low'
export const END_POSITION: PanelPosition = 'ultracode'

/**
 * Check if a value is a valid panel cursor position (excluding ultracode, which is panel-internal only).
 */
function isNonUltracodePosition(
  value: unknown,
): value is Exclude<PanelPosition, 'ultracode'> {
  return (
    typeof value === 'string' &&
    value !== 'ultracode' &&
    (PANEL_POSITIONS as readonly string[]).includes(value)
  )
}

/**
 * Normalize EffortValue to a panel-usable cursor position.
 * - null / undefined / numeric (ant-only) / ultracode → undefined (let the caller use displayed)
 * - valid string slot → returns that slot
 */
function normalizeToPanelPosition(
  value: EffortValue | null | undefined,
): PanelPosition | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') return undefined
  if (isNonUltracodePosition(value)) {
    return value
  }
  return undefined
}

export function moveLeft(cursor: PanelPosition): PanelPosition {
  const idx = PANEL_POSITIONS.indexOf(cursor)
  if (idx <= 0) return PANEL_POSITIONS[0]
  return PANEL_POSITIONS[idx - 1]
}

export function moveRight(cursor: PanelPosition): PanelPosition {
  const idx = PANEL_POSITIONS.indexOf(cursor)
  if (idx === -1 || idx >= PANEL_POSITIONS.length - 1) {
    return PANEL_POSITIONS[PANEL_POSITIONS.length - 1]
  }
  return PANEL_POSITIONS[idx + 1]
}

export function isUltracode(cursor: PanelPosition): boolean {
  return cursor === 'ultracode'
}

/**
 * Determine the initial cursor position when the panel mounts.
 * Priority: env override (if valid slot) > displayed level
 *
 * @param envOverride    Return value of getEffortEnvOverride(): EffortValue | null | undefined
 * @param appStateEffort AppState.effortValue
 * @param displayed      getDisplayedEffortLevel(model, appStateEffort) — required, avoids depending on model here
 */
export function getInitialCursor(args: {
  envOverride: EffortValue | null | undefined
  appStateEffort: EffortValue | undefined
  displayed: PanelPosition
}): PanelPosition {
  const fromEnv = normalizeToPanelPosition(args.envOverride)
  if (fromEnv !== undefined) return fromEnv
  // displayed is already EffortLevel (no ultracode), valid
  return args.displayed
}

// -- Confirm/cancel decision (injecting ApplyFn avoids circular dependency + improves testability) --

export type ConfirmOutcome =
  | {
      kind: 'apply'
      message: string
      effortUpdate?: { value: EffortValue | undefined }
    }
  | { kind: 'ultracode-hint'; message: string }

export type ApplyFn = (cursor: PanelPosition) => {
  message: string
  effortUpdate?: { value: EffortValue | undefined }
}

export const ULTRACODE_HINT =
  'ultracode is not an effort level. Use /ultracode <context> to start a multi-agent workflow.'

export const CANCEL_MESSAGE = 'Effort unchanged.'

export function computeConfirmOutcome(
  cursor: PanelPosition,
  applyFn: ApplyFn,
): ConfirmOutcome {
  if (isUltracode(cursor)) {
    return { kind: 'ultracode-hint', message: ULTRACODE_HINT }
  }
  const result = applyFn(cursor)
  return {
    kind: 'apply',
    message: result.message,
    effortUpdate: result.effortUpdate,
  }
}
