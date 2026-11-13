/**
 * Guards the protected Chrome MCP tool surface after the Web Editor /
 * element-marker cleanup. Imports the real tool registry and asserts the
 * human-in-the-loop tools the CLI advertises are still registered and
 * dispatchable.
 */

import { describe, expect, test } from 'vitest';
import { handleCallTool } from '@/entrypoints/background/tools';
import { TOOL_NAMES } from '@gakr-gakr/mcp-chrome-shared';

describe('protected Chrome MCP tools remain registered', () => {
  test('chrome_read_page is registered and dispatchable', async () => {
    // No active tab in the test env: the tool must still resolve through the
    // registry and answer via its own handler. A registry miss would produce
    // "Tool chrome_read_page not found"; reaching the handler produces a
    // tab/accessibility error instead.
    const result = await handleCallTool({
      name: TOOL_NAMES.BROWSER.READ_PAGE,
      args: {},
    });
    const text = JSON.stringify(result);
    expect(text).not.toContain(`Tool ${TOOL_NAMES.BROWSER.READ_PAGE} not found`);
  });

  test('chrome_request_element_selection is registered and validates input', async () => {
    // Empty requests[] is rejected by the tool itself, proving dispatch reached it.
    const result = await handleCallTool({
      name: TOOL_NAMES.BROWSER.REQUEST_ELEMENT_SELECTION,
      args: { requests: [] },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toMatch(/requests/i);
  });
});
