import { expect, test, describe } from 'bun:test'
import { filterInjectedMemoryFiles } from './gakrclimd.js'
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
})
