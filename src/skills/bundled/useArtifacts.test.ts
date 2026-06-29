import { describe, expect, test } from 'bun:test'
import {
  clearBundledSkills,
  getBundledSkills,
} from '../bundledSkills.js'
import { registerUseArtifactsSkill } from './useArtifacts.js'

describe('registerUseArtifactsSkill', () => {
  test('registers the use-artifacts bundled skill', () => {
    clearBundledSkills()
    registerUseArtifactsSkill()
    const skills = getBundledSkills()
    const skill = skills.find(s => s.name === 'use-artifacts')
    expect(skill).toBeDefined()
    expect(skill!.description).toBeTruthy()
    expect(skill!.userInvocable).toBe(true)
  })

  test.skip('skill description contains artifact guidance', () => {
    clearBundledSkills()
    registerUseArtifactsSkill()
    const skills = getBundledSkills()
    const skill = skills.find(s => s.name === 'use-artifacts')!
    expect(skill.description).toMatch(/when and how to use the artifact tool/i)
  })
})
