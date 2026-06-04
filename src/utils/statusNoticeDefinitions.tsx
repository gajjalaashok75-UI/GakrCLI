// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { Box, Text } from '../ink.js';
import * as React from 'react';
import { getLargeMemoryFiles, MAX_MEMORY_CHARACTER_COUNT, type MemoryFileInfo } from './gakrclimd.js';
import figures from 'figures';
import { getCwd } from './cwd.js';
import { relative } from 'path';
import { formatNumber } from './format.js';
import type { getGlobalConfig } from './config.js';
import { getAnthropicApiKeyWithSource, getApiKeyFromConfigOrMacOSKeychain, getAuthTokenSource, isgakrcliAISubscriber } from './auth.js';
import type { AgentDefinitionsResult } from '../tools/AgentTool/loadAgentsDir.js';
import { getAgentDescriptionsTotalTokens, AGENT_DESCRIPTIONS_THRESHOLD } from './statusNoticeHelpers.js';
import { isSupportedJetBrainsTerminal, toIDEDisplayName, getTerminalIdeType } from './ide.js';
import { isJetBrainsPluginInstalledCachedSync } from './jetbrains.js';
import type { PermissionMode } from './permissions/PermissionMode.js';
import { modelSupportsAutoMode } from './betas.js';
import { getAPIProvider } from './model/providers.js';
import type { LocalModelContextWarning } from './statusNoticeLocalModel.js';

// Types
export type StatusNoticeType = 'warning' | 'info';
export type StatusNoticeContext = {
  config: ReturnType<typeof getGlobalConfig>;
  agentDefinitions?: AgentDefinitionsResult;
  memoryFiles: MemoryFileInfo[];
  permissionMode?: PermissionMode;
  mainLoopModel?: string;
  isLocalModel?: boolean;
  localModelContextLoad?: LocalModelContextWarning | null;
};
export type StatusNoticeDefinition = {
  id: string;
  type: StatusNoticeType;
  isActive: (context: StatusNoticeContext) => boolean;
  render: (context: StatusNoticeContext) => React.ReactNode;
};

