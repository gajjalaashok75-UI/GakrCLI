import { describe, expect, test } from 'bun:test'
import {
  stripHtmlComments,
  isMemoryFilePath,
  getLargeMemoryFiles,
} from '../../src/utils/gakrclimd'
import { buildEffectiveSystemPrompt } from '../../src/utils/systemPrompt'
import {
  createTempDir,
  cleanupTempDir,
  writeTempFile,
} from '../mocks/file-system'

// ─── GAKRCLI.md Integration with System Prompt ─────────────────────────

describe('Context build: GAKRCLI.md + system prompt integration', () => {
  test('buildEffectiveSystemPrompt passes through default prompt', () => {
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: 'You are GakrCLI.',
    })
    // Result is an array of strings (may be split differently)
    const joined = Array.from(result).join('')
    expect(joined).toBe('You are GakrCLI.')
  })

  test('buildEffectiveSystemPrompt handles empty prompts', () => {
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: '',
    })
    const joined = Array.from(result).join('')
    expect(joined).toBe('')
  })

  test('buildEffectiveSystemPrompt with overrideSystemPrompt replaces everything', () => {
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: 'Default',
      overrideSystemPrompt: 'Override',
    })
    const joined = Array.from(result).join('')
    expect(joined).toBe('Override')
  })

  test('buildEffectiveSystemPrompt with customSystemPrompt replaces default', () => {
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: 'Default',
      customSystemPrompt: 'Custom',
    })
    const joined = Array.from(result).join('')
    expect(joined).toBe('Custom')
  })

  test('buildEffectiveSystemPrompt with appendSystemPrompt includes both', () => {
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: 'Main prompt',
      appendSystemPrompt: 'Appended',
    })
    const joined = Array.from(result).join('')
    expect(joined).toContain('Main prompt')
    expect(joined).toContain('Appended')
    // Appended should come after main
    expect(joined.indexOf('Main prompt')).toBeLessThan(
      joined.indexOf('Appended'),
    )
  })
})

// ─── GAKRCLI.md Discovery with Real File System ───────────────────────

describe('Context build: GAKRCLI.md file system integration', () => {
  let tempDir: string

  test('strips HTML comments from GAKRCLI.md content', () => {
    const input = '<!-- this is a comment -->Actual content'
    const { content, stripped } = stripHtmlComments(input)
    expect(content).toBe('Actual content')
    expect(stripped).toBe(true)
  })

  test('preserves code blocks when stripping HTML comments', () => {
    const input = '```\n<!-- not a real comment -->\n```\nReal text'
    const { content } = stripHtmlComments(input)
    expect(content).toContain('<!-- not a real comment -->')
    expect(content).toContain('Real text')
  })

  test('isMemoryFilePath correctly identifies GAKRCLI.md paths', () => {
    expect(isMemoryFilePath('/project/GAKRCLI.md')).toBe(true)
    expect(isMemoryFilePath('/project/gakrcli.local.md')).toBe(true)
    const sep = require('node:path').sep
    expect(isMemoryFilePath(`/project${sep}.gakrcli${sep}rules${sep}file.md`)).toBe(true)
    expect(isMemoryFilePath('/project/README.md')).toBe(false)
    expect(isMemoryFilePath('/project/src/index.ts')).toBe(false)
  })
})

// ─── Large Memory File Filtering ──────────────────────────────────────

describe('Context build: large memory file filtering', () => {
  test('getLargeMemoryFiles returns empty for empty input', () => {
    expect(getLargeMemoryFiles([])).toEqual([])
  })

  test('getLargeMemoryFiles returns empty when all files are small', () => {
    const files = [
      { path: '/a/GAKRCLI.md', content: 'small' },
      { path: '/b/GAKRCLI.md', content: 'also small' },
    ]
    expect(getLargeMemoryFiles(files)).toEqual([])
  })
})
