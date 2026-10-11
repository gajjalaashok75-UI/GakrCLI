import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearCommandsCache } from '../../../commands.js'
import {
  __resetPrefetchSessionForTest,
  getTurnZeroSkillDiscovery,
} from '../prefetch.js'
import { clearSkillIndexCache } from '../localSearch.js'
import {
  __resetTriggerIndexForTest,
  keywordMatches,
  matchSkillTriggers,
  normalizeSkillName,
  type SkillTriggerEntry,
} from '../triggerMatch.js'

// Every test rebuilds the full command index against a fresh temp skill
// directory. The first cold build loads the whole command/skill module graph
// and costs >1s on a warm machine, so the 5s default is too tight under load.
setDefaultTimeout(20_000)

let root: string
let previousCwd: string
const originalEnv = { ...process.env }

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'skill-search-prefetch-'))
  previousCwd = process.cwd()
  process.chdir(root)
  process.env = { ...originalEnv }
  process.env.GAKR_CONFIG_DIR = join(root, 'config')
  process.env.GAKR_SKILL_LEARNING_HOME = join(root, 'learning')
  process.env.SKILL_SEARCH_ENABLED = '1'
  process.env.SKILL_LEARNING_ENABLED = '1'
  process.env.NODE_ENV = 'test'
  process.env.ANTHROPIC_API_KEY = 'test-key'
  clearCommandsCache()
  clearSkillIndexCache()
  __resetTriggerIndexForTest()
  __resetPrefetchSessionForTest()
})

afterEach(() => {
  process.chdir(previousCwd)
  process.env = { ...originalEnv }
  clearCommandsCache()
  clearSkillIndexCache()
  __resetTriggerIndexForTest()
  __resetPrefetchSessionForTest()
  try {
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    })
  } catch {
    // Windows can keep transient handles after dynamic command loading.
  }
})

function writeSkill(dir: string, body: string[]): string {
  const skillDir = join(root, '.gakrcli', 'skills', dir)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'SKILL.md'), body.join('\n'))
  return skillDir
}

describe('keywordMatches — OpenHands whole-token semantics', () => {
  test('matches a whole word', () => {
    expect(keywordMatches('git', 'please use git here')).toBe(true)
  })

  test('does not match a substring (git != github)', () => {
    expect(keywordMatches('git', 'push to github')).toBe(false)
  })

  test('matches at string boundaries', () => {
    expect(keywordMatches('deploy', 'deploy now')).toBe(true)
    expect(keywordMatches('deploy', 'redeploy now')).toBe(false)
  })

  test('slash-prefixed keywords match', () => {
    expect(keywordMatches('/linear', 'open /linear issue')).toBe(true)
  })

  test('case-insensitive', () => {
    expect(keywordMatches('Deploy', 'DEPLOY the app')).toBe(true)
  })

  test('empty keyword never matches', () => {
    expect(keywordMatches('  ', 'anything')).toBe(false)
  })
})

describe('matchSkillTriggers — deterministic matching', () => {
  function entry(overrides: Partial<SkillTriggerEntry>): SkillTriggerEntry {
    const name = overrides.name ?? 'test-skill'
    return {
      name,
      normalizedName: overrides.normalizedName ?? normalizeSkillName(name),
      description: overrides.description ?? '',
      triggers: overrides.triggers ?? [],
      source: overrides.source ?? 'project',
      loadedFrom: overrides.loadedFrom ?? 'skills',
      skillRoot: overrides.skillRoot,
      contentLength: overrides.contentLength,
    }
  }

  test('keyword trigger fires on whole token only', () => {
    const index = [entry({ name: 'git-helper', triggers: ['git'] })]
    expect(matchSkillTriggers('run git status', index)).toHaveLength(1)
    expect(matchSkillTriggers('browse github', index)).toHaveLength(0)
  })

  test('name acts as an implicit trigger (hyphenated name)', () => {
    const index = [entry({ name: 'code-review' })]
    const results = matchSkillTriggers('please do a code review now', index)
    expect(results).toHaveLength(1)
    expect(results[0]?.matchType).toBe('name')
  })

  test('short names do not match everything', () => {
    const index = [entry({ name: 'go' })]
    expect(matchSkillTriggers('go to the store', index)).toHaveLength(0)
  })

  test('single-word generic names do not act as implicit triggers', () => {
    const index = [
      entry({ name: 'architecture' }),
      entry({ name: 'development' }),
      entry({ name: 'surprise-me' }),
    ]
    // "architecture"/"development" are ordinary prose words; only the
    // multi-word hyphenated name is allowed to match implicitly.
    const results = matchSkillTriggers(
      'explain the architecture of the development server',
      index,
    )
    expect(results.map(r => r.name)).toEqual([])
  })

  test('multi-word hyphenated name is an implicit trigger', () => {
    const index = [entry({ name: 'code-review' })]
    const results = matchSkillTriggers('please do a code review', index)
    expect(results.map(r => r.name)).toEqual(['code-review'])
    expect(results[0]?.matchType).toBe('name')
  })

  test('explicit keyword matches outrank name matches', () => {
    const index = [
      entry({ name: 'code-review' }),
      entry({ name: 'audit', triggers: ['review'] }),
    ]
    const results = matchSkillTriggers('review the code', index)
    expect(results[0]?.name).toBe('audit')
    expect(results[0]?.matchType).toBe('keyword')
  })

  test('a skill is reported once even if several triggers match', () => {
    const index = [entry({ name: 'deploy', triggers: ['deploy', 'ship'] })]
    expect(matchSkillTriggers('deploy and ship it', index)).toHaveLength(1)
  })

  test('no matches returns empty', () => {
    const index = [entry({ name: 'code-review', triggers: ['review'] })]
    expect(matchSkillTriggers('write a poem', index)).toHaveLength(0)
  })
})

