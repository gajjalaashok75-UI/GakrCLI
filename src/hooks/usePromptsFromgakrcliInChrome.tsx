import { c as _c } from "react-compiler-runtime";
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import { useEffect, useRef } from 'react';
import { logError } from 'src/utils/log.js';
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
export function usePromptsFromGakrCLIInChrome(mcpClients, toolPermissionMode) {
  const $ = _c(6);
  useRef(undefined);
  let t0;
  if ($[0] !== mcpClients) {
    t0 = [mcpClients];
    $[0] = mcpClients;
    $[1] = t0;
  } else {
    t0 = $[1];
  }
  useEffect(_temp, t0);
  let t1;
  let t2;
  if ($[2] !== mcpClients || $[3] !== toolPermissionMode) {
    t1 = () => {
      const chromeClient = findChromeClient(mcpClients);
      if (!chromeClient) {
        return;
      }
      const chromeMode = getGakrCLIInChromePermissionMode(toolPermissionMode);
      callIdeRpc("set_permission_mode", {
        mode: chromeMode
      }, chromeClient);
    };
    t2 = [mcpClients, toolPermissionMode];
    $[2] = mcpClients;
    $[3] = toolPermissionMode;
    $[4] = t1;
    $[5] = t2;
  } else {
    t1 = $[4];
    t2 = $[5];
  }
  useEffect(t1, t2);
}
function _temp() {}
function findChromeClient(clients: MCPServerConnection[]): ConnectedMCPServer | undefined {
  return clients.find((client): client is ConnectedMCPServer => client.type === 'connected' && client.name === GAKR_IN_CHROME_MCP_SERVER_NAME);
}
