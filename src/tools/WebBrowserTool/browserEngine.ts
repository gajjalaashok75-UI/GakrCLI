/**
 * BrowserToolExecutor — the core engine wrapper.
 *
 * LAYER 1 — GakrCLI-AGNOSTIC. Ported from impl.py (773 lines): the
 * `recording_aware` decorator, chromium path discovery, consecutive-failure
 * reset, and the shared singleton executor all port exactly.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { AsyncMutex } from './asyncMutex.js';
import { BrowserServer } from './browserServer.js';
import {
  BROWSER_RECORDING_OUTPUT_DIR,
  BrowserObservation,
  DEFAULT_BROWSER_ACTION_TIMEOUT_SECONDS,
  DEGRADED_TIMEOUT_SECONDS,
  EMPTY_BROWSER_LIVE_STATE,
  MAX_CONSECUTIVE_FAILURES,
  type BrowserAction,
  type BrowserConfig,
  type BrowserProxyConfig,
  type BrowserLiveState,
} from './types.js';

const logger = {
  debug: (...args: unknown[]) => { if (process.env.DEBUG) console.debug('[browserEngine]', ...args); },
  info: (...args: unknown[]) => console.info('[browserEngine]', ...args),
  warn: (...args: unknown[]) => console.warn('[browserEngine]', ...args),
};

// ============================================================
// Chromium discovery (ported EXACTLY from impl.py's platform path helpers)
// ============================================================

function currentPlatform(platform?: NodeJS.Platform): NodeJS.Platform {
  return platform ?? process.platform;
}

function windowsBrowserInstallPaths(): string[] {
  const roots = [
    process.env.PROGRAMFILES ?? 'C:\\Program Files',
    process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
    process.env.LOCALAPPDATA,
  ].filter((r): r is string => Boolean(r));

  const browsers = [
    ['Google', 'Chrome', 'Application', 'chrome.exe'],
    ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
    ['Chromium', 'Application', 'chrome.exe'],
  ];

  const paths: string[] = [];
  for (const root of roots) {
    for (const parts of browsers) {
      paths.push(path.join(root, ...parts));
    }
  }
  return paths;
}

function standardChromiumPaths(platform?: NodeJS.Platform): string[] {
  switch (currentPlatform(platform)) {
    case 'darwin':
      return [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ];
    case 'win32':
      return windowsBrowserInstallPaths();
    default:
      return [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/microsoft-edge',
        '/usr/bin/microsoft-edge-stable',
      ];
  }
}

function playwrightCacheDirs(platform?: NodeJS.Platform): string[] {
  const home = os.homedir();
  switch (currentPlatform(platform)) {
    case 'darwin':
      return [path.join(home, 'Library', 'Caches', 'ms-playwright')];
    case 'win32': {
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) return [path.join(localAppData, 'ms-playwright')];
      return [path.join(home, 'AppData', 'Local', 'ms-playwright')];
    }
    default:
      return [path.join(home, '.cache', 'ms-playwright')];
  }
}

function playwrightChromiumPaths(chromiumDir: string, platform?: NodeJS.Platform): string[] {
  switch (currentPlatform(platform)) {
    case 'darwin':
      return [
        path.join(chromiumDir, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        path.join(chromiumDir, 'chrome-mac', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        path.join(chromiumDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      ];
    case 'win32':
      return [
        path.join(chromiumDir, 'chrome-win64', 'chrome.exe'),
        path.join(chromiumDir, 'chrome-win', 'chrome.exe'),
      ];
    default:
      return [
        path.join(chromiumDir, 'chrome-linux64', 'chrome'),
        path.join(chromiumDir, 'chrome-linux', 'chrome'),
      ];
  }
}

function pathBinaryCandidates(platform?: NodeJS.Platform): string[] {
  if (currentPlatform(platform) === 'win32') return ['chrome', 'msedge', 'chromium'];
  return ['google-chrome', 'chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
}

/** TS equivalent of `shutil.which()`. */
function which(binary: string): string | null {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE').split(';') : [''];
  const dirs = (process.env.PATH ?? '').split(path.delimiter);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, binary + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // not found here, keep looking
      }
    }
  }
  return null;
}

