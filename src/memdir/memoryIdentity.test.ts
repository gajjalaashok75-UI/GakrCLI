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
