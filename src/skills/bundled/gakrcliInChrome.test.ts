import { describe, expect, test } from 'bun:test'
import { shouldEnableGakrCLIInChromeSkill } from './gakrcliInChromeAccess.js'

describe('shouldEnableGakrCLIInChromeSkill', () => {
  test('requires both auto-enable eligibility and subscriber access', () => {
    expect(
      shouldEnableGakrCLIInChromeSkill({
        autoEnabled: true,
        hasGakrCLIInChromeAccess: true,
      }),
    ).toBe(true)

    expect(
      shouldEnableGakrCLIInChromeSkill({
        autoEnabled: true,
        hasGakrCLIInChromeAccess: false,
      }),
    ).toBe(false)

    expect(
      shouldEnableGakrCLIInChromeSkill({
        autoEnabled: false,
        hasGakrCLIInChromeAccess: true,
      }),
    ).toBe(false)
  })
})
