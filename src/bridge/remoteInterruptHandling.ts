import { feature } from 'bun:bundle'

import { requestBridgeInterrupt } from '../utils/replInterruption.js'

export function handleRemoteInterrupt(
  abortController: AbortController | null,
): void {
  if (feature('PROACTIVE') || feature('KAIROS')) {
    const { pauseProactive } =
      require('../proactive/index.js') as typeof import('../proactive/index.js')
    pauseProactive()
  }

  // Route the abort through the shared REPL interruption helper so the bridge
  // interrupt is traced with a causal id and a stable 'interrupt' reason.
  requestBridgeInterrupt({ current: abortController })
}
