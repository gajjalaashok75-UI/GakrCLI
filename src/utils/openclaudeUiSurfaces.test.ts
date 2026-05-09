import { describe, expect, test } from 'bun:test'
import { join } from 'path'

import { optionForPermissionSaveDestination } from '../components/permissions/rules/AddPermissionRules.tsx'
import { isgakrcliSettingsPath } from './permissions/filesystem.ts'
import { getValidationTip } from './settings/validationTips.ts'

describe('GakrCLI settings path surfaces', () => {
  test('isgakrcliSettingsPath recognizes project .gakrcli settings files', () => {
    expect(
      isgakrcliSettingsPath(
        join(process.cwd(), '.gakrcli', 'settings.json'),
      ),
    ).toBe(true)

    expect(
      isgakrcliSettingsPath(
        join(process.cwd(), '.gakrcli', 'settings.local.json'),
      ),
    ).toBe(true)
  })

  test('permission save destinations point user settings to ~/.gakrcli', () => {
    expect(optionForPermissionSaveDestination('userSettings')).toEqual({
      label: 'User settings',
      description: 'Saved in ~/.gakrcli/settings.json',
      value: 'userSettings',
    })
  })

  test('permission save destinations point project settings to .gakrcli', () => {
    expect(optionForPermissionSaveDestination('projectSettings')).toEqual({
      label: 'Project settings',
      description: 'Checked in at .gakrcli/settings.json',
      value: 'projectSettings',
    })

    expect(optionForPermissionSaveDestination('localSettings')).toEqual({
      label: 'Project settings (local)',
      description: 'Saved in .gakrcli/settings.local.json',
      value: 'localSettings',
    })
  })
})

describe('GakrCLI validation tips', () => {
  test('permissions.defaultMode invalid value keeps suggestion but no Claude docs link', () => {
    const tip = getValidationTip({
      path: 'permissions.defaultMode',
      code: 'invalid_value',
      enumValues: [
        'acceptEdits',
        'bypassPermissions',
        'default',
        'dontAsk',
        'plan',
      ],
    })

    expect(tip).toEqual({
      suggestion:
        'Valid modes: "acceptEdits" (ask before file changes), "plan" (analysis only), "bypassPermissions" (auto-accept all), or "default" (standard behavior)',
    })
  })
})
