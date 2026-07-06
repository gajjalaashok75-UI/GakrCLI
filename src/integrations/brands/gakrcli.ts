import { defineBrand } from '../define.js'

export default defineBrand({
  id: 'gakrcli',
  label: 'GakrCLI',
  canonicalVendorId: 'gakr',
  defaultCapabilities: {
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsJsonMode: true,
    supportsReasoning: true,
    supportsPreciseTokenCount: false,
  },
  modelIds: [
    'gakrcli-kosmios-1-0',
    'gakrcli-kosmios-1-1',
    'gakrcli-kosmios-1-2',
  ],
})
