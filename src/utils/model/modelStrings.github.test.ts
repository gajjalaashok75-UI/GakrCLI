import { afterEach, expect, test } from 'bun:test'

import { resetModelStringsForTestingOnly } from '../../bootstrap/state.js'
import { parseUserSpecifiedModel } from './model.js'
import { getModelStrings } from './modelStrings.js'

const originalEnv = {
  GAKR_CODE_USE_GITHUB: process.env.GAKR_CODE_USE_GITHUB,
  GAKR_CODE_USE_OPENAI: process.env.GAKR_CODE_USE_OPENAI,
  GAKR_CODE_USE_GEMINI: process.env.GAKR_CODE_USE_GEMINI,
  GAKR_CODE_USE_BEDROCK: process.env.GAKR_CODE_USE_BEDROCK,
  GAKR_CODE_USE_VERTEX: process.env.GAKR_CODE_USE_VERTEX,
  GAKR_CODE_USE_FOUNDRY: process.env.GAKR_CODE_USE_FOUNDRY,
}

function clearProviderFlags(): void {
  delete process.env.GAKR_CODE_USE_GITHUB
  delete process.env.GAKR_CODE_USE_OPENAI
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GAKR_CODE_USE_BEDROCK
  delete process.env.GAKR_CODE_USE_VERTEX
  delete process.env.GAKR_CODE_USE_FOUNDRY
}

afterEach(() => {
  process.env.GAKR_CODE_USE_GITHUB = originalEnv.GAKR_CODE_USE_GITHUB
  process.env.GAKR_CODE_USE_OPENAI = originalEnv.GAKR_CODE_USE_OPENAI
  process.env.GAKR_CODE_USE_GEMINI = originalEnv.GAKR_CODE_USE_GEMINI
  process.env.GAKR_CODE_USE_BEDROCK = originalEnv.GAKR_CODE_USE_BEDROCK
  process.env.GAKR_CODE_USE_VERTEX = originalEnv.GAKR_CODE_USE_VERTEX
  process.env.GAKR_CODE_USE_FOUNDRY = originalEnv.GAKR_CODE_USE_FOUNDRY
  resetModelStringsForTestingOnly()
})

test('GitHub provider model strings are concrete IDs', () => {
  clearProviderFlags()
  process.env.GAKR_CODE_USE_GITHUB = '1'

  const modelStrings = getModelStrings()

  for (const value of Object.values(modelStrings)) {
    expect(typeof value).toBe('string')
    expect(value.trim().length).toBeGreaterThan(0)
  }
})

test('GitHub provider model strings are safe to parse', () => {
  clearProviderFlags()
  process.env.GAKR_CODE_USE_GITHUB = '1'

  const modelStrings = getModelStrings()

  expect(() => parseUserSpecifiedModel(modelStrings.sonnet46 as any)).not.toThrow()
})
