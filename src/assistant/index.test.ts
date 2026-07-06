import { expect, test } from 'bun:test'
import {
  getAssistantActivationPath,
  getAssistantSystemPromptAddendum,
  initializeAssistantTeam,
  isAssistantForced,
  isAssistantMode,
  markAssistantForced,
  supportsRemoteAssistantSessions,
} from './index.js'
import { isKairosEnabled } from './gate.js'
import { discoverAssistantSessions } from './sessionDiscovery.js'

test.skip('open-build assistant mode can be forced locally', async () => {
  expect(isAssistantForced()).toBe(false)

  markAssistantForced()

  expect(isAssistantForced()).toBe(true)
  expect(isAssistantMode()).toBe(true)
  expect(getAssistantActivationPath()).toBe('--assistant')
  await expect(initializeAssistantTeam()).resolves.toBeUndefined()
  expect(supportsRemoteAssistantSessions()).toBe(false)
})

test.skip('open-build assistant prompt addendum explains local mode', () => {
  const addendum = getAssistantSystemPromptAddendum()

  expect(addendum).toContain('# Assistant Mode')
  expect(addendum).toContain('open build')
  expect(addendum).toContain('Cloud assistant backend features may be unavailable')
})

test.skip('open-build KAIROS gate is enabled', async () => {
  await expect(isKairosEnabled()).resolves.toBe(true)
})

test.skip('open-build assistant session discovery fails clearly', async () => {
  await expect(discoverAssistantSessions()).rejects.toThrow(
    'Assistant session discovery is not available in this open build',
  )
})
