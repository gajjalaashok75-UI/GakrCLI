import { afterEach, beforeEach, expect, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { getGlobalConfig, saveGlobalConfig } from '../config.js'
import { getDefaultMainLoopModelSetting, getUserSpecifiedModelSetting } from './model.js'

const env = {
  GAKR_CODE_USE_GITHUB: process.env.GAKR_CODE_USE_GITHUB,
  GAKR_CODE_USE_OPENAI: process.env.GAKR_CODE_USE_OPENAI,
  GAKR_CODE_USE_GEMINI: process.env.GAKR_CODE_USE_GEMINI,
  GAKR_CODE_USE_BEDROCK: process.env.GAKR_CODE_USE_BEDROCK,
  GAKR_CODE_USE_VERTEX: process.env.GAKR_CODE_USE_VERTEX,
  GAKR_CODE_USE_FOUNDRY: process.env.GAKR_CODE_USE_FOUNDRY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
}
const originalModel = getGlobalConfig().model

function restoreEnv(key: keyof typeof env): void {
  if (env[key] === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = env[key]
  }
}

beforeEach(async () => {
  await acquireSharedMutationLock('model/model.github.test.ts')
  process.env.GAKR_CODE_USE_GITHUB = '1'
  delete process.env.GAKR_CODE_USE_OPENAI
  delete process.env.GAKR_CODE_USE_GEMINI
  delete process.env.GAKR_CODE_USE_BEDROCK
  delete process.env.GAKR_CODE_USE_VERTEX
  delete process.env.GAKR_CODE_USE_FOUNDRY
  delete process.env.OPENAI_MODEL
  saveGlobalConfig(current => ({
    ...current,
    model: ({ bad: true } as unknown) as string,
  }))
})

afterEach(() => {
  try {
    for (const key of Object.keys(env) as Array<keyof typeof env>) {
      restoreEnv(key)
    }
    saveGlobalConfig(current => ({
      ...current,
      model: originalModel,
    }))
  } finally {
    releaseSharedMutationLock()
  }
})

test('github default model setting ignores non-string saved model', () => {
  const model = getDefaultMainLoopModelSetting()
  expect(typeof model).toBe('string')
  expect(model).not.toBe('[object Object]')
  expect(model.length).toBeGreaterThan(0)
})

test('user specified model ignores non-string saved model', () => {
  const model = getUserSpecifiedModelSetting()
  if (model !== undefined && model !== null) {
    expect(typeof model).toBe('string')
    expect(model).not.toBe('[object Object]')
  }
})
