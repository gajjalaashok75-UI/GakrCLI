import { feature } from 'bun:bundle'

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
 * work (intentNormalize Haiku calls, prefetch hot path, telemetry)? Off by
 * default — the operator must run `/skill-search start` (which sets
 * `SKILL_SEARCH_ENABLED=1`).
 */
export function isSkillSearchEnabled(): boolean {
  return process.env.SKILL_SEARCH_ENABLED === '1'
}
