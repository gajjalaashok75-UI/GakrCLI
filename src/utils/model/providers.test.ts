import { afterEach, expect, test } from 'bun:test'

import {
  getAPIProvider,
  usesAnthropicAccountFlow,
} from './providers.js'

const originalEnv = {
  GAKR_CODE_USE_GEMINI: process.env.GAKR_CODE_USE_GEMINI,
  GAKR_CODE_USE_GITHUB: process.env.GAKR_CODE_USE_GITHUB,
  GAKR_CODE_USE_OPENAI: process.env.GAKR_CODE_USE_OPENAI,
  GAKR_CODE_USE_BEDROCK: process.env.GAKR_CODE_USE_BEDROCK,
  GAKR_CODE_USE_VERTEX: process.env.GAKR_CODE_USE_VERTEX,
  GAKR_CODE_USE_FOUNDRY: process.env.GAKR_CODE_USE_FOUNDRY,
}

afterEach(() => {
  process.env.GAKR_CODE_USE_GEMINI = originalEnv.GAKR_CODE_USE_GEMINI
  process.env.GAKR_CODE_USE_GITHUB = originalEnv.GAKR_CODE_USE_GITHUB
  process.env.GAKR_CODE_USE_OPENAI = originalEnv.GAKR_CODE_USE_OPENAI
  process.env.GAKR_CODE_USE_BEDROCK = originalEnv.GAKR_CODE_USE_BEDROCK
  process.env.GAKR_CODE_USE_VERTEX = originalEnv.GAKR_CODE_USE_VERTEX
  process.env.GAKR_CODE_USE_FOUNDRY = originalEnv.GAKR_CODE_USE_FOUNDRY
})

function clearProviderEnv(): void {
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GAKR_CODE_USE_GITHUB
  delete process.env.GAKR_CODE_USE_OPENAI
  delete process.env.GAKR_CODE_USE_BEDROCK
  delete process.env.GAKR_CODE_USE_VERTEX
  delete process.env.GAKR_CODE_USE_FOUNDRY
}

test('first-party provider keeps Anthropic account setup flow enabled', () => {
  clearProviderEnv()

  expect(getAPIProvider()).toBe('firstParty')
  expect(usesAnthropicAccountFlow()).toBe(true)
})

test.each([
  ['GAKR_CODE_USE_OPENAI', 'openai'],
  ['GAKR_CODE_USE_GITHUB', 'github'],
  ['GAKR_CODE_USE_GEMINI', 'gemini'],
  ['GAKR_CODE_USE_BEDROCK', 'bedrock'],
  ['GAKR_CODE_USE_VERTEX', 'vertex'],
  ['GAKR_CODE_USE_FOUNDRY', 'foundry'],
] as const)(
  '%s disables Anthropic account setup flow',
  (envKey, provider) => {
    clearProviderEnv()
    process.env[envKey] = '1'

    expect(getAPIProvider()).toBe(provider)
    expect(usesAnthropicAccountFlow()).toBe(false)
  },
)

test('GEMINI takes precedence over GitHub when both are set', () => {
  clearProviderEnv()
  process.env.GAKR_CODE_USE_GEMINI = '1'
  process.env.GAKR_CODE_USE_GITHUB = '1'

  expect(getAPIProvider()).toBe('gemini')
})
