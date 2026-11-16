import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

import { cleanupOldMessageFilesInBackground } from './cleanup.js'
import { setGakrCLIConfigHomeDirForTesting } from './envUtils.js'
import { resetSettingsCache } from './settings/settingsCache.js'

const tempDirs: string[] = []

afterEach(async () => {
  setGakrCLIConfigHomeDirForTesting(undefined)
  resetSettingsCache()
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

/**
 * A day whose event file is older than any configured cleanup period, so
 * cleanup prunes it and (depending on the period) rolls its totals up first.
 */
function oldEventLine(configDir: string): string {
  return `${JSON.stringify({
    v: 1,
    id: 'fixture-old',
    ts: new Date(2000, 0, 1, 12).getTime(),
    session: 'fixture-session',
    project: configDir,
    model: 'fixture-model',
    route: 'fixture-route',
    source: 'repl_main_thread',
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    webSearch: 0,
  })}\n`
}

async function runUsageCleanup(
  configDir: string,
  opts: { enablePersistence?: boolean } = {},
): Promise<{
  eventsPresent: boolean
  rollupPresent: boolean
}> {
  const eventsFile = join(configDir, 'usage', 'events', '2000-01-01.jsonl')
  const rollupFile = join(configDir, 'usage', 'rollups', '2000-01.json')
  await mkdir(dirname(eventsFile), { recursive: true })
  await writeFile(eventsFile, oldEventLine(configDir))

  // Tests run under NODE_ENV=test, where persistence is skipped by default.
  const priorPersistence = process.env.TEST_ENABLE_SESSION_PERSISTENCE
  if (opts.enablePersistence) {
    process.env.TEST_ENABLE_SESSION_PERSISTENCE = '1'
  }
  try {
    await cleanupOldMessageFilesInBackground()
  } finally {
    if (priorPersistence === undefined) {
      delete process.env.TEST_ENABLE_SESSION_PERSISTENCE
    } else {
      process.env.TEST_ENABLE_SESSION_PERSISTENCE = priorPersistence
    }
  }

  return {
    eventsPresent: await stat(eventsFile).then(
      () => true,
      () => false,
    ),
    rollupPresent: await stat(rollupFile).then(
      () => true,
      () => false,
    ),
  }
}

async function setupConfigDir(cleanupPeriodDays: number): Promise<string> {
  const configDir = join(
    tmpdir(),
    `gakrcli-cleanup-usage-${cleanupPeriodDays}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
  tempDirs.push(configDir)
  await mkdir(configDir, { recursive: true })
  await writeFile(
    join(configDir, 'settings.json'),
    JSON.stringify({ cleanupPeriodDays }),
  )
  setGakrCLIConfigHomeDirForTesting(configDir)
  resetSettingsCache()
  return configDir
}

describe('cleanup usage ledger retention', () => {
  test('cleanupPeriodDays 0 deletes old events without saving totals', async () => {
    const configDir = await setupConfigDir(0)
    expect(await runUsageCleanup(configDir)).toEqual({
      eventsPresent: false,
      rollupPresent: false,
    })
  }, 30_000)

  test('the default period saves daily totals before pruning events', async () => {
    const configDir = await setupConfigDir(30)
    expect(await runUsageCleanup(configDir, { enablePersistence: true })).toEqual({
      eventsPresent: false,
      rollupPresent: true,
    })
  }, 30_000)
})
