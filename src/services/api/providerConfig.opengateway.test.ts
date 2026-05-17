import { afterEach, beforeEach, expect, test } from 'bun:test'

import { resolveProviderRequest } from './providerConfig.js'

const ENV_KEYS = [
  'GAKR_CODE_USE_OPENAI',
  'GAKR_CODE_USE_GITHUB',
  'GAKR_CODE_USE_GEMINI',
  'GAKR_CODE_USE_MISTRAL',
  'GAKR_CODE_USE_NVIDIA',
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
] as const

const originalEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalEnv[key]
    }
  }
})

test.each([
  'https://opengateway.gitlawb.com/v1/xiaomi-mimo',
  'https://opengateway.gitlawb.com/v1/xiaomi-mimo/',
  'https://opengateway.fly.dev/v1/gmi-cloud?legacy=1#hash',
] as const)('normalizes legacy Opengateway base URL %s', baseUrl => {
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_BASE_URL = baseUrl

  const request = resolveProviderRequest({ model: 'mimo-v2.5-pro' })

  expect(request.baseUrl).toBe(
    baseUrl.includes('fly.dev')
      ? 'https://opengateway.fly.dev/v1'
      : 'https://opengateway.gitlawb.com/v1',
  )
})

test('leaves non-Opengateway path-qualified base URLs unchanged', () => {
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_BASE_URL = 'https://gateway.example.test/v1/xiaomi-mimo'

  const request = resolveProviderRequest({ model: 'mimo-v2.5-pro' })

  expect(request.baseUrl).toBe('https://gateway.example.test/v1/xiaomi-mimo')
})
