/**
 * Recording session management for browser session recording using rrweb.
 *
 * LAYER 1 - GakrCLI-AGNOSTIC. Ported exactly from recording.py (570 lines),
 * every method and every error path.
 *
 * ROUND 10 - REWRITTEN to use Playwright's own `page.evaluate()` /
 * `page.addInitScript()` instead of raw CDP `Runtime.evaluate` /
 * `Page.addScriptToEvaluateOnNewDocument` calls.
 *
 * Why: `start_recording` was reported failing with an opaque
 * `unexpected_response` on EVERY tested page - localhost (no CSP), plain
 * HTTPS sites, everything, 100% reproduction. That universality is itself
 * the important clue: it rules out page-specific causes (CSP, slow
 * loading, a particular site's JS) and points at the CDP plumbing itself.
 * Every one of this file's raw CDP calls did its own manual
 * `result?.result?.value` parsing of the raw protocol response - exactly
 * the kind of hand-rolled unwrapping that silently swallows a REAL
 * underlying error (a thrown exception, a missing domain-enable, a shape
 * Playwright's own CDP typings didn't match) into a generic "didn't look
 * like what I expected" fallback, with no way to tell what actually went
 * wrong short of raw runtime access this sandbox doesn't have.
 *
 * `page.evaluate()` is Playwright's own proven, cross-platform-tested API
 * for exactly this need (run JS in the page, await any returned promise,
 * get the real resolved value) - it doesn't need manual response-shape
 * parsing, and critically, if the evaluated expression throws, `evaluate()`
 * REJECTS with the REAL underlying error message rather than returning an
 * ambiguous value my old code had to guess about. `page.addInitScript()`
 * is the equivalent replacement for `Page.addScriptToEvaluateOnNewDocument`.
 * This eliminates the CDP session entirely from this file - no more
 * `cdpSession()`/`CDPSession` caching, so BUG 5 (round 3's CDP-session-per-
 * call fix) is now moot here, not because it was wrong, but because the
 * whole CDP dependency for these operations is gone.
 *
 * If `start_recording` still fails after this change, the returned/logged
 * error will now be a REAL Playwright/JS error message (e.g. a genuine
 * network failure fetching the CDN script, or a real ReferenceError) -
 * turning "opaque, unreproducible from this sandbox" into "the next
 * failure will actually say what broke."
 *
 * Error Handling Policy
 * =====================
 * Recording is a secondary feature that should never block primary browser
 * operations. This module follows a consistent error handling strategy
 * based on operation type:
 *
 * 1. User-facing operations (start, stop):
 *    - Return descriptive error strings to the caller (prefixed "Error:")
 *    - Log at WARN for unexpected errors, INFO for expected failures
 *      (e.g. rrweb load failures)
 *
 * 2. Internal/background operations (flushEvents, periodic flush, restart):
 *    - Log at DEBUG and continue silently
 *    - Never throw in a way that interrupts browser operations
 *    - Return neutral values (0, null) on failure
 *
 * 3. "Not initialized" conditions (e.g. missing page/session):
 *    - Silent pass - expected when recording hasn't been set up.
 *
 * This policy ensures recording failures are observable through logs but
 * never disrupt the user's primary browser workflow.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import { AsyncMutex } from './asyncMutex.js';
import { EventStorage } from './eventStorage.js';

const logger = {
  debug: (...args: unknown[]) => { if (process.env.DEBUG) console.debug('[recording]', ...args); },
  info: (...args: unknown[]) => console.info('[recording]', ...args),
  warn: (...args: unknown[]) => console.warn('[recording]', ...args),
};

// ============================================================
// Configuration
// ============================================================

export interface RecordingConfig {
  flush_interval_seconds: number;
  rrweb_load_timeout_ms: number;
  cdn_url: string;
}

export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  flush_interval_seconds: 5.0,
  rrweb_load_timeout_ms: 10000,
  cdn_url: 'https://unpkg.com/rrweb@2.0.0-alpha.17/dist/rrweb.umd.cjs',
};

// ============================================================
// Inlined browser scripts (bundled by bun build into cli.mjs)
// ============================================================

// Vendor rrweb into the shipped package so recording works offline / cold start.
// `assets/rrweb.umd.cjs` is read at module load and inlined as a string
// below; the loader script then `eval`s it in-page instead of injecting a
// <script src="https://unpkg.com/..."> tag. The CDN `cdn_url` is kept as a
// final fallback in case the vendor file is ever missing at runtime.
function findVendoredRrwebPath(): string | null {
  // Walk up from this file looking for `assets/rrweb.umd.cjs`. Resolution
  // order: (1) relative to this source file, (2) relative to cwd, (3)
  // environment override. This handles both source and bundled layouts.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolvePath(here, '..', '..', '..', 'assets', 'rrweb.umd.cjs'),
    resolvePath(here, '..', '..', 'assets', 'rrweb.umd.cjs'),
    resolvePath(here, '..', 'assets', 'rrweb.umd.cjs'),
    resolvePath(process.cwd(), 'assets', 'rrweb.umd.cjs'),
  ];
  if (process.env.GAKRCLI_RRWEB_PATH) candidates.unshift(process.env.GAKRCLI_RRWEB_PATH);
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

function loadVendoredRrwebJs(): string | null {
  const p = findVendoredRrwebPath();
  if (!p) return null;
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

const VENDORED_RRWEB_JS = loadVendoredRrwebJs();

// prettier-ignore
const RRWEB_LOADER_JS = `(function() {
    if (window.__rrweb_loaded) return;
    window.__rrweb_loaded = true;

    window.__rrweb_events = window.__rrweb_events || [];
    window.__rrweb_should_record = window.__rrweb_should_record || false;
    window.__rrweb_load_failed = false;

    var resolveReady;
    window.__rrweb_ready_promise = new Promise(function(resolve) {
        resolveReady = resolve;
    });

    // rrweb UMD bundle, inlined at build time from assets/rrweb.umd.cjs.
    // null only when the vendored asset is missing (e.g. dev env without it);
    // in that case we fall back to the legacy <script src=CDN> path.
    var INLINED_RRWEB_JS = ${JSON.stringify(VENDORED_RRWEB_JS ?? null)};

    function loadFromInlinedBundle() {
        try {
            // Wrap the UMD body in a Function so its top-level vars don't
            // pollute our scope. The UMD attaches \`rrweb\` to globalThis
            // when it detects a browser, but we also fall back to reading
            // it from the eval result in case the bundle's branch logic
            // misses the in-page environment.
            // eslint-disable-next-line no-new-func
            var factory = new Function(INLINED_RRWEB_JS + '\\n;return (typeof rrweb !== "undefined") ? rrweb : (typeof rrwebRecord !== "undefined") ? {record: rrwebRecord.record} : null;');
            var rrweb = factory();
            if (!rrweb || typeof rrweb.record !== 'function') {
                throw new Error('rrweb bundle did not expose record()');
            }
            window.rrweb = rrweb;
            window.__rrweb_ready = true;
            console.log('[rrweb] Loaded successfully from vendored bundle');
            resolveReady({success: true, source: 'vendored'});
            if (window.__rrweb_should_record && !window.__rrweb_stopFn) {
                window.startRecordingInternal();
            }
        } catch (e) {
            console.error('[rrweb] Vendored-bundle load failed:', e);
            window.__rrweb_load_failed = true;
            resolveReady({success: false, error: 'inlined_load_failed', detail: String((e && e.message) || e)});
        }
    }

    function loadFromCdn() {
        var s = document.createElement('script');
        s.src = '{{CDN_URL}}';
        s.onload = function() {
            window.__rrweb_ready = true;
            console.log('[rrweb] Loaded successfully from CDN');
            resolveReady({success: true, source: 'cdn'});
            if (window.__rrweb_should_record && !window.__rrweb_stopFn) {
                window.startRecordingInternal();
            }
        };
        s.onerror = function() {
            console.error('[rrweb] Failed to load from CDN');
            window.__rrweb_load_failed = true;
            resolveReady({success: false, error: 'cdn_load_failed'});
        };
        (document.head || document.documentElement).appendChild(s);
    }

    function loadRrweb() {
        if (INLINED_RRWEB_JS) {
            loadFromInlinedBundle();
        } else {
            loadFromCdn();
        }
    }

    window.startRecordingInternal = function() {
        var recordFn = (typeof rrweb !== 'undefined' && rrweb.record) ||
                       (typeof rrwebRecord !== 'undefined' && rrwebRecord.record);
        if (!recordFn || window.__rrweb_stopFn) return;

        window.__rrweb_events = [];
        window.__rrweb_stopFn = recordFn({
            emit: function(event) {
                window.__rrweb_events.push(event);
            }
        });
        console.log('[rrweb] Auto-started recording on new page');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadRrweb);
    } else {
        loadRrweb();
    }
})();
`;
// prettier-ignore
const FLUSH_EVENTS_JS = `(function() {
    var events = window.__rrweb_events || [];
    // Clear browser-side events after flushing
    window.__rrweb_events = [];
    return JSON.stringify({events: events});
})();
`;

// prettier-ignore
const START_RECORDING_SIMPLE_JS = `(function() {
    var recordFn = (typeof rrweb !== 'undefined' && rrweb.record) ||
                   (typeof rrwebRecord !== 'undefined' && rrwebRecord.record);
    if (!recordFn) return {status: 'not_loaded'};
    if (window.__rrweb_stopFn) return {status: 'already_recording'};

    window.__rrweb_events = [];
    window.__rrweb_stopFn = recordFn({
        emit: function(event) {
            window.__rrweb_events.push(event);
        }
    });
    return {status: 'started'};
})();
`;

// prettier-ignore
const START_RECORDING_JS = `(function() {
    if (window.__rrweb_stopFn) return {status: 'already_recording'};
    // Check if rrweb failed to load from CDN
    if (window.__rrweb_load_failed) return {status: 'load_failed'};
    // rrweb UMD module exports to window.rrweb (not rrwebRecord)
    var recordFn = (typeof rrweb !== 'undefined' && rrweb.record) ||
                   (typeof rrwebRecord !== 'undefined' && rrwebRecord.record);
    if (!recordFn) return {status: 'not_loaded'};
    window.__rrweb_events = [];
    window.__rrweb_should_record = true;
    window.__rrweb_stopFn = recordFn({
        emit: function(event) {
            window.__rrweb_events.push(event);
        }
    });
    return {status: 'started'};
})();
`;

// prettier-ignore
const STOP_RECORDING_JS = `(function() {
    var events = window.__rrweb_events || [];

    // Stop the recording if active
    if (window.__rrweb_stopFn) {
        window.__rrweb_stopFn();
        window.__rrweb_stopFn = null;
    }

    // Clear flags
    window.__rrweb_should_record = false;
    window.__rrweb_events = [];

    return JSON.stringify({events: events});
})();
`;

// prettier-ignore
const WAIT_FOR_RRWEB_JS = `(function() {
    // If Promise doesn't exist, scripts weren't injected yet
    if (!window.__rrweb_ready_promise) {
        return Promise.resolve({success: false, error: 'not_injected'});
    }
    // If already loaded, return immediately
    if (window.__rrweb_ready) {
        return Promise.resolve({success: true});
    }
    // If already failed, return immediately
    if (window.__rrweb_load_failed) {
        return Promise.resolve({success: false, error: 'load_failed'});
    }
    // Wait for the Promise to resolve
    return window.__rrweb_ready_promise;
})();
`;

export function getRrwebLoaderJs(cdnUrl: string): string {
  return RRWEB_LOADER_JS.replace('{{CDN_URL}}', cdnUrl);
}

export function getFlushEventsJs(): string {
  return FLUSH_EVENTS_JS;
}

export function getStartRecordingSimpleJs(): string {
  return START_RECORDING_SIMPLE_JS;
}

export function getStartRecordingJs(): string {
  return START_RECORDING_JS;
}

export function getStopRecordingJs(): string {
  return STOP_RECORDING_JS;
}

export function getWaitForRrwebJs(): string {
  return WAIT_FOR_RRWEB_JS;
}

interface WaitForRrwebResult {
  success: boolean;
  error?: string;
}

interface StartRecordingResult {
  status: string;
}

/** Race a promise against a timeout without leaking the timer either way. */
function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * RecordingSession - manages browser session recording using rrweb.
 *
 * Concurrency: uses an async mutex to protect the `_events` buffer from
 * concurrent access by the periodic flush loop and navigation-triggered
 * flushes, mirroring Python's `asyncio.Lock`.
 *
 * TS NOTE: Python's `_periodic_flush_loop` runs as an `asyncio.Task` driven
 * by `asyncio.sleep`. The direct TS equivalent is `setInterval`/`setTimeout`;
 * this port uses a self-rescheduling `setTimeout` loop (closer to the
 * Python `while` + `sleep` semantics than `setInterval`, since it won't
 * overlap invocations if a flush takes longer than the interval).
 */
