import { afterEach, describe, expect, mock, test } from 'bun:test'

afterEach(() => {
  mock.restore()
})

describe('dangerousModePromptRuntime', () => {
  test('startup prompt state and acceptance persistence use the settings-backed runtime wiring', async () => {
    const actualSettings = await import(
      `../settings/settings.ts?actual=${Date.now()}-${Math.random()}`
    )
    let hasBypassAcceptance = false
    let hasFullAccessAcceptance = false
    const updates: Array<{
      source: string
      settings: Record<string, unknown>
    }> = []

    mock.module('../settings/settings.js', () => ({
      ...actualSettings,
      hasSkipDangerousModePermissionPrompt: () => hasBypassAcceptance,
      hasSkipFullAccessModePermissionPrompt: () => hasFullAccessAcceptance,
      updateSettingsForSource: (
        source: string,
        settings: Record<string, unknown>,
      ) => {
        updates.push({ source, settings })
        return { error: null }
      },
    }))

    const {
      getStartupDangerousPermissionPromptState,
      persistDangerousModeAcceptance,
    } = await import(
      `./dangerousModePromptRuntime.js?ts=${Date.now()}-${Math.random()}`
    )

    expect(
      getStartupDangerousPermissionPromptState({
        permissionMode: 'fullAccess',
        allowDangerouslySkipPermissions: false,
      }),
    ).toEqual({
      mode: 'fullAccess',
      shouldShow: true,
    })

    hasFullAccessAcceptance = true

    expect(
      getStartupDangerousPermissionPromptState({
        permissionMode: 'fullAccess',
        allowDangerouslySkipPermissions: false,
      }),
    ).toEqual({
      mode: 'fullAccess',
      shouldShow: false,
    })

    persistDangerousModeAcceptance('fullAccess')
    persistDangerousModeAcceptance('bypassPermissions')

    expect(updates).toEqual([
      {
        source: 'userSettings',
        settings: { skipFullAccessModePermissionPrompt: true },
      },
      {
        source: 'userSettings',
        settings: { skipDangerousModePermissionPrompt: true },
      },
    ])
  })
})
