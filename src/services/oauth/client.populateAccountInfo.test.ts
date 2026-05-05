import { expect, test } from 'bun:test'
import { shouldRefreshOAuthAccountInfo } from './client.js'

test('OAuth account info population does not refresh when Claude.ai auth is inactive', () => {
  expect(
    shouldRefreshOAuthAccountInfo({
      hasCompleteAccountInfo: false,
      isGakrcliAiSubscriber: false,
      hasProfileScope: true,
    }),
  ).toBe(false)
})

test('OAuth account info population still refreshes active Claude.ai auth', () => {
  expect(
    shouldRefreshOAuthAccountInfo({
      hasCompleteAccountInfo: false,
      isGakrcliAiSubscriber: true,
      hasProfileScope: true,
    }),
  ).toBe(true)
})

test('OAuth account info population skips refresh when profile scope is missing', () => {
  expect(
    shouldRefreshOAuthAccountInfo({
      hasCompleteAccountInfo: false,
      isGakrcliAiSubscriber: true,
      hasProfileScope: false,
    }),
  ).toBe(false)
})

test('OAuth account info population skips refresh when account info is complete', () => {
  expect(
    shouldRefreshOAuthAccountInfo({
      hasCompleteAccountInfo: true,
      isGakrcliAiSubscriber: true,
      hasProfileScope: true,
    }),
  ).toBe(false)
})
