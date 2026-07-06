import { expect, test } from 'bun:test'
import { shouldRefreshOAuthAccountInfo } from './client.js'

test('OAuth account info population does not refresh when GakrCLI.ai auth is inactive', () => {
  expect(
    shouldRefreshOAuthAccountInfo({
      hasCompleteAccountInfo: false,
      isGakrCLIAiSubscriber: false,
      hasProfileScope: true,
    }),
  ).toBe(false)
})

test('OAuth account info population still refreshes active GakrCLI.ai auth', () => {
  expect(
    shouldRefreshOAuthAccountInfo({
      hasCompleteAccountInfo: false,
      isGakrCLIAiSubscriber: true,
      hasProfileScope: true,
    }),
  ).toBe(true)
})

test('OAuth account info population skips refresh when profile scope is missing', () => {
  expect(
    shouldRefreshOAuthAccountInfo({
      hasCompleteAccountInfo: false,
      isGakrCLIAiSubscriber: true,
      hasProfileScope: false,
    }),
  ).toBe(false)
})

test('OAuth account info population skips refresh when account info is complete', () => {
  expect(
    shouldRefreshOAuthAccountInfo({
      hasCompleteAccountInfo: true,
      isGakrCLIAiSubscriber: true,
      hasProfileScope: true,
    }),
  ).toBe(false)
})
