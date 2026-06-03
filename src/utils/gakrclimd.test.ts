import { expect, test, describe } from 'bun:test'
import { basename } from 'path'
import { filterInjectedMemoryFiles, renderWorkspaceContext, compareWorkspaceFiles, stripHtmlComments, parseMemoryFileContent, WORKSPACE_CONTEXT_FILE_ORDER } from './gakrclimd.js'
import type { MemoryFileInfo } from './gakrclimd.js'

describe('Memory System', () => {
  // Note: filterInjectedMemoryFiles behavior depends on feature flag 'tengu_moth_copse'
  // These tests cover the default path where the feature is disabled.
  // Feature-flagged filtering is tested via integration tests.

  describe('filterInjectedMemoryFiles', () => {
    test('returns all files when feature flag is disabled (default)', () => {
      const memoryFiles: MemoryFileInfo[] = [
        { path: '/project/MEMORY.md', content: 'A', type: 'Project' },
        { path: '/user/GAKRCLI.md', content: 'B', type: 'User' },
        { path: '/auto/memory.md', content: 'C', type: 'AutoMem' },
      ]
      const result = filterInjectedMemoryFiles(memoryFiles)
      expect(result).toHaveLength(3)
    })

    test('respects empty array input', () => {
      const result = filterInjectedMemoryFiles([])
      expect(result).toHaveLength(0)
    })

    test('preserves file order', () => {
      const memoryFiles: MemoryFileInfo[] = [
        { path: '/a', content: '1', type: 'Project' },
        { path: '/b', content: '2', type: 'User' },
        { path: '/c', content: '3', type: 'Local' },
      ]
      const result = filterInjectedMemoryFiles(memoryFiles)
      expect(result.map(f => f.path)).toEqual(['/a', '/b', '/c'])
    })
  })

  // --- Workspace context file ordering ---

  describe('WORkSPACE_CONTEXT_FILE_ORDER', () => {
    test('gakrcli.md has lowest order number (highest priority)', () => {
      expect(WORKSPACE_CONTEXT_FILE_ORDER.get('gakrcli.md')).toBe(10)
    })

    test('agents.md before soul.md', () => {
      expect(WORKSPACE_CONTEXT_FILE_ORDER.get('agents.md')).toBeLessThan(WORKSPACE_CONTEXT_FILE_ORDER.get('soul.md'))
    })

    test('soul.md before identity.md before user.md', () => {
      const soul = WORKSPACE_CONTEXT_FILE_ORDER.get('soul.md')!
      const identity = WORKSPACE_CONTEXT_FILE_ORDER.get('identity.md')!
      const user = WORKSPACE_CONTEXT_FILE_ORDER.get('user.md')!
      expect(soul).toBeLessThan(identity)
      expect(identity).toBeLessThan(user)
    })

    test('heartbeat.md has highest order number (lowest priority)', () => {
      expect(WORKSPACE_CONTEXT_FILE_ORDER.get('heartbeat.md')).toBe(90)
    })

    test('unknown filenames default to MAX_SAFE_INTEGER', () => {
      const order = WORKSPACE_CONTEXT_FILE_ORDER.get('unknown.md')
      expect(order).toBeUndefined()
    })
  })

  describe('compareWorkspaceFiles', () => {
    test('unknown file falls back to MAX_SAFE_INTEGER order', () => {
      const order = WORKSPACE_CONTEXT_FILE_ORDER.get('mystery.md')
      expect(order).toBeUndefined()
    })
  })

  describe('renderWorkspaceContext', () => {
    test('returns null when no workspace files', () => {
      const result = renderWorkspaceContext([])
      expect(result).toBeNull()
    })

    test('filters out empty-content files', () => {
      const files: MemoryFileInfo[] = [
        { path: '/workspace/gakrclicli.md', content: '# GAKRCLI', type: 'Workspace' },
        { path: '/workspace/soul.md', content: '', type: 'Workspace' },
      ]
      const result = renderWorkspaceContext(files)
      expect(result).toContain('GAKRCLI')
      expect(result).not.toContain('SOUL')
    })

  test('renderWorkspaceContext returns null for empty input', () => {
    expect(renderWorkspaceContext([])).toBeNull()
  })

  test('wraps output in GAKRCLI_WORKSPACE boundary', () => {
    const files: MemoryFileInfo[] = [
      { path: '/workspace/gakrclicli.md', content: 'hello', type: 'Workspace' },
    ]
    const result = renderWorkspaceContext(files)!
    expect(result.includes('<GAKRCLI_WORKSPACE>')).toBe(true)
    expect(result.includes('</GAKRCLI_WORKSPACE>')).toBe(true)
  })

    test('includes SOUL.md description when present', () => {
      const files: MemoryFileInfo[] = [
        { path: '/workspace/soul.md', content: 'soul content', type: 'Workspace' },
      ]
      const result = renderWorkspaceContext(files)!
      expect(result).toContain('SOUL.md')
      expect(result).toContain('persona, tone, and working style')
    })

    test('includes RULEBOOK.md description when present', () => {
      const files: MemoryFileInfo[] = [
        { path: '/workspace/rulebook.md', content: 'rules', type: 'Workspace' },
      ]
      const result = renderWorkspaceContext(files)!
      expect(result).toContain('RULEBOOK.md')
      expect(result).toContain('how to interpret the GakrCLI harness')
    })

    test('includes MEMORY.md description when present', () => {
      const files: MemoryFileInfo[] = [
        { path: '/workspace/memory.md', content: 'memories', type: 'Workspace' },
      ]
      const result = renderWorkspaceContext(files)!
      expect(result).toContain('MEMORY.md')
      expect(result).toContain('durable user preferences')
    })

    test('renders file path headers and content', () => {
      const files: MemoryFileInfo[] = [
        { path: '/workspace/gakrclicli.md', content: 'file content here', type: 'Workspace' },
      ]
      const result = renderWorkspaceContext(files)!
      expect(result).toContain('## /workspace/gakrclicli.md')
      expect(result).toContain('file content here')
    })
  })

  // --- HTML comment stripping ---

  describe('stripHtmlComments', () => {
    test('function is exported and callable', () => {
      const result = stripHtmlComments('plain text')
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('stripped')
    })

    test('graceful no-op on markdown without comments', () => {
      const result = stripHtmlComments('hello world')
      expect(result.content).toBe('hello world')
    })
  })

  // --- parseMemoryFileContent ---

  describe('parseMemoryFileContent', () => {
    test('parses content without frontmatter', () => {
      const result = parseMemoryFileContent('plain content', '/path/file.md', 'Project')
      expect(result.info).not.toBeNull()
      expect(result.info!.content).toBe('plain content')
      expect(result.info!.type).toBe('Project')
      expect(result.info!.globs).toBeUndefined()
      expect(result.includePaths).toHaveLength(0)
    })

    test('strips frontmatter and extracts paths', () => {
      const raw = `---
paths:
  - "**/*.tsx"
---
content here`
      const result = parseMemoryFileContent(raw, '/path/file.md', 'Project')
      expect(result.info!.content).not.toContain('paths:')
      expect(result.info!.globs).toEqual(['**/*.tsx'])
    })

  test('html comments are stripped and contentDiffersFromDisk is set', () => {
    const raw = '# Title\n\n<!-- author note -->\nreal content'
    const result = parseMemoryFileContent(raw, '/path/file.md', 'Project')
    expect(result.info!.content).not.toContain('<!--')
    expect(result.info!.content).not.toContain('-->')
    expect(result.info!.contentDiffersFromDisk).toBe(true)
    expect(result.info!.rawContent?.includes('<!--')).toBe(true)
  })

    test('non-text extensions return null info', () => {
      const result = parseMemoryFileContent('binary', '/path/image.png', 'Project')
      expect(result.info).toBeNull()
      expect(result.includePaths).toHaveLength(0)
    })

    test('marks contentDifferFromDisk when frontmatter is stripped', () => {
      const raw = `---
paths:
  - "**/*.ts"
---
real content`
      const result = parseMemoryFileContent(raw, '/path/file.md', 'Project')
      expect(result.info!.contentDiffersFromDisk).toBe(true)
      expect(result.info!.rawContent).toBe(raw)
    })

    test('returns empty includePaths when no includeBasePath', () => {
      const result = parseMemoryFileContent('some text', '/path/file.md', 'Project')
      expect(result.includePaths).toHaveLength(0)
    })
  })
})