function formatBrowserOperationError(error: unknown, timeoutSeconds?: number): string {
  let errorDetail: string;
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || (error as any).isTimeout) {
      errorDetail =
        timeoutSeconds !== undefined
          ? `Operation timed out after ${Math.trunc(timeoutSeconds)} seconds`
          : 'Operation timed out';
    } else if (error.message?.trim()) {
      errorDetail = error.message.trim();
    } else {
      errorDetail = error.constructor.name;
    }
  } else {
    errorDetail = String(error);
  }
  return `Browser operation failed: ${errorDetail}`;
}

function getChromiumErrorMessage(): string {
  return (
    'Chromium is required for browser operations but is not installed.\n\n' +
    'To install Chromium, run one of the following commands:\n' +
    '  1. Using npx (recommended): npx playwright install chromium\n' +
    '  2. Using bunx: bunx playwright install chromium\n' +
    '  3. Using system package manager:\n' +
    '     - Ubuntu/Debian: sudo apt install chromium-browser\n' +
    '     - macOS: brew install chromium\n' +
    '     - Windows: winget install Chromium.Chromium\n\n' +
    'After installation, restart your application to use the browser tool.'
  );
}

/** TS NOTE: Python's `_install_chromium()` shells out to `uvx playwright install`.
 * The Node equivalent installs via `npx`/`bunx` (see package.json postinstall note
 * in the README this port ships with). Kept as a best-effort helper; failures are
 * non-fatal — the caller falls back to `getChromiumErrorMessage()`. */
export function installChromium(): boolean {
  try {
    const runner = which('bunx') ? 'bunx' : which('npx');
    if (!runner) {
      logger.warn('npx/bunx not found - cannot auto-install Chromium');
      return false;
    }
    execFileSync(runner, ['playwright', 'install', 'chromium'], {
      timeout: 300_000,
      stdio: 'pipe',
    });
    logger.info('Chromium installation completed successfully');
    return true;
  } catch (e) {
    logger.warn(`Error during Chromium installation: ${e}`);
    return false;
  }
}

// ============================================================
// Timeout helper (TS equivalent of impl.py's run_with_timeout / TimeoutError)
// ============================================================

class BrowserTimeoutError extends Error {
  isTimeout = true;
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutSeconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new BrowserTimeoutError(`Operation timed out after ${timeoutSeconds} seconds`));
    }, timeoutSeconds * 1000);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// ============================================================
// BrowserToolExecutor
// ============================================================

/** Init timeout (MISSING 1 FIX), matching Python's `init_timeout_seconds=30`. */
const INIT_TIMEOUT_SECONDS = 30;

export interface BrowserToolExecutorOptions {
  headless?: boolean;
  allowedDomains?: string[];
  sessionTimeoutMinutes?: number;
  actionTimeoutSeconds?: number;
  /** MISSING 1 FIX: timeout for browser session init (chromium.launch() + page setup). Default: 30s. */
  initTimeoutSeconds?: number;
  fullOutputSaveDir?: string | null;
  injectScripts?: string[] | null;
  /**
   * Explicit outbound proxy for Chromium's network traffic. When omitted,
   * falls back to `resolveProxyFromEnv()` (HTTPS_PROXY/HTTP_PROXY/ALL_PROXY
   * env vars) — set this explicitly to override or to opt OUT by passing
   * `null` even when those env vars are present.
   */
  proxy?: BrowserProxyConfig | null;
  /**
   * Secrets the LLM can reference via `<secret>key</secret>` placeholders in
   * action parameters. See `secretRedaction.ts` for resolution rules and
   * TOTP handling. Sensitive values never appear in returned observation
   * text — they are redacted after each call.
   */
  sensitiveData?: Record<string, string | Record<string, string>> | null;
  /** Real browser window size (headless: false only). Default: 1280x1024. See resolveLaunchConfig() in browserServer.ts. */
  windowSize?: { width: number; height: number } | null;
  /** Real browser window position (headless: false only). Default: OS-placed. */
  windowPosition?: { x: number; y: number } | null;
}

