/**
 * Tests for the 4 actions ported from gakrcli-for-chrome-mcp:
 *   - read_console_messages
 *   - read_network_requests
 *   - fill_form
 *   - resize_window
 *
 * Scope:
 *   1. Schema validation via BrowserActionFlatSchema (provider-facing flat
 *      shape — does NOT apply per-action defaults; only proves `action` is
 *      one of the known names).
 *   2. parseBrowserAction — the strict per-action validator. Applies
 *      per-variant defaults and strictObject rules. Returns a
 *      BrowserActionParseResult tagged union.
 *   3. isReadOnly() — the two read-only batch reads should be classified
 *      as read-only; fill_form and resize_window should NOT.
 *   4. shortActionResult() — the canonical short summary shown in the
 *      canonical-text output. Covers the new switch cases directly.
 *   5. toAutoClassifierInput() — the compact representation surfaced to
 *      the auto-mode classifier. Covers the new switch cases directly.
 *
 * The executor dispatch (browserEngine.ts) and the live Playwright
 * integration (browserServer.ts) are covered separately by the existing
 * test files; this file stays schema + presentation-only so it can run
 * without a real browser.
 */
import { describe, it, expect } from 'bun:test';

import { BrowserActionFlatSchema, parseBrowserAction } from '../types.js';
import { WebBrowserTool, shortActionResult } from '../WebBrowserTool.js';

describe('ported action: read_console_messages', () => {
  it('flat schema accepts a minimal valid payload', () => {
    const result = BrowserActionFlatSchema.parse({ action: 'read_console_messages' });
    expect(result.action).toBe('read_console_messages');
  });

  it('flat schema does NOT apply per-action defaults', () => {
    // The flat schema is provider-facing; defaults are only applied by
    // parseBrowserAction. This test pins that contract for fields that ARE
    // declared on the flat schema. (`tail` lives on the strict per-action
    // schema only, so it's not part of the flat shape at all.)
    const result = BrowserActionFlatSchema.parse({ action: 'read_console_messages' });
    expect(result.level).toBeUndefined();
    expect(result.only_errors).toBeUndefined();
  });

  it('flat schema accepts a fully populated payload', () => {
    // The flat schema is a flat list of ALL optional fields. Per-action
    // fields (like `tail`) belong to the strict per-action schema, not the
    // flat one. So this payload only exercises fields the flat schema
    // actually declares.
    const result = BrowserActionFlatSchema.parse({
      action: 'read_console_messages',
      level: 'warn',
      only_errors: false,
    });
    expect(result.level).toBe('warn');
    expect(result.only_errors).toBe(false);
  });

  it('flat schema rejects an unknown level value', () => {
    const parsed = BrowserActionFlatSchema.safeParse({
      action: 'read_console_messages',
      level: 'trace',
    });
    expect(parsed.success).toBe(false);
  });

  it('flat schema rejects tail out of range (>500)', () => {
    const parsed = BrowserActionFlatSchema.safeParse({
      action: 'read_console_messages',
      tail: 501,
    });
    expect(parsed.success).toBe(false);
  });

  it('parseBrowserAction applies defaults and returns the tagged action', () => {
    const result = parseBrowserAction({ action: 'read_console_messages' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.action.action).toBe('read_console_messages');
      const action = result.action as {
        level?: string;
        only_errors?: boolean;
        tail?: number;
      };
      expect(action.level).toBe('all');
      expect(action.only_errors).toBe(false);
      expect(action.tail).toBe(100);
    }
  });

  it('parseBrowserAction surfaces a precise error for unknown level', () => {
    const result = parseBrowserAction({
      action: 'read_console_messages',
      level: 'trace',
    } as never);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toMatch(/level/);
    }
  });

  it('isReadOnly classifies read_console_messages as read-only', () => {
    expect(
      WebBrowserTool.isReadOnly({ action: 'read_console_messages' } as never),
    ).toBe(true);
  });

  it('shortActionResult shortens on only_errors', () => {
    const out = shortActionResult({
      action: 'read_console_messages',
      level: 'all',
      only_errors: true,
      tail: 100,
    } as never);
    expect(out).toBe('Read error console messages');
  });

  it('shortActionResult includes the level when not all and no only_errors', () => {
    const out = shortActionResult({
      action: 'read_console_messages',
      level: 'warn',
      only_errors: false,
      tail: 25,
    } as never);
    expect(out).toBe('Read warn-level console messages (tail=25)');
  });

  it('toAutoClassifierInput shortens on only_errors', () => {
    const out = WebBrowserTool.toAutoClassifierInput({
      action: 'read_console_messages',
      level: 'all',
      only_errors: true,
      tail: 100,
    } as never);
    expect(out).toBe('read_console_messages: errors only');
  });

  it('toAutoClassifierInput includes the level when no only_errors', () => {
    const out = WebBrowserTool.toAutoClassifierInput({
      action: 'read_console_messages',
      level: 'warn',
      only_errors: false,
      tail: 100,
    } as never);
    expect(out).toBe('read_console_messages: level=warn');
  });
});

