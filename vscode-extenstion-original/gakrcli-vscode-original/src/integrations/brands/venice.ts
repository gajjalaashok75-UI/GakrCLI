import { defineBrand } from '../define.js'

export default defineBrand({
  id: 'venice',
  label: 'Venice',
  canonicalVendorId: 'venice',
  defaultCapabilities: {
    supportsStreaming: true,
    supportsFunctionCalling: true,
    supportsJsonMode: true,
    supportsPreciseTokenCount: false,
  },
  modelIds: ['venice-uncensored'],
})
