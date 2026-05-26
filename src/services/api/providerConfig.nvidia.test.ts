import { afterEach, expect, test } from 'bun:test'

import {
  DEFAULT_CODEX_BASE_URL,
  DEFAULT_NVIDIA_BASE_URL,
  DEFAULT_NVIDIA_MODEL,
  resolveProviderRequest,
} from './providerConfig.js'

const ENV_KEYS = [
  'GAKR_CODE_USE_OPENAI',
  'GAKR_CODE_USE_GITHUB',
  'GAKR_CODE_USE_GEMINI',
  'GAKR_CODE_USE_MISTRAL',
  'GAKR_CODE_USE_NVIDIA',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
  'OPENAI_MODEL',
  'NVIDIA_BASE_URL',
  'NVIDIA_MODEL',
] as const

const originalEnv: Record<string, string | undefined> = {}
for (const key of ENV_KEYS) {
  originalEnv[key] = process.env[key]
}

test('default NVIDIA model is a NVIDIA NIM model id', () => {
  expect(DEFAULT_NVIDIA_MODEL).toBe('stepfun-ai/step-3.5-flash')
})

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

function clearProviderEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    restoreEnv(key, originalEnv[key])
  }
})

test('resolves dedicated NVIDIA provider env when GAKR_CODE_USE_NVIDIA is set', () => {
  clearProviderEnv()
  process.env.GAKR_CODE_USE_NVIDIA = '1'
  process.env.NVIDIA_BASE_URL = DEFAULT_NVIDIA_BASE_URL
  process.env.NVIDIA_MODEL = DEFAULT_NVIDIA_MODEL

  expect(resolveProviderRequest()).toMatchObject({
    transport: 'chat_completions',
    requestedModel: DEFAULT_NVIDIA_MODEL,
    resolvedModel: DEFAULT_NVIDIA_MODEL,
    baseUrl: DEFAULT_NVIDIA_BASE_URL,
  })
})

test('dedicated NVIDIA provider falls back to the NVIDIA default model', () => {
  clearProviderEnv()
  process.env.GAKR_CODE_USE_NVIDIA = '1'

  expect(resolveProviderRequest()).toMatchObject({
    transport: 'chat_completions',
    requestedModel: DEFAULT_NVIDIA_MODEL,
    resolvedModel: DEFAULT_NVIDIA_MODEL,
    baseUrl: DEFAULT_NVIDIA_BASE_URL,
  })
})

test('dedicated NVIDIA provider preserves the default model from env', () => {
  clearProviderEnv()
  process.env.GAKR_CODE_USE_NVIDIA = '1'
  process.env.NVIDIA_MODEL = 'stepfun-ai/step-3.5-flash'

  expect(resolveProviderRequest()).toMatchObject({
    requestedModel: DEFAULT_NVIDIA_MODEL,
    resolvedModel: DEFAULT_NVIDIA_MODEL,
    baseUrl: DEFAULT_NVIDIA_BASE_URL,
  })
})

test('ambient NVIDIA mode does not hijack an explicit Codex alias request', () => {
  clearProviderEnv()
  process.env.GAKR_CODE_USE_NVIDIA = '1'
  process.env.NVIDIA_BASE_URL = DEFAULT_NVIDIA_BASE_URL
  process.env.NVIDIA_MODEL = DEFAULT_NVIDIA_MODEL

  expect(resolveProviderRequest({ model: 'codexplan' })).toMatchObject({
    transport: 'codex_responses',
    requestedModel: 'codexplan',
    resolvedModel: 'gpt-5.5',
    baseUrl: DEFAULT_CODEX_BASE_URL,
  })
})
