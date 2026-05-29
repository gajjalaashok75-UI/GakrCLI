import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'
import { matchSessionMode } from './coordinatorMode.js'

const originalGakrCoordinatorMode = process.env.GAKR_CODE_COORDINATOR_MODE

beforeEach(async () => {
  await acquireSharedMutationLock('coordinatorMode.test.ts')
  delete process.env.GAKR_CODE_COORDINATOR_MODE
})

afterEach(() => {
  try {
    if (originalGakrCoordinatorMode === undefined) {
      delete process.env.GAKR_CODE_COORDINATOR_MODE
    } else {
      process.env.GAKR_CODE_COORDINATOR_MODE = originalGakrCoordinatorMode
    }

  } finally {
    releaseSharedMutationLock()
  }
})

test('matchSessionMode restores coordinator mode with the GakrCLI env var', () => {
  expect(matchSessionMode('coordinator')).toBe(
    'Entered coordinator mode to match resumed session.',
  )

  expect(process.env.GAKR_CODE_COORDINATOR_MODE).toBe('1')
})