describe('ported action: read_network_requests', () => {
  it('flat schema accepts a minimal valid payload', () => {
    const result = BrowserActionFlatSchema.parse({ action: 'read_network_requests' });
    expect(result.action).toBe('read_network_requests');
  });

  it('flat schema accepts an optional url_pattern', () => {
    const result = BrowserActionFlatSchema.parse({
      action: 'read_network_requests',
      url_pattern: '/api/',
    });
    expect(result.url_pattern).toBe('/api/');
  });

  it('flat schema rejects an empty url_pattern (min length 1)', () => {
    const parsed = BrowserActionFlatSchema.safeParse({
      action: 'read_network_requests',
      url_pattern: '',
    });
    expect(parsed.success).toBe(false);
  });

  it('parseBrowserAction applies defaults', () => {
    const result = parseBrowserAction({ action: 'read_network_requests' });
    expect(result.success).toBe(true);
    if (result.success) {
      const action = result.action as {
        failed_only?: boolean;
        tail?: number;
      };
      expect(action.failed_only).toBe(false);
      expect(action.tail).toBe(100);
    }
  });

  it('isReadOnly classifies read_network_requests as read-only', () => {
    expect(
      WebBrowserTool.isReadOnly({ action: 'read_network_requests' } as never),
    ).toBe(true);
  });

  it('shortActionResult shortens on failed_only', () => {
    const out = shortActionResult({
      action: 'read_network_requests',
      failed_only: true,
      tail: 100,
    } as never);
    expect(out).toBe('Read failed network requests');
  });

  it('toAutoClassifierInput embeds the url_pattern when present', () => {
    const out = WebBrowserTool.toAutoClassifierInput({
      action: 'read_network_requests',
      url_pattern: '/api/',
      failed_only: false,
      tail: 100,
    } as never);
    expect(out).toBe("read_network_requests: url~'/api/'");
  });
});

describe('ported action: fill_form', () => {
  it('flat schema accepts a single-field payload', () => {
    const result = BrowserActionFlatSchema.parse({
      action: 'fill_form',
      fields: [{ selector: '#email', value: 'a@b.c' }],
    });
    expect(result.action).toBe('fill_form');
    expect(result.fields).toHaveLength(1);
  });

  it('flat schema accepts a multi-field payload with mixed actions', () => {
    const result = BrowserActionFlatSchema.parse({
      action: 'fill_form',
      fields: [
        { selector: '#email', value: 'a@b.c' },
        { selector: '#country', value: 'US', action: 'select' },
        { selector: '#agree', value: '', action: 'check' },
      ],
    });
    expect(result.fields).toHaveLength(3);
    expect(result.fields?.[1]?.action).toBe('select');
    expect(result.fields?.[2]?.action).toBe('check');
  });

  it('flat schema rejects an invalid per-field action', () => {
    const parsed = BrowserActionFlatSchema.safeParse({
      action: 'fill_form',
      fields: [{ selector: '#x', value: 'y', action: 'bogus' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('parseBrowserAction applies default per-field action = type', () => {
    const result = parseBrowserAction({
      action: 'fill_form',
      fields: [{ selector: '#email', value: 'a@b.c' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const action = result.action as {
        fields: Array<{ action: string }>;
      };
      expect(action.fields[0]?.action).toBe('type');
    }
  });

  it('parseBrowserAction rejects an empty fields array (min 1)', () => {
    const result = parseBrowserAction({
      action: 'fill_form',
      fields: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toMatch(/fields/);
    }
  });

  it('fill_form is NOT classified as read-only', () => {
    expect(
      WebBrowserTool.isReadOnly({ action: 'fill_form' } as never),
    ).toBe(false);
  });

  it('shortActionResult pluralizes correctly for one vs many fields', () => {
    const one = shortActionResult({
      action: 'fill_form',
      fields: [{ selector: '#x', value: 'y' }],
    } as never);
    expect(one).toBe('Filled 1 form field');

    const many = shortActionResult({
      action: 'fill_form',
      fields: [
        { selector: '#a', value: '1' },
        { selector: '#b', value: '2' },
      ],
    } as never);
    expect(many).toBe('Filled 2 form fields');
  });
});

describe('ported action: resize_window', () => {
  it('flat schema accepts a valid viewport size', () => {
    const result = BrowserActionFlatSchema.parse({
      action: 'resize_window',
      width: 1280,
      height: 720,
    });
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
  });

  it('flat schema rejects width below the 320 minimum', () => {
    const parsed = BrowserActionFlatSchema.safeParse({
      action: 'resize_window',
      width: 100,
      height: 720,
    });
    expect(parsed.success).toBe(false);
  });

  it('flat schema rejects height above the 8192 maximum', () => {
    const parsed = BrowserActionFlatSchema.safeParse({
      action: 'resize_window',
      width: 1280,
      height: 9999,
    });
    expect(parsed.success).toBe(false);
  });

  it('resize_window is NOT classified as read-only', () => {
    expect(
      WebBrowserTool.isReadOnly({ action: 'resize_window' } as never),
    ).toBe(false);
  });

  it('shortActionResult includes width and height', () => {
    const out = shortActionResult({
      action: 'resize_window',
      width: 800,
      height: 600,
    } as never);
    expect(out).toBe('Resized viewport to 800x600');
  });

  it('toAutoClassifierInput includes width and height', () => {
    const out = WebBrowserTool.toAutoClassifierInput({
      action: 'resize_window',
      width: 1024,
      height: 768,
    } as never);
    expect(out).toBe('resize_window: 1024x768');
  });
});

describe('ported actions: discriminated union coverage', () => {
  it('parseBrowserAction returns the matching tag for each new action', () => {
    for (const payload of [
      { action: 'read_console_messages' as const },
      { action: 'read_network_requests' as const },
      {
        action: 'fill_form' as const,
        fields: [{ selector: '#x', value: 'y' }],
      },
      {
        action: 'resize_window' as const,
        width: 800,
        height: 600,
      },
    ]) {
      const result = parseBrowserAction(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.action.action).toBe(payload.action);
      }
    }
  });

  it('BrowserActionFlatSchema rejects unknown action names', () => {
    const parsed = BrowserActionFlatSchema.safeParse({ action: 'no_such_action' });
    expect(parsed.success).toBe(false);
  });
});
