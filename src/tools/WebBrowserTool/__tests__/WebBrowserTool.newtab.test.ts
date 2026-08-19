/**
 * Isolated tests that mock the 'playwright' module via bun:test's
 * mock.module(), covering ROUND 7's new-tab auto-tracking and HTTP status
 * capture (both live inside initBrowserSession()'s context-level 'page'
 * handler / navigate()'s Response handling, which need a fake
 * chromium.launch() to exercise end to end).
 *
 * Kept in their own file for the same reason as WebBrowserTool.mocks.test.ts:
 * bun 1.3.11's mock.module() is sticky for the whole test file, so a second,
 * differently-shaped mock.module('playwright', ...) elsewhere in a shared
 * file risks clobbering or being clobbered by this one.
 */

import { describe, it, expect, mock } from 'bun:test';

describe('ROUND 7: new-tab auto-tracking (context "page" event)', () => {
  it('auto-focuses a newly opened page and marks autoSwitchedToNewTab', async () => {
    const firstPage = {
      isClosed: () => false,
      on: mock(() => {}),
      url: () => 'https://example.com/',
      title: async () => 'Example',
      context: () => fakeContext,
    };
    const secondPage = {
      isClosed: () => false,
      on: mock(() => {}),
      url: () => 'https://example.com/popup',
      title: async () => 'Popup',
      context: () => fakeContext,
    };

    let contextPageHandler: ((page: unknown) => void) | null = null;
    const fakeContext: any = {
      on: mock((event: string, handler: (page: unknown) => void) => {
        if (event === 'page') contextPageHandler = handler;
      }),
      route: mock(async () => {}),
      pages: () => [firstPage, secondPage],
      newPage: mock(async () => firstPage),
    };
    const fakeBrowser = { newContext: mock(async () => fakeContext) };

    mock.module('playwright', () => ({
      chromium: { launch: mock(async () => fakeBrowser) },
    }));

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    await server.initBrowserSession({
      headless: true,
      allowed_domains: [],
      chromium_sandbox: true,
      session_timeout_minutes: 30,
      action_timeout_seconds: 300,
      inject_scripts: null,
    } as any);

    // At this point (server) knows only about firstPage (from newPage()).
    expect(server.getLiveState().currentUrl).toBe('https://example.com/');

    // Simulate the site opening a target="_blank" link: Playwright fires the
    // context's 'page' event with the new Page object.
    expect(contextPageHandler).not.toBeNull();
    contextPageHandler!(secondPage);

    // Give the fire-and-forget refreshLiveState() a tick to resolve.
    await new Promise((r) => setTimeout(r, 10));

    const state = server.getLiveState();
    expect(state.currentUrl).toBe('https://example.com/popup');
    expect(state.autoSwitchedToNewTab).toBe(true);
  });

  it('does not re-trigger autoSwitchedToNewTab for a page that is already active', async () => {
    const page = {
      isClosed: () => false,
      on: mock(() => {}),
      url: () => 'https://example.com/',
      title: async () => 'Example',
      context: () => fakeContext,
    };

    let contextPageHandler: ((page: unknown) => void) | null = null;
    const fakeContext: any = {
      on: mock((event: string, handler: (page: unknown) => void) => {
        if (event === 'page') contextPageHandler = handler;
      }),
      route: mock(async () => {}),
      pages: () => [page],
      newPage: mock(async () => page),
    };
    const fakeBrowser = { newContext: mock(async () => fakeContext) };

    mock.module('playwright', () => ({
      chromium: { launch: mock(async () => fakeBrowser) },
    }));

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    await server.initBrowserSession({
      headless: true,
      allowed_domains: [],
      chromium_sandbox: true,
      session_timeout_minutes: 30,
      action_timeout_seconds: 300,
      inject_scripts: null,
    } as any);

    // initBrowserSession()'s own context.newPage() call already fired the
    // 'page' event for this exact page once; firing it again for the SAME
    // page object should be a no-op (page === this.page already).
    contextPageHandler!(page);
    await new Promise((r) => setTimeout(r, 10));

    expect(server.getLiveState().autoSwitchedToNewTab).toBe(false);
  });
});

