import { useEffect, useState } from 'react'
import {
  type gakrcliAILimits,
  currentLimits,
  statusListeners,
} from './gakrcliAiLimits.js'

export function usegakrcliAiLimits(): gakrcliAILimits {
  const [limits, setLimits] = useState<gakrcliAILimits>({ ...currentLimits })

  useEffect(() => {
    const listener = (newLimits: gakrcliAILimits) => {
      setLimits({ ...newLimits })
    }
    statusListeners.add(listener)

    return () => {
      statusListeners.delete(listener)
    }
  }, [])

  return limits
}
