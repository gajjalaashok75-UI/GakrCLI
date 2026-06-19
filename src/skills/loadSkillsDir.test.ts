import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { getSkillDirCommands, clearSkillCaches } from './loadSkillsDir.ts'
import {
  getAdditionalDirectoriesForGakrCLIMd,
  setAdditionalDirectoriesForGakrCLIMd,
} from '../bootstrap/state.js'
import { setGakrCLIConfigHomeDirForTesting } from '../utils/envUtils.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

function writeSkill(rootDir: string, skillPath: string): void {
  const skillDir = join(rootDir, '.gakrcli', 'skills', ...skillPath.split('/'))
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\ndescription: ${skillPath}\n---\n# ${skillPath}\n`,
    'utf8',
  )
}

function writeCommand(rootDir: string, commandName: string): void {
  const commandsDir = join(rootDir, '.gakrcli', 'commands')
  mkdirSync(commandsDir, { recursive: true })
  writeFileSync(
    join(commandsDir, `${commandName}.md`),
    `---\ndescription: ${commandName}\n---\n# ${commandName}\n`,
    'utf8',
  )
}

test('loads flat and nested skills with colon namespaces', async () => {
  await acquireSharedMutationLock('loadSkillsDir.test.ts')
  const configDir = mkdtempSync(join(tmpdir(), 'gakrcli-skills-'))
  const cwd = join(configDir, 'workspace')
  const originalConfigDir = process.env.GAKR_CONFIG_DIR

  try {
    mkdirSync(cwd, { recursive: true })
    writeSkill(configDir, 'flat-skill')
    writeSkill(configDir, 'git/commit')
    writeSkill(configDir, 'frontend/react/form')

    process.env.GAKR_CONFIG_DIR = configDir
    clearSkillCaches()

    const skills = await getSkillDirCommands(cwd)
    const fixtureSkillsRoot = join(configDir, '.gakrcli', 'skills')
    const promptSkills = skills.filter(
      (
        skill,
      ): skill is Extract<(typeof skills)[number], { type: 'prompt' }> & {
        skillRoot: string
      } =>
        skill.type === 'prompt' &&
        skill.skillRoot?.startsWith(fixtureSkillsRoot) === true,
    )
    const skillNames = promptSkills.map(skill => skill.name).sort()

    assert.deepEqual(skillNames, [
      'flat-skill',
      'frontend:react:form',
      'git:commit',
    ])

    const nestedSkill = promptSkills.find(skill => skill.name === 'git:commit')
    assert.ok(nestedSkill)
    assert.equal(nestedSkill.skillRoot, join(configDir, '.gakrcli', 'skills', 'git', 'commit'))

    const deepSkill = promptSkills.find(
      skill => skill.name === 'frontend:react:form',
    )
    assert.ok(deepSkill)
    assert.equal(
      deepSkill.skillRoot,
      join(configDir, '.gakrcli', 'skills', 'frontend', 'react', 'form'),
    )
  } finally {
    try {
      if (originalConfigDir === undefined) {
        delete process.env.GAKR_CONFIG_DIR
      } else {
        process.env.GAKR_CONFIG_DIR = originalConfigDir
      }
      clearSkillCaches()
      rmSync(configDir, { recursive: true, force: true })
    } finally {
      releaseSharedMutationLock()
    }
  }
})

test('skips npm global asset skills when user skills directory exists', async () => {
  await acquireSharedMutationLock('loadSkillsDir.test.ts')
  const homeDir = mkdtempSync(join(tmpdir(), 'gakrcli-home-'))
  const cwd = join(homeDir, 'workspace')
  const originalConfigDir = process.env.GAKR_CONFIG_DIR
  const originalHome = process.env.HOME
  const originalUserProfile = process.env.USERPROFILE

  try {
    mkdirSync(cwd, { recursive: true })
    writeSkill(homeDir, 'user-only')

    delete process.env.GAKR_CONFIG_DIR
    process.env.HOME = homeDir
    process.env.USERPROFILE = homeDir
    setGakrCLIConfigHomeDirForTesting(join(homeDir, '.gakrcli'))
    clearSkillCaches()

    const skills = await getSkillDirCommands(cwd)
    const skillNames = skills.map(skill => skill.name).sort()

    assert.deepEqual(skillNames, ['user-only'])
  } finally {
    try {
      if (originalConfigDir === undefined) {
        delete process.env.GAKR_CONFIG_DIR
      } else {
        process.env.GAKR_CONFIG_DIR = originalConfigDir
      }
      if (originalHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = originalHome
      }
      if (originalUserProfile === undefined) {
        delete process.env.USERPROFILE
      } else {
        process.env.USERPROFILE = originalUserProfile
      }
      setGakrCLIConfigHomeDirForTesting(undefined)
      clearSkillCaches()
      rmSync(homeDir, { recursive: true, force: true })
    } finally {
      releaseSharedMutationLock()
    }
  }
})

test('deduplicates loaded skills by name across loader sources', async () => {
  await acquireSharedMutationLock('loadSkillsDir.test.ts')
  const homeDir = mkdtempSync(join(tmpdir(), 'gakrcli-home-'))
  const configRoot = join(homeDir, 'config')
  const projectRoot = join(homeDir, 'project')
  const addDirRoot = join(homeDir, 'add-dir')
  const cwd = join(projectRoot, 'workspace')
  const originalConfigDir = process.env.GAKR_CONFIG_DIR
  const originalHome = process.env.HOME
  const originalUserProfile = process.env.USERPROFILE
  const originalAdditionalDirs = getAdditionalDirectoriesForGakrCLIMd()

  try {
    mkdirSync(cwd, { recursive: true })
    writeSkill(configRoot, 'duplicate')
    writeSkill(projectRoot, 'duplicate')
    writeSkill(projectRoot, 'project-only')
    writeSkill(addDirRoot, 'duplicate')
    writeSkill(addDirRoot, 'add-dir-only')
    writeCommand(projectRoot, 'duplicate')
    writeCommand(projectRoot, 'legacy-only')

    process.env.GAKR_CONFIG_DIR = join(configRoot, '.gakrcli')
    process.env.HOME = homeDir
    process.env.USERPROFILE = homeDir
    setAdditionalDirectoriesForGakrCLIMd([addDirRoot])
    clearSkillCaches()

    const skills = await getSkillDirCommands(cwd)
    const skillNames = skills.map(skill => skill.name).sort()

    assert.deepEqual(skillNames, [
      'add-dir-only',
      'duplicate',
      'legacy-only',
      'project-only',
    ])
  } finally {
    try {
      if (originalConfigDir === undefined) {
        delete process.env.GAKR_CONFIG_DIR
      } else {
        process.env.GAKR_CONFIG_DIR = originalConfigDir
      }
      if (originalHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = originalHome
      }
      if (originalUserProfile === undefined) {
        delete process.env.USERPROFILE
      } else {
        process.env.USERPROFILE = originalUserProfile
      }
      setAdditionalDirectoriesForGakrCLIMd(originalAdditionalDirs)
      clearSkillCaches()
      rmSync(homeDir, { recursive: true, force: true })
    } finally {
      releaseSharedMutationLock()
    }
  }
})

