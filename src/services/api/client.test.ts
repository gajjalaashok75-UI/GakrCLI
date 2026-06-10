import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

type FetchType = typeof globalThis.fetch

type ShimClient = {
  beta: {
    messages: {
      create: (params: Record<string, unknown>) => Promise<unknown>
    }
  }
}

const originalFetch = globalThis.fetch
const originalMacro = (globalThis as Record<string, unknown>).MACRO
const originalEnv = {
  GAKR_CODE_USE_OPENAI: process.env.GAKR_CODE_USE_OPENAI,
  GAKR_CODE_USE_BEDROCK: process.env.GAKR_CODE_USE_BEDROCK,
  GAKR_CODE_SKIP_BEDROCK_AUTH: process.env.GAKR_CODE_SKIP_BEDROCK_AUTH,
  GAKR_CODE_USE_VERTEX: process.env.GAKR_CODE_USE_VERTEX,
  GAKR_CODE_USE_FOUNDRY: process.env.GAKR_CODE_USE_FOUNDRY,
  GAKR_CODE_USE_GEMINI: process.env.GAKR_CODE_USE_GEMINI,
  GAKR_CODE_USE_GITHUB: process.env.GAKR_CODE_USE_GITHUB,
  GAKR_CODE_USE_MISTRAL: process.env.GAKR_CODE_USE_MISTRAL,
  GAKR_CODE_USE_NVIDIA: process.env.GAKR_CODE_USE_NVIDIA,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GH_TOKEN: process.env.GH_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_BASE_URL: process.env.GEMINI_BASE_URL,
  GEMINI_AUTH_MODE: process.env.GEMINI_AUTH_MODE,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  OPENAI_API_FORMAT: process.env.OPENAI_API_FORMAT,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
  VENICE_API_KEY: process.env.VENICE_API_KEY,
  MIMO_API_KEY: process.env.MIMO_API_KEY,
  NVIDIA_NIM: process.env.NVIDIA_NIM,
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
  NVIDIA_BASE_URL: process.env.NVIDIA_BASE_URL,
  NVIDIA_MODEL: process.env.NVIDIA_MODEL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  ANTHROPIC_CUSTOM_HEADERS: process.env.ANTHROPIC_CUSTOM_HEADERS,
}
let getAnthropicClient: typeof import('./client.js')['getAnthropicClient']

function getTestAPIProvider(): string {
  if (process.env.GAKR_CODE_USE_GEMINI === '1') return 'gemini'
  if (process.env.GAKR_CODE_USE_MISTRAL === '1') return 'mistral'
  if (process.env.GAKR_CODE_USE_GITHUB === '1') return 'github'
  if (process.env.GAKR_CODE_USE_BEDROCK === '1') return 'bedrock'
  if (process.env.GAKR_CODE_USE_VERTEX === '1') return 'vertex'
  if (process.env.GAKR_CODE_USE_FOUNDRY === '1') return 'foundry'
  if (process.env.NVIDIA_NIM === '1') return 'nvidia-nim'
  if (process.env.XAI_API_KEY) return 'xai'
  if (process.env.MINIMAX_API_KEY) return 'minimax'
  if (process.env.MIMO_API_KEY) return 'xiaomi-mimo'
  if (process.env.GAKR_CODE_USE_OPENAI === '1') return 'openai'
  return 'firstParty'
}

function isGithubNativeAnthropicMode(resolvedModel?: string): boolean {
  if (process.env.GAKR_CODE_USE_GITHUB !== '1') return false
  const model = resolvedModel?.trim() || process.env.OPENAI_MODEL?.trim() || ''
  return model.toLowerCase().includes('claude-')
}

