import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const promptSource = readFileSync(join(__dirname, '..', 'prompt.ts'), 'utf-8')

describe('prompt.ts fork-related text verification', () => {
  test('contains "omit `subagent_type`" fork guidance', () => {
    expect(promptSource).toMatch(/omit.*subagent_type/)
  })

  test('contains `forkEnabled` in at least 3 locations', () => {
    const matches = promptSource.match(/forkEnabled/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(6)
  })

  test('forkEnabled negation is accepted for the background-task gate', () => {
    // The `!forkEnabled` gate intentionally hides background-task instructions
    // when fork mode is active (fork handles its own concurrency).
    const negationLine = promptSource
      .split('\n')
      .find(
        line =>
          line.includes('!forkEnabled') &&
          !line.includes('//'),
      )
    // The negation exists and is intentional — just verify it's there
    expect(negationLine).toBeDefined()
  })

  test('uses "fresh agent" terminology (fork-enabled prompt)', () => {
    expect(promptSource).toContain('fresh agent')
    // "non-fork" should not appear
    expect(promptSource).not.toContain('non-fork')
  })

  test('has forked-agent examples', () => {
    // Fork examples should appear in the prompt
    expect(promptSource).toContain('When to fork')
    expect(promptSource).toContain("Don't peek")
    expect(promptSource).toContain("Don't race")
  })
})
