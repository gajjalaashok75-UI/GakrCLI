import { feature } from 'bun:bundle'
import { logForDebugging } from '../../utils/debug.js'

/**
 * Build-time presence check: is the `/skill-search` slash command compiled
 * into this build? Used by the command registry's `isEnabled` so the
 * command appears in the menu whenever it is buildable. Operators activate
 * the subsystem itself via `/skill-search start`, which flips
 * `SKILL_SEARCH_ENABLED=1` and turns the runtime hot paths on (see
 * `isSkillSearchEnabled`).
 */
export function isSkillSearchCompiledIn(): boolean {
  if (feature('EXPERIMENTAL_SKILL_SEARCH')) return true
  return false
}

/**
 * Runtime activation check: is the skill-search subsystem currently doing
 * work (trigger matching, prefetch hot path, telemetry)? Off by default — the
 * operator must run `/skill-search start` (which sets `SKILL_SEARCH_ENABLED=1`).
 *
 * Build-flag gating is intentionally NOT performed here: the command
 * registry already gates command compilation on the build flag, and this
 * function is only reached from code paths that the build flag has
 * already let through. Decoupling keeps the test surface clean (tests
 * exercise the env-var contract without needing to mock `bun:bundle`).
 */
export function isSkillSearchEnabled(): boolean {
  return process.env.SKILL_SEARCH_ENABLED === '1'
}

/**
 * Skill-search behavior mode.
 *
 * - `off`    — subsystem disabled; no matching, no injection.
 * - `normal` — deterministic trigger matching surfaces skill *suggestions*
 *              (names + descriptions) without injecting full content.
 * - `hybrid` — deterministic trigger matching additionally auto-injects the
 *              full instructions of matching skills into the prompt.
 *
 * "hybrid" here means trigger matching plus automatic injection — it does NOT
 * combine multiple retrieval algorithms. There is no TF-IDF/embedding path.
 */
export type SkillSearchMode = 'off' | 'normal' | 'hybrid'

export const DEFAULT_SKILL_SEARCH_MODE: SkillSearchMode = 'normal'

/** True when the value is a valid behavior mode. */
export function isSkillSearchMode(value: unknown): value is SkillSearchMode {
  return value === 'off' || value === 'normal' || value === 'hybrid'
}

/**
 * Resolve the current mode. The master on/off switch is
 * `SKILL_SEARCH_ENABLED`; `SKILL_SEARCH_MODE` selects the behavior when on.
 * An unrecognized mode falls back to {@link DEFAULT_SKILL_SEARCH_MODE}.
 */
export function getSkillSearchMode(): SkillSearchMode {
  if (!isSkillSearchEnabled()) return 'off'
  const raw = process.env.SKILL_SEARCH_MODE
  return isSkillSearchMode(raw) ? raw : DEFAULT_SKILL_SEARCH_MODE
}

/**
 * Apply a mode. `off` disables the subsystem; any other mode enables it and
 * records the behavior. Returns the mode actually in effect.
 */
export function setSkillSearchMode(mode: SkillSearchMode): SkillSearchMode {
  if (mode === 'off') {
    process.env.SKILL_SEARCH_ENABLED = '0'
    logForDebugging('[skill-search] mode set to off (SKILL_SEARCH_ENABLED=0)')
    return 'off'
  }
  process.env.SKILL_SEARCH_ENABLED = '1'
  process.env.SKILL_SEARCH_MODE = mode
  logForDebugging(
    `[skill-search] mode set to ${mode} (SKILL_SEARCH_ENABLED=1, SKILL_SEARCH_MODE=${mode})`,
  )
  return mode
}
