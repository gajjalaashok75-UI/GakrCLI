import { logForDebugging } from '../../utils/debug.js'

/**
 * Deterministic, OpenHands-style skill trigger matching.
 *
 * Replaces TF-IDF/cosine retrieval for skill discovery. A skill is considered
 * relevant only when one of its declared keyword `triggers:` — or its own name
 * — appears in the user's message as a whole token. This mirrors the OpenHands
 * SDK `Skill.match_trigger` / `_keyword_matches` behavior:
 *
 *   pattern = (?<![a-z0-9])keyword(?![a-z0-9])
 *
 * which means `git` does not fire on `github`, but slash-prefixed keywords like
 * `/linear` still match.
 *
 * A skill's name is treated as an implicit trigger so that e.g. mentioning
 * "code review" surfaces the `code-review` skill without extra frontmatter.
 */

export interface SkillTriggerEntry {
  name: string
  /** Lowercased name with `-`/`_` collapsed to spaces, used as a name trigger. */
  normalizedName: string
  description: string
  triggers: string[]
  source: string
  loadedFrom: string | undefined
  skillRoot: string | undefined
  contentLength: number | undefined
}

export interface TriggerMatchResult {
  name: string
  description: string
  /** The keyword (or name) that caused the match. */
  trigger: string
  matchType: 'keyword' | 'name'
  score: number
  source?: string
  loadedFrom?: string
  skillRoot?: string
  contentLength?: number
}

/** Sources whose commands are CLI built-ins, not discoverable skills. */
const NON_SKILL_SOURCES = new Set(['builtin'])

/**
 * Loaded-from values that always identify a real skill, even without an
 * explicit description or `when_to_use`.
 */
const SKILL_LOADED_FROM = new Set([
  'skills',
  'bundled',
  'plugin',
  'commands_DEPRECATED',
  'mcp',
])

export function normalizeSkillName(name: string): string {
  return name.toLowerCase().replace(/[-_]+/g, ' ').trim()
}

/**
 * Whole-token, case-insensitive match. The message is lowercased internally so
 * callers do not have to remember to; `messageLower` is accepted already-lower
 * for hot paths that precompute it, but correctness never depends on it.
 */
