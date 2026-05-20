import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import {
  clearAgentDefinitionsCache,
  getAgentDefinitionsWithOverrides,
} from './loadAgentsDir.js'
import { loadMarkdownFilesForSubdir } from '../../utils/markdownConfigLoader.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

const originalEnv = {
  GAKR_CONFIG_DIR: process.env.GAKR_CONFIG_DIR,
  GAKR_CODE_SIMPLE: process.env.GAKR_CODE_SIMPLE,
  GAKR_CODE_USE_NATIVE_FILE_SEARCH:
    process.env.GAKR_CODE_USE_NATIVE_FILE_SEARCH,
}

let tempDir: string

beforeEach(async () => {
  await acquireSharedMutationLock('loadAgentsDir.test.ts')
  tempDir = await mkdtemp(join(tmpdir(), 'gakrcli-agents-test-'))
  process.env.GAKR_CONFIG_DIR = join(tempDir, '.gakrcli')
  process.env.GAKR_CODE_USE_NATIVE_FILE_SEARCH = '1'
  delete process.env.GAKR_CODE_SIMPLE
  clearAgentDefinitionsCache()
  loadMarkdownFilesForSubdir.cache.clear?.()
})

afterEach(async () => {
  try {
    await rm(tempDir, { recursive: true, force: true })
    restoreEnv('GAKR_CONFIG_DIR')
    restoreEnv('GAKR_CODE_SIMPLE')
    restoreEnv('GAKR_CODE_USE_NATIVE_FILE_SEARCH')
    clearAgentDefinitionsCache()
    loadMarkdownFilesForSubdir.cache.clear?.()
  } finally {
    releaseSharedMutationLock()
  }
})

function restoreEnv(key: keyof typeof originalEnv): void {
  const originalValue = originalEnv[key]
  if (originalValue === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = originalValue
  }
}

async function writeAgent(
  filePath: string,
  name: string,
  prompt = `You are ${name}.`,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(
    filePath,
    `---
name: ${name}
description: "Use for regression coverage"
---

${prompt}
`,
  )
}

describe('agent definition loading', () => {
  test('loads user agents from the GakrCLI config dir in simple mode', async () => {
    await writeAgent(
      join(process.env.GAKR_CONFIG_DIR!, 'agents', 'user-agent.md'),
      'user-agent',
    )

    process.env.GAKR_CODE_SIMPLE = '1'
    clearAgentDefinitionsCache()
    loadMarkdownFilesForSubdir.cache.clear?.()

    const { activeAgents } = await getAgentDefinitionsWithOverrides(tempDir)

    expect(activeAgents.some(agent => agent.agentType === 'user-agent')).toBe(
      true,
    )
  })

  test('loads project agents from .gakrcli/agents', async () => {
    const projectDir = join(tempDir, 'project')
    await writeAgent(
      join(projectDir, '.gakrcli', 'agents', 'project-agent.md'),
      'project-agent',
    )

    const { activeAgents } = await getAgentDefinitionsWithOverrides(projectDir)

    expect(
      activeAgents.some(agent => agent.agentType === 'project-agent'),
    ).toBe(true)
  })

  test('ignores project agents from .claude', async () => {
    const projectDir = join(tempDir, 'project')
    await writeAgent(
      join(projectDir, '.claude', 'agents', 'shared-agent.md'),
      'shared-agent',
      'legacy prompt',
    )

    const { activeAgents } = await getAgentDefinitionsWithOverrides(projectDir)
    const agent = activeAgents.find(agent => agent.agentType === 'shared-agent')

    expect(agent).toBeUndefined()
  })
})
