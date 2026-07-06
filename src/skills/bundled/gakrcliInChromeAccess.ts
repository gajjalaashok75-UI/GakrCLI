import { isGakrCLIAISubscriber } from '../../utils/auth.js'

export function shouldEnableGakrCLIInChromeSkill(options?: {
  autoEnabled?: boolean
  hasGakrCLIInChromeAccess?: boolean
}): boolean {
  const autoEnabled =
    options?.autoEnabled ?? defaultShouldAutoEnableGakrCLIInChrome()
  const hasGakrCLIInChromeAccess =
    options?.hasGakrCLIInChromeAccess ?? isGakrCLIAISubscriber()
  return autoEnabled && hasGakrCLIInChromeAccess
}

// Keep this lazy to avoid importing setup.ts while startup code is still
// wiring shared Chrome-in-GakrCLI state.
function defaultShouldAutoEnableGakrCLIInChrome(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { shouldAutoEnableGakrCLIInChrome } = require(
      '../../utils/gakrcliInChrome/setup.js',
    ) as typeof import('../../utils/gakrcliInChrome/setup.js')
    return shouldAutoEnableGakrCLIInChrome()
  } catch {
    return false
  }
}
