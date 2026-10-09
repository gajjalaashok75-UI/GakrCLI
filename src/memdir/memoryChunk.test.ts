import { describe, expect, it } from 'bun:test'
import { chunkMarkdown } from './memoryChunk.js'

describe('chunkMarkdown', () => {
  it('returns no chunks for empty or whitespace-only content', () => {
    expect(chunkMarkdown('')).toEqual([])
    expect(chunkMarkdown('\n\n   \n')).toEqual([])
  })

  it('chunks pre-heading content under a null heading', () => {
    const chunks = chunkMarkdown('Intro paragraph.\n\nSecond line.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].heading).toBeNull()
    expect(chunks[0].text).toBe('Intro paragraph.\n\nSecond line.')
    expect(chunks[0].index).toBe(0)
  })

  it('starts a new chunk at each heading and records the heading', () => {
    const chunks = chunkMarkdown(
      'Preamble text.\n\n## Deploy steps\n\nRun the migration.\n\n## Rollback\n\nRevert the migration.',
    )
    expect(chunks.map(c => c.heading)).toEqual([null, 'Deploy steps', 'Rollback'])
    expect(chunks.map(c => c.text)).toEqual([
      'Preamble text.',
      'Run the migration.',
      'Revert the migration.',
    ])
  })

  it('records the innermost heading for nested sections', () => {
    const chunks = chunkMarkdown('# Top\n\ntop body.\n\n## Nested\n\nNested body.\n\n# Next\n\nNext body.')
    expect(chunks.map(c => c.heading)).toEqual(['Top', 'Nested', 'Next'])
  })

  it('emits nothing for a parent heading that has no body of its own', () => {
    const chunks = chunkMarkdown('# Top\n\n## Nested\n\nNested body.')
    // The `# Top` heading owns no text, so it cannot be cited on its own.
    expect(chunks.map(c => c.heading)).toEqual(['Nested'])
  })

  it('does not emit a chunk for a heading with no body', () => {
    const chunks = chunkMarkdown('## Empty section\n\n## Real section\n\nBody here.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].heading).toBe('Real section')
  })

  it('splits a long section on paragraph boundaries without crossing it', () => {
    const paragraph = 'x'.repeat(400)
    const chunks = chunkMarkdown(`## Big\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}`, 900)
    expect(chunks.length).toBe(2)
    for (const chunk of chunks) {
      expect(chunk.heading).toBe('Big')
      expect(chunk.text.length).toBeLessThanOrEqual(900)
    }
  })

  it('hard-splits a single paragraph larger than the limit', () => {
    const chunks = chunkMarkdown(`## Huge\n\n${'y'.repeat(2500)}`, 1000)
    expect(chunks.length).toBe(3)
    expect(chunks.every(c => c.text.length <= 1000)).toBe(true)
    expect(chunks.every(c => c.heading === 'Huge')).toBe(true)
  })

  it('normalizes CRLF line endings', () => {
    const chunks = chunkMarkdown('## Section\r\n\r\nBody line.\r\nSecond line.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe('Body line.\nSecond line.')
  })

  it('produces unique and stable keys', () => {
    const chunks = chunkMarkdown('## A\n\nOne.\n\n## A\n\nTwo.')
    const keys = chunks.map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(chunkMarkdown('## A\n\nOne.').map(c => c.key)).toEqual([keys[0]])
  })
})
