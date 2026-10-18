import { TOOL_NAMES } from '@gakr-gakr/mcp-chrome-shared';
import * as React from 'react';
import { MessageResponse } from '../../components/MessageResponse.js';
import { Text } from '../../ink.js';
import { renderToolResultMessage as renderDefaultMCPToolResultMessage } from '../../tools/MCPTool/UI.js';
import type { MCPToolResult } from '../../utils/mcpValidation.js';
import { truncateToWidth } from '../format.js';
import { trackGakrCLIInChromeTabId } from './common.js';
export type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * All tool names the Chrome extension implements, derived from the shared
 * registry the extension names its own tools from so this cannot drift.
 */
export type ChromeToolName = (typeof TOOL_NAMES)['BROWSER'][keyof (typeof TOOL_NAMES)['BROWSER']];
function renderChromeToolUseMessage(input: Record<string, unknown>, toolName: ChromeToolName, verbose: boolean): React.ReactNode {
  const tabId = input.tabId;
  if (typeof tabId === 'number') {
    trackGakrCLIInChromeTabId(tabId);
  }

  // Build secondary info based on tool type and input
  const secondaryInfo: string[] = [];
  switch (toolName) {
    case 'chrome_navigate':
      if (typeof input.url === 'string') {
        try {
          const url = new URL(input.url);
          secondaryInfo.push(url.hostname);
        } catch {
          secondaryInfo.push(truncateToWidth(input.url, 30));
        }
      }
      break;
    case 'chrome_computer':
      if (typeof input.action === 'string') {
        const action = input.action;
        if (action === 'left_click' || action === 'right_click' || action === 'double_click' || action === 'middle_click') {
          if (typeof input.ref === 'string') {
            secondaryInfo.push(`${action} on ${input.ref}`);
          } else if (Array.isArray(input.coordinate)) {
            secondaryInfo.push(`${action} at (${input.coordinate.join(', ')})`);
          } else {
            secondaryInfo.push(action);
          }
        } else if (action === 'type' && typeof input.text === 'string') {
          secondaryInfo.push(`type "${truncateToWidth(input.text, 15)}"`);
        } else if (action === 'key' && typeof input.text === 'string') {
          secondaryInfo.push(`key ${input.text}`);
        } else if (action === 'scroll' && typeof input.scroll_direction === 'string') {
          secondaryInfo.push(`scroll ${input.scroll_direction}`);
        } else if (action === 'wait' && typeof input.duration === 'number') {
          secondaryInfo.push(`wait ${input.duration}s`);
        } else if (action === 'left_click_drag') {
          secondaryInfo.push('drag');
        } else {
          secondaryInfo.push(action);
        }
      }
      break;
    case 'chrome_gif_recorder':
      if (typeof input.action === 'string') {
        secondaryInfo.push(`${input.action}`);
      }
      break;
    case 'chrome_console':
      if (typeof input.mode === 'string') {
        secondaryInfo.push(`mode: ${input.mode}`);
      }
      if (typeof input.maxMessages === 'number') {
        secondaryInfo.push(`max: ${input.maxMessages}`);
      }
      break;
    case 'chrome_network_request':
      if (typeof input.url === 'string') {
        secondaryInfo.push(`url: ${truncateToWidth(input.url, 20)}`);
      }
      if (typeof input.method === 'string') {
        secondaryInfo.push(input.method);
      }
      break;
    case 'chrome_javascript':
      // In verbose mode, show the full code
      if (verbose && typeof input.code === 'string') {
        return input.code;
      }
      // In non-verbose mode, return empty string to preserve View Tab layout
      return '';
    case 'get_windows_and_tabs':
    case 'chrome_read_page':
    case 'chrome_screenshot':
    case 'chrome_close_tabs':
    case 'chrome_switch_tab':
    case 'chrome_get_web_content':
    case 'chrome_network_capture':
    case 'chrome_handle_download':
    case 'chrome_history':
    case 'chrome_bookmark_search':
    case 'chrome_bookmark_add':
    case 'chrome_bookmark_delete':
    case 'chrome_click_element':
    case 'chrome_fill_or_select':
    case 'chrome_request_element_selection':
    case 'chrome_keyboard':
    case 'chrome_upload_file':
    case 'chrome_handle_dialog':
    case 'performance_start_trace':
    case 'performance_stop_trace':
    case 'performance_analyze_insight':
      // These tools don't have meaningful secondary info to show inline.
      // Return empty string (not null) to ensure tool header still renders.
      return '';
  }
  return secondaryInfo.join(', ') || null;
}