/**
 * Falls back to the same proxy env vars most CLI HTTP clients (curl, git,
 * npm, etc.) already honor automatically — Chromium does NOT read these on
 * its own, which is the most common cause of "my shell has internet but the
 * browser tool says it doesn't" in a sandboxed/containerized environment.
 * Checks both-case variants since env var casing conventions vary
 * (`HTTPS_PROXY` is the documented curl/Node convention; some tooling only
 * sets the lowercase form).
 */
export function resolveProxyFromEnv(): BrowserProxyConfig | null {
  const server =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;

  if (!server) return null;

  const bypass = process.env.NO_PROXY || process.env.no_proxy;
  return { server, bypass: bypass || undefined };
}

export class BrowserToolExecutor {
  private server: BrowserServer;
  private config: BrowserConfig;
  private initialized = false;
  private cleanupInitiated = false;
  private consecutiveFailures = 0;
  private actionTimeoutSeconds: number;
  private initTimeoutSeconds: number;
  private fullOutputSaveDir: string | null;

  /**
   * Current page URL, or null if the browser is closed/never navigated.
   * BUG FIX: this used to reach into `this.server.page` directly, a
   * `private` field — see BrowserServer.getCurrentUrl()'s doc comment.
   */
  getCurrentUrl(): string | null {
    return this.server?.getCurrentUrl() ?? null;
  }

  /** Effective sensitive_data config (URL filtering is applied by callers). */
  getSensitiveData(): Record<string, string | Record<string, string>> | null {
    return this.config.sensitive_data ?? null;
  }
  /** MISSING 2 FIX: instance-level lock guarding close(), mirroring Python's `_close_lock`. */
  private closeLock = new AsyncMutex();
  /** MISSING 3 FIX: process-exit cleanup handler, registered once in the constructor. */
  private exitCleanupHandler: (() => void) | null = null;

  /** Cached Chromium discovery result (TS equivalent of Python's `@functools.cache`). */
  private static chromiumPathCache: string | null | undefined;

  static checkChromiumAvailable(): string | null {
    if (BrowserToolExecutor.chromiumPathCache !== undefined) {
      return BrowserToolExecutor.chromiumPathCache;
    }

    for (const p of standardChromiumPaths()) {
      if (fs.existsSync(p)) {
        BrowserToolExecutor.chromiumPathCache = p;
        return p;
      }
    }

    for (const cacheDir of playwrightCacheDirs()) {
      if (fs.existsSync(cacheDir)) {
        let entries: string[] = [];
        try {
          entries = fs.readdirSync(cacheDir).filter((e) => e.startsWith('chromium-'));
        } catch {
          entries = [];
        }
        for (const entry of entries) {
          const chromiumDir = path.join(cacheDir, entry);
          for (const p of playwrightChromiumPaths(chromiumDir)) {
            if (fs.existsSync(p)) {
              BrowserToolExecutor.chromiumPathCache = p;
              return p;
            }
          }
        }
      }
    }

    for (const binary of pathBinaryCandidates()) {
      const found = which(binary);
      if (found) {
        BrowserToolExecutor.chromiumPathCache = found;
        return found;
      }
    }

    BrowserToolExecutor.chromiumPathCache = null;
    return null;
  }

  private ensureChromiumAvailable(): string {
    const found = BrowserToolExecutor.checkChromiumAvailable();
    if (found) {
      logger.info(`Chromium is available for browser operations at ${found}`);
      return found;
    }
    throw new Error(getChromiumErrorMessage());
  }

