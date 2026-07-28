import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import { useEffect, useRef } from 'react';
import { logError } from '../utils/log.js';
import { z } from 'zod/v4';
import { callIdeRpc } from '../services/mcp/client.js';
import type { ConnectedMCPServer, MCPServerConnection } from '../services/mcp/types.js';
import type { PermissionMode } from '../types/permissions.js';
import { GAKR_IN_CHROME_MCP_SERVER_NAME, isTrackedGakrCLIInChromeTabId } from '../utils/gakrcliInChrome/common.js';
import { lazySchema } from '../utils/lazySchema.js';
import { enqueuePendingNotification } from '../utils/messageQueueManager.js';

// Schema for the prompt notification from Chrome extension (JSON-RPC 2.0 format)
const GakrCLIInChromePromptNotificationSchema = lazySchema(() => z.object({
  method: z.literal('notifications/message'),
  params: z.object({
    prompt: z.string(),
    image: z.object({
      type: z.literal('base64'),
      media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
      data: z.string()
    }).optional(),
    tabId: z.number().optional()
  })
}));

export function getGakrCLIInChromePermissionMode(toolPermissionMode: PermissionMode): 'ask' | 'skip_all_permission_checks' {
  return toolPermissionMode === 'fullAccess'
    ? 'skip_all_permission_checks'
    : 'ask';
}

/**
 * A hook that listens for prompt notifications from the GakrCLI for Chrome extension,
 * enqueues them as user prompts, and syncs permission mode changes to the extension.
 */
export function usePromptsFromGakrCLIInChrome(
  mcpClients: MCPServerConnection[],
  toolPermissionMode: PermissionMode,
): void {
  const mcpClientRef = useRef<ConnectedMCPServer | undefined>(undefined);

  useEffect(() => {
    if (process.env.USER_TYPE !== 'ant') return;

    const mcpClient = findChromeClient(mcpClients);
    if (mcpClientRef.current !== mcpClient) {
      mcpClientRef.current = mcpClient;
    }

    if (mcpClient) {
      mcpClient.client.setNotificationHandler(GakrCLIInChromePromptNotificationSchema(), notification => {
        if (mcpClientRef.current !== mcpClient) return;
        const { tabId, prompt, image } = notification.params;

        // Process notifications from tabs we're tracking since notifications are broadcasted
        if (typeof tabId !== 'number' || !isTrackedGakrCLIInChromeTabId(tabId)) return;

        try {
          if (image) {
            const contentBlocks: ContentBlockParam[] = [
              { type: 'text', text: prompt },
              {
                type: 'image',
                source: {
                  type: image.type,
                  media_type: image.media_type,
                  data: image.data,
                },
              },
            ];
            enqueuePendingNotification({ value: contentBlocks, mode: 'prompt' });
          } else {
            enqueuePendingNotification({ value: prompt, mode: 'prompt' });
          }
        } catch (error) {
          logError(error as Error);
        }
      });
    }
  }, [mcpClients]);

  // Sync permission mode with Chrome extension whenever it changes
  useEffect(() => {
    const chromeClient = findChromeClient(mcpClients);
    if (!chromeClient) return;

    const chromeMode = getGakrCLIInChromePermissionMode(toolPermissionMode);
    void callIdeRpc('set_permission_mode', { mode: chromeMode }, chromeClient);
  }, [mcpClients, toolPermissionMode]);
}

function findChromeClient(clients: MCPServerConnection[]): ConnectedMCPServer | undefined {
  return clients.find(
    (client): client is ConnectedMCPServer =>
      client.type === 'connected' && client.name === GAKR_IN_CHROME_MCP_SERVER_NAME,
  );
}
