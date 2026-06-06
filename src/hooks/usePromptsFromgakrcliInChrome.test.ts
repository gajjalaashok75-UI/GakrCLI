import { describe, expect, test } from 'bun:test'

import { getGakrcliInChromePermissionMode } from './usePromptsFromgakrcliInChrome.tsx'

describe('getGakrcliInChromePermissionMode', () => {
  test('maps only fullAccess to skip-all permission checks', () => {
    expect(getGakrcliInChromePermissionMode('bypassPermissions')).toBe('ask')
    expect(getGakrcliInChromePermissionMode('fullAccess')).toBe(
      'skip_all_permission_checks',
    )
  })

  test('keeps non-dangerous modes in ask mode', () => {
    expect(getGakrcliInChromePermissionMode('default')).toBe('ask')
    expect(getGakrcliInChromePermissionMode('acceptEdits')).toBe('ask')
    expect(getGakrcliInChromePermissionMode('plan')).toBe('ask')
    expect(getGakrcliInChromePermissionMode('dontAsk')).toBe('ask')
  })
})
