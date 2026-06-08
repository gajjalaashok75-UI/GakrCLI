/**
 * Tests for getUserLocation() — dynamic IP-based location injection.
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { getUserLocation, __resetUserLocationForTests } from '../constants/common.js'

const mockSuccess = (data: Record<string, unknown>) =>
  async () =>
    ({
      ok: true,
      json: async () => data,
    }) as any

const mockFail = () => async () => ({ ok: true, json: async () => ({ status: 'fail' }) }) as any

const mockHttpError = () =>
  async () =>
    ({
      ok: false,
    }) as any

const mockThrow = () => async () => {
  throw new Error('Network error')
}

describe('getUserLocation', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = originalFetch as typeof fetch
    __resetUserLocationForTests()
  })

  test('returns formatted "City, State, Country" on success', async () => {
    globalThis.fetch = mockSuccess({
      status: 'success',
      city: 'Hyderabad',
      regionName: 'Telangana',
      country: 'India',
    })
    const result = await getUserLocation()
    expect(result).toBe('Hyderabad, Telangana, India')
  })

  test('returns locale-only when regionName absent', async () => {
    globalThis.fetch = mockSuccess({
      status: 'success',
      city: 'Paris',
      country: 'France',
    })
    const result = await getUserLocation()
    expect(result).toBe('Paris, France')
  })

  test('returns city-only when only city present', async () => {
    globalThis.fetch = mockSuccess({
      status: 'success',
      city: 'Smallville',
    })
    const result = await getUserLocation()
    expect(result).toBe('Smallville')
  })

  test('returns null when API status is "fail"', async () => {
    globalThis.fetch = mockFail()
    const result = await getUserLocation()
    expect(result).toBeNull()
  })

  test('returns null on HTTP error', async () => {
    globalThis.fetch = mockHttpError()
    const result = await getUserLocation()
    expect(result).toBeNull()
  })

  test('returns null when fetch throws', async () => {
    globalThis.fetch = mockThrow()
    const result = await getUserLocation()
    expect(result).toBeNull()
  })

  test('memoizes result — fetch called only once across multiple calls', async () => {
    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      return mockSuccess({
        status: 'success',
        city: 'Pune',
        regionName: 'Maharashtra',
        country: 'India',
      })()
    }

    await getUserLocation()
    await getUserLocation()
    await getUserLocation()
    expect(callCount).toBe(1)
  })
})
