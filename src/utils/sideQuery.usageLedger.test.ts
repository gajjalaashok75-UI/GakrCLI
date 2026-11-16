/**
 * Verifies that `sideQuery` records its request in the local usage ledger used
 * by `/usage`. Side queries bypass the session cost tracker, so without this
 * hook classifier and session-search calls would be invisible in the Local view.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

const envKeys = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'GAKR_CONFIG_DIR',
  'GAKR_FEATURE_FLAGS_FILE',
] as const
const originalEnv = { ...process.env }
const originalFetch = globalThis.fetch
const hadSavedMacro = Object.hasOwn(globalThis, 'MACRO')
const savedMacro = (globalThis as Record<string, unknown>).MACRO
let configRoot: string | undefined

function makeMessageResponse(): Response {
  return new Response(
    JSON.stringify({
      id: 'msg-side-ledger-test',
      type: 'message',
      role: 'assistant',
      model: 'gakr-side-ledger-test',
      content: [],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    }),
    {
      headers: {
        'content-type': 'application/json',
        'request-id': 'req-side-ledger-test',
      },
    },
  )
}

beforeEach(async () => {
  await acquireSharedMutationLock('sideQuery.usageLedger.test.ts')
  // Isolate settings and config so credentials resolve from the test env alone
  // instead of whatever the developer's real settings/config home contains.
  const { setAllowedSettingSources, setFlagSettingsInline, setFlagSettingsPath } =
    await import('../bootstrap/state.js')
  const { resetSettingsCache } = await import('./settings/settingsCache.js')
  const { SETTING_SOURCES } = await import('./settings/constants.js')
  const { resetGrowthBook } = await import('../services/analytics/growthbook.js')
  const { getGakrCLIAIOAuthTokens } = await import('./auth.js')
  setFlagSettingsPath(undefined)
  setFlagSettingsInline(null)
  setAllowedSettingSources([...SETTING_SOURCES])
  resetSettingsCache()
  configRoot = mkdtempSync(join(tmpdir(), 'side-query-ledger-'))
  for (const key of envKeys) delete process.env[key]
  process.env.ANTHROPIC_API_KEY = 'sk-test-side-query'
  process.env.GAKR_CONFIG_DIR = configRoot
  process.env.GAKR_FEATURE_FLAGS_FILE = join(configRoot, 'feature-flags.json')
  ;(globalThis as Record<string, unknown>).MACRO = {
    VERSION: '0.0.0-test',
    DISPLAY_VERSION: '0.0.0-test',
    BUILD_TIME: 'test',
    ISSUES_EXPLAINER: 'test',
    PACKAGE_URL: 'test',
    NATIVE_PACKAGE_URL: undefined,
  }
  getGakrCLIAIOAuthTokens.cache?.clear?.()
  resetGrowthBook()
})

afterEach(() => {
  try {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
    globalThis.fetch = originalFetch
    if (configRoot) {
      rmSync(configRoot, { recursive: true, force: true })
      configRoot = undefined
    }
    if (hadSavedMacro) {
      ;(globalThis as Record<string, unknown>).MACRO = savedMacro
    } else {
      delete (globalThis as Record<string, unknown>).MACRO
    }
  } finally {
    releaseSharedMutationLock()
  }
})

describe('sideQuery local usage ledger', () => {
  // The subject pulls in the full API client graph, so the first dynamic import
  // dominates the run time on cold caches.
  test('records the side query with its source and token counts', async () => {
    const { getRecordedUsageEvents, resetUsageLedgerForTesting } = await import(
      '../services/usage/ledger.js'
    )
    const { sideQuery } = await import('./sideQuery.js')
    resetUsageLedgerForTesting()
    globalThis.fetch = (async () =>
      makeMessageResponse()) as unknown as typeof fetch
    try {
      await sideQuery({
        querySource: 'model_validation',
        model: 'gakr-side-ledger-test',
        system: 'stable side prompt',
        messages: [{ role: 'user', content: 'hello' }],
      })

      const recorded = getRecordedUsageEvents()
      expect(recorded).toHaveLength(1)
      expect(recorded[0]).toMatchObject({
        model: 'gakr-side-ledger-test',
        route: 'anthropic',
        source: 'model_validation',
        input: 1,
        output: 1,
      })
    } finally {
      resetUsageLedgerForTesting()
    }
  }, 30_000)
})
