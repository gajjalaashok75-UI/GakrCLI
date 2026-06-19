import { useEffect, useState } from 'react'
import {
  type GakrCLIAILimits,
  currentLimits,
  statusListeners,
} from './gakrcliAiLimits.js'

export function useGakrCLIAiLimits(): GakrCLIAILimits {
  const [limits, setLimits] = useState<GakrCLIAILimits>({ ...currentLimits })

  useEffect(() => {
    const listener = (newLimits: GakrCLIAILimits) => {
      setLimits({ ...newLimits })
    }
    statusListeners.add(listener)

    return () => {
      statusListeners.delete(listener)
    }
  }, [])

  return limits
}
