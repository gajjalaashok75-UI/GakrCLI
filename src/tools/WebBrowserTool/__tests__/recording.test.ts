import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test';
import { RecordingSession, DEFAULT_RECORDING_CONFIG, getRrwebLoaderJs } from '../recording';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EvalResult = string | { status?: string; success?: boolean; error?: string; events?: unknown[] };

interface FakePage {
  _calls: { kind: string; result?: EvalResult }[];
  _evalIndex: number;
  evaluate: ReturnType<typeof makeEvaluate>;
  addInitScript: ReturnType<typeof makeAddInitScript>;
  url: () => string;
}

/** Build a fake Playwright Page whose evaluate() yields results in order. */
function makePage(results: EvalResult[]): FakePage {
  const calls: { kind: string; result?: EvalResult }[] = [];
  let index = 0;

  const evaluate = async (_fnOrString: Function | string) => {
    const result = results[Math.min(index, results.length - 1)];
    calls.push({ kind: 'evaluate', result });
    index++;
    return result;
  };

  const addInitScript = async () => {
    calls.push({ kind: 'addInitScript' });
  };

  return { _calls: calls, _evalIndex: 0, evaluate, addInitScript, url: () => 'http://test.local' };
}

const DEFAULT_RESULTS: EvalResult[] = [
  // 0: rrweb-loader evaluate (idempotent, returns undefined in real browser)
  undefined,
  // 1: wait-for-rrweb — resolves { success: true }
  { success: true },
  // 2: start-recording IIFE — returns { status: 'started' }
  { status: 'started' },
  // 3+: flush-events / stop-recording return `JSON.stringify(...)` which
  //     Playwright auto-deserialises; we model that as plain objects/strings.
  { events: [] },      // flush
  { events: [] },      // stop (flush before stop)
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecordingSession unit tests', () => {
  let page: FakePage;

  const freshPage = () => makePage([...DEFAULT_RESULTS]);

  beforeEach(() => {
    mock.restore();
  });

  // ---- 1. start() → stop() happy path -------------------------------------

  it('start() then stop() records and reports 0 events when none captured', async () => {
    page = freshPage();
    const session = new RecordingSession('/tmp/out', DEFAULT_RECORDING_CONFIG);

    const startMsg = await session.start(page as any);
    expect(startMsg).toBe('Recording started');
    expect(session.isActive).toBe(true);

    const stopMsg = await session.stop(page as any);
    expect(stopMsg).toContain('0');
    expect(stopMsg).toContain('event');
    expect(session.isActive).toBe(false);
  });

  // ---- 2. stop() without start() is a no-op -------------------------------

  it('stop() before start() returns an error message and does not throw', async () => {
    page = freshPage();
    const session = new RecordingSession('/tmp/out', DEFAULT_RECORDING_CONFIG);

    await expect(session.stop(page as any)).rejects.toThrow();
  });

  // ---- 3. double start() is idempotent ------------------------------------

  it('start() called twice returns Already recording and does not break state', async () => {
    page = freshPage();
    // Second call catches the already_recording fast-path where
    // start_recording.js returns { status: 'already_recording' }
    const results = [
      undefined,
      { success: true },
      { status: 'started' },
      { status: 'already_recording' }, // second start-recording eval
    ];
    const page2 = makePage(results);
    const session = new RecordingSession('/tmp/out', DEFAULT_RECORDING_CONFIG);

    const m1 = await session.start(page2 as any);
    expect(m1).toBe('Recording started');

    const m2 = await session.start(page2 as any);
    expect(m2).toBe('Already recording');
    expect(session.isActive).toBe(true);

    await session.stop(page2 as any);
  });

  // ---- 4. events are captured from browser --------------------------------

  it('stop() reports the correct number of events captured from the browser', async () => {
    const fakeEvents = [{ type: 2 }, { type: 3 }, { type: 4 }];
    const results: EvalResult[] = [
      undefined,
      { success: true },
      { status: 'started' },
      { events: fakeEvents.slice(0, 2) }, // first flush
      { events: fakeEvents.slice(2) },     // stop returns last batch
    ];
    const p = makePage(results);
    const session = new RecordingSession('/tmp/out', DEFAULT_RECORDING_CONFIG);

    await session.start(p as any);
    const stopMsg = await session.stop(p as any);
    expect(stopMsg).toContain('3');
    expect(stopMsg).toContain('event');
  });

  // ---- 5. rrweb load failure surfaces a descriptive error ----------------

  it('start() returns an error when rrweb fails to load', async () => {
    const results: EvalResult[] = [
      undefined,
      { success: false, error: 'load_failed' },
    ];
    const p = makePage(results);
    const session = new RecordingSession('/tmp/out', DEFAULT_RECORDING_CONFIG);

    const msg = await session.start(p as any);
    expect(msg).toContain('Error');
    expect(msg).toContain('rrweb');
    expect(session.isActive).toBe(false);
  });

  // ---- 6. timeout surfaces a descriptive error ----------------------------

  it('start() returns an error when rrweb load times out', async () => {
    const results: EvalResult[] = [
      undefined,
      { success: false, error: 'timeout' },
    ];
    const p = makePage(results);
    const session = new RecordingSession('/tmp/out', DEFAULT_RECORDING_CONFIG);

    const msg = await session.start(p as any);
    expect(msg).toContain('Error');
    expect(msg).toContain('timed out');
    expect(session.isActive).toBe(false);
  });

  // ---- 7. evaluate throwing propagates as an error -----------------------

  it('start() handles a thrown error from page.evaluate gracefully', async () => {
    const throwingPage = {
      evaluate: async () => { throw new Error('browser_disconnected'); },
      addInitScript: async () => {},
      url: () => 'http://test.local',
    };
    const session = new RecordingSession('/tmp/out', DEFAULT_RECORDING_CONFIG);

    const msg = await session.start(throwingPage as any);
    expect(msg).toContain('Error');
    expect(msg).toContain('browser_disconnected');
    expect(session.isActive).toBe(false);
  });

  // ---- 8. events are saved to disk ----------------------------------------

  it('stop() writes events to disk and reports the session directory', async () => {
    const outDir = '/tmp/recording-out';
    const fakeEvents = [{ type: 5, data: { href: '/page2' } }];
    const results: EvalResult[] = [
      undefined,
      { success: true },
      { status: 'started' },
      { events: fakeEvents },
    ];
    const p = makePage(results);
    const session = new RecordingSession(outDir, DEFAULT_RECORDING_CONFIG);

    await session.start(p as any);
    const msg = await session.stop(p as any);

    expect(msg).toContain('1 event');
    // sessionDir is populated after createSessionSubfolder()
    expect(session.sessionDir).not.toBeNull();
    expect(session.sessionDir).toContain(outDir);
  });

  // ---- 9. DEFAULT_RECORDING_CONFIG values --------------------------------

  it('DEFAULT_RECORDING_CONFIG is correctly exported', () => {
    expect(DEFAULT_RECORDING_CONFIG.flush_interval_seconds).toBe(5.0);
    expect(DEFAULT_RECORDING_CONFIG.rrweb_load_timeout_ms).toBe(10000);
    expect(DEFAULT_RECORDING_CONFIG.cdn_url).toContain('rrweb');
  });

  // ---- 10. getRrwebLoaderJs substitutes the CDN URL ----------------------

  it('getRrwebLoaderJs substitutes {{CDN_URL}} with the configured URL', () => {
    const js = getRrwebLoaderJs('https://custom.cdn/rrweb.js');
    expect(js).toContain('https://custom.cdn/rrweb.js');
    expect(js).not.toContain('{{CDN_URL}}');
  });
});