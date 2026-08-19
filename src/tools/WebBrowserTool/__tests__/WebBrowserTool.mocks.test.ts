/**
 * Isolated tests for BrowserToolExecutor that stub ../browserServer.js via
 * bun:test's mock.module().
 *
 * These MUST live in their own file: in bun 1.3.11 a mock.module() call is
 * sticky for the whole test file (the `sticky: false` option is ignored, and
 * mock.restore() does not clear module mocks). When these tests sat in
 * WebBrowserTool.test.ts, the FakeBrowserServer leaked into every later test
 * in that file (ISSUE 8/9/10 got a server with no refresh/wait/pressKey, and
 * ISSUE 7 hung on the never-resolving initBrowserSession). Separate test
 * files isolate module mocks, so each file gets exactly one registration per
 * module path; a second mock.module for the same path overrides the first.
 */

import { describe, it, expect, mock } from 'bun:test';

describe('MISSING 1: ensureInitialized respects init timeout', () => {
  it('surfaces a timeout error instead of hanging when init never resolves', async () => {
    // Swap in a fake BrowserServer whose initBrowserSession() hangs forever,
    // and a fake chromium discovery so the constructor doesn't need a real
    // browser installed in the test environment.
    mock.module('../browserServer.js', () => ({
      BrowserServer: class FakeBrowserServer {
        isRecording = false;
        async initBrowserSession() {
          return new Promise(() => {}); // never resolves
        }
        async injectScriptsToSession() {}
        setInjectScripts() {}
        async getBrowserState() {
          return JSON.stringify({ elements: '', url: 'about:blank' });
        }
      },
    }));

    const { BrowserToolExecutor } = await import('../browserEngine.js');
    const originalCheck = BrowserToolExecutor.checkChromiumAvailable;
    BrowserToolExecutor.checkChromiumAvailable = () => '/fake/chromium';

    try {
      const executor = new BrowserToolExecutor({
        initTimeoutSeconds: 0.05,
        actionTimeoutSeconds: 5,
      });

      const observation = await executor.call({ action: 'get_state', include_screenshot: false } as any);
      expect(observation.is_error).toBe(true);
      expect(observation.text.toLowerCase()).toContain('timed out');
    } finally {
      BrowserToolExecutor.checkChromiumAvailable = originalCheck;
    }
  });
});

describe("getLiveState() on the executor returns the empty snapshot before initialization", () => {
  it('short-circuits to the empty snapshot rather than delegating to the server', async () => {
    // A fake whose getLiveState() would report isInitialized:true proves the
    // executor never delegates before an action has initialized the session.
    // This registration overrides the one above for this file (second
    // mock.module for the same path wins).
    mock.module('../browserServer.js', () => ({
      BrowserServer: class FakeBrowserServer {
        isRecording = false;
        getLiveState() {
          return { isInitialized: true } as any; // should NOT be reached
        }
        async initBrowserSession() {}
        async injectScriptsToSession() {}
        setInjectScripts() {}
      },
    }));

    const { BrowserToolExecutor } = await import('../browserEngine.js');
    const originalCheck = BrowserToolExecutor.checkChromiumAvailable;
    BrowserToolExecutor.checkChromiumAvailable = () => '/fake/chromium';

    try {
      const executor = new BrowserToolExecutor({ initTimeoutSeconds: 1 });
      // Before any action has run, `initialized` is false, so getLiveState()
      // must short-circuit to the empty snapshot rather than delegating.
      const state = executor.getLiveState();
      expect(state.isInitialized).toBe(false);
    } finally {
      BrowserToolExecutor.checkChromiumAvailable = originalCheck;
    }
  });
});