  constructor(opts: BrowserToolExecutorOptions = {}) {
    const executablePath = this.ensureChromiumAvailable();

    // OH_ENABLE_VNC env override -> force headless off.
    const vncEnabled = ['true', '1', 'yes'].includes((process.env.OH_ENABLE_VNC ?? 'false').toLowerCase());
    const headless = vncEnabled ? false : (opts.headless ?? true);
    if (vncEnabled) logger.info('VNC is enabled - running browser in non-headless mode');

    // Chromium refuses to run sandboxed as root; disable sandbox in that case.
    const runningAsRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    if (runningAsRoot) {
      logger.warn('Running as root - disabling Chromium sandbox (required for root). This reduces security isolation.');
    }

    const actionTimeoutSeconds = opts.actionTimeoutSeconds ?? DEFAULT_BROWSER_ACTION_TIMEOUT_SECONDS;
    if (actionTimeoutSeconds <= 0) {
      throw new Error('actionTimeoutSeconds must be greater than 0');
    }

    this.config = {
      headless,
      allowed_domains: opts.allowedDomains ?? [],
      executable_path: executablePath,
      chromium_sandbox: !runningAsRoot,
      // MISSING 4: session_timeout_minutes is accepted and stored but not
      // yet enforced. Python passes this to browser_use's BrowserUseServer,
      // which applies it as a session inactivity timeout; the current raw-
      // Playwright BrowserServer has no direct equivalent and simply keeps
      // the browser/context open until explicitly closed. Lower
      // priority per review — acceptable for v1, revisit if idle browser
      // sessions become an issue (e.g. track last-activity timestamp in
      // BrowserServer and force-close on ensureInitialized() checks).
      session_timeout_minutes: opts.sessionTimeoutMinutes ?? 30,
      action_timeout_seconds: actionTimeoutSeconds,
      inject_scripts: opts.injectScripts ?? null,
      // BUG: `opts.proxy ?? resolveProxyFromEnv()` would treat an explicit
      // `proxy: null` (meant to opt OUT of the env-var fallback) the same
      // as "not provided", since `??` falls through on null too — silently
      // contradicting the documented "pass null to opt out" behavior.
      // `undefined` (key omitted) is the only case that should fall back.
      proxy: opts.proxy === undefined ? resolveProxyFromEnv() : opts.proxy,
      sensitive_data: opts.sensitiveData ?? null,
      window_size: opts.windowSize ?? null,
      window_position: opts.windowPosition ?? null,
    };

    const initTimeoutSeconds = opts.initTimeoutSeconds ?? INIT_TIMEOUT_SECONDS;
    if (initTimeoutSeconds <= 0) {
      throw new Error('initTimeoutSeconds must be greater than 0');
    }

    this.actionTimeoutSeconds = actionTimeoutSeconds;
    this.initTimeoutSeconds = initTimeoutSeconds;
    this.fullOutputSaveDir = opts.fullOutputSaveDir ?? null;
    this.server = new BrowserServer();
    if (this.config.inject_scripts) {
      this.server.setInjectScripts(this.config.inject_scripts);
    }

    // MISSING 3 FIX: Python's `__del__` calls close() to prevent Chromium
    // process leaks on GC. Node/Bun have no reliable finalizer for this, so
    // register a best-effort cleanup on process exit instead — the closest
    // practical equivalent. `beforeExit` allows the async close() to run;
    // `exit` is a last-ditch synchronous fallback (close() is fire-and-forget
    // there since async work can't complete during the `exit` event).
    this.exitCleanupHandler = () => {
      this.close().catch(() => {});
    };
    process.once('beforeExit', this.exitCleanupHandler);
    process.once('exit', this.exitCleanupHandler);
  }

  /**
   * Explicit dispose for callers that want deterministic cleanup (e.g. tests)
   * without waiting on process-exit hooks. Complements MISSING 3's fallback.
   * (Not wired to `Symbol.dispose` — that requires the `esnext.disposable`
   * TS lib, which the consuming project's tsconfig may not include. Call
   * this directly, or adopt `using executor = ...` + `Symbol.dispose` in
   * the real repo once that lib target is confirmed available.)
   */
  dispose(): void {
    this.close().catch(() => {});
  }