describe('ROUND 7: HTTP status capture on navigate()', () => {
  it('captures status/statusText from goto()\'s Response and includes it in the result message', async () => {
    const fakeResponse = { status: () => 200, statusText: () => 'OK' };
    const fakePage: any = {
      isClosed: () => false,
      on: mock(() => {}),
      goto: mock(async () => fakeResponse),
      url: () => 'https://example.com/',
      title: async () => 'Example',
      content: async () => '<html></html>',
      innerText: async () => 'Example body text',
      context: () => ({ pages: () => [fakePage] }),
    };
    const fakeContext: any = {
      on: mock(() => {}),
      route: mock(async () => {}),
      newPage: mock(async () => fakePage),
    };
    const fakeBrowser = { newContext: mock(async () => fakeContext) };

    mock.module('playwright', () => ({
      chromium: { launch: mock(async () => fakeBrowser) },
    }));

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    await server.initBrowserSession({
      headless: true,
      allowed_domains: [],
      chromium_sandbox: true,
      session_timeout_minutes: 30,
      action_timeout_seconds: 300,
      inject_scripts: null,
    } as any);

    const result = await server.navigate('https://example.com/', false);
    expect(result).toContain('200');
    expect(result).toContain('OK');
    expect(server.getLiveState().httpStatus).toBe(200);
    expect(server.getLiveState().httpStatusText).toBe('OK');
    expect(server.getLiveState().contentPreview).toBe('Example body text');
  });

  it('classifies a 404 response for the panel via derivePanelState-equivalent httpStatus field', async () => {
    const fakeResponse = { status: () => 404, statusText: () => 'Not Found' };
    const fakePage: any = {
      isClosed: () => false,
      on: mock(() => {}),
      goto: mock(async () => fakeResponse),
      url: () => 'https://example.com/missing',
      title: async () => 'Not Found',
      content: async () => '<html></html>',
      innerText: async () => '',
      context: () => ({ pages: () => [fakePage] }),
    };
    const fakeContext: any = {
      on: mock(() => {}),
      route: mock(async () => {}),
      newPage: mock(async () => fakePage),
    };
    const fakeBrowser = { newContext: mock(async () => fakeContext) };

    mock.module('playwright', () => ({
      chromium: { launch: mock(async () => fakeBrowser) },
    }));

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    await server.initBrowserSession({
      headless: true,
      allowed_domains: [],
      chromium_sandbox: true,
      session_timeout_minutes: 30,
      action_timeout_seconds: 300,
      inject_scripts: null,
    } as any);

    await server.navigate('https://example.com/missing', false);
    expect(server.getLiveState().httpStatus).toBe(404);
  });
});

describe('ROUND 10 screenshot finding: "Last Action: new()" nonsensical verb', () => {
  it('the auto-tab-switch handler no longer overwrites lastOperation with a non-verb phrase', async () => {
    const page1: any = { isClosed: () => false, on: mock(() => {}), url: () => 'https://example.com/', title: async () => 'A' };
    const page2: any = { isClosed: () => false, on: mock(() => {}), url: () => 'https://example.com/popup', title: async () => 'B' };
    let contextPageHandler: ((page: unknown) => void) | null = null;
    const fakeContext: any = {
      on: mock((event: string, handler: (page: unknown) => void) => {
        if (event === 'page') contextPageHandler = handler;
      }),
      route: mock(async () => {}),
      pages: () => [page1, page2],
      newPage: mock(async () => page1),
    };
    page1.context = () => fakeContext;
    page2.context = () => fakeContext;
    const fakeBrowser = { newContext: mock(async () => fakeContext) };

    mock.module('playwright', () => ({ chromium: { launch: mock(async () => fakeBrowser) } }));

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    await server.initBrowserSession({
      headless: true,
      allowed_domains: [],
      chromium_sandbox: true,
      session_timeout_minutes: 30,
      action_timeout_seconds: 300,
      inject_scripts: null,
    } as any);

    // Simulate a prior real action having set a real lastOperation, THEN a
    // new tab opens (e.g. a target="_blank" click) — the auto-switch must
    // NOT clobber lastOperation with something unparseable as a verb.
    (server as any).liveState.lastOperation = 'click [3]';

    contextPageHandler!(page2);
    await new Promise((r) => setTimeout(r, 10));

    const state = server.getLiveState();
    expect(state.autoSwitchedToNewTab).toBe(true);
    // Regression guard for the exact screenshot bug: must NOT become "new
    // tab opened" (whose first word "new" rendered as the nonsensical
    // "Last Action: new()").
    expect(state.lastOperation).not.toBe('new tab opened');
    expect(state.lastOperation).toBe('click [3]');
  });
});
