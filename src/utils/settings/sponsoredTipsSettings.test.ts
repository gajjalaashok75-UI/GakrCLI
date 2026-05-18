import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

beforeEach(async () => {
  await acquireSharedMutationLock('utils/settings/sponsoredTipsSettings.test.ts')
})

afterEach(() => {
  releaseSharedMutationLock()
})

describe('SettingsSchema sponsored tips settings', () => {
  test('accepts sponsored tip controls', async () => {
    const { SettingsSchema } = await import('./types.js')
    const result = SettingsSchema().safeParse({
      sponsoredTipsEnabled: false,
      sponsoredTipsFrequency: 25,
    })

    expect(result.success).toBe(true)
  })

  test('rejects negative sponsored tip frequency', async () => {
    const { SettingsSchema } = await import('./types.js')
    const result = SettingsSchema().safeParse({
      sponsoredTipsFrequency: -1,
    })

    expect(result.success).toBe(false)
  })
})