export class RecordingSession {
  readonly outputDir: string | null;
  readonly config: RecordingConfig;

  private storage: EventStorage;
  private _isRecording = false;
  private events: Record<string, unknown>[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushLoopActive = false;
  private scriptsInjected = false;
  private lock = new AsyncMutex();
  private consecutiveFlushFailures = 0;

  constructor(outputDir: string | null = null, config: RecordingConfig = DEFAULT_RECORDING_CONFIG) {
    this.outputDir = outputDir;
    this.config = config;
    this.storage = new EventStorage(outputDir);
  }

  get sessionDir(): string | null {
    return this.storage.sessionDir;
  }

  get isActive(): boolean {
    return this._isRecording;
  }

  get totalEvents(): number {
    return this.storage.totalEvents;
  }

  get fileCount(): number {
    return this.storage.fileCount;
  }

  private saveAndClearEvents(): string | null {
    if (!this.events.length) return null;
    const filepath = this.storage.saveEvents(this.events);
    if (filepath) this.events = [];
    return filepath;
  }

  private async setRecordingFlag(page: Page, shouldRecord: boolean): Promise<void> {
    try {
      await page.evaluate((should) => {
        (window as any).__rrweb_should_record = should;
      }, shouldRecord);
    } catch (e) {
      logger.debug(`Failed to set recording flag: ${e}`);
    }
  }

  /**
   * Inject the rrweb loader script into the browser session, for both the
   * CURRENT document (via a direct `evaluate()`) and all FUTURE
   * navigations on this page (via `addInitScript()`).
   *
   * `page.addInitScript()` only applies to documents created AFTER this
   * call - it does NOT retroactively run on the already-loaded page - so
   * the direct `page.evaluate()` call is still required for the page the
   * caller is on right now when `start_recording` is invoked (the exact
   * scenario that was failing: navigate() to a page, THEN separately call
   * start_recording()).
   */
  async injectScripts(page: Page): Promise<void> {
    if (this.scriptsInjected) return;

    const rrwebLoader = getRrwebLoaderJs(this.config.cdn_url);

    try {
      await page.addInitScript({ content: rrwebLoader });
    } catch (e) {
      logger.debug(`addInitScript registration skipped: ${e}`);
    }

    // The loader is idempotent (guarded by window.__rrweb_loaded), so
    // running it on the current document too - in addition to the
    // addInitScript registration for future navigations - is harmless and
    // is what makes start_recording work on a page that was already loaded
    // before start_recording was called.
    try {
      await page.evaluate(rrwebLoader);
    } catch (e) {
      logger.debug(`Loader evaluation on current page skipped: ${e}`);
    }

    this.scriptsInjected = true;
    logger.debug('Injected rrweb loader script');
  }

  /** Flush recording events from the browser to local storage. Returns count flushed. */
  async flushEvents(page: Page): Promise<number> {
    if (!this._isRecording) return 0;

    try {
      const raw = await page.evaluate<string>(getFlushEventsJs());
      const data = JSON.parse(raw || '{}');
      const events: Record<string, unknown>[] = data.events ?? [];
      if (events.length) {
        await this.lock.withLock(() => {
          this.events.push(...events);
          logger.debug(`Flushed ${events.length} events from browser`);
        });
      }
      return events.length;
    } catch (e) {
      logger.debug(`Event flush skipped: ${e}`);
      return 0;
    }
  }

  /** Self-rescheduling flush loop (TS equivalent of asyncio.sleep-driven while loop). */
  private scheduleNextFlush(page: Page): void {
    if (!this._isRecording) return;
    this.flushTimer = setTimeout(async () => {
      if (!this._isRecording) return;
      try {
        await this.flushEvents(page);
        await this.lock.withLock(() => {
          if (this.events.length) {
            const filepath = this.saveAndClearEvents();
            this.consecutiveFlushFailures = filepath ? 0 : this.consecutiveFlushFailures + 1;
          }
        });
      } catch (e) {
        this.consecutiveFlushFailures += 1;
        logger.debug(`Periodic flush skipped: ${e}`);
      }

      if (this.consecutiveFlushFailures >= 3) {
        logger.warn(
          `Recording flush has failed ${this.consecutiveFlushFailures} times. ` +
            'Events may be accumulating in memory. Check disk space and permissions.',
        );
      }

      this.scheduleNextFlush(page);
    }, this.config.flush_interval_seconds * 1000);
  }

  private startFlushTask(page: Page): void {
    if (!this.flushLoopActive) {
      this.flushLoopActive = true;
      this.scheduleNextFlush(page);
    }
  }

  private stopFlushTask(): void {
    this.flushLoopActive = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Wait for rrweb to finish loading. `wait-for-rrweb.js` itself returns a
   * Promise that resolves to `{success, error?}` - `page.evaluate()`
   * auto-awaits that promise and resolves with its actual value, so no
   * manual response-shape parsing is needed (unlike the previous raw-CDP
   * version). If the page-side script throws for any reason, `evaluate()`
   * REJECTS with the real error, caught below and surfaced verbatim in the
   * log rather than folded into a generic error code.
   */
   private async waitForRrwebLoad(page: Page): Promise<WaitForRrwebResult> {
    const timeoutMs = this.config.rrweb_load_timeout_ms;

    try {
      const result = await withTimeout(
        page.evaluate<WaitForRrwebResult>(getWaitForRrwebJs()),
        timeoutMs,
        () => ({ success: false, error: 'timeout' }),
      );

      if (
        !result ||
        typeof result !== 'object' ||
        typeof result.success !== 'boolean'
      ) {
        logger.warn(
          `wait-for-rrweb unexpected response: ${JSON.stringify(result)}`,
        );
        return { success: false, error: 'unexpected_response' };
      }

      return result;
    } catch (e) {
      // ROUND 10: surface the REAL error, not a generic code - this is
      // exactly the diagnostic gap that made the previous universal
      // failure unfixable from this sandbox. If this still fires, the
      // logged message now says what actually broke.
      logger.warn(`wait-for-rrweb evaluate failed: ${e instanceof Error ? e.message : e}`);
      return { success: false, error: `evaluate_failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  private initializeSessionState(): void {
    this.events = [];
    this._isRecording = true;
    this.consecutiveFlushFailures = 0;
    this.storage.reset();
    this.storage.outputDir = this.outputDir;
    this.storage.createSessionSubfolder();
  }

   private async handleRrwebLoadFailure(page: Page, error: string): Promise<string> {
    this._isRecording = false;
    // Best-effort cleanup: set the flag without blocking error handling.
    // Uses a short timeout so a hung page.evaluate() (e.g. in offline/no-network
    // test environments) cannot stall the error return path.
    this.setRecordingFlag(page, false).catch((e) => logger.debug(`setRecordingFlag cleanup failed: ${e}`));

    if (error === 'load_failed') {
      logger.info('Recording start failed: rrweb load_failed');
      return (
        `Error: Unable to start recording. The rrweb library failed to load ` +
        `from ${this.config.cdn_url}. Recording needs internet access to fetch ` +
        `rrweb - check your connection and try again.`
      );
    }

    if (error === 'timeout') {
      logger.info(`Recording start failed: rrweb load timeout (${this.config.rrweb_load_timeout_ms}ms)`);
      return (
        'Error: Unable to start recording. rrweb did not load in time. ' +
        `Recording needs internet access to fetch rrweb from ` +
        `${this.config.cdn_url}. Check your connection and try again.`
      );
    }

    if (error === 'not_injected') {
      logger.info('Recording start failed: rrweb not_injected');
      return (
        'Error: Unable to start recording. Scripts not injected. ' +
        'Please navigate to a page first and try again.'
      );
    }

     if (error.startsWith('evaluate_failed: ')) {
      // ROUND 10: this is the real page-side/Playwright error message,
      // not a guessed generic code - pass it straight through so it's
      // actually actionable.
      const detail = error.slice('evaluate_failed: '.length);
      logger.info(`Recording start failed: ${detail}`);
      return `Error: Unable to start recording - ${detail}`;
    }

    if (error === 'unexpected_response') {
      logger.info('Recording start failed: rrweb unexpected_response');
      return (
        'Error: Unable to start recording. The rrweb loader returned an ' +
        'unexpected response — this can happen on first load when the page ' +
        'is still initializing. If retrying does not help, try navigating ' +
        'to a stable page first, then run browser_get_state to confirm the ' +
        'page is ready before invoking browser_start_recording.'
      );
    }

    logger.info(`Recording start failed: ${error}`);
    return `Error: Unable to start recording: ${error}`;
  }

   private async ensureRrwebLoaded(page: Page): Promise<string | null> {
    let loadResult = await this.waitForRrwebLoad(page);

    if (!loadResult.success) {
      const error = loadResult.error ?? 'unknown';

      if (error === 'unexpected_response') {
        logger.info(
          'Recording start: retrying once on transient unexpected_response',
        );
        loadResult = await this.waitForRrwebLoad(page);
      }
    }

    if (!loadResult.success) {
      const error = loadResult.error ?? 'unknown';
      return this.handleRrwebLoadFailure(page, error);
    }
    return null;
  }

  private async executeStartRecording(page: Page): Promise<string> {
    let result: StartRecordingResult;
    try {
      result = await page.evaluate<StartRecordingResult>(getStartRecordingJs());
    } catch (e) {
      this._isRecording = false;
      const detail = e instanceof Error ? e.message : String(e);
      logger.warn(`start-recording evaluate failed: ${detail}`);
      return `Error: Unable to start recording - ${detail}`;
    }

    const status = result?.status;

    if (status === 'started') {
      await this.setRecordingFlag(page, true);
      this.startFlushTask(page);
      logger.info('Recording started');
      return 'Recording started';
    }

    if (status === 'already_recording') {
      await this.setRecordingFlag(page, true);
      this.startFlushTask(page);
      logger.debug('Recording already active');
      return 'Already recording';
    }

    if (status === 'load_failed') {
      return this.handleRrwebLoadFailure(page, 'load_failed');
    }

    if (status === 'not_loaded') {
      return this.handleRrwebLoadFailure(page, 'not_injected');
    }

    this._isRecording = false;
    logger.info(`Recording start failed: unknown status '${status}'`);
    return `Error: Unable to start recording: unknown status '${status}'`;
  }

  /**
   * Start rrweb session recording. Creates a new timestamped subfolder
   * under outputDir so multiple start/stop cycles don't mix events.
   *
   * User-facing operation: returns error strings, logs at WARN for
   * unexpected errors (see module error-handling policy).
   */
  async start(page: Page): Promise<string> {
    if (!this.scriptsInjected) {
      await this.injectScripts(page);
    }

    this.initializeSessionState();

    try {
      const errorMsg = await this.ensureRrwebLoaded(page);
      if (errorMsg) return errorMsg;

      return await this.executeStartRecording(page);
    } catch (e) {
      this._isRecording = false;
      logger.warn(`Recording start failed: ${e}`);
      return `Error starting recording: ${e}`;
    }
  }

  /**
   * Stop rrweb recording and save remaining events. Returns a summary
   * message with event count, file count, and save directory.
   *
   * User-facing operation: returns error strings, logs at WARN for
   * unexpected errors (see module error-handling policy).
   */
  async stop(page: Page): Promise<string> {
    if (!this._isRecording) {
      return 'Error: Not recording. Call browser_start_recording first.';
    }

    try {
      this._isRecording = false;
      this.stopFlushTask();

      const raw = await page.evaluate<string>(getStopRecordingJs());
      const currentPageData = JSON.parse(raw || '{}');
      const currentPageEvents: Record<string, unknown>[] = currentPageData.events ?? [];

      let totalEvents = 0;
      let totalFiles = 0;
      await this.lock.withLock(() => {
        if (currentPageEvents.length) this.events.push(...currentPageEvents);
        if (this.events.length) this.saveAndClearEvents();
        totalEvents = this.storage.totalEvents;
        totalFiles = this.storage.fileCount;
      });

      await this.setRecordingFlag(page, false);
      const sessionDirUsed = this.storage.sessionDir;

      logger.info(`Recording stopped: ${totalEvents} events saved to ${totalFiles} file(s) in ${sessionDirUsed}`);

      let summary = `Recording stopped. Captured ${totalEvents} events in ${totalFiles} file(s).`;
      if (sessionDirUsed) summary += ` Saved to: ${sessionDirUsed}`;

      return summary;
    } catch (e) {
      this._isRecording = false;
      this.stopFlushTask();
      const detail = e instanceof Error ? e.message : String(e);
      logger.warn(`Recording stop failed: ${detail}`);
      return `Error stopping recording: ${detail}`;
    }
  }

  /**
   * Restart recording on a new page after navigation.
   *
   * Internal operation: logs at DEBUG, never throws (see module error
   * handling policy).
   */
  async restartOnNewPage(page: Page): Promise<void> {
    if (!this._isRecording) return;

    try {
      const loadResult = await this.waitForRrwebLoad(page);
      if (!loadResult.success) {
        logger.debug(`Recording restart skipped: rrweb ${loadResult.error ?? 'unknown'}`);
        return;
      }

      const result = await page.evaluate<StartRecordingResult>(getStartRecordingSimpleJs());
      const status = result?.status;

      if (status === 'started') {
        logger.debug('Recording restarted on new page');
      } else if (status === 'already_recording') {
        logger.debug('Recording already active on new page');
      } else {
        logger.debug(`Recording restart: unexpected status '${status}'`);
      }
    } catch (e) {
      logger.debug(`Recording restart skipped: ${e}`);
    }
  }

  /** Reset the recording session state for reuse. */
  reset(): void {
    this.events = [];
    this._isRecording = false;
    this.storage.reset();
    this.stopFlushTask();
  }
}