describe('skill search prefetch — trigger matching', () => {
  test('clearSkillIndexCache also drops the trigger index', async () => {
    // Discovery callers invalidate through clearSkillIndexCache (that is what
    // clearCommandsCache invokes, and what MCP/learned-skill paths call) and
    // expect the next pass to rebuild. It must drop the trigger index too, or
    // a stale index is served for the rest of the session.
    const { getSkillTriggerIndex } = await import('../triggerMatch.js')
    writeSkill('cache-probe', [
      '---',
      'name: cache-probe',
      'description: Probe skill for cache invalidation',
      'triggers: probe',
      '---',
      '',
      '# Probe',
    ])

    const before = await getSkillTriggerIndex(root)
    expect(before.some(e => e.name === 'cache-probe')).toBe(true)
    expect(await getSkillTriggerIndex(root)).toBe(before)

    clearSkillIndexCache()
    const after = await getSkillTriggerIndex(root)

    expect(after).not.toBe(before)
    expect(after.some(e => e.name === 'cache-probe')).toBe(true)
  })

  test('index excludes builtin CLI commands (pollution regression)', async () => {
    const { getSkillTriggerIndex } = await import('../triggerMatch.js')
    const index = await getSkillTriggerIndex(root)
    const builtins = ['review', 'commit', 'init', 'insights']
    for (const builtin of builtins) {
      expect(
        index.some(e => e.name === builtin && e.source === 'builtin'),
      ).toBe(false)
    }
  })

  test('normal mode surfaces matching skill without injecting content', async () => {
    process.env.SKILL_SEARCH_MODE = 'normal'
    writeSkill('feature-audit', [
      '---',
      'name: feature-audit',
      'description: Audit feature flags and classify minimal implementations',
      'triggers: audit, feature flags',
      '---',
      '',
      '# Feature Audit',
      '',
      'Use the feature flag audit workflow.',
    ])

    const attachment = await getTurnZeroSkillDiscovery(
      'audit feature flags for minimal implementation stubs',
      [],
      { agentId: undefined } as any,
    )

    expect(attachment?.type).toBe('skill_discovery')
    if (attachment?.type !== 'skill_discovery') {
      throw new Error('expected skill_discovery attachment')
    }
    expect(attachment.skills[0]?.name).toBe('feature-audit')
    expect(attachment.skills[0]?.autoLoaded).toBeUndefined()
    expect(attachment.skills[0]?.content).toBeUndefined()
  })

  test('hybrid mode auto-injects matching skill content', async () => {
    process.env.SKILL_SEARCH_MODE = 'hybrid'
    writeSkill('feature-audit', [
      '---',
      'name: feature-audit',
      'description: Audit feature flags and classify minimal implementations',
      'triggers: audit',
      '---',
      '',
      '# Feature Audit',
      '',
      'Use the feature flag audit workflow and classify flags as stub, shell, MVP, or thin-toggle.',
    ])

    const attachment = await getTurnZeroSkillDiscovery(
      'audit the codebase',
      [],
      { agentId: undefined } as any,
    )

    expect(attachment?.type).toBe('skill_discovery')
    if (attachment?.type !== 'skill_discovery') {
      throw new Error('expected skill_discovery attachment')
    }
    expect(attachment.skills[0]?.name).toBe('feature-audit')
    expect(attachment.skills[0]?.autoLoaded).toBe(true)
    expect(attachment.skills[0]?.content).toContain(
      'feature flag audit workflow',
    )
  })

  test('normal mode does not match an irrelevant prompt (no TF-IDF noise)', async () => {
    process.env.SKILL_SEARCH_MODE = 'normal'
    writeSkill('feature-audit', [
      '---',
      'name: feature-audit',
      'description: Audit feature flags and classify minimal implementations',
      'triggers: audit',
      '---',
      '',
      '# Feature Audit',
    ])

    const attachment = await getTurnZeroSkillDiscovery(
      'write a haiku about the ocean',
      [],
      { agentId: undefined } as any,
    )

    // No trigger match: the only attachment should be a (learning) gap, not a
    // spurious skill suggestion.
    if (attachment?.type === 'skill_discovery') {
      expect(attachment.skills).toHaveLength(0)
    }
  })

  test('records a pending skill gap on the first unmatched prompt (no draft file yet)', async () => {
    process.env.SKILL_SEARCH_MODE = 'normal'
    const attachment = await getTurnZeroSkillDiscovery(
      'frobnicate zephyr ledger workflow',
      [],
      { agentId: undefined } as any,
    )

    expect(attachment?.type).toBe('skill_discovery')
    if (attachment?.type !== 'skill_discovery') {
      throw new Error('expected skill_discovery attachment')
    }
    expect(attachment.skills).toEqual([])
    expect(attachment.gap?.status).toBe('pending')
    expect(attachment.gap?.draftPath).toBeUndefined()
  })
})
