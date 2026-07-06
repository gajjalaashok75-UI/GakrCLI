import { describe, expect, test, mock } from 'bun:test'

// ── Mocks ────────────────────────────────────────────
// Mock companion.js so call() doesn't hit real storage.
const mockGetCompanion = mock(() => null)
const mockRollWithSeed = mock(() => ({
  species: 'mushroom',
  rarity: 'common',
  bones: { species: 'mushroom' as string, rarity: 'common' as string },
}))
const mockGenerateSeed = mock(() => 'test-seed')

mock.module('../../buddy/companion.js', () => ({
  getCompanion: mockGetCompanion,
  rollWithSeed: mockRollWithSeed,
  generateSeed: mockGenerateSeed,
}))

mock.module('../../utils/config.js', () => ({
  getGlobalConfig: () => ({ companionMuted: false }),
  saveGlobalConfig: () => {},
}))

mock.module('../../buddy/companionReact.js', () => ({
  triggerCompanionReaction: () => {},
}))

// ── Import the module under test ──
const { default: buddyCommand } = await import('../index.js')
const { call } = await import('../buddy.js')

// ── Helpers ──────────────────────────────────────────

const HELP_ARGS = ['help', '-h', '--help']
const INFO_ARGS = ['list', 'show', 'display', 'current', 'view']

const noop = () => {}
const baseContext = {
  messages: [],
  setAppState: () => {},
  getAppState: () => ({ companionReaction: undefined }),
  options: { tools: [] },
  onChangeAPIKey: noop,
  setMessages: noop,
} as any

// ── Tests ────────────────────────────────────────────

describe('buddy command', () => {
  test('command metadata', () => {
    expect(buddyCommand.name).toBe('buddy')
    expect(buddyCommand.type).toBe('local-jsx')
    expect(typeof buddyCommand.load).toBe('function')
  })

  test.each(HELP_ARGS)('/buddy %s shows help', async (arg) => {
    let output = ''
    const onDone = (text: string) => { output = text }
    await call(onDone, baseContext, arg)
    expect(output).toContain('Usage: /buddy')
    expect(output).toContain('status')
    expect(output).toContain('help')
  })

  test.each(INFO_ARGS)('/buddy %s shows "no companion"', async (arg) => {
    mockGetCompanion.mockImplementation(() => null)
    let output = ''
    const onDone = (text: string) => { output = text }
    await call(onDone, baseContext, arg)
    expect(output).toContain('No companion hatched yet')
  })

  test('/buddy status shows "no companion" when none hatched', async () => {
    mockGetCompanion.mockImplementation(() => null)
    let output = ''
    const onDone = (text: string) => { output = text }
    await call(onDone, baseContext, 'status')
    expect(output).toContain('No companion hatched yet')
  })

  test('/buddy pet shows "no companion" when none hatched', async () => {
    mockGetCompanion.mockImplementation(() => null)
    let output = ''
    const onDone = (text: string) => { output = text }
    await call(onDone, baseContext, 'pet')
    expect(output).toContain('no companion yet')
  })

  test('/buddy off mutes companion', async () => {
    const onDone = () => {}
    await expect(call(onDone, baseContext, 'off')).resolves.toBeNull()
  })

  test('/buddy on unmutes companion', async () => {
    const onDone = () => {}
    await expect(call(onDone, baseContext, 'on')).resolves.toBeNull()
  })

  test('/buddy with no args hatches a companion', async () => {
    mockGetCompanion.mockImplementation(() => null)
    let output = ''
    const onDone = (text: string) => { output = text }
    await call(onDone, baseContext, '')
    expect(output).toContain('A wild companion appeared!')
    expect(output).toContain('Rarity:')
  })
})