export function keywordMatches(keyword: string, messageLower: string): boolean {
  const keywordLower = keyword.trim().toLowerCase()
  if (!keywordLower) return false
  const pattern = new RegExp(
    `(?<![a-z0-9])${escapeRegExp(keywordLower)}(?![a-z0-9])`,
  )
  return pattern.test(messageLower.toLowerCase())
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

let cachedIndex: SkillTriggerEntry[] | null = null
let cachedCwd: string | null = null

export function clearTriggerIndexCache(): void {
  cachedIndex = null
  cachedCwd = null
  logForDebugging('[skill-search] trigger index cache cleared')
}

/**
 * Build (and memoize) the trigger index for `cwd`. Only real, model-invocable
 * skills are indexed — CLI built-ins (`source: 'builtin'`) and skills with
 * `disable-model-invocation` are excluded so they cannot pollute discovery.
 */
export async function getSkillTriggerIndex(
  cwd: string,
): Promise<SkillTriggerEntry[]> {
  if (cachedIndex && cachedCwd === cwd) {
    logForDebugging(
      `[skill-search] trigger index cache hit (cwd=${cwd}, ${cachedIndex.length} entries)`,
    )
    return cachedIndex
  }

  const { getCommands } = await import('../../commands.js')
  const commands = await getCommands(cwd)

  const entries: SkillTriggerEntry[] = []
  let skippedNonPrompt = 0
  let skippedDisabled = 0
  let skippedBuiltin = 0
  let skippedNotRealSkill = 0
  for (const cmd of commands) {
    const record = cmd as Record<string, unknown>
    if (record.type !== 'prompt') {
      skippedNonPrompt++
      continue
    }
    if (record.disableModelInvocation) {
      skippedDisabled++
      logForDebugging(
        `[skill-search] index skip (disable-model-invocation): ${cmd.name}`,
      )
      continue
    }

    const source = (record.source as string) ?? 'unknown'
    if (NON_SKILL_SOURCES.has(source)) {
      skippedBuiltin++
      logForDebugging(
        `[skill-search] index skip (builtin source): ${cmd.name}`,
      )
      continue
    }

    const name = cmd.name
    const description = cmd.description ?? ''
    const whenToUse = record.whenToUse as string | undefined
    const triggers = (record.triggers as string[] | undefined) ?? []
    const loadedFrom = record.loadedFrom as string | undefined
    const hasUserSpecifiedDescription = Boolean(
      record.hasUserSpecifiedDescription,
    )

    const isRealSkill =
      SKILL_LOADED_FROM.has(loadedFrom ?? '') ||
      hasUserSpecifiedDescription ||
      Boolean(whenToUse) ||
      triggers.length > 0
    if (!isRealSkill) {
      skippedNotRealSkill++
      logForDebugging(
        `[skill-search] index skip (not a real skill): ${name} (loadedFrom=${loadedFrom ?? 'none'})`,
      )
      continue
    }

    entries.push({
      name,
      normalizedName: normalizeSkillName(name),
      description,
      triggers,
      source,
      loadedFrom,
      skillRoot: record.skillRoot as string | undefined,
      contentLength: record.contentLength as number | undefined,
    })
    if (triggers.length > 0) {
      logForDebugging(
        `[skill-search] index add: ${name} triggers=[${triggers.join(', ')}] source=${source}`,
      )
    }
  }

  cachedIndex = entries
  cachedCwd = cwd
  logForDebugging(
    `[skill-search] indexed ${entries.length} skills from ${commands.length} commands ` +
      `(skipped: non-prompt=${skippedNonPrompt}, disabled=${skippedDisabled}, ` +
      `builtin=${skippedBuiltin}, not-real-skill=${skippedNotRealSkill}; ` +
      `trigger-bearing=${entries.filter(e => e.triggers.length > 0).length})`,
  )
  return entries
}

/**
 * Match the message against the trigger index. Explicit `triggers:` are checked
 * before the implicit name trigger. Returns every skill that fires (a skill is
 * reported once, even if several of its triggers match), ordered so that
 * keyword matches precede name-only matches.
 */
export function matchSkillTriggers(
  message: string,
  index: SkillTriggerEntry[],
): TriggerMatchResult[] {
  const trimmed = message?.trim()
  if (!trimmed || index.length === 0) return []

  const messageLower = trimmed.toLowerCase()
  const results: TriggerMatchResult[] = []

  for (const entry of index) {
    let matchedTrigger: string | undefined
    let matchType: 'keyword' | 'name' = 'keyword'

    for (const trigger of entry.triggers) {
      if (keywordMatches(trigger, messageLower)) {
        matchedTrigger = trigger
        break
      }
    }

    if (matchedTrigger === undefined && entry.normalizedName.includes(' ')) {
      // Whole-phrase name match for multi-word (hyphenated) names, e.g.
      // "code review" -> code-review. Single-word names are deliberately NOT
      // used as implicit triggers: generic names like `architecture` or
      // `development` would otherwise fire on ordinary prose. Authors who want
      // a single word to match must declare it in `triggers:`.
      if (keywordMatches(entry.normalizedName, messageLower)) {
        matchedTrigger = entry.normalizedName
        matchType = 'name'
      }
    }

    if (matchedTrigger === undefined) continue

    logForDebugging(
      `[skill-search] match: ${entry.name} via ${matchType} "${matchedTrigger}"`,
    )

    results.push({
      name: entry.name,
      description: entry.description,
      trigger: matchedTrigger,
      matchType,
      score: matchType === 'keyword' ? 1 : 0.9,
      source: entry.source,
      loadedFrom: entry.loadedFrom,
      skillRoot: entry.skillRoot,
      contentLength: entry.contentLength,
    })
  }

  results.sort((a, b) => {
    if (a.matchType !== b.matchType) return a.matchType === 'keyword' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  logForDebugging(
    `[skill-search] matched ${results.length}/${index.length} skills for "${trimmed.slice(0, 120)}": ` +
      (results.length > 0
        ? results.map(r => `${r.name}(${r.matchType}:${r.trigger})`).join(', ')
        : '(none)'),
  )

  return results
}

/** Reset caches between tests. */
export function __resetTriggerIndexForTest(): void {
  cachedIndex = null
  cachedCwd = null
}
