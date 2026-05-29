import { afterEach, beforeEach, expect, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { getEnterPlanModeToolPrompt } from './prompt.js'

let originalUserType: string | undefined

beforeEach(async () => {
  await acquireSharedMutationLock('tools/EnterPlanModeTool/prompt.test.ts')
  originalUserType = process.env.USER_TYPE
})

afterEach(() => {
  if (originalUserType === undefined) {
    delete process.env.USER_TYPE
  } else {
    process.env.USER_TYPE = originalUserType
  }
  releaseSharedMutationLock()
})

test('uses the same proactive plan-mode guidance for internal and external sessions', () => {
  process.env.USER_TYPE = 'ant'

  const prompt = getEnterPlanModeToolPrompt()

  expect(prompt).toContain('Use this tool proactively')
  expect(prompt).toContain('Prefer using EnterPlanMode')
  expect(prompt).not.toContain('Use this tool when a task has genuine ambiguity')
})