  /** Submit an action and wait for the result, with timeout + crash-recovery tracking. */
  async call(action: BrowserAction, signal?: AbortSignal): Promise<BrowserObservation> {
    if (signal?.aborted) {
      return BrowserObservation.fromText('Browser action aborted', true);
    }
    const effectiveTimeout =
      this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES - 1 ? DEGRADED_TIMEOUT_SECONDS : this.actionTimeoutSeconds;

    try {
      const result = await withTimeout(this.executeAction(action, signal), effectiveTimeout);
      this.consecutiveFailures = 0;
      return result;
    } catch (error) {
      if (error instanceof BrowserTimeoutError) {
        return this.handleTimeoutFailure(formatBrowserOperationError(error, effectiveTimeout));
      }
      const message = error instanceof Error ? error.message : String(error);
      if (/abort/i.test(message)) {
        return BrowserObservation.fromText('Browser action aborted', true);
      }
      throw error;
    }
  }

  private async handleTimeoutFailure(errorText: string): Promise<BrowserObservation> {
    this.consecutiveFailures += 1;
    logger.debug(`Browser timeout failure ${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`);

    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logger.warn(
        `Browser appears crashed (${this.consecutiveFailures} consecutive failures). Resetting session for automatic recovery.`,
      );
      try {
        await withTimeout(this.cleanup(), 5);
      } catch (e) {
        logger.debug(`Cleanup during session reset failed (expected if browser crashed): ${e}`);
      }
      this.initialized = false;
      this.consecutiveFailures = 0;
      errorText +=
        '\n\nThe browser session has been reset after multiple consecutive ' +
        'failures (possible crash). The browser will be restarted on ' +
        'the next action. Please retry your action.';
    }

