/**
 * Browser Module — Phase 5 Performance Benchmark (defensive path timing)
 *
 * Mock-based percentile timing for the same defensive code paths stress-tested
 * in Phase 2.  Live-browser timing (real navigate/screenshot/PDF/search_google
 * against a Chromium) is documented in
 * docs/browser-hardening/PRODUCTION-HARDENING.md as ENVIRONMENT_DEFERRED —
 * the bun+Windows WebSocket transport issue that blocks the stress-test
 * harness also blocks timing real browser round-trips from a fresh
 * `bun test` subprocess.  The prior V2 30-action sweep (recorded in the
 * Phase 1 audit) ran inside the agent's Node.js process and so used a
 * different transport lifecycle.
 *
 *   bun test src/tools/WebBrowserTool/__tests__/perf.benchmark.test.ts
 */
import { describe, it, expect, mock } from 'bun:test';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface TimingRow {
  action: string;
  iterations: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  totalMs: number;
}

const RESULTS: TimingRow[] = [];

function summarize(action: string, samples: number[], totalMs: number): TimingRow {
  const sorted = [...samples].sort((a, b) => a - b);
  const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
  return {
    action,
    iterations: samples.length,
    p50Ms: Number((p(0.5) ?? 0).toFixed(3)),
    p95Ms: Number((p(0.95) ?? 0).toFixed(3)),
    maxMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(3)),
    totalMs: Math.round(totalMs),
  };
}

async function makeServerWithFakeCdp(opts: {
  cdpSend?: (...a: unknown[]) => Promise<unknown>;
  addCookies?: (...a: unknown[]) => Promise<void>;
  evaluateReturn?: unknown;
} = {}) {
  const cdpSend = mock(opts.cdpSend ?? (async () => undefined));
  const newCDPSession = mock(async () => ({ send: cdpSend }));
  const addCookies = mock(opts.addCookies ?? (async () => undefined));
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const fakePage = {
    context: () => ({
      pages: () => [fakePage],
      addCookies,
      newCDPSession,
    }),
    url: () => 'about:blank',
    isClosed: () => false,
    goto: async () => undefined,
    click: async () => undefined,
    fill: async () => undefined,
    screenshot: async () => Buffer.from(tinyPng, 'base64'),
    pdf: async () => Buffer.from('%PDF-1.4\n%mock\n'),
    evaluate: async () => opts.evaluateReturn ?? { ok: true, value: null },
    waitForEvent: async () => ({
      element: () => ({ evaluate: async () => 'input' }),
    }),
    close: async () => undefined,
  };
  const { BrowserServer } = await import('../browserServer.js');
  const server = new BrowserServer();
  (server as any).page = fakePage;
  (server as any).context = fakePage.context();
  (server as any).browser = { close: async () => undefined };
  return { server, addCookies, cdpSend, fakePage };
}

