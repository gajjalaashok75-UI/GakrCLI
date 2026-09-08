import { describe, it, expect, afterEach } from 'bun:test';
import { resolveLaunchConfig, isDisplayAvailable } from '../browserServer.js';

// ============================================================
// Headless/headed launch resolution — pure functions, no browser needed.
// See browserServer.ts's "Headless / headed launch resolution" section
// header for the full rationale.
// ============================================================

describe('isDisplayAvailable()', () => {
  it('is always true on macOS regardless of env vars', () => {
    expect(isDisplayAvailable({}, 'darwin')).toBe(true);
  });

  it('is always true on Windows regardless of env vars', () => {
    expect(isDisplayAvailable({}, 'win32')).toBe(true);
  });

  it('is true on Linux when DISPLAY is set (X11)', () => {
    expect(isDisplayAvailable({ DISPLAY: ':0' }, 'linux')).toBe(true);
  });

  it('is true on Linux when WAYLAND_DISPLAY is set (Wayland)', () => {
    expect(isDisplayAvailable({ WAYLAND_DISPLAY: 'wayland-0' }, 'linux')).toBe(true);
  });

  it('is false on Linux when neither DISPLAY nor WAYLAND_DISPLAY is set', () => {
    expect(isDisplayAvailable({}, 'linux')).toBe(false);
  });
});

describe('resolveLaunchConfig()', () => {
  it('headless: true uses a fixed viewport (default 1280x720) and hardening args', () => {
    const config = resolveLaunchConfig({ headless: true }, false);
    expect(config.headless).toBe(true);
    expect(config.viewport).toEqual({ width: 1280, height: 720 });
    expect(config.args).toContain('--disable-blink-features=AutomationControlled');
    expect(config.args).toContain('--disable-background-timer-throttling');
    // Headed-only flags must NOT leak into headless args.
    expect(config.args.some((a) => a.startsWith('--window-size'))).toBe(false);
  });

  it('headless: true respects a custom window_size for its viewport', () => {
    const config = resolveLaunchConfig({ headless: true, window_size: { width: 1920, height: 1080 } }, false);
    expect(config.viewport).toEqual({ width: 1920, height: 1080 });
  });

  it('headless: false uses viewport: null (real window drives page size) and a default window size', () => {
    const config = resolveLaunchConfig({ headless: false }, false);
    expect(config.headless).toBe(false);
    expect(config.viewport).toBeNull();
    expect(config.args).toContain('--window-size=1280,1024');
    // Headless-only hardening flags must NOT leak into headed args.
    expect(config.args).not.toContain('--disable-blink-features=AutomationControlled');
  });

  it('headless: false respects a custom window_size', () => {
    const config = resolveLaunchConfig({ headless: false, window_size: { width: 1600, height: 900 } }, false);
    expect(config.args).toContain('--window-size=1600,900');
  });

  it('headless: false adds --window-position only when window_position is given', () => {
    const withoutPosition = resolveLaunchConfig({ headless: false }, false);
    expect(withoutPosition.args.some((a) => a.startsWith('--window-position'))).toBe(false);

    const withPosition = resolveLaunchConfig({ headless: false, window_position: { x: 100, y: 50 } }, false);
    expect(withPosition.args).toContain('--window-position=100,50');
  });

  it('adds --no-sandbox only when running as root, for both headless and headed', () => {
    expect(resolveLaunchConfig({ headless: true }, true).args).toContain('--no-sandbox');
    expect(resolveLaunchConfig({ headless: true }, false).args).not.toContain('--no-sandbox');
    expect(resolveLaunchConfig({ headless: false }, true).args).toContain('--no-sandbox');
    expect(resolveLaunchConfig({ headless: false }, false).args).not.toContain('--no-sandbox');
  });

  it('always includes --disable-dev-shm-usage regardless of headless/root', () => {
    expect(resolveLaunchConfig({ headless: true }, false).args).toContain('--disable-dev-shm-usage');
    expect(resolveLaunchConfig({ headless: false }, true).args).toContain('--disable-dev-shm-usage');
  });
});

describe('initBrowserSession() headless:false display-detection guard', () => {
  const originalDisplay = process.env.DISPLAY;
  const originalWayland = process.env.WAYLAND_DISPLAY;

  afterEach(() => {
    if (originalDisplay === undefined) delete process.env.DISPLAY;
    else process.env.DISPLAY = originalDisplay;
    if (originalWayland === undefined) delete process.env.WAYLAND_DISPLAY;
    else process.env.WAYLAND_DISPLAY = originalWayland;
  });

  it('rejects headless:false with an actionable message when no display is available (linux only)', async () => {
    if (process.platform !== 'linux') return; // isDisplayAvailable() is unconditionally true elsewhere — nothing to assert
    delete process.env.DISPLAY;
    delete process.env.WAYLAND_DISPLAY;

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    let caught: Error | null = null;
    try {
      await server.initBrowserSession({ headless: false } as any);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toMatch(/display server/i);
    expect(caught!.message).toMatch(/xvfb/i);
  });

  it('does not raise the display error for headless:true (the check is headed-mode-only)', async () => {
    if (process.platform !== 'linux') return;
    delete process.env.DISPLAY;
    delete process.env.WAYLAND_DISPLAY;

    // A real launch attempt will likely still fail in this sandbox (no
    // Chromium binary installed) — that's expected and fine. This test
    // only asserts the FAILURE REASON isn't "no display", i.e. the guard
    // correctly does not apply to headless mode.
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    try {
      await server.initBrowserSession({ headless: true } as any);
    } catch (e) {
      expect((e as Error).message).not.toMatch(/display server/i);
    }
  });
});
