import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, test } from 'bun:test'

import type { PluginError } from '../../types/plugin.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { resolvePluginMcpEnvironment } from './mcpPluginIntegration.js'

const originalPluginCacheDir = process.env.GAKR_CODE_PLUGIN_CACHE_DIR
let tempDir: string | undefined
let lockAcquired = false

afterEach(async () => {
  try {
    process.env.GAKR_CODE_PLUGIN_CACHE_DIR = originalPluginCacheDir
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  } finally {
    if (lockAcquired) {
      releaseSharedMutationLock()
      lockAcquired = false
    }
  }
})

describe('resolvePluginMcpEnvironment', () => {
  test('sets plugin cwd for stdio MCP servers and resolves plugin variable aliases', async () => {
    await acquireSharedMutationLock('utils/plugins/mcpPluginIntegration.test.ts')
    lockAcquired = true
    tempDir = await mkdtemp(join(tmpdir(), 'gakrcli-plugin-mcp-'))
    process.env.GAKR_CODE_PLUGIN_CACHE_DIR = join(tempDir, 'plugins')

    const pluginRoot = join(tempDir, 'telegram')
    const errors: PluginError[] = []

    const resolved = resolvePluginMcpEnvironment(
      {
        command: 'bun',
        args: ['run', '--cwd', '${GAKR_PLUGIN_ROOT}', 'start'],
        env: {
          LEGACY_ROOT: '${GAKR_PLUGIN_ROOT}',
          LEGACY_DATA: '${GAKR_PLUGIN_DATA}',
        },
      },
      {
        path: pluginRoot,
        source: 'telegram@gakrcli-plugins-official',
      },
      undefined,
      errors,
      'telegram',
      'telegram',
    )

    if (resolved.type !== undefined && resolved.type !== 'stdio') {
      throw new Error('expected stdio MCP config')
    }

    expect(resolved.cwd).toBe(pluginRoot)
    expect(resolved.args?.[2]).toBe(
      process.platform === 'win32' ? pluginRoot.replace(/\\/g, '/') : pluginRoot,
    )
    expect(resolved.env?.LEGACY_ROOT).toBe(resolved.args?.[2])
    expect(resolved.env?.LEGACY_DATA).toContain('telegram-gakrcli-plugins-official')
    expect(errors).toEqual([])
  })
})
