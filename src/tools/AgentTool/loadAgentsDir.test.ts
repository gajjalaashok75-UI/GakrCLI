import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import {
  clearAgentDefinitionsCache,
  getAgentDefinitionsWithOverrides,
} from './loadAgentsDir.js'
import { getBuiltInAgents } from './builtInAgents.js'
import { loadMarkdownFilesForSubdir } from '../../utils/markdownConfigLoader.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

const originalEnv = {
  GAKR_CONFIG_DIR: process.env.GAKR_CONFIG_DIR,
  GAKR_CODE_SIMPLE: process.env.GAKR_CODE_SIMPLE,
  GAKR_CODE_ENTRYPOINT: process.env.GAKR_CODE_ENTRYPOINT,
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
    restoreEnv('GAKR_CODE_ENTRYPOINT')
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
  test('registers root built-in agents for normal CLI entrypoints', () => {
    delete process.env.GAKR_CODE_ENTRYPOINT

    const agentTypes = getBuiltInAgents().map(agent => agent.agentType)

    expect(agentTypes).toContain('general-purpose')
    expect(agentTypes).toContain('statusline-setup')
    expect(agentTypes).toContain('gakrcli-code-guide')
  })

  test('hides the GakrCLI guide agent for SDK entrypoints', () => {
    process.env.GAKR_CODE_ENTRYPOINT = 'sdk-ts'

    const agentTypes = getBuiltInAgents().map(agent => agent.agentType)

    expect(agentTypes).not.toContain('gakrcli-code-guide')
  })

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

  test('deduplicates agents by name across user and project sources', async () => {
    const projectDir = join(tempDir, 'project')
    await writeAgent(
      join(process.env.GAKR_CONFIG_DIR!, 'agents', 'duplicate-agent.md'),
      'duplicate-agent',
      'user prompt',
    )
    await writeAgent(
      join(projectDir, '.gakrcli', 'agents', 'duplicate-agent.md'),
      'duplicate-agent',
      'project prompt',
    )
    await writeAgent(
      join(projectDir, '.gakrcli', 'agents', 'project-only.md'),
      'project-only',
    )

    const { activeAgents, allAgents } =
      await getAgentDefinitionsWithOverrides(projectDir)
    const activeDuplicate = activeAgents.filter(
      agent => agent.agentType === 'duplicate-agent',
    )
    const allDuplicate = allAgents.filter(
      agent => agent.agentType === 'duplicate-agent',
    )

    expect(activeDuplicate).toHaveLength(1)
    expect(allDuplicate).toHaveLength(1)
    expect(activeDuplicate[0]?.source).toBe('userSettings')
    expect(activeAgents.some(agent => agent.agentType === 'project-only')).toBe(
      true,
    )
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
