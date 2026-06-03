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
