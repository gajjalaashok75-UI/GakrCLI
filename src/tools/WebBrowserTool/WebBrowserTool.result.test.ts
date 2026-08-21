import { describe, expect, it } from 'bun:test';
import { WebBrowserTool, type WebBrowserOutput } from './WebBrowserTool.js';

function makeOutput(overrides: Partial<WebBrowserOutput> = {}): WebBrowserOutput {
  return {
    observationText: overrides.observationText ?? 'ok',
    isError: overrides.isError ?? false,
    contentBlocks: overrides.contentBlocks ?? [{ type: 'text', text: 'ok' }],
  };
}

describe('WebBrowserTool.renderToolResultMessage', () => {
  it('returns plain observation text for a simple success', () => {
    const result = 'Navigated https://example.com';
    const rendered = (WebBrowserTool as unknown as { renderToolResultMessage: (c: WebBrowserOutput) => string }).renderToolResultMessage(makeOutput({ observationText: result }));
    expect(rendered).toBe(result);
  });

  it('returns error prefix when isError is true', () => {
    const rendered = (WebBrowserTool as unknown as { renderToolResultMessage: (c: WebBrowserOutput) => string }).renderToolResultMessage(makeOutput({ isError: true, observationText: 'DNS failed' }));
    expect(rendered).toBe('WebBrowser error: DNS failed');
  });

  it('truncates long output past 100 chars', () => {
    const longText = 'x'.repeat(150);
    const rendered = (WebBrowserTool as unknown as { renderToolResultMessage: (c: WebBrowserOutput) => string }).renderToolResultMessage(makeOutput({ observationText: longText }));
    expect(rendered).toHaveLength(100);
    expect(rendered.endsWith('...')).toBeTrue();
  });

  it('truncates multiline output', () => {
    const multiline = 'line1\nline2\nline3';
    const rendered = (WebBrowserTool as unknown as { renderToolResultMessage: (c: WebBrowserOutput) => string }).renderToolResultMessage(makeOutput({ observationText: multiline }));
    expect(rendered.endsWith('...')).toBeTrue();
  });
});

describe('WebBrowserTool.extractSearchText', () => {
  it('strips newlines and caps at 120 chars', () => {
    const long = 'a'.repeat(200);
    const rendered = (WebBrowserTool as unknown as { extractSearchText: (c: WebBrowserOutput) => string }).extractSearchText(makeOutput({ observationText: long }));
    expect(rendered.replace(/\n/g, ' ')).toBe(rendered);
    expect(rendered.length).toBeLessThanOrEqual(120);
    expect(rendered.endsWith('...')).toBeTrue();
  });

  it('adds error prefix only for errors', () => {
    expect((WebBrowserTool as unknown as { extractSearchText: (c: WebBrowserOutput) => string }).extractSearchText(makeOutput())).not.toContain('WebBrowser error:');
    expect((WebBrowserTool as unknown as { extractSearchText: (c: WebBrowserOutput) => string }).extractSearchText(makeOutput({ isError: true, observationText: 'boom' }))).toContain('WebBrowser error: boom');
  });
});