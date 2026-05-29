import { afterAll, describe, expect, mock, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import * as realConfig from '../../utils/config.js'
import * as realSettings from '../../utils/settings/settings.js'
import type { Tip } from './types.js'

const settingsRef: {
  value: {
    spinnerTipsEnabled?: boolean
  }
} = { value: {} }
const configRef: {
  value: {
    numStartups: number
    tipsHistory?: Record<string, number>
  }
} = { value: { numStartups: 100 } }

const relevantTipsRef: { value: Tip[] } = { value: [] }

await acquireSharedMutationLock('services/tips/tipScheduler.test.ts')

mock.module('../../utils/settings/settings.js', () => ({
  ...realSettings,
  getSettings_DEPRECATED: () => settingsRef.value,
  getInitialSettings: () => settingsRef.value,
  getSettingsForSource: () => undefined,
  getSettingsWithSources: () => ({ settings: settingsRef.value, sources: {} }),
  getSettingsWithErrors: () => ({ settings: settingsRef.value, errors: [] }),
  updateSettingsForSource: () => ({ error: null }),
}))

mock.module('../../utils/config.js', () => ({
  ...realConfig,
  getGlobalConfig: () => configRef.value,
  checkHasTrustDialogAccepted: () => false,
  getOrCreateUserID: () => 'test-user',
  saveGlobalConfig: (mut: (c: typeof configRef.value) => typeof configRef.value) => {
    configRef.value = mut(configRef.value)
  },
}))

mock.module('./tipRegistry.js', () => ({
  getRelevantTips: async () => relevantTipsRef.value,
}))

mock.module('../analytics/index.js', () => ({
  logEvent: () => undefined,
  stripProtoFields: <T>(value: T) => value,
}))

afterAll(() => {
  try {
    mock.restore()
  } finally {
    releaseSharedMutationLock()
  }
})

async function freshScheduler() {
  const stamp = `${Date.now()}-${Math.random()}`
  return import(`./tipScheduler.ts?ts=${stamp}`)
}

function makeTip(id: string): Tip {
  return {
    id,
    content: async () => id,
    cooldownSessions: 0,
    isRelevant: async () => true,
  }
}

function setState(opts: {
  numStartups?: number
  tipsHistory?: Record<string, number>
  spinnerTipsEnabled?: boolean
  tips: Tip[]
}) {
  configRef.value = {
    numStartups: opts.numStartups ?? 100,
    tipsHistory: opts.tipsHistory,
  }
  settingsRef.value = {
    spinnerTipsEnabled: opts.spinnerTipsEnabled,
  }
  relevantTipsRef.value = opts.tips
}

describe('getTipToShowOnSpinner', () => {
  test('picks the tip with the longest time since shown', async () => {
    setState({
      numStartups: 100,
      tipsHistory: {
        recent: 99,
        older: 50,
      },
      tips: [makeTip('recent'), makeTip('older')],
    })

    const { getTipToShowOnSpinner } = await freshScheduler()
    const pick = await getTipToShowOnSpinner()

    expect(pick?.id).toBe('older')
  })

  test('returns undefined when no tips are relevant', async () => {
    setState({ tips: [] })

    const { getTipToShowOnSpinner } = await freshScheduler()

    expect(await getTipToShowOnSpinner()).toBeUndefined()
  })

  test('spinnerTipsEnabled=false short-circuits tip selection', async () => {
    setState({
      spinnerTipsEnabled: false,
      tips: [makeTip('regular-1')],
    })

    const { getTipToShowOnSpinner } = await freshScheduler()

    expect(await getTipToShowOnSpinner()).toBeUndefined()
  })
})

describe('recordShownTip', () => {
  test('records regular tip history', async () => {
    setState({ numStartups: 100, tips: [] })

    const { recordShownTip } = await freshScheduler()
    recordShownTip(makeTip('regular-1'))

    expect(configRef.value.tipsHistory).toEqual({
      'regular-1': 100,
    })
  })
})
