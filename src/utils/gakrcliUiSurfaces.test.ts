import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { homedir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

import { isInGlobalGakrCLIFolder } from '../components/permissions/FilePermissionDialog/permissionOptions.tsx'
import { optionForPermissionSaveDestination } from '../components/permissions/rules/AddPermissionRules.tsx'
import { getDefaultPermissionModeOptions } from './permissions/defaultPermissionModeOptions.ts'
import {
  getGakrCLISkillScope,
  isGakrCLISettingsPath,
} from './permissions/filesystem.ts'
import { getValidationTip } from './settings/validationTips.ts'

const originalConfigDir = process.env.GAKR_CONFIG_DIR

beforeEach(async () => {
  await acquireSharedMutationLock('gakrcliUiSurfaces.test.ts')
})

afterEach(() => {
  try {
    if (originalConfigDir === undefined) {
      delete process.env.GAKR_CONFIG_DIR
    } else {
      process.env.GAKR_CONFIG_DIR = originalConfigDir
    }
  } finally {
    releaseSharedMutationLock()
  }
})

describe('GakrCLI settings path surfaces', () => {
  test('isGakrCLISettingsPath recognizes project .gakrcli settings files', () => {
    expect(
      isGakrCLISettingsPath(
        join(process.cwd(), '.gakrcli', 'settings.json'),
      ),
    ).toBe(true)

    expect(
      isGakrCLISettingsPath(
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

  test('permission dialog treats ~/.gakrcli as the global GakrCLI folder', () => {
    process.env.GAKR_CONFIG_DIR = join(homedir(), '.gakrcli')

    expect(
      isInGlobalGakrCLIFolder(
        join(homedir(), '.gakrcli', 'settings.json'),
      ),
    ).toBe(true)
    expect(
      isInGlobalGakrCLIFolder(join(homedir(), '.gakrcli', 'settings.json')),
    ).toBe(true)
  })

  test('permission dialog does not treat arbitrary GAKR_CONFIG_DIR as the global GakrCLI folder', () => {
    process.env.GAKR_CONFIG_DIR = join(homedir(), 'custom-gakrcli')

    expect(
      isInGlobalGakrCLIFolder(
        join(homedir(), 'custom-gakrcli', 'settings.json'),
      ),
    ).toBe(false)
  })

  test('global skill scope recognizes ~/.gakrcli and legacy ~/.gakrcli skills', () => {
    process.env.GAKR_CONFIG_DIR = join(homedir(), '.gakrcli')

    expect(
      getGakrCLISkillScope(
        join(homedir(), '.gakrcli', 'skills', 'demo', 'SKILL.md'),
      ),
    ).toEqual({
      skillName: 'demo',
      pattern: '~/.gakrcli/skills/demo/**',
    })

    expect(
      getGakrCLISkillScope(
        join(homedir(), '.gakrcli', 'skills', 'legacy', 'SKILL.md'),
      ),
    ).toEqual({
      skillName: 'legacy',
      pattern: '~/.gakrcli/skills/legacy/**',
    })
  })

  test('global skill scope does not emit fixed rules for arbitrary GAKR_CONFIG_DIR skills', () => {
    process.env.GAKR_CONFIG_DIR = join(homedir(), 'custom-gakrcli')

    expect(
      getGakrCLISkillScope(
        join(homedir(), 'custom-gakrcli', 'skills', 'demo', 'SKILL.md'),
      ),
    ).toBe(null)
  })
})

describe('GakrCLI validation tips', () => {
  test('permissions.defaultMode invalid value keeps suggestion but no GakrCLI docs link', () => {
    const tip = getValidationTip({
      path: 'permissions.defaultMode',
      code: 'invalid_value',
      enumValues: [
        'acceptEdits',
        'bypassPermissions',
        'default',
        'dontAsk',
        'fullAccess',
        'plan',
      ],
    })

    expect(tip).toEqual({
      suggestion:
        'Valid modes: "acceptEdits" (ask before file changes), "plan" (analysis only), "bypassPermissions" (auto-accept prompts), "fullAccess" (skip even hard safety-check prompts), or "default" (standard behavior)',
    })
  })
})

describe('GakrCLI permission mode surfaces', () => {
  test('default permission mode picker excludes dangerous persisted modes', () => {
    const options = getDefaultPermissionModeOptions(true)

    expect(options).not.toContain('bypassPermissions')
    expect(options).not.toContain('fullAccess')
  })
})