// Individual notice definitions
const largeMemoryFilesNotice: StatusNoticeDefinition = {
  id: 'large-memory-files',
  type: 'warning',
  isActive: ctx => {
    if (ctx.isLocalModel && ctx.localModelContextLoad) {
      return false;
    }
    return getLargeMemoryFiles(ctx.memoryFiles).length > 0;
  },
  render: ctx => {
    const largeMemoryFiles = getLargeMemoryFiles(ctx.memoryFiles);
    return <>
        {largeMemoryFiles.map(file => {
        const displayPath = file.path.startsWith(getCwd()) ? relative(getCwd(), file.path) : file.path;
        return <Box key={file.path} flexDirection="row">
              <Text color="warning">{figures.warning}</Text>
              <Text color="warning">
                Large <Text bold>{displayPath}</Text> will impact performance (
                {formatNumber(file.content.length)} chars &gt;{' '}
                {formatNumber(MAX_MEMORY_CHARACTER_COUNT)})
                <Text dimColor> · /memory to edit</Text>
              </Text>
            </Box>;
      })}
      </>;
  }
};
const gakrcliAiSubscriberExternalTokenNotice: StatusNoticeDefinition = {
  id: 'gakrcli-ai-external-token',
  type: 'warning',
  isActive: () => {
    const authTokenInfo = getAuthTokenSource();
    return isgakrcliAISubscriber() && (authTokenInfo.source === 'ANTHROPIC_AUTH_TOKEN' || authTokenInfo.source === 'apiKeyHelper');
  },
  render: () => {
    const authTokenInfo = getAuthTokenSource();
    return <Box flexDirection="row" marginTop={1}>
        <Text color="warning">{figures.warning}</Text>
        <Text color="warning">
          Auth conflict: Using {authTokenInfo.source} instead of Gakr account
          subscription token. Either unset {authTokenInfo.source}, or run
          `/logout`.
        </Text>
      </Box>;
  }
};
const apiKeyConflictNotice: StatusNoticeDefinition = {
  id: 'api-key-conflict',
  type: 'warning',
  isActive: () => {
    const {
      source: apiKeySource
    } = getAnthropicApiKeyWithSource({
      skipRetrievingKeyFromApiKeyHelper: true
    });
    return !!getApiKeyFromConfigOrMacOSKeychain() && (apiKeySource === 'ANTHROPIC_API_KEY' || apiKeySource === 'apiKeyHelper');
  },
  render: () => {
    const {
      source: apiKeySource
    } = getAnthropicApiKeyWithSource({
      skipRetrievingKeyFromApiKeyHelper: true
    });
    return <Box flexDirection="row" marginTop={1}>
        <Text color="warning">{figures.warning}</Text>
        <Text color="warning">
          Auth conflict: Using {apiKeySource} instead of Gakr account login.
          Either unset {apiKeySource}, or run `/logout`.
        </Text>
      </Box>;
  }
};
const bothAuthMethodsNotice: StatusNoticeDefinition = {
  id: 'both-auth-methods',
  type: 'warning',
  isActive: () => {
    const {
      source: apiKeySource
    } = getAnthropicApiKeyWithSource({
      skipRetrievingKeyFromApiKeyHelper: true
    });
    const authTokenInfo = getAuthTokenSource();
    return apiKeySource !== 'none' && authTokenInfo.source !== 'none' && !(apiKeySource === 'apiKeyHelper' && authTokenInfo.source === 'apiKeyHelper');
  },
  render: () => {
    const {
      source: apiKeySource
    } = getAnthropicApiKeyWithSource({
      skipRetrievingKeyFromApiKeyHelper: true
    });
    const authTokenInfo = getAuthTokenSource();
    return <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row">
          <Text color="warning">{figures.warning}</Text>
          <Text color="warning">
            Auth conflict: Both a token ({authTokenInfo.source}) and an API key
            ({apiKeySource}) are set. This may lead to unexpected behavior.
          </Text>
        </Box>
        <Box flexDirection="column" marginLeft={3}>
          <Text color="warning">
            · Trying to use{' '}
            {authTokenInfo.source === 'gakr.ai' ? 'gakr.ai' : authTokenInfo.source}
            ?{' '}
            {apiKeySource === 'ANTHROPIC_API_KEY' ? 'Unset the ANTHROPIC_API_KEY environment variable, or /logout then say "No" to the API key approval before login.' : apiKeySource === 'apiKeyHelper' ? 'Unset the apiKeyHelper setting.' : '/logout'}
          </Text>
          <Text color="warning">
            · Trying to use {apiKeySource}?{' '}
            {authTokenInfo.source === 'gakr.ai' ? '/logout to sign out of gakr.ai.' : `Unset the ${authTokenInfo.source} environment variable.`}
          </Text>
        </Box>
      </Box>;
  }
};
const largeAgentDescriptionsNotice: StatusNoticeDefinition = {
  id: 'large-agent-descriptions',
  type: 'warning',
  isActive: context => {
    if (context.isLocalModel && context.localModelContextLoad) {
      return false;
    }
    const totalTokens = getAgentDescriptionsTotalTokens(context.agentDefinitions);
    return totalTokens > AGENT_DESCRIPTIONS_THRESHOLD;
  },
  render: context => {
    const totalTokens = getAgentDescriptionsTotalTokens(context.agentDefinitions);
    return <Box flexDirection="row">
        <Text color="warning">{figures.warning}</Text>
        <Text color="warning">
          Large cumulative agent descriptions will impact performance (~
          {formatNumber(totalTokens)} tokens &gt;{' '}
          {formatNumber(AGENT_DESCRIPTIONS_THRESHOLD)})
          <Text dimColor> · /agents to manage</Text>
        </Text>
      </Box>;
  }
};
const jetbrainsPluginNotice: StatusNoticeDefinition = {
  id: 'jetbrains-plugin-install',
  type: 'info',
  isActive: context => {
    // Only show if running in JetBrains built-in terminal
    if (!isSupportedJetBrainsTerminal()) {
      return false;
    }
    // Don't show if auto-install is disabled
    const shouldAutoInstall = context.config.autoInstallIdeExtension ?? true;
    if (!shouldAutoInstall) {
      return false;
    }
    // Check if plugin is already installed (cached to avoid repeated filesystem checks)
    const ideType = getTerminalIdeType();
    return ideType !== null && !isJetBrainsPluginInstalledCachedSync(ideType);
  },
  render: () => {
    const ideType = getTerminalIdeType();
    const ideName = toIDEDisplayName(ideType);
    return <Box flexDirection="row" gap={1} marginLeft={1}>
        <Text color="ide">{figures.arrowUp}</Text>
        <Text>
          Install the <Text color="ide">{ideName}</Text> plugin from the
          JetBrains Marketplace.
        </Text>
      </Box>;
  }
};