/**
 * Custom tool result message rendering for gakrcli-in-chrome tools.
 * Shows a brief summary for successful results. Errors are handled by
 * the default renderToolUseErrorMessage when is_error is set.
 */
export function renderChromeToolResultMessage(output: MCPToolResult, toolName: ChromeToolName, verbose: boolean): React.ReactNode {
  if (verbose) {
    return renderDefaultMCPToolResultMessage(output, [], {
      verbose
    });
  }
  let summary: string | null = null;
  switch (toolName) {
    case 'chrome_navigate':
      summary = 'Navigation completed';
      break;
    case 'get_windows_and_tabs':
      summary = 'Tabs read';
      break;
    case 'chrome_fill_or_select':
      summary = 'Input completed';
      break;
    case 'chrome_computer':
      summary = 'Action completed';
      break;
    case 'chrome_gif_recorder':
      summary = 'GIF action completed';
      break;
    case 'chrome_console':
      summary = 'Console messages retrieved';
      break;
    case 'chrome_network_request':
      summary = 'Network request completed';
      break;
    case 'chrome_network_capture':
      summary = 'Network capture completed';
      break;
    case 'chrome_javascript':
      summary = 'Script executed';
      break;
    case 'chrome_read_page':
      summary = 'Page read';
      break;
    case 'chrome_screenshot':
      summary = 'Screenshot captured';
      break;
    case 'chrome_get_web_content':
      summary = 'Page content retrieved';
      break;
    case 'chrome_click_element':
      summary = 'Click performed';
      break;
    case 'chrome_upload_file':
      summary = 'File uploaded';
      break;
    case 'chrome_history':
      summary = 'History retrieved';
      break;
    case 'chrome_bookmark_search':
      summary = 'Bookmarks searched';
      break;
  }
  if (summary) {
    return <MessageResponse height={1}>
        <Text dimColor>{summary}</Text>
      </MessageResponse>;
  }
  return null;
}

/**
 * Returns tool method overrides for GakrCLI in Chrome MCP tools. Use this to customize
 * rendering for chrome tools in a single spread operation.
 */
export function getGakrCLIInChromeMCPToolOverrides(toolName: string): {
  userFacingName: (input?: Record<string, unknown>) => string;
  renderToolUseMessage: (input: Record<string, unknown>, options: {
    verbose: boolean;
  }) => React.ReactNode;
  renderToolUseTag: (input: Partial<Record<string, unknown>>) => React.ReactNode;
  renderToolResultMessage: (output: string | MCPToolResult, progressMessagesForMessage: unknown[], options: {
    verbose: boolean;
  }) => React.ReactNode;
} {
  return {
    userFacingName(_input?: Record<string, unknown>) {
      // Trim the _mcp postfix that show up in some of the tool names
      const displayName = toolName.replace(/_mcp$/, '');
      return `GakrCLI in Chrome[${displayName}]`;
    },
    renderToolUseMessage(input: Record<string, unknown>, {
      verbose
    }: {
      verbose: boolean;
    }): React.ReactNode {
      return renderChromeToolUseMessage(input, toolName as ChromeToolName, verbose);
    },
    renderToolUseTag(_input: Partial<Record<string, unknown>>): React.ReactNode {
      // The old "[View Tab]" tag was a deep link into the upstream extension's
      // web app (clau.de). This extension registers no such URL handler, so the
      // link did nothing and is not rendered.
      return null;
    },
    renderToolResultMessage(output: string | MCPToolResult, _progressMessagesForMessage: unknown[], {
      verbose
    }: {
      verbose: boolean;
    }): React.ReactNode {
      if (!isMCPToolResult(output)) {
        return null;
      }
      return renderChromeToolResultMessage(output, toolName as ChromeToolName, verbose);
    }
  };
}
function isMCPToolResult(output: string | MCPToolResult): output is MCPToolResult {
  return typeof output === 'object' && output !== null;
}
