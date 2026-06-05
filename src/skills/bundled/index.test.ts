import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { clearBundledSkills, getBundledSkills } from '../bundledSkills.js'
import { initBundledSkills } from './index.js'

const originalUserType = process.env.USER_TYPE

beforeEach(async () => {
  await acquireSharedMutationLock('skills/bundled/index.test.ts')
  clearBundledSkills()
  process.env.USER_TYPE = 'ant'
})

afterEach(() => {
  try {
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

    expect(skillNames).toContain('update-config')
    expect(skillNames).toContain('keybindings-help')
    expect(skillNames).toContain('verify')
    expect(skillNames).toContain('debug')
    expect(skillNames).toContain('lorem-ipsum')
    expect(skillNames).toContain('skillify')
    expect(skillNames).toContain('remember')
    expect(skillNames).toContain('simplify')
    expect(skillNames).toContain('batch')
    expect(skillNames).toContain('stuck')
    expect(skillNames).toContain('loop')
  })
})