function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) return true
  try {
    return new URL(baseUrl).hostname === 'api.anthropic.com'
  } catch {
    return false
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

function clearEnvForMiniMaxOnlyTest(): void {
  delete process.env.GAKR_CODE_USE_OPENAI
  delete process.env.GAKR_CODE_USE_BEDROCK
  delete process.env.GAKR_CODE_SKIP_BEDROCK_AUTH
  delete process.env.GAKR_CODE_USE_VERTEX
  delete process.env.GAKR_CODE_USE_FOUNDRY
  delete process.env.GAKR_CODE_USE_GITHUB
  delete process.env.GAKR_CODE_USE_MISTRAL
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED
  delete process.env.GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  delete process.env.GOOGLE_API_KEY
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_BASE_URL
  delete process.env.OPENAI_API_BASE
  delete process.env.OPENAI_MODEL
  delete process.env.XAI_API_KEY
  delete process.env.NVIDIA_NIM
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_AUTH_TOKEN
  delete process.env.ANTHROPIC_BASE_URL
  delete process.env.ANTHROPIC_MODEL
  delete process.env.ANTHROPIC_CUSTOM_HEADERS
}

beforeEach(async () => {
  await acquireSharedMutationLock('client.test.ts')
  mock.restore()
  mock.module('src/utils/model/providers.js', () => ({
    getAPIProvider: getTestAPIProvider,
    getAPIProviderForStatsig: getTestAPIProvider,
    isGithubNativeAnthropicMode,
    isFirstPartyAnthropicBaseUrl,
    usesAnthropicAccountFlow: () => getTestAPIProvider() === 'firstParty',
    usesGakrcliHostedAuthFlow: () => getTestAPIProvider() === 'firstParty',
  }))
  getAnthropicClient = (await import(
    `./client.js?client-test=${Date.now()}-${Math.random()}`
  )).getAnthropicClient
  ;(globalThis as Record<string, unknown>).MACRO = { VERSION: 'test-version' }
  process.env.GAKR_CODE_USE_GEMINI = '1'
  process.env.GEMINI_API_KEY = 'gemini-test-key'
  process.env.GEMINI_MODEL = 'gemini-2.0-flash'
  process.env.GEMINI_BASE_URL = 'https://gemini.example/v1beta/openai'
  process.env.GEMINI_AUTH_MODE = 'api-key'

  delete process.env.GAKR_CODE_USE_OPENAI
  delete process.env.GAKR_CODE_USE_BEDROCK
  delete process.env.GAKR_CODE_SKIP_BEDROCK_AUTH
  delete process.env.GAKR_CODE_USE_VERTEX
  delete process.env.GAKR_CODE_USE_FOUNDRY
  delete process.env.GAKR_CODE_USE_GITHUB
  delete process.env.GAKR_CODE_USE_MISTRAL
  delete process.env.GAKR_CODE_USE_NVIDIA
  delete process.env.GITHUB_TOKEN
  delete process.env.GH_TOKEN
  delete process.env.GOOGLE_API_KEY
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_BASE_URL
  delete process.env.OPENAI_API_BASE
  delete process.env.OPENAI_API_FORMAT
  delete process.env.OPENAI_MODEL
  delete process.env.MINIMAX_API_KEY
  delete process.env.XAI_API_KEY
  delete process.env.VENICE_API_KEY
  delete process.env.MIMO_API_KEY
  delete process.env.NVIDIA_NIM
  delete process.env.NVIDIA_API_KEY
  delete process.env.NVIDIA_BASE_URL
  delete process.env.NVIDIA_MODEL
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_AUTH_TOKEN
  delete process.env.ANTHROPIC_CUSTOM_HEADERS
})

afterEach(() => {
  try {
    ;(globalThis as Record<string, unknown>).MACRO = originalMacro
    restoreEnv('GAKR_CODE_USE_OPENAI', originalEnv.GAKR_CODE_USE_OPENAI)
    restoreEnv('GAKR_CODE_USE_BEDROCK', originalEnv.GAKR_CODE_USE_BEDROCK)
    restoreEnv(
      'GAKR_CODE_SKIP_BEDROCK_AUTH',
      originalEnv.GAKR_CODE_SKIP_BEDROCK_AUTH,
    )
    restoreEnv('GAKR_CODE_USE_VERTEX', originalEnv.GAKR_CODE_USE_VERTEX)
    restoreEnv('GAKR_CODE_USE_FOUNDRY', originalEnv.GAKR_CODE_USE_FOUNDRY)
    restoreEnv('GAKR_CODE_USE_GEMINI', originalEnv.GAKR_CODE_USE_GEMINI)
    restoreEnv('GAKR_CODE_USE_GITHUB', originalEnv.GAKR_CODE_USE_GITHUB)
    restoreEnv('GAKR_CODE_USE_MISTRAL', originalEnv.GAKR_CODE_USE_MISTRAL)
    restoreEnv('GAKR_CODE_USE_NVIDIA', originalEnv.GAKR_CODE_USE_NVIDIA)
    restoreEnv('GITHUB_TOKEN', originalEnv.GITHUB_TOKEN)
    restoreEnv('GH_TOKEN', originalEnv.GH_TOKEN)
    restoreEnv('GEMINI_API_KEY', originalEnv.GEMINI_API_KEY)
    restoreEnv('GEMINI_MODEL', originalEnv.GEMINI_MODEL)
    restoreEnv('GEMINI_BASE_URL', originalEnv.GEMINI_BASE_URL)
    restoreEnv('GEMINI_AUTH_MODE', originalEnv.GEMINI_AUTH_MODE)
    restoreEnv('GOOGLE_API_KEY', originalEnv.GOOGLE_API_KEY)
    restoreEnv('OPENAI_API_KEY', originalEnv.OPENAI_API_KEY)
    restoreEnv('OPENAI_BASE_URL', originalEnv.OPENAI_BASE_URL)
    restoreEnv('OPENAI_API_BASE', originalEnv.OPENAI_API_BASE)
    restoreEnv('OPENAI_API_FORMAT', originalEnv.OPENAI_API_FORMAT)
    restoreEnv('OPENAI_MODEL', originalEnv.OPENAI_MODEL)
    restoreEnv('MINIMAX_API_KEY', originalEnv.MINIMAX_API_KEY)
    restoreEnv('XAI_API_KEY', originalEnv.XAI_API_KEY)
    restoreEnv('VENICE_API_KEY', originalEnv.VENICE_API_KEY)
    restoreEnv('MIMO_API_KEY', originalEnv.MIMO_API_KEY)
    restoreEnv('NVIDIA_NIM', originalEnv.NVIDIA_NIM)
    restoreEnv('NVIDIA_API_KEY', originalEnv.NVIDIA_API_KEY)
    restoreEnv('NVIDIA_BASE_URL', originalEnv.NVIDIA_BASE_URL)
    restoreEnv('NVIDIA_MODEL', originalEnv.NVIDIA_MODEL)
    restoreEnv('ANTHROPIC_API_KEY', originalEnv.ANTHROPIC_API_KEY)
    restoreEnv('ANTHROPIC_AUTH_TOKEN', originalEnv.ANTHROPIC_AUTH_TOKEN)
    restoreEnv('ANTHROPIC_BASE_URL', originalEnv.ANTHROPIC_BASE_URL)
    restoreEnv('ANTHROPIC_MODEL', originalEnv.ANTHROPIC_MODEL)
    restoreEnv('ANTHROPIC_CUSTOM_HEADERS', originalEnv.ANTHROPIC_CUSTOM_HEADERS)
    globalThis.fetch = originalFetch
  } finally {
    mock.restore()
    releaseSharedMutationLock()
  }
})

test('first-party Anthropic requests execute the configured fetch wrapper without runtime symbol errors', async () => {
  let capturedHeaders: Headers | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  delete process.env.GAKR_CODE_USE_OPENAI
  delete process.env.GAKR_CODE_USE_BEDROCK
  delete process.env.GAKR_CODE_USE_VERTEX
  delete process.env.GAKR_CODE_USE_FOUNDRY
  delete process.env.GAKR_CODE_USE_GITHUB
  delete process.env.GAKR_CODE_USE_MISTRAL
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_BASE_URL
  delete process.env.OPENAI_API_BASE
  delete process.env.OPENAI_MODEL
  delete process.env.NVIDIA_NIM
  delete process.env.ANTHROPIC_BASE_URL

  const fetchOverride = (async (_input, init) => {
    capturedHeaders = new Headers(init?.headers)

    return new Response(
      JSON.stringify({
        id: 'msg_first_party_fetch',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        container: null,
        usage: {
          input_tokens: 1,
          output_tokens: 1,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = await getAnthropicClient({
    apiKey: 'anthropic-test-key',
    maxRetries: 0,
    model: 'claude-sonnet-4-6',
    fetchOverride,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
  })

  expect(response).toMatchObject({
    id: 'msg_first_party_fetch',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
  })
  expect(capturedHeaders).toBeDefined()
})

test('routes GitHub Claude models through native Anthropic format', async () => {
  let capturedUrl: string | undefined
  let capturedHeaders: Headers | undefined
  let capturedBody: Record<string, unknown> | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  delete process.env.OPENAI_API_KEY
  process.env.GAKR_CODE_USE_GITHUB = '1'
  process.env.OPENAI_MODEL = 'claude-sonnet-4-6'
  process.env.GITHUB_TOKEN = 'github-native-token'

  const fetchOverride = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedHeaders = new Headers(init?.headers)
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'msg_github_native',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: 'github native ok' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 1,
          output_tokens: 1,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = await getAnthropicClient({
    maxRetries: 0,
    model: 'claude-sonnet-4-6',
    fetchOverride,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
  })

  expect(capturedUrl).toBe('https://api.githubcopilot.com/v1/messages')
  expect(capturedHeaders?.get('authorization')).toBe('Bearer github-native-token')
  expect(capturedBody?.model).toBe('claude-sonnet-4-6')
  expect(response).toMatchObject({
    id: 'msg_github_native',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
  })
})

test('routes Gemini provider requests through the OpenAI-compatible shim', async () => {
  let capturedUrl: string | undefined
  let capturedHeaders: Headers | undefined
  let capturedBody: Record<string, unknown> | undefined

  globalThis.fetch = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedHeaders = new Headers(init?.headers)
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-gemini',
        model: 'gemini-2.0-flash',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'gemini ok',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 3,
          total_tokens: 11,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'gemini-2.0-flash',
  })) as unknown as ShimClient

  const response = await client.beta.messages.create({
    model: 'gemini-2.0-flash',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://gemini.example/v1beta/openai/chat/completions')
  expect(capturedHeaders?.get('authorization')).toBe('Bearer gemini-test-key')
  expect(capturedBody?.model).toBe('gemini-2.0-flash')
  expect(response).toMatchObject({
    role: 'assistant',
    model: 'gemini-2.0-flash',
  })
})

test('env-only MiniMax fallback replaces stale non-MiniMax model env', async () => {
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.ANTHROPIC_API_KEY = 'anthropic-test-key'
  process.env.MINIMAX_API_KEY = 'minimax-test-key'
  process.env.OPENAI_MODEL = 'gpt-4o'

  await getAnthropicClient({
    maxRetries: 0,
    model: 'MiniMax-M2.7',
  })

  expect(process.env.GAKR_CODE_USE_OPENAI).toBeUndefined()
  expect(process.env.ANTHROPIC_MODEL).toBe('MiniMax-M2.7')
  expect(process.env.ANTHROPIC_API_KEY).toBe('minimax-test-key')
})

test('env-only MiniMax fallback does not override explicit OpenAI credentials', async () => {
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.ANTHROPIC_API_KEY = 'anthropic-test-key'
  process.env.OPENAI_API_KEY = 'openai-test-key'
  process.env.MINIMAX_API_KEY = 'minimax-test-key'

  await getAnthropicClient({
    maxRetries: 0,
    model: 'gpt-4o',
  })

  expect(process.env.GAKR_CODE_USE_OPENAI).toBeUndefined()
  expect(process.env.OPENAI_API_KEY).toBe('openai-test-key')
  expect(process.env.OPENAI_BASE_URL).toBeUndefined()
  expect(process.env.OPENAI_MODEL).toBeUndefined()
})

test('env-only MiniMax fallback ignores non-MiniMax base overrides', async () => {
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.ANTHROPIC_API_KEY = 'anthropic-test-key'
  process.env.MINIMAX_API_KEY = 'minimax-test-key'
  process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1'
  process.env.OPENAI_MODEL = 'MiniMax-M2.7'

  await getAnthropicClient({
    maxRetries: 0,
    model: 'MiniMax-M2.7',
  })

  expect(process.env.GAKR_CODE_USE_OPENAI).toBeUndefined()
  expect(process.env.OPENAI_API_KEY).toBeUndefined()
  expect(process.env.OPENAI_BASE_URL).toBe('https://api.openai.com/v1')
  expect(process.env.OPENAI_MODEL).toBe('MiniMax-M2.7')
})

test('routes env-only xAI requests through the OpenAI-compatible shim', async () => {
  let capturedUrl: string | undefined
  let capturedHeaders: Headers | undefined
  let capturedBody: Record<string, unknown> | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.XAI_API_KEY = 'xai-test-key'

  globalThis.fetch = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedHeaders = new Headers(init?.headers)
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-xai',
        model: 'grok-4',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'xai ok',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 3,
          total_tokens: 11,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'grok-4',
  })) as unknown as ShimClient

  const response = await client.beta.messages.create({
    model: 'grok-4',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://api.x.ai/v1/chat/completions')
  expect(capturedHeaders?.get('authorization')).toBe('Bearer xai-test-key')
  expect(capturedBody?.model).toBe('grok-4')
  expect(response).toMatchObject({
    role: 'assistant',
    model: 'grok-4',
  })
})

test('env-only xAI fallback replaces stale OpenAI credentials and model env', async () => {
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.XAI_API_KEY = 'xai-test-key'
  process.env.OPENAI_API_KEY = 'openai-test-key'
  process.env.OPENAI_MODEL = 'gpt-4o'

  await getAnthropicClient({
    maxRetries: 0,
    model: 'grok-4',
  })

  expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
  expect(process.env.OPENAI_MODEL).toBe('grok-4')
  expect(process.env.OPENAI_API_KEY).toBe('xai-test-key')
})

test('env-only xAI fallback uses Grok 4.3 when no xAI model is requested', async () => {
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.XAI_API_KEY = 'xai-test-key'
  process.env.OPENAI_API_KEY = 'openai-test-key'
  process.env.OPENAI_MODEL = 'gpt-4o'

  await getAnthropicClient({
    maxRetries: 0,
    model: 'gakrcli-sonnet-4-6',
  })

  expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
  expect(process.env.OPENAI_MODEL).toBe('grok-4.3')
  expect(process.env.OPENAI_API_KEY).toBe('xai-test-key')
})

test('env-only xAI fallback preserves xAI OPENAI_API_BASE host overrides', async () => {
  let capturedUrl: string | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.XAI_API_KEY = 'xai-test-key'
  process.env.OPENAI_API_BASE = 'https://api.x.ai/v1'

  globalThis.fetch = (async (input) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-xai-api-base',
        model: 'grok-4',
        choices: [
          {
            message: { role: 'assistant', content: 'xai api base ok' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'grok-4',
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'grok-4',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://api.x.ai/v1/chat/completions')
  expect(process.env.OPENAI_BASE_URL).toBe('https://api.x.ai/v1')
})

test('env-only xAI fallback drops unsupported OpenAI shim options', async () => {
  let capturedUrl: string | undefined
  let capturedHeaders: Headers | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.XAI_API_KEY = 'xai-test-key'
  process.env.OPENAI_API_FORMAT = 'responses'
  process.env.OPENAI_AUTH_HEADER = 'api-key'
  process.env.OPENAI_AUTH_SCHEME = 'raw'
  process.env.OPENAI_AUTH_HEADER_VALUE = 'stale-header-value'

  globalThis.fetch = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedHeaders = new Headers(init?.headers)

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-xai-clean',
        model: 'grok-4',
        choices: [
          {
            message: { role: 'assistant', content: 'xai clean ok' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'grok-4',
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'grok-4',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://api.x.ai/v1/chat/completions')
  expect(capturedHeaders?.get('authorization')).toBe('Bearer xai-test-key')
  expect(capturedHeaders?.get('api-key')).toBeNull()
  expect(process.env.OPENAI_API_FORMAT).toBeUndefined()
  expect(process.env.OPENAI_AUTH_HEADER).toBeUndefined()
  expect(process.env.OPENAI_AUTH_SCHEME).toBeUndefined()
  expect(process.env.OPENAI_AUTH_HEADER_VALUE).toBeUndefined()
})

test('env-only xAI fallback ignores non-xAI base overrides', async () => {
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.ANTHROPIC_API_KEY = 'anthropic-test-key'
  process.env.XAI_API_KEY = 'xai-test-key'
  process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1'
  process.env.OPENAI_MODEL = 'grok-4'

  await getAnthropicClient({
    maxRetries: 0,
    model: 'grok-4',
  })

  expect(process.env.GAKR_CODE_USE_OPENAI).toBeUndefined()
  expect(process.env.OPENAI_API_KEY).toBeUndefined()
  expect(process.env.OPENAI_BASE_URL).toBe('https://api.openai.com/v1')
  expect(process.env.OPENAI_MODEL).toBe('grok-4')
})

test('env-only xAI wins when MiniMax key is also present', async () => {
  let capturedUrl: string | undefined
  let capturedHeaders: Headers | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.MINIMAX_API_KEY = 'minimax-test-key'
  process.env.XAI_API_KEY = 'xai-test-key'

  globalThis.fetch = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedHeaders = new Headers(init?.headers)

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-xai',
        model: 'grok-4',
        choices: [
          {
            message: { role: 'assistant', content: 'xai ok' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'grok-4',
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'grok-4',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://api.x.ai/v1/chat/completions')
  expect(capturedHeaders?.get('authorization')).toBe('Bearer xai-test-key')
  expect(process.env.OPENAI_API_KEY).toBe('xai-test-key')
})

test('routes env-only Venice requests through the OpenAI-compatible shim', async () => {
  let capturedUrl: string | undefined
  let capturedHeaders: Headers | undefined
  let capturedBody: Record<string, unknown> | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.VENICE_API_KEY = 'venice-test-key'

  globalThis.fetch = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedHeaders = new Headers(init?.headers)
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-venice',
        model: 'venice-uncensored',
        choices: [
          {
            message: { role: 'assistant', content: 'venice ok' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'venice-uncensored',
  })) as unknown as ShimClient

  const response = await client.beta.messages.create({
    model: 'venice-uncensored',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://api.venice.ai/api/v1/chat/completions')
  expect(capturedHeaders?.get('authorization')).toBe('Bearer venice-test-key')
  expect(capturedBody?.model).toBe('venice-uncensored')
  expect(response).toMatchObject({
    role: 'assistant',
    model: 'venice-uncensored',
  })
})

test('routes env-only Xiaomi MiMo requests through the OpenAI-compatible shim', async () => {
  let capturedUrl: string | undefined
  let capturedHeaders: Headers | undefined
  let capturedBody: Record<string, unknown> | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.MIMO_API_KEY = 'mimo-test-key'

  globalThis.fetch = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedHeaders = new Headers(init?.headers)
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-mimo',
        model: 'mimo-v2.5-pro',
        choices: [
          {
            message: { role: 'assistant', content: 'mimo ok' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'mimo-v2.5-pro',
  })) as unknown as ShimClient

  const response = await client.beta.messages.create({
    model: 'mimo-v2.5-pro',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://api.xiaomimimo.com/v1/chat/completions')
  expect(capturedHeaders?.get('api-key')).toBe('mimo-test-key')
  expect(capturedHeaders?.get('authorization')).toBeNull()
  expect(capturedBody?.model).toBe('mimo-v2.5-pro')
  expect(response).toMatchObject({
    role: 'assistant',
    model: 'mimo-v2.5-pro',
  })
})

test('env-only MiniMax fallback yields to explicit Bedrock selection', async () => {
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.GAKR_CODE_USE_BEDROCK = '1'
  process.env.GAKR_CODE_SKIP_BEDROCK_AUTH = '1'
  process.env.MINIMAX_API_KEY = 'minimax-test-key'

  globalThis.fetch = (async () => {
    throw new Error('MiniMax/OpenAI shim fetch should not run')
  }) as unknown as FetchType

  await getAnthropicClient({
    maxRetries: 0,
    model: 'claude-sonnet-4-6',
  })

  expect(process.env.GAKR_CODE_USE_OPENAI).toBeUndefined()
  expect(process.env.OPENAI_BASE_URL).toBeUndefined()
  expect(process.env.OPENAI_MODEL).toBeUndefined()
  expect(process.env.OPENAI_API_KEY).toBeUndefined()
})

test('env-only xAI fallback yields to explicit Bedrock selection', async () => {
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_BASE_URL
  delete process.env.GEMINI_AUTH_MODE
  process.env.GAKR_CODE_USE_BEDROCK = '1'
  process.env.GAKR_CODE_SKIP_BEDROCK_AUTH = '1'
  process.env.XAI_API_KEY = 'xai-test-key'

  globalThis.fetch = (async () => {
    throw new Error('xAI/OpenAI shim fetch should not run')
  }) as unknown as FetchType

  await getAnthropicClient({
    maxRetries: 0,
    model: 'claude-sonnet-4-6',
  })

  expect(process.env.GAKR_CODE_USE_OPENAI).toBeUndefined()
  expect(process.env.OPENAI_BASE_URL).toBeUndefined()
  expect(process.env.OPENAI_MODEL).toBeUndefined()
  expect(process.env.OPENAI_API_KEY).toBeUndefined()
})

test('strips Anthropic-specific custom headers before sending OpenAI-compatible shim requests', async () => {
  let capturedHeaders: Headers | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_API_KEY = 'openai-test-key'
  process.env.OPENAI_BASE_URL = 'http://example.test/v1'
  process.env.OPENAI_MODEL = 'gpt-4o'
  process.env.ANTHROPIC_CUSTOM_HEADERS = [
    'anthropic-version: 2023-06-01',
    'anthropic-beta: prompt-caching-2024-07-31',
    'x-anthropic-additional-protection: true',
    'x-claude-remote-session-id: remote-123',
    'x-app: cli',
    'api-key: custom-provider-key',
    'x-safe-header: keep-me',
  ].join('\n')

  globalThis.fetch = (async (_input, init) => {
    capturedHeaders = new Headers(init?.headers)

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-openai',
        model: 'gpt-4o',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'ok',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 3,
          total_tokens: 11,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'gpt-4o',
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'gpt-4o',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedHeaders?.get('anthropic-version')).toBeNull()
  expect(capturedHeaders?.get('anthropic-beta')).toBeNull()
  expect(capturedHeaders?.get('x-anthropic-additional-protection')).toBeNull()
  expect(capturedHeaders?.get('x-claude-remote-session-id')).toBeNull()
  expect(capturedHeaders?.get('x-app')).toBeNull()
  expect(capturedHeaders?.get('api-key')).toBeNull()
  expect(capturedHeaders?.get('x-safe-header')).toBe('keep-me')
  expect(capturedHeaders?.get('authorization')).toBe('Bearer openai-test-key')
})

test('strips Anthropic-specific custom headers on providerOverride shim requests too', async () => {
  let capturedHeaders: Headers | undefined

  process.env.ANTHROPIC_CUSTOM_HEADERS = [
    'anthropic-version: 2023-06-01',
    'anthropic-beta: prompt-caching-2024-07-31',
    'x-claude-remote-session-id: remote-123',
    'api-key: custom-provider-key',
    'x-safe-header: keep-me',
  ].join('\n')

  globalThis.fetch = (async (_input, init) => {
    capturedHeaders = new Headers(init?.headers)

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-provider-override',
        model: 'gpt-4o',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'ok',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 3,
          total_tokens: 11,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    providerOverride: {
      model: 'gpt-4o',
      baseURL: 'http://example.test/v1',
      apiKey: 'provider-test-key',
    },
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'unused',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedHeaders?.get('anthropic-version')).toBeNull()
  expect(capturedHeaders?.get('anthropic-beta')).toBeNull()
  expect(capturedHeaders?.get('x-claude-remote-session-id')).toBeNull()
  expect(capturedHeaders?.get('api-key')).toBeNull()
  expect(capturedHeaders?.get('x-safe-header')).toBe('keep-me')
  expect(capturedHeaders?.get('authorization')).toBe('Bearer provider-test-key')
})

test('forwards max effort as xhigh reasoning_effort on direct OpenAI shim requests', async () => {
  delete process.env.GAKR_CODE_USE_GEMINI
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_API_KEY = 'openai-test-key'
  process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1'

  let capturedBody: Record<string, unknown> | undefined

  globalThis.fetch = (async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-openai-effort',
        model: 'gpt-5.4',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'ok',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 3,
          total_tokens: 11,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'gpt-5.4',
    effortValue: 'max',
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'gpt-5.4',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedBody?.reasoning_effort).toBe('xhigh')
})

test('forwards effort to providerOverride shim requests', async () => {
  let capturedBody: Record<string, unknown> | undefined

  globalThis.fetch = (async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-provider-effort',
        model: 'gpt-5.4',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'ok',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 3,
          total_tokens: 11,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    effortValue: 'high',
    providerOverride: {
      model: 'gpt-5.4',
      baseURL: 'http://example.test/v1',
      apiKey: 'provider-test-key',
    },
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'unused',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedBody?.reasoning_effort).toBe('high')
})

test('routes env-only MiniMax requests through the Anthropic-compatible API', async () => {
  let capturedUrl: string | undefined
  let capturedHeaders: Headers | undefined
  let capturedBody: Record<string, unknown> | undefined

  clearEnvForMiniMaxOnlyTest()
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_API_KEY = 'ambient-openai-key'
  process.env.XAI_API_KEY = 'ambient-xai-key'
  process.env.MINIMAX_API_KEY = 'minimax-test-key'

  globalThis.fetch = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedHeaders = new Headers(init?.headers)
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'msg-minimax',
        type: 'message',
        role: 'assistant',
        model: 'MiniMax-M2.5',
        content: [{ type: 'text', text: 'minimax ok' }],
        usage: {
          input_tokens: 8,
          output_tokens: 3,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
        stop_reason: 'end_turn',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'MiniMax-M2.5',
  })) as unknown as ShimClient

  const response = await client.beta.messages.create({
    model: 'MiniMax-M2.5',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://api.minimax.io/anthropic/v1/messages?beta=true')
  expect(capturedHeaders?.get('x-api-key')).toBe('minimax-test-key')
  expect(capturedBody?.model).toBe('MiniMax-M2.5')
  expect(process.env.ANTHROPIC_BASE_URL).toBe('https://api.minimax.io/anthropic')
  expect(process.env.ANTHROPIC_API_KEY).toBe('minimax-test-key')
  expect(process.env.GAKR_CODE_USE_OPENAI).toBeUndefined()
  expect(response).toMatchObject({
    role: 'assistant',
    model: 'MiniMax-M2.5',
  })
})

test('env-only MiniMax fallback preserves legacy OPENAI_MODEL as Anthropic model', async () => {
  let capturedUrl: string | undefined
  let capturedBody: Record<string, unknown> | undefined

  clearEnvForMiniMaxOnlyTest()
  process.env.MINIMAX_API_KEY = 'minimax-test-key'
  process.env.OPENAI_MODEL = 'MiniMax-M2.7-highspeed'

  globalThis.fetch = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'msg-minimax-override',
        type: 'message',
        role: 'assistant',
        model: 'MiniMax-M2.7-highspeed',
        content: [{ type: 'text', text: 'minimax override ok' }],
        usage: { input_tokens: 8, output_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        stop_reason: 'end_turn',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'MiniMax-M2.7-highspeed',
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'MiniMax-M2.7-highspeed',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://api.minimax.io/anthropic/v1/messages?beta=true')
  expect(capturedBody?.model).toBe('MiniMax-M2.7-highspeed')
  expect(process.env.ANTHROPIC_MODEL).toBe('MiniMax-M2.7-highspeed')
})

test('env-only MiniMax fallback drops stale OpenAI shim options', async () => {
  let capturedUrl: string | undefined
  let capturedHeaders: Headers | undefined

  clearEnvForMiniMaxOnlyTest()
  process.env.MINIMAX_API_KEY = 'minimax-test-key'
  process.env.OPENAI_API_FORMAT = 'responses'
  process.env.OPENAI_AUTH_HEADER = 'api-key'
  process.env.OPENAI_AUTH_SCHEME = 'raw'
  process.env.OPENAI_AUTH_HEADER_VALUE = 'stale-header-value'

  globalThis.fetch = (async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    capturedHeaders = new Headers(init?.headers)

    return new Response(
      JSON.stringify({
        id: 'msg-minimax-clean',
        type: 'message',
        role: 'assistant',
        model: 'MiniMax-M2.7',
        content: [{ type: 'text', text: 'minimax clean ok' }],
        usage: { input_tokens: 8, output_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        stop_reason: 'end_turn',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'MiniMax-M2.7',
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'MiniMax-M2.7',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedUrl).toBe('https://api.minimax.io/anthropic/v1/messages?beta=true')
  expect(capturedHeaders?.get('x-api-key')).toBe('minimax-test-key')
  expect(capturedHeaders?.get('api-key')).toBeNull()
  expect(process.env.OPENAI_API_FORMAT).toBeUndefined()
  expect(process.env.OPENAI_AUTH_HEADER).toBeUndefined()
  expect(process.env.OPENAI_AUTH_SCHEME).toBeUndefined()
  expect(process.env.OPENAI_AUTH_HEADER_VALUE).toBeUndefined()
})

test('rejects CRLF-injected custom headers before sending OpenAI-compatible shim requests', async () => {
  let capturedHeaders: Headers | undefined

  delete process.env.GAKR_CODE_USE_GEMINI
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_API_KEY = 'openai-test-key'
  process.env.OPENAI_BASE_URL = 'http://example.test/v1'
  process.env.OPENAI_MODEL = 'gpt-4o'
  process.env.ANTHROPIC_CUSTOM_HEADERS =
    'x-safe-header: keep-me\r\nx-injected: bad'

  globalThis.fetch = (async (_input, init) => {
    capturedHeaders = new Headers(init?.headers)

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-openai-crlf',
        model: 'gpt-4o',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'ok',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 3,
          total_tokens: 11,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = (await getAnthropicClient({
    maxRetries: 0,
    model: 'gpt-4o',
  })) as unknown as ShimClient

  await client.beta.messages.create({
    model: 'gpt-4o',
    system: 'test system',
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedHeaders?.get('x-safe-header')).toBeNull()
  expect(capturedHeaders?.get('x-injected')).toBeNull()
  expect(capturedHeaders?.get('authorization')).toBe('Bearer openai-test-key')
})
