import {
  getAdditionalDirectoriesForGakrCLIMd,
  getAllowedSettingSources,
  setAdditionalDirectoriesForGakrCLIMd,
  setAllowedSettingSources,
} from '../bootstrap/state.js'
import type { SettingSource } from '../utils/settings/constants.js'
import { resetSettingsCache } from '../utils/settings/settingsCache.js'

export type SettingSourceState = {
  additionalDirectories: string[]
  argv: string[]
  gakrcliCodeSimple: string | undefined
  sources: SettingSource[]
}

export function enableUserAndProjectSettingSources(): SettingSourceState {
  const originalSources = getAllowedSettingSources()
  const originalAdditionalDirectories = getAdditionalDirectoriesForGakrCLIMd()
  const originalArgv = [...process.argv]
  const originalGakrCLICodeSimple = process.env.GAKR_CODE_SIMPLE
  process.argv = process.argv.filter(arg => arg !== '--bare')
  delete process.env.GAKR_CODE_SIMPLE
  setAdditionalDirectoriesForGakrCLIMd([])
  setAllowedSettingSources([
    'userSettings',
    'projectSettings',
    'localSettings',
    'flagSettings',
    'policySettings',
  ])
  resetSettingsCache()
  return {
    additionalDirectories: originalAdditionalDirectories,
    argv: originalArgv,
    gakrcliCodeSimple: originalGakrCLICodeSimple,
    sources: originalSources,
  }
}

export function restoreSettingState(original: SettingSourceState): void {
  process.argv = original.argv
  if (original.gakrcliCodeSimple === undefined) {
    delete process.env.GAKR_CODE_SIMPLE
  } else {
    process.env.GAKR_CODE_SIMPLE = original.gakrcliCodeSimple
  }
  setAdditionalDirectoriesForGakrCLIMd(original.additionalDirectories)
  setAllowedSettingSources(original.sources)
  resetSettingsCache()
}
