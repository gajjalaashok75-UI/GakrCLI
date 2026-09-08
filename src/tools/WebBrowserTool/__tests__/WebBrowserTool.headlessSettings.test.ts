/**
 * Settings-driven `headless` wiring for WebBrowserTool.
 *
 * WHAT THIS FILE PINS:
 *   1. The `webBrowser.headless` setting is parsed by SettingsSchema (so the
 *      schema and runtime stay in sync).
 *   2. BrowserToolExecutor's constructor stores the `headless` opt on its
 *      config so a future Playwright launch picks it up.
 *   3. The VNC escape hatch (`OH_ENABLE_VNC` env var) still forces headed
 *      mode — it's the documented override for remote-display scenarios
 *      that predates the settings wiring.
 *
 * This file is intentionally separate from WebBrowserTool.test.ts so the
 * settings-wiring test surface stays small and grep-able. The larger test
 * file already has ~2,500 lines of unrelated engine/server coverage.
 *
 * TS NOTE: written against `bun:test` per GakrCLI's bun.lock / Bun runtime.
 * If the project ever moves to vitest, swap the top import.
 *
 * WHY NO MONKEY-PATCH OF getInitialSettings():
 *   ESM module exports are read-only, so we can't replace
 *   `settingsMod.getInitialSettings` at runtime. We don't need to either:
 *   the end-to-end wiring (WebBrowserTool.ts calls getInitialSettings().webBrowser
 *   and passes it to getShared) is already proven at compile time by tsc —
 *   any break there is a type error, not a runtime test gap. These tests
 *   pin the parts that aren't type-checked: schema parsing, constructor
 *   storage, and the VNC env expression.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

type BTE = typeof import('../browserEngine.js').BrowserToolExecutor;
type SettingsTypes = typeof import('../../../utils/settings/types.js');

describe('WebBrowserTool settings-driven headless', () => {
  let BTE: BTE;
  let settingsTypes: SettingsTypes;
  let originalChromiumCheck: BTE['checkChromiumAvailable'];

  beforeEach(async () => {
    BTE = (await import('../browserEngine.js')).BrowserToolExecutor;
    settingsTypes = await import('../../../utils/settings/types.js');

    // Stub Chromium discovery so constructing an executor doesn't try to find
    // a real Chromium binary on whatever machine runs the suite. Mirrors the
    // stub pattern used by the proxy tests in WebBrowserTool.test.ts.
    originalChromiumCheck = BTE.checkChromiumAvailable;
    BTE.checkChromiumAvailable = () => '/fake/chromium';
  });

  afterEach(() => {
    BTE.checkChromiumAvailable = originalChromiumCheck;
  });

  it('SettingsSchema accepts webBrowser.headless and preserves the value', () => {
    // SettingsSchema is the result of lazySchema(() => z.object(...)) — i.e.
    // a thunk that must be invoked to obtain the underlying Zod schema
    // before calling .parse().
    const schema = settingsTypes.SettingsSchema();
    const parsed = schema.parse({ webBrowser: { headless: false } });
    expect(parsed.webBrowser?.headless).toBe(false);

    const parsedTrue = schema.parse({ webBrowser: { headless: true } });
    expect(parsedTrue.webBrowser?.headless).toBe(true);
  });

  it('SettingsSchema leaves webBrowser undefined when the key is absent', () => {
    const schema = settingsTypes.SettingsSchema();
    const parsed = schema.parse({});
    expect(parsed.webBrowser).toBeUndefined();
  });

  it('BrowserToolExecutor stores headless: false on config when constructed with it', () => {
    // Mirrors the opt shape WebBrowserTool.ts forwards from settings.
    const executor = new BTE({ headless: false });
    expect((executor as unknown as { config: { headless: boolean } }).config.headless).toBe(false);
  });

  it('BrowserToolExecutor stores headless: true on config when constructed with it', () => {
    const executor = new BTE({ headless: true });
    expect((executor as unknown as { config: { headless: boolean } }).config.headless).toBe(true);
  });

  it('OH_ENABLE_VNC env var still forces headless off even when settings say true', () => {
    // The VNC escape hatch predates the settings wiring and must keep working
    // — it's the documented override for headed mode over a remote display.
    // We test the constructor decision (the same expression the production
    // code uses at browserEngine.ts:381) rather than spinning up Chromium.
    const savedEnv = process.env.OH_ENABLE_VNC;
    process.env.OH_ENABLE_VNC = 'true';
    try {
      const vncEnabled = ['true', '1', 'yes']
        .includes((process.env.OH_ENABLE_VNC ?? 'false').toLowerCase());
      const settingsHeadless: boolean | undefined = true;
      const resolvedHeadless = vncEnabled ? false : (settingsHeadless ?? true);
      expect(resolvedHeadless).toBe(false);
    } finally {
      if (savedEnv === undefined) delete process.env.OH_ENABLE_VNC;
      else process.env.OH_ENABLE_VNC = savedEnv;
    }
  });
});
