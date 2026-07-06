import { describe, expect, test } from 'bun:test'

import { getGakrCLIInChromePermissionMode } from './usePromptsFromGakrCLIInChrome.tsx'

describe('getGakrCLIInChromePermissionMode', () => {
  test('maps only fullAccess to skip-all permission checks', () => {
    expect(getGakrCLIInChromePermissionMode('bypassPermissions')).toBe('ask')
    expect(getGakrCLIInChromePermissionMode('fullAccess')).toBe(
      'skip_all_permission_checks',
    )
  })

  test('keeps non-dangerous modes in ask mode', () => {
    expect(getGakrCLIInChromePermissionMode('default')).toBe('ask')
    expect(getGakrCLIInChromePermissionMode('acceptEdits')).toBe('ask')
    expect(getGakrCLIInChromePermissionMode('plan')).toBe('ask')
    expect(getGakrCLIInChromePermissionMode('dontAsk')).toBe('ask')
  })
})
