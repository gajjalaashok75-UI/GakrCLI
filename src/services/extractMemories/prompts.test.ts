import { expect, test } from 'bun:test'

import { buildExtractAutoOnlyPrompt } from './prompts.js'

test('extract memory prompt includes workspace persistence routing', () => {
  const prompt = buildExtractAutoOnlyPrompt(
    3,
    '',
    false,
    '/tmp/gakrcli-workspace/projects/project/memory/',
  )

  expect(prompt).toContain('Workspace files vs project auto-memory')
  expect(prompt).toContain(
    'Project-specific auto-memory lives at `/tmp/gakrcli-workspace/projects/project/memory/`',
  )
  expect(prompt).toContain('RULEBOOK.md')
  expect(prompt).toContain('MEMORY.md')
  expect(prompt).toContain('IDENTITY.md')
  expect(prompt).toContain(
    'update that workspace file instead of duplicating it in project auto-memory',
  )
})

test('extract memory prompt forbids dated session memory files', () => {
  const prompt = buildExtractAutoOnlyPrompt(
    3,
    '',
    false,
    '/tmp/gakrcli-workspace/projects/project/memory/',
  )

  expect(prompt).not.toContain('Daily session files')
  expect(prompt).not.toContain('YYYY-MM-DD.md')
  expect(prompt).not.toContain('DD-MM-YYYY.md')
  expect(prompt).toContain('semantic topic files')
  expect(prompt).toContain('Do not create date-named session files')
})
