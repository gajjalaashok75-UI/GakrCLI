import { defineModel } from '../define.js'

export default [
  defineModel({
    id: 'venice-uncensored',
    label: 'Venice Uncensored',
    brandId: 'venice',
    vendorId: 'venice',
    classification: ['chat'],
    defaultModel: 'venice-uncensored',
    capabilities: {
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      supportsPreciseTokenCount: false,
    },
    contextWindow: 128_000,
  }),
]
