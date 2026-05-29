import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldBubbleAsyncAgentPermissionPrompts } from './permissionPromptPolicy.js'

test('background agents bubble permission prompts in interactive sessions', () => {
  assert.equal(
    shouldBubbleAsyncAgentPermissionPrompts({
      shouldRunAsync: true,
      isNonInteractiveSession: false,
      shouldAvoidPermissionPrompts: false,
    }),
    true,
  )
})

test('background agents do not bubble permission prompts in headless contexts', () => {
  assert.equal(
    shouldBubbleAsyncAgentPermissionPrompts({
      shouldRunAsync: true,
      isNonInteractiveSession: true,
      shouldAvoidPermissionPrompts: false,
    }),
    false,
  )
  assert.equal(
    shouldBubbleAsyncAgentPermissionPrompts({
      shouldRunAsync: true,
      isNonInteractiveSession: false,
      shouldAvoidPermissionPrompts: true,
    }),
    false,
  )
})

test('foreground agents do not need async permission bubbling', () => {
  assert.equal(
    shouldBubbleAsyncAgentPermissionPrompts({
      shouldRunAsync: false,
      isNonInteractiveSession: false,
      shouldAvoidPermissionPrompts: false,
    }),
    false,
  )
})
