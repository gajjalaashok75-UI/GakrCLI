import { afterEach, expect, mock, test } from 'bun:test'
import * as originalSettings from './settings/settings.js'

type MockSource =
  | 'userSettings'
  | 'projectSettings'
  | 'repositorySettings'
  | 'localSettings'
  | 'flagSettings'
  | 'policySettings'
  | 'none'

async function importAuthFresh() {
  return await import(`./auth.js?ts=${Date.now()}-${Math.random()}`)
}

// Restore Bun's module mocks after each test so leaked settings behavior
// cannot influence later auth/settings tests in the same process.
// Addresses jatmn's P3 on #1731: test isolation for mock.module().
afterEach(() => {
  mock.restore()
})

// Helper: mock settings to return the given subscriptionType from a specific
// source (or no source at all). The trusted-source helper in auth.ts reads
// from user settings only — project, local, flag, and policy settings must
// NOT propagate subscriptionType.
function mockSettings(
  subscriptionType: string | undefined,
  source: MockSource = 'userSettings',
) {
  mock.module('./settings/settings.js', () => ({
    ...originalSettings,
    getSettings_DEPRECATED: () => (source === 'none' ? {} : { subscriptionType }),
    getSettingsForSource: (s: string) => {
      if (source === 'none') return null
      return s === source ? { subscriptionType } : null
    },
  }))
}

async function withControlledAuthEnv<T>(
  fn: () => Promise<T>,
  options: { oauthToken?: string } = {},
): Promise<T> {
  const previous = {
    GAKR_CODE_OAUTH_TOKEN: process.env.GAKR_CODE_OAUTH_TOKEN,
    GAKR_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR:
      process.env.GAKR_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR,
    ANTHROPIC_UNIX_SOCKET: process.env.ANTHROPIC_UNIX_SOCKET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
    GAKR_CODE_API_KEY_FILE_DESCRIPTOR:
      process.env.GAKR_CODE_API_KEY_FILE_DESCRIPTOR,
    GAKR_CODE_USE_BEDROCK: process.env.GAKR_CODE_USE_BEDROCK,
    GAKR_CODE_USE_VERTEX: process.env.GAKR_CODE_USE_VERTEX,
    GAKR_CODE_USE_FOUNDRY: process.env.GAKR_CODE_USE_FOUNDRY,
    GAKR_CODE_USE_OPENAI: process.env.GAKR_CODE_USE_OPENAI,
    GAKR_CODE_USE_GEMINI: process.env.GAKR_CODE_USE_GEMINI,
    GAKR_CODE_USE_MISTRAL: process.env.GAKR_CODE_USE_MISTRAL,
    GAKR_CODE_USE_GITHUB: process.env.GAKR_CODE_USE_GITHUB,
  }
  if (options.oauthToken) {
    process.env.GAKR_CODE_OAUTH_TOKEN = options.oauthToken
  } else {
    delete process.env.GAKR_CODE_OAUTH_TOKEN
  }
  delete process.env.GAKR_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR
  delete process.env.ANTHROPIC_UNIX_SOCKET
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_AUTH_TOKEN
  delete process.env.GAKR_CODE_API_KEY_FILE_DESCRIPTOR
  delete process.env.GAKR_CODE_USE_BEDROCK
  delete process.env.GAKR_CODE_USE_VERTEX
  delete process.env.GAKR_CODE_USE_FOUNDRY
  delete process.env.GAKR_CODE_USE_OPENAI
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GAKR_CODE_USE_MISTRAL
  delete process.env.GAKR_CODE_USE_GITHUB
  try {
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

async function withOAuthFallbackEnv<T>(fn: () => Promise<T>): Promise<T> {
  return withControlledAuthEnv(fn, { oauthToken: 'test-oauth-token' })
}

test('isGakrCLIAISubscriber returns true if subscriptionType is pro in user settings', async () => {
  mockSettings('pro', 'userSettings')
  const { isGakrCLIAISubscriber, getSubscriptionType } = await importAuthFresh()
  expect(isGakrCLIAISubscriber()).toBe(true)
  expect(getSubscriptionType()).toBe('pro')
})

test('isGakrCLIAISubscriber returns false if subscriptionType is free in user settings', async () => {
  mockSettings('free', 'userSettings')
  const { isGakrCLIAISubscriber, getSubscriptionType } = await importAuthFresh()
  expect(isGakrCLIAISubscriber()).toBe(false)
  expect(getSubscriptionType()).toBe('free')
})

test('isGakrCLIAISubscriber returns true for OAuth fallback without a free override', async () => {
  mockSettings(undefined, 'none')
  await withOAuthFallbackEnv(async () => {
    const { isGakrCLIAISubscriber } = await importAuthFresh()
    expect(isGakrCLIAISubscriber()).toBe(true)
  })
})

// P2 regression: subscriptionType: "free" must short-circuit the OAuth path.
// Prior code only short-circuited non-free values, so free + valid OAuth
// returned true (the OAuth-detected subscriber state leaked through). This
// test sets a fake GakrCLI AI OAuth token that WOULD satisfy the OAuth path,
// then asserts the free override wins.
test('isGakrCLIAISubscriber returns false for free override even when OAuth tokens would qualify', async () => {
  mockSettings('free', 'userSettings')
  await withOAuthFallbackEnv(async () => {
    const { isGakrCLIAISubscriber } = await importAuthFresh()
    expect(isGakrCLIAISubscriber()).toBe(false)
  })
})

for (const source of [
  'projectSettings',
  'repositorySettings',
  'localSettings',
  'flagSettings',
  'policySettings',
] as const) {
  test(`isGakrCLIAISubscriber ignores subscriptionType from ${source}`, async () => {
    mockSettings('pro', source)
    await withControlledAuthEnv(async () => {
      const { isGakrCLIAISubscriber, getSubscriptionType } = await importAuthFresh()
      expect(getSubscriptionType()).toBe(null)
      expect(isGakrCLIAISubscriber()).toBe(false)
    })
  })
}

// P2/P3 regression: when subscriptionType is 'free', isGakrCLIAISubscriber() returns false
// even if fallback auth conditions (OAuth/environment) are satisfied, and getSubscriptionType() returns 'free'.
test("when subscriptionType is 'free', isGakrCLIAISubscriber() returns false even if fallback auth conditions are satisfied, and getSubscriptionType() returns 'free'", async () => {
  mockSettings('free', 'userSettings')
  await withOAuthFallbackEnv(async () => {
    const { isGakrCLIAISubscriber, getSubscriptionType } = await importAuthFresh()
    expect(isGakrCLIAISubscriber()).toBe(false)
    expect(getSubscriptionType()).toBe('free')
  })
})
