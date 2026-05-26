import { defineGateway } from '../define.js'

export default defineGateway({
  id: 'nvidia-nim',
  label: 'NVIDIA NIM',
  category: 'hosted',
  defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
  defaultModel: 'nvidia/stepfun-ai/step-3.5-flash',
  supportsModelRouting: true,
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['NVIDIA_API_KEY'],
  },
  transportConfig: {
    kind: 'openai-compatible',
    openaiShim: {
      supportsAuthHeaders: true,
      ui: {
        showAuthHeader: false,
        showAuthHeaderValue: false,
      },
    },
  },
  preset: {
    id: 'nvidia-nim',
    description: 'NVIDIA NIM endpoint',
    apiKeyEnvVars: ['NVIDIA_API_KEY'],
    vendorId: 'openai',
  },
  validation: {
    kind: 'credential-env',
    credentialEnvVars: ['NVIDIA_API_KEY', 'OPENAI_API_KEY'],
    missingCredentialMessage:
      'NVIDIA_API_KEY or OPENAI_API_KEY is required when using NVIDIA NIM.',
    routing: {
      enablementEnvVar: 'NVIDIA_NIM',
      matchDefaultBaseUrl: true,
    },
  },
  catalog: {
    source: 'hybrid',
    discovery: { kind: 'openai-compatible' },
    discoveryCacheTtl: '1d',
    discoveryRefreshMode: 'background-if-stale',
    allowManualRefresh: true,
    models: [
      { id: 'nvidia-stepfun-ai-step-3.5-flash', apiName: 'nvidia/stepfun-ai/step-3.5-flash', label: 'StepFun Step 3.5 Flash', modelDescriptorId: 'nvidia/stepfun-ai/step-3.5-flash' },
      { id: 'nvidia-llama-3.1-nemotron-70b', apiName: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Llama 3.1 Nemotron 70B', modelDescriptorId: 'nvidia/llama-3.1-nemotron-70b-instruct' },
    ],
  },
  usage: { supported: false },
})
