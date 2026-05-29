import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'
import type { Attachment } from './attachments.js'
import { normalizeAttachmentForAPI } from './messages.js'

beforeEach(async () => {
  await acquireSharedMutationLock('utils/messages.toolReminders.test.ts')
})

afterEach(() => {
  delete process.env.GAKR_DISABLE_TOOL_REMINDERS
  releaseSharedMutationLock()
})

describe('tool reminder attachments', () => {
  test('GAKR_DISABLE_TOOL_REMINDERS suppresses todo reminders', () => {
    process.env.GAKR_DISABLE_TOOL_REMINDERS = '1'

    const messages = normalizeAttachmentForAPI({
      type: 'todo_reminder',
      content: [{ status: 'pending', content: 'ship it' }],
    } as Attachment)

    expect(messages).toEqual([])
  })

  test('todo reminders are emitted when the kill switch is unset', () => {
    const messages = normalizeAttachmentForAPI({
      type: 'todo_reminder',
      content: [],
    } as Attachment)

    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0]?.message.content).toContain('TodoWrite')
  })
})
