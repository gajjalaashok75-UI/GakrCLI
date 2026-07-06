import { afterEach, expect, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

// Dynamic import with cache busting to avoid circular dependency issues
// that occur when static imports are resolved during concurrent test execution.
async function importFreshFileReadTool() {
  return import(`./FileReadTool.js?ts=${Date.now()}-${Math.random()}`)
}

const originalDisableToolReminders = process.env.GAKR_DISABLE_TOOL_REMINDERS

let lockAcquired = false

afterEach(() => {
  try {
    if (originalDisableToolReminders === undefined) {
      delete process.env.GAKR_DISABLE_TOOL_REMINDERS
    } else {
      process.env.GAKR_DISABLE_TOOL_REMINDERS = originalDisableToolReminders
    }
  } finally {
    if (lockAcquired) {
      releaseSharedMutationLock()
      lockAcquired = false
    }
  }
})

test('GAKR_DISABLE_TOOL_REMINDERS suppresses FileRead mitigation reminders', async () => {
  const {
    CYBER_RISK_MITIGATION_REMINDER,
    FileReadTool,
  } = await importFreshFileReadTool()

  await acquireSharedMutationLock('tools/FileReadTool/FileReadTool.test.ts')
  lockAcquired = true
  process.env.GAKR_DISABLE_TOOL_REMINDERS = '1'

  const block = FileReadTool.mapToolResultToToolResultBlockParam(
    textReadOutput(),
    'toolu_read',
  )

  expect(block.type).toBe('tool_result')
  if (typeof block.content !== 'string') {
    throw new Error('expected FileRead text result content to be a string')
  }
  expect(block.content).not.toContain(CYBER_RISK_MITIGATION_REMINDER)
})

function textReadOutput() {
  return {
    type: 'text' as const,
    file: {
      filePath: 'demo.ts',
      content: 'export const demo = true\n',
      numLines: 1,
      startLine: 1,
      totalLines: 1,
    },
  }
}
