import { formatTotalCost } from '../../cost-tracker.js'
import { currentLimits } from '../../services/gakrcliAiLimits.js'
import type { LocalCommandCall } from '../../types/command.js'
import { isgakrcliAISubscriber } from '../../utils/auth.js'

export const call: LocalCommandCall = async () => {
  if (isgakrcliAISubscriber()) {
    let value: string

    if (currentLimits.isUsingOverage) {
      value =
        'You are currently using your overages to power your Gakr usage. We will automatically switch you back to your subscription rate limits when they reset'
    } else {
      value =
        'You are currently using your subscription to power your Gakr usage'
    }

    if (process.env.USER_TYPE === 'ant') {
      value += `\n\n[ANT-ONLY] Showing cost anyway:\n ${formatTotalCost()}`
    }
    return { type: 'text', value }
  }
  return { type: 'text', value: formatTotalCost() }
}
