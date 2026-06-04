import { expect, test } from 'bun:test'

import { buildMemoryLines } from './memdir.js'
import { WHAT_NOT_TO_SAVE_SECTION } from './memoryTypes.js'

test('memory prompts use GakrCLI identity and docs names', () => {
  const promptText = [
    ...WHAT_NOT_TO_SAVE_SECTION,
    ...buildMemoryLines('auto memory', '/tmp/gakrcli-memory/'),
  ].join('\n')

  expect(promptText).toContain('GAKRCLI.md')
  expect(promptText).toContain('Workspace files vs project auto-memory')
  expect(promptText).toContain('Project-specific auto-memory lives at')
  expect(promptText).toContain('Workspace-level memory and identity live at')
  expect(promptText).toContain('RULEBOOK.md')
  expect(promptText).toContain('IDENTITY.md')
  expect(promptText).toContain('SOUL.md')
  expect(promptText).not.toContain('CLAUDE.md')
  expect(promptText).not.toContain('Claude Code')
})

test('memory prompts use semantic files instead of dated session files', () => {
  const promptText = buildMemoryLines(
    'auto memory',
    '/tmp/gakrcli-memory/',
  ).join('\n')

  expect(promptText).toContain('Organize memory semantically by topic')
  expect(promptText).toContain('MEMORY.md')
  expect(promptText).not.toContain('Daily session files')
  expect(promptText).not.toContain('YYYY-MM-DD.md')
  expect(promptText).not.toContain('DD-MM-YYYY.md')
})
