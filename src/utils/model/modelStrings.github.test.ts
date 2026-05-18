import { afterEach, beforeEach, expect, test } from 'bun:test'

import { resetModelStringsForTestingOnly } from '../../bootstrap/state.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
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

function restoreEnv(key: keyof typeof originalEnv): void {
  if (originalEnv[key] === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = originalEnv[key]
  }
}

beforeEach(async () => {
  await acquireSharedMutationLock('model/modelStrings.github.test.ts')
})

afterEach(() => {
  try {
    for (const key of Object.keys(originalEnv) as Array<keyof typeof originalEnv>) {
      restoreEnv(key)
    }
    resetModelStringsForTestingOnly()
  } finally {
    releaseSharedMutationLock()
  }
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
