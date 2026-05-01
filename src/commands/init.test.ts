import { afterEach, expect, mock, test } from 'bun:test'

const originalGakrcliNewInit = process.env.GAKR_CODE_NEW_INIT

async function importInitCommand() {
  return (await import(`./init.ts?ts=${Date.now()}-${Math.random()}`)).default
}

afterEach(() => {
  mock.restore()

  if (originalGakrcliNewInit === undefined) {
    delete process.env.GAKR_CODE_NEW_INIT
  } else {
    process.env.GAKR_CODE_NEW_INIT = originalGakrcliNewInit
  }
})

test('NEW_INIT prompt preserves existing root GAKRCLI.md by default', async () => {
  process.env.GAKR_CODE_NEW_INIT = '1'

  mock.module('../projectOnboardingState.js', () => ({
    maybeMarkProjectOnboardingComplete: () => {},
  }))
  mock.module('./initMode.js', () => ({
    isNewInitEnabled: () => true,
  }))

  const command = await importInitCommand()
  const blocks = await command.getPromptForCommand()

  expect(blocks).toHaveLength(1)
  expect(blocks[0]?.type).toBe('text')
  expect(String(blocks[0]?.text)).toContain(
    'checked-in root `GAKRCLI.md` and does NOT already have a root `AGENTS.md`',
  )
  expect(String(blocks[0]?.text)).toContain(
    'do NOT silently create a second root instruction file',
  )
  expect(String(blocks[0]?.text)).toContain(
    'update the existing root `GAKRCLI.md` in place by default',
  )
})
