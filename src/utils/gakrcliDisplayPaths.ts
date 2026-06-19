import { homedir } from 'os'
import { join } from 'path'
import {
  getGakrCLIConfigHomeDir,
  resolveGakrCLIConfigHomeDir,
  resolveConfigDirEnv,
} from './envUtils.js'
import { getDisplayPath } from './file.js'

function getUserConfigHomeForDisplay(): string {
  const configDirEnv = resolveConfigDirEnv({
    openGakrCLIConfigDir: process.env.GAKR_CONFIG_DIR,
    legacyConfigDir: process.env.GAKR_CONFIG_DIR,
  })

  if (configDirEnv) {
    return resolveGakrCLIConfigHomeDir({
      configDirEnv,
      homeDir: homedir(),
    })
  }

  return getGakrCLIConfigHomeDir()
}

export function getUserSettingsDisplayPath(): string {
  return getDisplayPath(join(getUserConfigHomeForDisplay(), 'settings.json'))
}

export function getUserSkillExampleDisplayPath(): string {
  return getDisplayPath(
    join(getUserConfigHomeForDisplay(), 'skills', '<name>', 'SKILL.md'),
  )
}
