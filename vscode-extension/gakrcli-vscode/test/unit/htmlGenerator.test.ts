import { describe, it, expect } from 'vitest';
import {
  generateNonce,
  escapeHtmlAttribute,
  getThemeKind,
  generateWebviewHtml,
} from '../../src/webview/htmlGenerator';
import { createMockWebview, Uri } from '../__mocks__/vscode';

describe('generateNonce', () => {
  it('returns a 32-character hex string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns different values on each call', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).not.toBe(nonce2);
  });
});

describe('escapeHtmlAttribute', () => {
  it('escapes double quotes', () => {
    expect(escapeHtmlAttribute('hello "world"')).toBe('hello &quot;world&quot;');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtmlAttribute('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtmlAttribute('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes single quotes', () => {
    expect(escapeHtmlAttribute("it's")).toBe('it&#39;s');
  });

  it('handles empty string', () => {
    expect(escapeHtmlAttribute('')).toBe('');
  });
});

describe('getThemeKind', () => {
  it('returns dark by default (mock has ColorThemeKind.Dark)', () => {
    expect(getThemeKind()).toBe('dark');
  });
});

describe('generateWebviewHtml', () => {
  it('produces valid HTML with CSP nonce', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
    });

    // Has DOCTYPE
    expect(html).toContain('<!DOCTYPE html>');

    // Has CSP with nonce
    expect(html).toMatch(/Content-Security-Policy/);
    expect(html).toMatch(/script-src 'nonce-[0-9a-f]{32}'/);

    // Has no unsafe-eval
    expect(html).not.toContain('unsafe-eval');

    // Has style-src with unsafe-inline (needed for CSS custom properties)
    expect(html).toContain("style-src");
    expect(html).toContain("'unsafe-inline'");

    // Has script tags with nonce
    expect(html).toMatch(/<script nonce="[0-9a-f]{32}">/);

    // Has the root div
    expect(html).toContain('<div id="root"');

    // Has theme data attribute
    expect(html).toContain('data-theme="dark"');
  });

  it('sets IS_SIDEBAR to true for sidebar panels', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: true,
    });

    expect(html).toContain('window.IS_SIDEBAR = true');
    expect(html).toContain('window.IS_FULL_EDITOR = false');
  });

  it('sets IS_FULL_EDITOR to true when specified', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
      isFullEditor: true,
    });

    expect(html).toContain('window.IS_SIDEBAR = false');
    expect(html).toContain('window.IS_FULL_EDITOR = true');
  });

  it('includes initial session data attribute when provided', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
      initialSessionId: 'session-abc-123',
    });

    expect(html).toContain('data-initial-session="session-abc-123"');
  });

  it('escapes XSS in initial prompt', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
      initialPrompt: '"><script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('includes font CSS custom properties', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
    });

    expect(html).toContain('--vscode-editor-font-family:');
    expect(html).toContain('--vscode-editor-font-size:');
    expect(html).toContain('--vscode-chat-font-size:');
  });
});
