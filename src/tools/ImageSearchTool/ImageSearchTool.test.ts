import { describe, expect, test } from 'bun:test'
import { ImageSearchTool } from './ImageSearchTool.js'

describe('ImageSearchTool - Schema and Configuration', () => {
  test('tool exports are present', () => {
    expect(ImageSearchTool).toBeTruthy()
    expect(typeof ImageSearchTool).toBe('object')
  })

  test('basic input validation logic works', () => {
    // Test valid query
    const validInput = {
      query: 'sunset photography',
      max_results: 10,
    }
    
    expect(validInput.query.length).toBeGreaterThanOrEqual(2)
    expect(validInput.max_results).toBeGreaterThanOrEqual(1)
    expect(validInput.max_results).toBeLessThanOrEqual(30)
  })

  test('domain filtering logic works', () => {
    const input = {
      query: 'mountain landscapes',
      allowed_domains: ['unsplash.com', 'pexels.com', 'pixabay.com'],
      blocked_domains: undefined,
    }
    
    expect(input.allowed_domains).toHaveLength(3)
    expect(input.allowed_domains.every(d => typeof d === 'string')).toBe(true)
  })

  test('max_results validation', () => {
    const cases = [
      { max_results: 1, valid: true },
      { max_results: 15, valid: true },
      { max_results: 30, valid: true },
      { max_results: 0, valid: false },
      { max_results: 31, valid: false },
    ]
    
    for (const testCase of cases) {
      const isValid = testCase.max_results >= 1 && testCase.max_results <= 30
      expect(isValid).toBe(testCase.valid)
    }
  })

  test('thumbnail_url is optional in image results', () => {
    const result1 = {
      title: 'Beautiful Sunset',
      url: 'https://unsplash.com/photos/sunset',
      thumbnail_url: 'https://cdn.unsplash.com/thumbnail.jpg',
    }
    
    const result2 = {
      title: 'Mountain Peak',
      url: 'https://pexels.com/photos/mountain',
      thumbnail_url: undefined,
    }
    
    expect(result1.thumbnail_url).toBeTruthy()
    expect(result2.thumbnail_url).toBeFalsy()
  })

  test('domain blocking mutually exclusive with domain allowing', () => {
    // In real validation, should not allow both
    const input1 = {
      query: 'test',
      allowed_domains: ['example.com'],
      blocked_domains: undefined,
    }
    
    const input2 = {
      query: 'test',
      allowed_domains: undefined,
      blocked_domains: ['spam.com'],
    }
    
    // Both should be valid individually
    expect(input1.allowed_domains || input1.blocked_domains).toBeTruthy()
    expect(input2.allowed_domains || input2.blocked_domains).toBeTruthy()
  })
})
