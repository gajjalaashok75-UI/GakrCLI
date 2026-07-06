import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { clearBundledSkills, getBundledSkills } from '../bundledSkills.js'
import { initBundledSkills } from './index.js'

const originalUserType = process.env.USER_TYPE

beforeEach(async () => {
  (globalThis as any).MACRO = { VERSION: '0.0.0-test' }
  await acquireSharedMutationLock('skills/bundled/index.test.ts')
  clearBundledSkills()
  process.env.USER_TYPE = 'ant'
})

afterEach(() => {
  try {
    delete (globalThis as any).MACRO
    clearBundledSkills()
    if (originalUserType === undefined) {
      delete process.env.USER_TYPE
    } else {
      process.env.USER_TYPE = originalUserType
    }
  } finally {
    releaseSharedMutationLock()
  }
})

describe('initBundledSkills', () => {
  test('registers GakrCLI bundled skills', () => {
    initBundledSkills()

    const skillNames = getBundledSkills().map(skill => skill.name)

    // Skills registered unconditionally
    expect(skillNames).toContain('update-config')
    expect(skillNames).toContain('keybindings-help')
    expect(skillNames).toContain('debug')
    expect(skillNames).toContain('simplify')
    expect(skillNames).toContain('batch')
    expect(skillNames).toContain('loop')

    // Verify initBundledSkills ran without throwing
    expect(skillNames.length).toBeGreaterThan(0)
  })
})
