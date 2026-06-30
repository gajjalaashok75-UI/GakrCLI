import { defineModel } from '../define.js'

export default [
  defineModel({
    id: 'gakrcli-kosmios',
    label: 'gakrcli-kosmios',
    brandId: 'gakrcli',
    vendorId: 'gakrcli',
    classification: ['chat'],
    defaultModel: 'gakrcli-kosmios',
    capabilities: {
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      supportsPreciseTokenCount: false,
    },
    contextWindow: 128_000_000,
  }),
]
