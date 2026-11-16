/**
 * Regression tests for /usage, /cost, and /stats command metadata.
 *
 * These are three separate commands in upstream (openclaude) and stay that way
 * in GakrCLI — /cost and /stats are NOT folded into /usage as aliases.
 * Verifies:
 *   - /usage has no aliases and describes usage + plan limits
 *   - /cost is its own command with the session cost description
 *   - /stats is its own command with the usage statistics description
 *   - none of the three is restricted exclusively to gakrcli-ai subscribers
 */

import { mock, describe, test, expect } from 'bun:test'
import type { Command } from '../../../commands.js'

// Must mock before importing anything that pulls in bootstrap/state
import { logMock } from '../../../../tests/mocks/log.js'
mock.module('src/utils/log.ts', logMock)

import { debugMock } from '../../../../tests/mocks/debug.js'
mock.module('src/utils/debug.ts', debugMock)

mock.module('bun:bundle', () => ({ feature: () => false }))

mock.module('src/utils/auth.ts', () => ({
  isGakrCLIAISubscriber: () => false,
  getOAuthAccount: () => null,
}))

mock.module('src/services/gakrcliAiLimits.ts', () => ({
  currentLimits: { isUsingOverage: false },
}))

mock.module('src/cost-tracker.ts', () => ({
  formatTotalCost: () => 'Total cost: $0.0012',
}))

mock.module('src/utils/config.ts', () => ({
  getCurrentProjectConfig: () => ({}),
  saveCurrentProjectConfig: () => {},
  getGlobalConfig: () => ({}),
}))

// ── helpers ──────────────────────────────────────────────────────────────────

async function loadUsageCommand(): Promise<Command> {
  const mod = await import('../index.js')
  return mod.default
}

async function loadCostCommand(): Promise<Command> {
  const mod = await import('../../cost/index.js')
  return mod.default
}

async function loadStatsCommand(): Promise<Command> {
  const mod = await import('../../stats/index.js')
  return mod.default
}

function isExclusivelyGakrCLIAi(cmd: Command): boolean {
  const avail = (cmd as { availability?: string[] }).availability
  return Array.isArray(avail) && avail.length === 1 && avail[0] === 'gakrcli-ai'
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('usage command — metadata', () => {
  test('name is "usage"', async () => {
    const cmd = await loadUsageCommand()
    expect(cmd.name).toBe('usage')
  })

  test('has no aliases (cost/stats stay separate commands)', async () => {
    const cmd = await loadUsageCommand()
    expect(cmd.aliases ?? []).toEqual([])
  })

  test('description mentions usage or plan', async () => {
    const cmd = await loadUsageCommand()
    const desc = cmd.description.toLowerCase()
    expect(desc.includes('usage') || desc.includes('plan')).toBe(true)
  })

  test('is NOT restricted exclusively to gakrcli-ai subscribers', async () => {
    const cmd = await loadUsageCommand()
    expect(isExclusivelyGakrCLIAi(cmd)).toBe(false)
  })
})

describe('cost command — standalone', () => {
  test('name is "cost"', async () => {
    const cmd = await loadCostCommand()
    expect(cmd.name).toBe('cost')
  })

  test('has no aliases', async () => {
    const cmd = await loadCostCommand()
    expect(cmd.aliases ?? []).toEqual([])
  })

  test('description mentions cost', async () => {
    const cmd = await loadCostCommand()
    expect(cmd.description.toLowerCase()).toContain('cost')
  })

  test('is NOT restricted exclusively to gakrcli-ai subscribers', async () => {
    const cmd = await loadCostCommand()
    expect(isExclusivelyGakrCLIAi(cmd)).toBe(false)
  })
})

describe('stats command — standalone', () => {
  test('name is "stats"', async () => {
    const cmd = await loadStatsCommand()
    expect(cmd.name).toBe('stats')
  })

  test('has no aliases', async () => {
    const cmd = await loadStatsCommand()
    expect(cmd.aliases ?? []).toEqual([])
  })

  test('description mentions stat', async () => {
    const cmd = await loadStatsCommand()
    expect(cmd.description.toLowerCase()).toContain('stat')
  })

  test('is NOT restricted exclusively to gakrcli-ai subscribers', async () => {
    const cmd = await loadStatsCommand()
    expect(isExclusivelyGakrCLIAi(cmd)).toBe(false)
  })
})
