import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  resetStateForTests,
  setCwdState,
  setOriginalCwd,
} from '../../bootstrap/state'
import { getTaskListId } from '../../utils/tasks'
import { getTeamFilePath } from '../../utils/swarm/teamHelpers'
import { initializeAssistantTeam } from '../index'

let tempDir = ''
let previousConfigDir: string | undefined

beforeEach(() => {
  previousConfigDir = process.env.GAKR_CONFIG_DIR
  tempDir = join(
    tmpdir(),
    `assistant-team-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
  process.env.GAKR_CONFIG_DIR = join(tempDir, 'config')
  resetStateForTests()
  setOriginalCwd(tempDir)
  setCwdState(tempDir)
})

afterEach(async () => {
  resetStateForTests()
  if (previousConfigDir === undefined) {
    delete process.env.GAKR_CONFIG_DIR
  } else {
    process.env.GAKR_CONFIG_DIR = previousConfigDir
  }
  await rm(tempDir, { recursive: true, force: true })
})

describe('initializeAssistantTeam', () => {
  test('returns undefined in open build (KAIROS-gated no-op)', async () => {
    const context = await initializeAssistantTeam()
    // Open-source build ships inert no-ops — KAIROS feature flag disabled.
    expect(context).toBeUndefined()
  })
})
