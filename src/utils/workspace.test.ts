import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

const originalEnv = { ...process.env }
const originalCwd = process.cwd()

let tempDir: string
let fsPromises: typeof import('fs/promises')
let bootstrapState: typeof import('../bootstrap/state.js')
let memoryFiles: typeof import('./gakrclimd.js')
let workspace: typeof import('./workspace.js')

beforeEach(async () => {
  await acquireSharedMutationLock('workspace.test.ts')
  fsPromises = await import('fs/promises')
  bootstrapState = await import('../bootstrap/state.js')
  memoryFiles = await import('./gakrclimd.js')
  workspace = await import('./workspace.js')

  tempDir = await fsPromises.mkdtemp(join(tmpdir(), 'gakrcli-workspace-test-'))
  process.env.GAKR_CONFIG_DIR = join(tempDir, '.gakrcli')
  delete process.env.GAKRCLI_WORKSPACE_DIR
  delete process.env.GAKR_WORKSPACE_DIR
  delete process.env.GAKRCLI_WORKSPACE_TEMPLATE_DIR
  bootstrapState.setOriginalCwd(originalCwd)
  memoryFiles.clearMemoryFileCaches()
})

afterEach(async () => {
  try {
    memoryFiles.clearMemoryFileCaches()
    process.env = { ...originalEnv }
    bootstrapState.setOriginalCwd(originalCwd)
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  } finally {
    releaseSharedMutationLock()
  }
})

