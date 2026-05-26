import { afterAll, afterEach, describe, expect, it, vi } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { isModelCacheValid, getCachedModelsFromDisk, saveModelsToCache } from '../model/modelCache.js'

await acquireSharedMutationLock('utils/model/modelCache.test.ts')

vi.mock('../model/ollamaModels.js', () => ({
  isOllamaProvider: vi.fn(() => true),
}))

afterEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  try {
    vi.restoreAllMocks()
  } finally {
    releaseSharedMutationLock()
  }
})

describe('modelCache', () => {
  const mockModel = { value: 'llama3', label: 'Llama 3', description: 'Test model' }

  describe('isModelCacheValid', () => {
    it('returns false for non-existent cache', async () => {
      const result = await isModelCacheValid('ollama')
      expect(result).toBe(false)
    })
  })

  describe('getCachedModelsFromDisk', () => {
    it('returns null when not cache available', async () => {
      const result = await getCachedModelsFromDisk()
      expect(result).toBeNull()
    })
  })

  describe('saveModelsToCache', () => {
    it('has saveModelsToCache function', () => {
      expect(typeof saveModelsToCache).toBe('function')
    })
  })
})
