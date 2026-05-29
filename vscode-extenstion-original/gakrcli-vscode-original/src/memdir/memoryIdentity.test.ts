import { expect, test } from 'bun:test'

import { buildMemoryLines } from './memdir.js'
import { WHAT_NOT_TO_SAVE_SECTION } from './memoryTypes.js'

test('memory prompts use GakrCLI identity and docs names', () => {
  const promptText = [
    ...WHAT_NOT_TO_SAVE_SECTION,
    ...buildMemoryLines('auto memory', '/tmp/gakrcli-memory/'),
  ].join('\n')

  expect(promptText).toContain('GAKRCLI.md')
  expect(promptText).not.toContain('CLAUDE.md')
  expect(promptText).not.toContain('Claude Code')
})
