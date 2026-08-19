/**
 * Tests for the browser-side script files in `js/` (now TypeScript `.ts`
 * sources) and the inlined equivalents bundled into `recording.ts`.
 *
 * These files are not normal ES modules: each is a self-contained IIFE that
 * Playwright injects into the page via `page.evaluate()` /
 * `page.addInitScript()`. The single CDN-templated file (`rrweb-loader.ts`)
 * is loaded at runtime by name; the other five are inlined verbatim into
 * `recording.ts` at build time so they are available inside the bundled
 * `cli.mjs` without any disk reads at runtime.
 *
 * Invariants verified here:
 *
 *   1. Every `.ts` script file under `js/` exists and is non-empty.
 *   2. Each file's body is syntactically valid JavaScript (the browser only
 *      ever runs the raw text, and TypeScript is a superset of JS, so a
 *      valid JS IIFE is a valid `.ts` file with no extra type syntax).
 *   3. The exported `getRrwebLoaderJs(cdnUrl)` builder substitutes
 *      `{{CDN_URL}}` and otherwise returns the `rrweb-loader.ts` body
 *      byte-for-byte.
 *   4. The corresponding inlined constants/callers in `recording.ts` each
 *      return the same literal text as their source file, guaranteeing the
 *      bundled output carries identical script bodies.
 *
 * Written with `vitest`.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getRrwebLoaderJs,
  getFlushEventsJs,
  getStartRecordingSimpleJs,
  getStartRecordingJs,
  getStopRecordingJs,
  getWaitForRrwebJs,
  DEFAULT_RECORDING_CONFIG,
} from '../recording.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(MODULE_DIR, '..');
const JS_DIR = path.join(PROJECT_DIR, 'js');
const RECORDING_SRC = fs.readFileSync(path.join(PROJECT_DIR, 'recording.ts'), 'utf-8');

/** The six script files recording.ts is expected to load, with stable base names. */
const EXPECTED_SCRIPTS = [
  'flush-events',
  'rrweb-loader',
  'start-recording-simple',
  'start-recording',
  'stop-recording',
  'wait-for-rrweb',
] as const;

/** Collect every `loadJsFile('xxx')` reference from recording.ts source. */
function referencedLoadJsFiles(): string[] {
  const matches = [...RECORDING_SRC.matchAll(/loadJsFile\(['"]([^'"]+)['"]\)/g)];
  return matches.map((m) => m[1]).sort();
}

/** Safely check that a string is a runnable JS program by compiling it. */
function isSyntacticallyValidJs(source: string): boolean {
  try {
    // eslint-disable-next-line no-new-func
    new Function(source);
    return true;
  } catch {
    return false;
  }
}

describe('js/ script files — existence & content', () => {
  for (const base of EXPECTED_SCRIPTS) {
    const file = `${base}.ts`;
    it(`exists and is non-empty: ${file}`, () => {
      const full = path.join(JS_DIR, file);
      expect(fs.existsSync(full)).toBe(true);
      const content = fs.readFileSync(full, 'utf-8');
      expect(content.trim().length).toBeGreaterThan(0);
    });

    it(`is syntactically valid JS (browser-runnable): ${file}`, () => {
      const content = fs.readFileSync(path.join(JS_DIR, file), 'utf-8');
      expect(isSyntacticallyValidJs(content)).toBe(true);
    });

    it(`is wrapped in an IIFE (self-contained browser script): ${file}`, () => {
      const content = fs.readFileSync(path.join(JS_DIR, file), 'utf-8').trim();
      expect(content.startsWith('(function')).toBe(true);
      expect(content.endsWith(')();')).toBe(true);
    });
  }
});

describe('js/ directory — script inventory', () => {
  it('no .js copies remain in js/ (conversion to .ts is complete)', () => {
    const entries = fs.readdirSync(JS_DIR);
    const jsFiles = entries.filter((f) => f.endsWith('.js'));
    expect(jsFiles).toEqual([]);
  });

  it('the js/ directory contains exactly the six converted .ts scripts', () => {
    const tsFiles = fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.ts')).sort();
    const expected = EXPECTED_SCRIPTS.map((b) => `${b}.ts`).sort();
    expect(tsFiles).toEqual(expected);
  });
});

describe('recording.ts — inlined script constants match source files byte-for-byte', () => {
  it('inline rrweb-loader matches rrweb-loader.ts (CDN placeholder substituted)', () => {
    const original = fs.readFileSync(path.join(JS_DIR, 'rrweb-loader.ts'), 'utf-8');
    const cdn = DEFAULT_RECORDING_CONFIG.cdn_url;
    expect(getRrwebLoaderJs(cdn)).toBe(original.replace('{{CDN_URL}}', cdn));
  });

  it('inline flush-events matches flush-events.ts', () => {
    const original = fs.readFileSync(path.join(JS_DIR, 'flush-events.ts'), 'utf-8');
    expect(getFlushEventsJs()).toBe(original);
  });

  it('inline start-recording-simple matches start-recording-simple.ts', () => {
    const original = fs.readFileSync(path.join(JS_DIR, 'start-recording-simple.ts'), 'utf-8');
    expect(getStartRecordingSimpleJs()).toBe(original);
  });

  it('inline start-recording matches start-recording.ts', () => {
    const original = fs.readFileSync(path.join(JS_DIR, 'start-recording.ts'), 'utf-8');
    expect(getStartRecordingJs()).toBe(original);
  });

  it('inline stop-recording matches stop-recording.ts', () => {
    const original = fs.readFileSync(path.join(JS_DIR, 'stop-recording.ts'), 'utf-8');
    expect(getStopRecordingJs()).toBe(original);
  });

  it('inline wait-for-rrweb matches wait-for-rrweb.ts', () => {
    const original = fs.readFileSync(path.join(JS_DIR, 'wait-for-rrweb.ts'), 'utf-8');
    expect(getWaitForRrwebJs()).toBe(original);
  });
});

describe('getRrwebLoaderJs — CDN template wiring (the only exported builder)', () => {
  it('substitutes {{CDN_URL}} with the configured CDN URL', () => {
    const cdn = DEFAULT_RECORDING_CONFIG.cdn_url;
    const out = getRrwebLoaderJs(cdn);
    expect(out).toContain(cdn);
    expect(out).not.toContain('{{CDN_URL}}');
  });

  it('leaves the rest of the loader body byte-for-byte intact', () => {
    const original = fs.readFileSync(path.join(JS_DIR, 'rrweb-loader.ts'), 'utf-8');
    const out = getRrwebLoaderJs('https://example.test/rrweb.js');
    const expected = original.replace('{{CDN_URL}}', 'https://example.test/rrweb.js');
    expect(out).toBe(expected);
  });

  it('produces browser-runnable JS for any (non-malicious) CDN string', () => {
    const out = getRrwebLoaderJs('https://cdn.example/rrweb.js');
    expect(isSyntacticallyValidJs(out)).toBe(true);
  });
});

describe('recording.ts — module surface for the script loaders', () => {
  it('exposes getRrwebLoaderJs and DEFAULT_RECORDING_CONFIG as runtime exports', () => {
    // Imported at top of file; assert the bindings are real values.
    expect(typeof getRrwebLoaderJs).toBe('function');
    expect(typeof DEFAULT_RECORDING_CONFIG).toBe('object');
    expect(DEFAULT_RECORDING_CONFIG).toHaveProperty('cdn_url');
    expect(DEFAULT_RECORDING_CONFIG).toHaveProperty('flush_interval_seconds');
    expect(DEFAULT_RECORDING_CONFIG).toHaveProperty('rrweb_load_timeout_ms');
  });
});