describe('Browser Module — Performance Benchmark (defensive path timing)', () => {
  it('navigate: 200 mock round-trips', async () => {
    const { server } = await makeServerWithFakeCdp();
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      const t = performance.now();
      const r = await server.navigate(`https://example.com/p${i}`, false);
      samples.push(performance.now() - t);
      expect(typeof r).toBe('string');
    }
    RESULTS.push(summarize('navigate (mock page.goto)', samples, performance.now() - t0));
  });

  it('click: 200 mock element clicks (by index)', async () => {
    const { server } = await makeServerWithFakeCdp();
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      const t = performance.now();
      const r = await server.click(1, undefined);
      samples.push(performance.now() - t);
      expect(typeof r).toBe('string');
    }
    RESULTS.push(summarize('click (mock page.click)', samples, performance.now() - t0));
  });

  it('type: 200 mock DOM-resolution cycles (covered by getBrowserState — same selector path)', async () => {
    const { server } = await makeServerWithFakeCdp();
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      const t = performance.now();
      // `type` is composed inside WebBrowserTool.ts (selector resolution +
      // live-state refresh + page.fill). The closest perf signal is
      // getBrowserState, which exercises the same DOM-resolution hot path.
      const r = await server.getBrowserState(false);
      samples.push(performance.now() - t);
      expect(typeof r).toBe('string');
    }
    RESULTS.push(summarize('type (proxy: getBrowserState selector path)', samples, performance.now() - t0));
  });

  it('screenshot: 200 mock PNG returns (covered by saveAsPdf — same encode path)', async () => {
    const { server } = await makeServerWithFakeCdp();
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      const t = performance.now();
      // `screenshot` is composed inside WebBrowserTool.ts from
      // page.screenshot + base64 encode + ImageData dispatch. The closest
      // perf signal is saveAsPdf, which shares the encode+return path.
      const r = await server.saveAsPdf(undefined);
      samples.push(performance.now() - t);
      expect(typeof r).toBe('string');
    }
    RESULTS.push(summarize('screenshot (proxy: saveAsPdf encode path)', samples, performance.now() - t0));
  });

  it('save_as_pdf: 100 mock PDF returns (heavier payload)', async () => {
    const { server } = await makeServerWithFakeCdp();
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      const t = performance.now();
      const r = await server.saveAsPdf(undefined);
      samples.push(performance.now() - t);
      expect(typeof r).toBe('string');
    }
    RESULTS.push(summarize('save_as_pdf (mock page.pdf → base64)', samples, performance.now() - t0));
  });

  it('search_google: 100 mock navigates (Google search has higher latency in real browser)', async () => {
    const { server } = await makeServerWithFakeCdp();
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      const t = performance.now();
      const r = await server.searchGoogle(`gakrcli benchmark ${i}`);
      samples.push(performance.now() - t);
      expect(typeof r).toBe('string');
    }
    RESULTS.push(summarize('search_google (mock navigate)', samples, performance.now() - t0));
  });

  it('evaluate: 200 mock JS evaluations (small result)', async () => {
    const { server } = await makeServerWithFakeCdp({ evaluateReturn: { ok: true, value: 42 } });
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      const t = performance.now();
      const r = await server.evaluate('1+1');
      samples.push(performance.now() - t);
      expect(typeof r).toBe('string');
    }
    RESULTS.push(summarize('evaluate (mock page.evaluate, small result)', samples, performance.now() - t0));
  });

  it('recording: 50 start/stop cycles (graceful error path)', async () => {
    const { server } = await makeServerWithFakeCdp();
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      const t = performance.now();
      const startR = await server.startRecording();
      await server.stopRecording();
      samples.push(performance.now() - t);
      expect(typeof startR).toBe('string');
    }
    RESULTS.push(summarize('start/stop recording (mock page, graceful)', samples, performance.now() - t0));
  });

  it('uploadFile: 100 happy-path uploads (with real tmp file)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-upload-'));
    const realFile = path.join(tmp, 'real.txt');
    fs.writeFileSync(realFile, 'hello world');
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      const { server } = await makeServerWithFakeCdp();
      const t = performance.now();
      const r = await server.uploadFile(0, realFile);
      samples.push(performance.now() - t);
      expect(typeof r).toBe('string');
    }
    RESULTS.push(summarize('uploadFile (mock, real file present)', samples, performance.now() - t0));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('summary', () => {
    console.log('\n\n========= PHASE 5 PERF SUMMARY =========\n');
    console.log('Action                                  | Iter  | p50(ms) | p95(ms) | max(ms) | total(ms)');
    console.log('----------------------------------------|-------|---------|---------|---------|----------');
    for (const r of RESULTS) {
      const name = r.action.padEnd(40);
      const it = String(r.iterations).padStart(5);
      const p50 = r.p50Ms.toFixed(3).padStart(7);
      const p95 = r.p95Ms.toFixed(3).padStart(7);
      const mx = r.maxMs.toFixed(3).padStart(7);
      const tot = String(r.totalMs).padStart(8);
      console.log(`${name} | ${it} | ${p50} | ${p95} | ${mx} | ${tot}`);
    }
    console.log('\n=========================================\n');
    expect(RESULTS.length).toBeGreaterThan(0);
  });
});