describe('GakrCLI workspace', () => {
  test('seeds OpenClaw-style workspace files and projects directory', async () => {
    await workspace.ensureGakrcliWorkspace()

    const workspaceDir = join(tempDir, '.gakrcli', 'workspace')
    expect((await fsPromises.stat(join(workspaceDir, 'projects'))).isDirectory()).toBe(
      true,
    )

    const gakrcli = await fsPromises.readFile(
      join(workspaceDir, 'GAKRCLI.md'),
      'utf8',
    )
    const identity = await fsPromises.readFile(
      join(workspaceDir, 'IDENTITY.md'),
      'utf8',
    )
    const rulebook = await fsPromises.readFile(
      join(workspaceDir, 'RULEBOOK.md'),
      'utf8',
    )
    const memory = await fsPromises.readFile(
      join(workspaceDir, 'MEMORY.md'),
      'utf8',
    )

    expect(gakrcli).toContain('# GAKRCLI.md - Your Workspace')
    expect(gakrcli).toContain('If `BOOTSTRAP.md` exists')
    expect(identity).toContain('# IDENTITY.md - Who Am I?')
    expect(identity).toContain('agent harness')
    expect(rulebook).toContain('# RULEBOOK.md - Workspace Rules')
    expect(rulebook).toContain('Harness vs Assistant')
    expect(memory).toContain('durable cross-project memories')
    for (const fileName of workspace.WORKSPACE_CONTEXT_FILENAMES) {
      const content = await fsPromises.readFile(
        join(workspaceDir, fileName),
        'utf8',
      )
      expect(content).toContain(`~/.gakrcli/workspace/${fileName}`)
    }
    await expect(fsPromises.stat(join(workspaceDir, 'AGENTS.md'))).rejects.toThrow()
    await expect(fsPromises.stat(join(workspaceDir, 'BOOT.md'))).rejects.toThrow()
  })

  test('does not overwrite user-edited workspace files', async () => {
    const workspaceDir = join(tempDir, '.gakrcli', 'workspace')
    await fsPromises.mkdir(workspaceDir, { recursive: true })
    await fsPromises.writeFile(join(workspaceDir, 'USER.md'), 'custom user profile', {
      flag: 'wx',
      encoding: 'utf8',
    })

    await workspace.ensureGakrcliWorkspace()

    expect((await fsPromises.stat(join(workspaceDir, 'GAKRCLI.md'))).isFile()).toBe(
      true,
    )
    expect(await fsPromises.readFile(join(workspaceDir, 'USER.md'), 'utf8')).toBe(
      'custom user profile',
    )
  })

  test('uses fallback content when a packaged workspace file is missing', async () => {
    const templateDir = join(tempDir, 'templates')
    await fsPromises.mkdir(templateDir, { recursive: true })
    await fsPromises.writeFile(
      join(templateDir, 'GAKRCLI.md'),
      'custom packaged workspace instructions',
      'utf8',
    )
    process.env.GAKRCLI_WORKSPACE_TEMPLATE_DIR = templateDir

    workspace = await import(`./workspace.ts?ts=${Date.now()}-${Math.random()}`)
    await workspace.ensureGakrcliWorkspace()

    const workspaceDir = join(tempDir, '.gakrcli', 'workspace')
    expect(
      await fsPromises.readFile(join(workspaceDir, 'GAKRCLI.md'), 'utf8'),
    ).toBe('custom packaged workspace instructions')
    expect(await fsPromises.readFile(join(workspaceDir, 'SOUL.md'), 'utf8')).toContain(
      '# SOUL.md - Who You Are',
    )
    expect(
      await fsPromises.readFile(join(workspaceDir, 'RULEBOOK.md'), 'utf8'),
    ).toContain('# RULEBOOK.md - Workspace Rules')
  })

  test('copies legacy AGENTS.md into GAKRCLI.md without overwriting either file', async () => {
    const workspaceDir = join(tempDir, '.gakrcli', 'workspace')
    await fsPromises.mkdir(workspaceDir, { recursive: true })
    await fsPromises.writeFile(
      join(workspaceDir, 'AGENTS.md'),
      'legacy workspace instructions',
      'utf8',
    )

    await workspace.ensureGakrcliWorkspace()

    expect(
      await fsPromises.readFile(join(workspaceDir, 'GAKRCLI.md'), 'utf8'),
    ).toBe('legacy workspace instructions')
    expect(await fsPromises.readFile(join(workspaceDir, 'AGENTS.md'), 'utf8')).toBe(
      'legacy workspace instructions',
    )
  })

  test('uses legacy packaged AGENTS.md only as a source for GAKRCLI.md', async () => {
    const templateDir = join(tempDir, 'templates')
    await fsPromises.mkdir(templateDir, { recursive: true })
    await fsPromises.writeFile(
      join(templateDir, 'AGENTS.md'),
      'legacy packaged workspace instructions',
      'utf8',
    )
    process.env.GAKRCLI_WORKSPACE_TEMPLATE_DIR = templateDir

    workspace = await import(`./workspace.ts?ts=${Date.now()}-${Math.random()}`)
    await workspace.ensureGakrcliWorkspace()

    const workspaceDir = join(tempDir, '.gakrcli', 'workspace')
    expect(
      await fsPromises.readFile(join(workspaceDir, 'GAKRCLI.md'), 'utf8'),
    ).toBe('legacy packaged workspace instructions')
    await expect(fsPromises.stat(join(workspaceDir, 'AGENTS.md'))).rejects.toThrow()
  })

  test('loads workspace files into memory context', async () => {
    await workspace.ensureGakrcliWorkspace()
    const workspaceDir = join(tempDir, '.gakrcli', 'workspace')
    await fsPromises.writeFile(
      join(workspaceDir, 'IDENTITY.md'),
      'identity from workspace',
    )
    memoryFiles.clearMemoryFileCaches()

    const files = await memoryFiles.getMemoryFiles()
    const workspaceFiles = files.filter(file => file.type === 'Workspace')

    expect(workspaceFiles.map(file => file.path)).toContain(
      join(workspaceDir, 'GAKRCLI.md'),
    )
    expect(workspaceFiles.map(file => file.path)).toContain(
      join(workspaceDir, 'IDENTITY.md'),
    )
    expect(workspaceFiles.map(file => file.path)).toContain(
      join(workspaceDir, 'RULEBOOK.md'),
    )
    expect(workspaceFiles.some(file => file.content.includes('identity from workspace'))).toBe(
      true,
    )

    const rendered = memoryFiles.getgakrcliMds(files)
    expect(rendered).toContain('## GakrCLI Workspace Context')
    expect(rendered).toContain(
      'GakrCLI loaded these user-editable workspace files',
    )
    expect(rendered).toContain('GakrCLI is the CLI, agent harness')
    expect(rendered).toContain('SOUL.md: persona, tone, and working style')
    expect(rendered).toContain('RULEBOOK.md: stable workspace rules')
    expect(rendered).toContain('MEMORY.md: durable user preferences')
    expect(rendered).toContain('# GAKRCLI.md - Your Workspace')
    expect(rendered).toContain('identity from workspace')
  })

  test('identifies root workspace persistence files and excludes bootstrap', async () => {
    await workspace.ensureGakrcliWorkspace()
    const workspaceDir = join(tempDir, '.gakrcli', 'workspace')

    expect(
      workspace.isWorkspacePersistencePath(join(workspaceDir, 'RULEBOOK.md')),
    ).toBe(true)
    expect(
      workspace.isWorkspacePersistencePath(join(workspaceDir, 'MEMORY.md')),
    ).toBe(true)
    expect(
      workspace.isWorkspacePersistencePath(join(workspaceDir, 'BOOTSTRAP.md')),
    ).toBe(false)
    expect(
      workspace.isWorkspacePersistencePath(
        join(workspaceDir, 'projects', 'example', 'memory', 'MEMORY.md'),
      ),
    ).toBe(false)
  })

  test('treats BOOTSTRAP.md as one-shot setup state', async () => {
    await workspace.ensureGakrcliWorkspace()
    const workspaceDir = join(tempDir, '.gakrcli', 'workspace')
    const bootstrapPath = join(workspaceDir, 'BOOTSTRAP.md')

    expect((await fsPromises.stat(bootstrapPath)).isFile()).toBe(true)

    await fsPromises.rm(bootstrapPath, { force: true })
    await workspace.ensureGakrcliWorkspace()

    await expect(fsPromises.stat(bootstrapPath)).rejects.toThrow()

    memoryFiles.clearMemoryFileCaches()
    const rendered = memoryFiles.getgakrcliMds(await memoryFiles.getMemoryFiles())
    expect(rendered).not.toContain('BOOTSTRAP.md: first-run workspace setup')
    expect(rendered).not.toContain('# BOOTSTRAP.md')
  })

  test('completes bootstrap when identity and user files were saved but bootstrap remains', async () => {
    await workspace.ensureGakrcliWorkspace()
    const workspaceDir = join(tempDir, '.gakrcli', 'workspace')
    const bootstrapPath = join(workspaceDir, 'BOOTSTRAP.md')

    await fsPromises.writeFile(
      join(workspaceDir, 'IDENTITY.md'),
      [
        '# IDENTITY.md - Who Am I?',
        '',
        '- **Name:** Autobot',
        '- **Nature:** Coding companion',
      ].join('\n'),
    )
    await fsPromises.writeFile(
      join(workspaceDir, 'USER.md'),
      [
        '# USER.md - About The User',
        '',
        '- **Name:** Gajjala Ashok Kumar Reddy',
        '- **What to call them:** Ashok',
      ].join('\n'),
    )
    expect((await fsPromises.stat(bootstrapPath)).isFile()).toBe(true)

    await workspace.ensureGakrcliWorkspace()

    await expect(fsPromises.stat(bootstrapPath)).rejects.toThrow()
    const state = JSON.parse(
      await fsPromises.readFile(
        join(workspaceDir, '.gakrcli', 'workspace-state.json'),
        'utf8',
      ),
    )
    expect(typeof state.setupCompletedAt).toBe('string')

    memoryFiles.clearMemoryFileCaches()
    const rendered = memoryFiles.getgakrcliMds(await memoryFiles.getMemoryFiles())
    expect(rendered).not.toContain('BOOTSTRAP.md: first-run workspace setup')
    expect(rendered).not.toContain('# BOOTSTRAP.md')
  })
})
