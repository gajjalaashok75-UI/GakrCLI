import { describe, expect, test } from 'bun:test'
import { getCachedNvidiaNimModelOptions } from './nvidiaNimModels.js'

describe('NVIDIA NIM model options', () => {
  test('do not include duplicate model ids', () => {
    const options = getCachedNvidiaNimModelOptions()
    const ids = options.map(option => option.value)

    expect(new Set(ids).size).toBe(ids.length)
  })

  test('include current routed model ids', () => {
    const ids = new Set(
      getCachedNvidiaNimModelOptions().map(option => option.value),
    )

    expect(ids.has('deepseek-ai/deepseek-v4-pro')).toBe(true)
    expect(ids.has('deepseek-ai/deepseek-v4-flash')).toBe(true)
    expect(ids.has('z-ai/glm-5.1')).toBe(true)
    expect(ids.has('minimaxai/minimax-m2.7')).toBe(true)
  })
})