    return BrowserObservation.fromText(errorText, true, { fullOutputSaveDir: this.fullOutputSaveDir });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      // MISSING 1 FIX: previously unbounded — a hang in chromium.launch() or
      // page setup would block forever. Bound it with a dedicated init
      // timeout (Python: init_timeout_seconds=30), distinct from the
      // per-action timeout.
      await withTimeout(
        (async () => {
          await this.server.initBrowserSession(this.config);
          await this.server.injectScriptsToSession();
        })(),
        this.initTimeoutSeconds,
      );
      this.initialized = true;
    }
  }

  // ── recordingAware wrapping (TS equivalent of impl.py's @recording_aware decorator) ──
  //
  // Wraps navigate/goBack/click so recording is flushed before and
  // restarted after, without interrupting the operation on failure.
  private async recordingAware<T>(name: string, op: () => Promise<T>): Promise<T> {
    const isRecording = this.server.isRecording;
    if (isRecording) {
      try {
        await this.server.flushRecordingEvents();
      } catch (e) {
        logger.debug(`Recording flush before ${name} skipped: ${e}`);
      }
    }

    const result = await op();

    if (isRecording) {
      try {
        await this.server.restartRecordingOnNewPage();
      } catch (e) {
        logger.debug(`Recording restart after ${name} skipped: ${e}`);
      }
    }

    return result;
  }

  // ── Navigation & control ──

  private async navigate(url: string, newTab: boolean, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.recordingAware('navigate', () => this.server.navigate(url, newTab, signal));
  }

  private async goBack(signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.recordingAware('go_back', () => this.server.goBack(signal));
  }

  // ISSUE 8/9/10: three new Playwright-direct actions.
  private async refresh(signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.recordingAware('refresh', () => this.server.refresh(signal));
  }

  private async wait(ms: number, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.wait(ms, signal);
  }

  private async pressKey(key: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.pressKey(key, signal);
  }

  private async waitForElement(
    selector: string,
    state: 'visible' | 'hidden' | 'attached' | 'detached',
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<string> {
    await this.ensureInitialized();
    return this.server.waitForElement(selector, state, timeoutMs, signal);
  }

  private async sendKeys(keys: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.sendKeys(keys, signal);
  }

  private async takeScreenshot(fileName?: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.takeScreenshot(fileName, signal);
  }

  private async getDropdownOptions(index: number, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.getDropdownOptions(index, signal);
  }

  private async selectDropdown(index: number, text: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.selectDropdown(index, text, signal);
  }

  private async uploadFile(index: number, path: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.uploadFile(index, path, signal);
  }

  private async searchGoogle(query: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.searchGoogle(query, signal);
  }

  private async saveAsPdf(
    fileName?: string,
    printBackground?: boolean,
    landscape?: boolean,
    scale?: number,
    paperFormat?: string,
    signal?: AbortSignal,
  ): Promise<string> {
    await this.ensureInitialized();
    return this.server.saveAsPdf(fileName, printBackground, landscape, scale, paperFormat, signal);
  }

  private async click(
    index: number | undefined,
    newTab: boolean,
    selector?: string,
    coordinateX?: number,
    coordinateY?: number,
    signal?: AbortSignal,
  ): Promise<string> {
    await this.ensureInitialized();
    return this.recordingAware('click', () => this.server.click(index, newTab, selector, coordinateX, coordinateY, signal));
  }

  private async typeText(index: number | undefined, text: string, selector?: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.typeText(index, text, selector, signal);
  }

  private async scroll(direction: 'up' | 'down', signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.scroll(direction, signal);
  }

  private async scrollToText(text: string, direction: 'up' | 'down', signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.scrollToText(text, direction, signal);
  }

  private async evaluate(code: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.evaluate(code, signal);
  }

  private async findElements(
    selector: string,
    attributes?: string[],
    maxResults?: number,
    includeText?: boolean,
    signal?: AbortSignal,
  ): Promise<string> {
    await this.ensureInitialized();
    return this.server.findElements(selector, attributes, maxResults, includeText, signal);
  }

  private async searchPage(
    pattern: string,
    regex?: boolean,
    caseSensitive?: boolean,
    contextChars?: number,
    cssScope?: string,
    maxResults?: number,
    signal?: AbortSignal,
  ): Promise<string> {
    await this.ensureInitialized();
    return this.server.searchPage(pattern, regex, caseSensitive, contextChars, cssScope, maxResults, signal);
  }

  private async getState(includeScreenshot: boolean, signal?: AbortSignal): Promise<BrowserObservation> {
    await this.ensureInitialized();
    const resultJson = await this.server.getBrowserState(includeScreenshot, signal);

    if (includeScreenshot) {
      try {
        const parsed = JSON.parse(resultJson);
        const screenshotData = parsed.screenshot ?? null;
        delete parsed.screenshot;
        return BrowserObservation.fromText(JSON.stringify(parsed, null, 2), false, {
          screenshotData,
          fullOutputSaveDir: this.fullOutputSaveDir,
        });
      } catch {
        // Fall through and return as-is if parsing fails.
      }
    }

    return BrowserObservation.fromText(resultJson, false, { fullOutputSaveDir: this.fullOutputSaveDir });
  }

  private async getStorage(signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.getStorage(signal);
  }

  private async setStorage(storageState: { cookies: any[]; origins: any[] }, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.setStorage(storageState, signal);
  }

  private async listTabs(signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.listTabs(signal);
  }

  private async switchTab(tabId: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.switchTab(tabId, signal);
  }

  private async closeTab(tabId: string, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.closeTab(tabId, signal);
  }

  private async closeAllTabs(signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.closeAllTabs(signal);
  }

  private async getContent(extractLinks: boolean, startFromChar: number, signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.getContent(extractLinks, startFromChar, signal);
  }

  private async startRecording(signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.startRecording(BROWSER_RECORDING_OUTPUT_DIR, signal);
  }

  private async stopRecording(signal?: AbortSignal): Promise<string> {
    await this.ensureInitialized();
    return this.server.stopRecording(signal);
  }

  private async executeAction(action: BrowserAction, signal?: AbortSignal): Promise<BrowserObservation> {
    try {
      let result: string;

      switch (action.action) {
        case 'navigate':
          result = await this.navigate(action.url, action.new_tab, signal);
          break;
        case 'click':
          result = await this.click(action.index, action.new_tab, action.selector, action.coordinate_x, action.coordinate_y, signal);
          break;
        case 'type':
          result = await this.typeText(action.index, action.text, action.selector, signal);
          break;
        case 'get_state':
          return this.getState(action.include_screenshot, signal);
        case 'get_storage':
          result = await this.getStorage(signal);
          break;
        case 'set_storage':
          result = await this.setStorage(action.storage_state, signal);
          break;
        case 'get_content':
          result = await this.getContent(action.extract_links, action.start_from_char, signal);
          break;
        case 'scroll':
          result = await this.scroll(action.direction, signal);
          break;
        case 'scroll_to_text':
          result = await this.scrollToText(action.text, action.direction, signal);
          break;
        case 'evaluate':
          result = await this.evaluate(action.code, signal);
          break;
        case 'find_elements':
          result = await this.findElements(action.selector, action.attributes, action.max_results, action.include_text, signal);
          break;
        case 'search_page':
          result = await this.searchPage(action.pattern, action.regex, action.case_sensitive, action.context_chars, action.css_scope, action.max_results, signal);
          break;
        case 'go_back':
          result = await this.goBack(signal);
          break;
        case 'list_tabs':
          result = await this.listTabs(signal);
          break;
        case 'switch_tab':
          result = await this.switchTab(action.tab_id, signal);
          break;
        case 'close_tab':
          result = await this.closeTab(action.tab_id, signal);
          break;
        case 'close_all_tabs':
          result = await this.closeAllTabs(signal);
          break;
        case 'start_recording':
          result = await this.startRecording(signal);
          break;
        case 'stop_recording':
          result = await this.stopRecording(signal);
          break;
        case 'refresh':
          result = await this.refresh(signal);
          break;
        case 'wait':
          result = await this.wait(action.ms, signal);
          break;
        case 'press_key':
          result = await this.pressKey(action.key, signal);
          break;
        case 'wait_for_element':
          result = await this.waitForElement(action.selector, action.state, action.timeout_ms, signal);
          break;
        case 'send_keys':
          result = await this.sendKeys(action.keys, signal);
          break;
        case 'screenshot':
          result = await this.takeScreenshot(action.file_name, signal);
          break;
        case 'dropdown_options':
          result = await this.getDropdownOptions(action.index, signal);
          break;
        case 'select_dropdown':
          result = await this.selectDropdown(action.index, action.text, signal);
          break;
        case 'upload_file':
          result = await this.uploadFile(action.index, action.path, signal);
          break;
        case 'search_google':
          result = await this.searchGoogle(action.query, signal);
          break;
        case 'save_as_pdf':
          result = await this.saveAsPdf(action.file_name, action.print_background, action.landscape, action.scale, action.paper_format, signal);
          break;
        default:
          return BrowserObservation.fromText(
            `Unsupported action type: ${JSON.stringify(action)}`,
            true,
            { fullOutputSaveDir: this.fullOutputSaveDir },
          );
      }

      return BrowserObservation.fromText(result, false, { fullOutputSaveDir: this.fullOutputSaveDir });
    } catch (error) {
      const errorMsg = formatBrowserOperationError(error);
      logger.warn(errorMsg);
      return BrowserObservation.fromText(errorMsg, true, { fullOutputSaveDir: this.fullOutputSaveDir });
    }
  }

  // ── Lifecycle ──

  async closeBrowser(): Promise<string> {
    if (this.initialized) {
      const result = await this.server.closeBrowser();
      this.initialized = false;
      return result;
    }
    return 'No browser session to close';
  }

  // ── Live state (for WebBrowserPanel.tsx) ──

  /** Cheap, always-available snapshot of the current browser state. */
  getLiveState(): BrowserLiveState {
    if (!this.initialized) return EMPTY_BROWSER_LIVE_STATE;
    return this.server.getLiveState();
  }

  /** Subscribe to live-state changes. Returns an unsubscribe function. */
  onLiveStateChange(listener: (state: BrowserLiveState) => void): () => void {
    return this.server.onLiveStateChange(listener);
  }

  /** On-demand screenshot for the panel (not captured automatically). */
  async captureScreenshot(): Promise<string | null> {
    if (!this.initialized) return null;
    return this.server.captureScreenshot();
  }

  async cleanup(): Promise<void> {
    try {
      await this.closeBrowser();
    } catch (e) {
      logger.warn(`Error during browser cleanup: ${e}`);
    }
  }

  async close(): Promise<void> {
    // MISSING 2 FIX: guard against concurrent close() calls racing each
    // other (Python has `_close_lock` / `threading.Lock` for this; the
    // static `sharedLock` only protects the shared-executor slot, not
    // concurrent calls to a single instance's close()).
    await this.closeLock.acquire();
    try {
      if (this.cleanupInitiated) return;
      this.cleanupInitiated = true;
      try {
        // Python uses a 30s bound on cleanup during close(); match it here.
        await withTimeout(this.cleanup(), 30);
      } catch (e) {
        logger.warn(`Error during browser cleanup: ${e}`);
      }
    } finally {
      this.closeLock.release();
      if (this.exitCleanupHandler) {
        process.removeListener('beforeExit', this.exitCleanupHandler);
        process.removeListener('exit', this.exitCleanupHandler);
        this.exitCleanupHandler = null;
      }
    }
  }

  // ── Shared singleton executor (ported from definition.py's BrowserToolSet) ──

  private static sharedExecutor: BrowserToolExecutor | null = null;
  private static sharedLock = new AsyncMutex();
  private static sharedListeners = new Set<(ex: BrowserToolExecutor | null) => void>();

  /**
   * Subscribe to shared-executor creation/teardown. UI code needs this because
   * `getSharedIfExists()` is a plain static read with no change signal — without
   * it, a panel mounted before the tool first runs can only discover the
   * executor by polling. Fires with the new value (or null on reset).
   */
  static onSharedChange(listener: (ex: BrowserToolExecutor | null) => void): () => void {
    BrowserToolExecutor.sharedListeners.add(listener);
    return () => {
      BrowserToolExecutor.sharedListeners.delete(listener);
    };
  }

  /** Notify shared-slot subscribers. Never lets a bad listener break the caller. */
  private static notifySharedChange(ex: BrowserToolExecutor | null): void {
    for (const listener of BrowserToolExecutor.sharedListeners) {
      try {
        listener(ex);
      } catch (e) {
        logger.warn(`BrowserToolExecutor shared-change listener threw: ${e}`);
      }
    }
  }

  static async getShared(opts?: BrowserToolExecutorOptions): Promise<BrowserToolExecutor> {
    let created: BrowserToolExecutor | null = null;
    let shared: BrowserToolExecutor;
    await BrowserToolExecutor.sharedLock.acquire();
    try {
      if (!BrowserToolExecutor.sharedExecutor) {
        BrowserToolExecutor.sharedExecutor = new BrowserToolExecutor(opts);
        created = BrowserToolExecutor.sharedExecutor;
      } else if (opts) {
        logger.warn(
          'BrowserToolExecutor.getShared() called with options but a shared executor ' +
            'already exists. The options will be ignored. This typically happens when a ' +
            "subagent requests browser tools — it reuses the parent's browser session.",
        );
      }
      shared = BrowserToolExecutor.sharedExecutor;
    } finally {
      BrowserToolExecutor.sharedLock.release();
    }
    // Notify outside the lock: a listener that re-enters getShared()/resetShared()
    // would otherwise deadlock on the mutex it is already holding.
    if (created) BrowserToolExecutor.notifySharedChange(created);
    return shared;
  }

  /**
   * Non-creating peek at the shared executor, for UI code (WebBrowserPanel.tsx)
   * that must never trigger chromium discovery / browser launch as a side
   * effect of merely rendering. Returns null until the tool has actually
   * been invoked at least once this session.
   */
  static getSharedIfExists(): BrowserToolExecutor | null {
    return BrowserToolExecutor.sharedExecutor;
  }

  /** Detach and clear the shared executor if this instance owns that slot. */
  static async resetShared(): Promise<void> {
    let cleared = false;
    await BrowserToolExecutor.sharedLock.acquire();
    try {
      if (BrowserToolExecutor.sharedExecutor) {
        await BrowserToolExecutor.sharedExecutor.close();
        BrowserToolExecutor.sharedExecutor = null;
        cleared = true;
      }
    } finally {
      BrowserToolExecutor.sharedLock.release();
    }
    if (cleared) BrowserToolExecutor.notifySharedChange(null);
  }
}
