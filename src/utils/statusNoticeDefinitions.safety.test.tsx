import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'
import type { StatusNoticeContext } from './statusNoticeDefinitions.js'

// Regression coverage for issue #244 — the two safety-related status notices
// that warn 3P users when they are running without the AI classifier or with
// `--dangerously-skip-permissions` outside a sandbox.

// Empty baseline context (no large-memory/agent-description triggers).
function buildContext(
  overrides?: Partial<StatusNoticeContext>,
): StatusNoticeContext {
  return {
    config: {} as StatusNoticeContext['config'],
    memoryFiles: [],
    ...overrides,
  }
}

function activeIds(ctx: StatusNoticeContext): string[] {
  return getActiveNotices(ctx).map(n => n.id)
}

const SAVED_ARGV = process.argv
const SAVED_ENV = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GAKR_CODE_USE_OPENAI: process.env.GAKR_CODE_USE_OPENAI,
  GAKR_CODE_USE_GEMINI: process.env.GAKR_CODE_USE_GEMINI,
  GAKR_CODE_USE_GITHUB: process.env.GAKR_CODE_USE_GITHUB,
  GAKR_CODE_USE_MISTRAL: process.env.GAKR_CODE_USE_MISTRAL,
  GAKR_CODE_USE_BEDROCK: process.env.GAKR_CODE_USE_BEDROCK,
  GAKR_CODE_USE_VERTEX: process.env.GAKR_CODE_USE_VERTEX,
  GAKR_CODE_USE_FOUNDRY: process.env.GAKR_CODE_USE_FOUNDRY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GH_TOKEN: process.env.GH_TOKEN,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
  VENICE_API_KEY: process.env.VENICE_API_KEY,
  MIMO_API_KEY: process.env.MIMO_API_KEY,
  NVIDIA_NIM: process.env.NVIDIA_NIM,
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
}
let lockAcquired = false
let getActiveNotices: typeof import('./statusNoticeDefinitions.js')['getActiveNotices']

function getTestAPIProvider(): string {
  if (process.env.GAKR_CODE_USE_GITHUB === '1') return 'github'
  if (process.env.GAKR_CODE_USE_GEMINI === '1') return 'gemini'
  if (process.env.GAKR_CODE_USE_MISTRAL === '1') return 'mistral'
  if (process.env.GAKR_CODE_USE_BEDROCK === '1') return 'bedrock'
  if (process.env.GAKR_CODE_USE_VERTEX === '1') return 'vertex'
  if (process.env.GAKR_CODE_USE_FOUNDRY === '1') return 'foundry'
  if (process.env.GAKR_CODE_USE_OPENAI === '1') return 'openai'
  if (process.env.XAI_API_KEY) return 'xai'
  if (process.env.MINIMAX_API_KEY) return 'minimax'
  if (process.env.MIMO_API_KEY) return 'xiaomi-mimo'
  return 'firstParty'
}

function isFirstPartyAnthropicBaseUrl(): boolean {
  return true
}

function isGithubNativeAnthropicMode(): boolean {
  return false
}

function setThirdPartyProvider(model: string): void {
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_API_KEY = 'sk-openai-test'
  process.env.OPENAI_MODEL = model
}

function setFirstPartyProvider(): void {
  delete process.env.GAKR_CODE_USE_OPENAI
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
}

beforeEach(async () => {
  await acquireSharedMutationLock('utils/statusNoticeDefinitions.safety.test.tsx')
  lockAcquired = true
  mock.restore()
  mock.module('./model/providers.js', () => ({
    getAPIProvider: getTestAPIProvider,
    getAPIProviderForStatsig: getTestAPIProvider,
    isFirstPartyAnthropicBaseUrl,
    isGithubNativeAnthropicMode,
    usesAnthropicAccountFlow: () => getTestAPIProvider() === 'firstParty',
    usesGakrcliHostedAuthFlow: () => getTestAPIProvider() === 'firstParty',
  }))
  getActiveNotices = (await import(
    `./statusNoticeDefinitions.js?status-safety=${Date.now()}-${Math.random()}`
  )).getActiveNotices
  // Reset argv each test so the dangerously-skip-permissions detector starts
  // from a known baseline.
  process.argv = [...SAVED_ARGV.filter(a => a !== '--dangerously-skip-permissions')]
  // Other status notices read auth state via getAnthropicApiKeyWithSource,
  // which throws when no key/token is present. Seed a dummy so getActiveNotices
  // can iterate every notice without unrelated failures crashing the test.
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'sk-test-dummy'
  for (const key of Object.keys(SAVED_ENV)) {
    if (key !== 'ANTHROPIC_API_KEY') {
      delete process.env[key]
    }
  }
})

afterEach(() => {
  try {
    process.argv = SAVED_ARGV
    for (const [key, value] of Object.entries(SAVED_ENV)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  } finally {
    mock.restore()
    if (lockAcquired) {
      releaseSharedMutationLock()
      lockAcquired = false
    }
  }
})

describe('third-party permissive mode notice (#244 finding 1)', () => {
  test('fires when 3P + acceptEdits + classifier-off model', () => {
    setThirdPartyProvider('gpt-5.4')
    const ctx = buildContext({ permissionMode: 'acceptEdits', mainLoopModel: 'gpt-5.4' })
    const ids = activeIds(ctx)
    expect(ids).toContain('third-party-permissive-mode')
  })

  test('fires when 3P + bypassPermissions', () => {
    setThirdPartyProvider('llama3.1')
    const ctx = buildContext({ permissionMode: 'bypassPermissions', mainLoopModel: 'llama3.1' })
    const ids = activeIds(ctx)
    expect(ids).toContain('third-party-permissive-mode')
  })

  test('suppressed in default mode even on 3P', () => {
    setThirdPartyProvider('gpt-5.4')
    const ctx = buildContext({ permissionMode: 'default', mainLoopModel: 'gpt-5.4' })
    const ids = activeIds(ctx)
    expect(ids).not.toContain('third-party-permissive-mode')
  })

  test('suppressed on firstParty Anthropic in acceptEdits', () => {
    setFirstPartyProvider()
    const ctx = buildContext({ permissionMode: 'acceptEdits', mainLoopModel: 'claude-opus-4-7' })
    const ids = activeIds(ctx)
    expect(ids).not.toContain('third-party-permissive-mode')
  })
})

describe('dangerously-skip-permissions sandbox notice (#244 finding 2)', () => {
  test('fires when --dangerously-skip-permissions is in argv', () => {
    process.argv = [...process.argv, '--dangerously-skip-permissions']
    expect(activeIds(buildContext())).toContain('dangerously-skip-permissions-no-sandbox')
  })

  test('fires when permission mode is bypassPermissions (e.g. settings defaultMode)', () => {
    expect(activeIds(buildContext({ permissionMode: 'bypassPermissions' }))).toContain(
      'dangerously-skip-permissions-no-sandbox',
    )
  })

  test('does not fire in default mode without the flag', () => {
    expect(activeIds(buildContext({ permissionMode: 'default' }))).not.toContain(
      'dangerously-skip-permissions-no-sandbox',
    )
  })
})
