import { afterEach, expect, test } from 'bun:test'

import {
  CYBER_RISK_MITIGATION_REMINDER,
  FileReadTool,
  type Output,
} from './FileReadTool.js'

const originalDisableToolReminders = process.env.GAKR_DISABLE_TOOL_REMINDERS

afterEach(() => {
  if (originalDisableToolReminders === undefined) {
    delete process.env.GAKR_DISABLE_TOOL_REMINDERS
  } else {
    process.env.GAKR_DISABLE_TOOL_REMINDERS = originalDisableToolReminders
  }
})

function textReadOutput(): Output {
  return {
    type: 'text',
    file: {
      filePath: 'demo.ts',
      content: 'export const demo = true\n',
      numLines: 1,
      startLine: 1,
      totalLines: 1,
    },
  }
}

test('GAKR_DISABLE_TOOL_REMINDERS suppresses FileRead mitigation reminders', () => {
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
