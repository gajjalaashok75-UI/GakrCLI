import { defineGateway } from '../define.js'
import { getCopilotModel } from '../../utils/model/copilotModels.js'

const COPILOT_HEADERS: Record<string, string> = {
  'User-Agent': 'GitHubCopilotChat/0.26.7',
  'Editor-Version': 'vscode/1.99.3',
  'Editor-Plugin-Version': 'copilot-chat/0.26.7',
  'Copilot-Integration-Id': 'vscode-chat',
}

const HIDDEN_COPILOT_MODEL_PATTERNS = [
  /embedding/i,
  /^accounts\/[^/]+\/routers\//i,
  /^oswe-vscode-/i,
  /^goldeneye-/i,
  /^gpt-3\.5-turbo$/i,
]

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function numberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

function getPolicyState(model: Record<string, unknown>): string | undefined {
  const policy = model.policy
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return undefined
  }
  return stringField((policy as Record<string, unknown>).state)?.toLowerCase()
}

function getVersionedCopilotLabel(id: string): string | undefined {
  const gpt4oMini = /^gpt-4o-mini-(\d{4}-\d{2}-\d{2})$/i.exec(id)
  if (gpt4oMini) {
    return `GPT-4o mini (${gpt4oMini[1]})`
  }

  const gpt4o = /^gpt-4o-(\d{4}-\d{2}-\d{2})$/i.exec(id)
  if (gpt4o) {
    return `GPT-4o (${gpt4o[1]})`
  }

  const gpt41 = /^gpt-4\.1-(\d{4}-\d{2}-\d{2})$/i.exec(id)
  if (gpt41) {
    return `GPT-4.1 (${gpt41[1]})`
  }

  const gpt35 = /^gpt-3\.5-turbo-(\d+)$/i.exec(id)
  if (gpt35) {
    return `GPT 3.5 Turbo (${gpt35[1]})`
  }

  const gpt4 = /^gpt-4-(\d+)(?:-(preview))?$/i.exec(id)
  if (gpt4) {
    return `GPT 4 (${gpt4[1]}${gpt4[2] ? ' preview' : ''})`
  }

  if (/^gpt-4-o-preview$/i.test(id)) {
    return 'GPT-4o Preview'
  }

  return undefined
}

function getCopilotModelLabel(
  id: string,
  model: Record<string, unknown>,
): string {
  return (
    getVersionedCopilotLabel(id) ??
    getCopilotModel(id)?.name ??
    stringField(model.name) ??
    stringField(model.display_name) ??
    stringField(model.displayName) ??
    id
  )
}

/**
 * GitHub Copilot has a special native-Claude path for Claude models.
 * When the model string contains "claude-", the runtime routes through
 * the native Anthropic path instead of the OpenAI shim to enable prompt
 * caching. This exception is handled in openaiShim.ts and providers.ts
 * and must be preserved during migration.
 *
 * @see src/utils/model/providers.ts — isGithubNativeAnthropicMode()
 * @see src/services/api/openaiShim.ts — getGithubEndpointType()
 */
export default defineGateway({
  id: 'github',
  label: 'GitHub Copilot',
  vendorId: 'openai',
  category: 'hosted',
  defaultBaseUrl: 'https://api.githubcopilot.com',
  defaultModel: 'github:copilot',
  supportsModelRouting: true,
  setup: {
    requiresAuth: true,
    authMode: 'token',
    credentialEnvVars: ['GITHUB_TOKEN', 'GH_TOKEN'],
  },
  transportConfig: {
    kind: 'openai-compatible',
    openaiShim: {
      headers: COPILOT_HEADERS,
      supportsAuthHeaders: true,
      maxTokensField: 'max_tokens',
    },
  },
  validation: {
    kind: 'github-token',
    routing: {
      enablementEnvVar: 'GAKR_CODE_USE_GITHUB',
      skipWhenUseOpenAI: true,
    },
    missingCredentialMessage:
      'GitHub Copilot authentication required.\nRun /provider in the CLI and choose GitHub Models to sign in with your GitHub account.\nThis will store your OAuth token securely and enable Copilot models.',
    expiredCredentialMessage:
      'GitHub Copilot token has expired.\nRun /provider and choose GitHub Models to sign in again and get a fresh token.',
    invalidCredentialMessage:
      'GitHub Copilot token is invalid or corrupted.\nRun /provider and choose GitHub Models to sign in again with your GitHub account.',
  },
  catalog: {
    source: 'hybrid',
    discovery: {
      kind: 'openai-compatible',
      mapModel(raw: unknown) {
        const model = raw as Record<string, unknown>
        const id = stringField(model.id)
        if (!id) {
          return null
        }
        if (HIDDEN_COPILOT_MODEL_PATTERNS.some(pattern => pattern.test(id))) {
          return null
        }
        const policyState = getPolicyState(model)
        if (policyState && policyState !== 'enabled') {
          return null
        }

        const known = getCopilotModel(id)
        const label = getCopilotModelLabel(id, model)
        const contextWindow =
          known?.limit.context ??
          numberField(model.context_length) ??
          numberField(model.contextWindow) ??
          numberField(model.inputTokenLimit)

        return {
          id,
          apiName: id,
          label,
          ...(contextWindow ? { contextWindow } : {}),
        }
      },
    },
    discoveryCacheTtl: '1h',
    discoveryRefreshMode: 'on-open',
    allowManualRefresh: true,
    models: [
      { id: 'github-copilot-default', apiName: 'github:copilot', label: 'GitHub Copilot Default' },
    ],
  },
  usage: { supported: false },
})