const PERMISSIVE_MODES_REQUIRING_CLASSIFIER: ReadonlyArray<PermissionMode> = [
  'acceptEdits',
  'bypassPermissions',
];

const thirdPartyPermissiveModeNotice: StatusNoticeDefinition = {
  id: 'third-party-permissive-mode',
  type: 'warning',
  isActive: ctx => {
    const mode = ctx.permissionMode;
    if (!mode || !PERMISSIVE_MODES_REQUIRING_CLASSIFIER.includes(mode)) {
      return false;
    }
    if (ctx.mainLoopModel && modelSupportsAutoMode(ctx.mainLoopModel)) {
      return false;
    }
    return getAPIProvider() !== 'firstParty';
  },
  render: ctx => {
    const mode = ctx.permissionMode;
    return <Box flexDirection="row">
        <Text color="warning">{figures.warning}</Text>
        <Text color="warning">
          <Text bold>{mode}</Text> mode is active on a third-party provider —
          tool calls run without the AI safety classifier.
          <Text dimColor> Inspect tool calls manually, especially when working with untrusted code.</Text>
        </Text>
      </Box>;
  }
};

function hasDangerouslySkipPermissionsArg(): boolean {
  return process.argv.includes('--dangerously-skip-permissions');
}

const dangerouslySkipPermissionsNotice: StatusNoticeDefinition = {
  id: 'dangerously-skip-permissions-no-sandbox',
  type: 'warning',
  isActive: ctx =>
    hasDangerouslySkipPermissionsArg() ||
    ctx.permissionMode === 'bypassPermissions',
  render: () => <Box flexDirection="row">
      <Text color="warning">{figures.warning}</Text>
      <Text color="warning">
        <Text bold>--dangerously-skip-permissions</Text> bypasses every tool
        consent check.
        <Text dimColor> Only use inside a sandbox with no internet access. Restart without the flag to re-enable prompts.</Text>
      </Text>
    </Box>
};

const localModelContextLoadNotice: StatusNoticeDefinition = {
  id: 'local-model-context-load',
  type: 'warning',
  isActive: context => context.localModelContextLoad != null,
  render: context => {
    const warning = context.localModelContextLoad;
    if (!warning) {
      return null;
    }
    return <Box flexDirection="column">
        <Box flexDirection="row">
          <Text color="warning">{figures.warning}</Text>
          <Text color="warning">
            Local model context load is high: {warning.lines.join(' · ')}
            <Text dimColor> Use /doctor for details.</Text>
          </Text>
        </Box>
      </Box>;
  }
};

// All notice definitions
export const statusNoticeDefinitions: StatusNoticeDefinition[] = [largeMemoryFilesNotice, largeAgentDescriptionsNotice, localModelContextLoadNotice, gakrcliAiSubscriberExternalTokenNotice, apiKeyConflictNotice, bothAuthMethodsNotice, jetbrainsPluginNotice, thirdPartyPermissiveModeNotice, dangerouslySkipPermissionsNotice];

// Helper functions for external use
export function getActiveNotices(context: StatusNoticeContext): StatusNoticeDefinition[] {
  return statusNoticeDefinitions.filter(notice => notice.isActive(context));
}
