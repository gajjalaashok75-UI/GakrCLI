/**
 * Tests for the inlined browser script constants in `recording.ts`.
 *
 * These scripts are not normal ES modules: each is a self-contained IIFE that
 * Playwright injects into the page via `page.evaluate()` /
 * `page.addInitScript()`. The single CDN-templated script (`RRWEB_LOADER_JS`)
 * is loaded at runtime by name; the other five are inlined verbatim into
 * `recording.ts` at build time so they are available inside the bundled
 * `cli.mjs` without any disk reads at runtime.
 *
 * Invariants verified here:
 *
 *   1. Every inlined script constant in `recording.ts` exists and is non-empty.
 *   2. Each constant's body is syntactically valid JavaScript (the browser only
 *      ever runs the raw text, and TypeScript is a superset of JS, so a
 *      valid JS IIFE is a valid `.ts` file with no extra type syntax).
 *   3. The exported `getRrwebLoaderJs(cdnUrl)` builder substitutes
 *      `{{CDN_URL}}` and otherwise returns the `RRWEB_LOADER_JS` body
 *      byte-for-byte.
 *   4. The corresponding inlined constants/callers in `recording.ts` each
 *      return the same literal text as their source constant, guaranteeing the
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
const RECORDING_SRC = fs.readFileSync(path.join(PROJECT_DIR, 'recording.ts'), 'utf-8');

/** Extract inlined script constants from recording.ts source. */
function extractScriptConstants(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const regex = /^const\s+([A-Z_]+_JS)\s*=\s*`([\s\S]*?)`;/gm;
  let match;
  while ((match = regex.exec(source)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

const SCRIPT_CONSTANTS = extractScriptConstants(RECORDING_SRC);

/** The six inlined script constants in recording.ts. */
const INLINED_SCRIPTS = [
  { name: 'RRWEB_LOADER_JS', value: SCRIPT_CONSTANTS.get('RRWEB_LOADER_JS') ?? '', hasCDNPlaceholder: true },
  { name: 'FLUSH_EVENTS_JS', value: SCRIPT_CONSTANTS.get('FLUSH_EVENTS_JS') ?? '', hasCDNPlaceholder: false },
  { name: 'START_RECORDING_SIMPLE_JS', value: SCRIPT_CONSTANTS.get('START_RECORDING_SIMPLE_JS') ?? '', hasCDNPlaceholder: false },
  { name: 'START_RECORDING_JS', value: SCRIPT_CONSTANTS.get('START_RECORDING_JS') ?? '', hasCDNPlaceholder: false },
  { name: 'STOP_RECORDING_JS', value: SCRIPT_CONSTANTS.get('STOP_RECORDING_JS') ?? '', hasCDNPlaceholder: false },
  { name: 'WAIT_FOR_RRWEB_JS', value: SCRIPT_CONSTANTS.get('WAIT_FOR_RRWEB_JS') ?? '', hasCDNPlaceholder: false },
] as const;

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

describe('recording.ts — inlined script constants', () => {
  for (const script of INLINED_SCRIPTS) {
    it(`constant ${script.name} exists and is non-empty`, () => {
      expect(script.value).toBeDefined();
      expect(typeof script.value).toBe('string');
      expect(script.value.trim().length).toBeGreaterThan(0);
    });

    it(`constant ${script.name} is syntactically valid JS (browser-runnable)`, () => {
      expect(isSyntacticallyValidJs(script.value)).toBe(true);
    });

    it(`constant ${script.name} is wrapped in an IIFE (self-contained browser script)`, () => {
      const content = script.value.trim();
      expect(content.startsWith('(function')).toBe(true);
      expect(content.endsWith(')();')).toBe(true);
    });
  }
});

describe('recording.ts — inlined script getters match source constants', () => {
  it('getRrwebLoaderJs matches RRWEB_LOADER_JS (CDN placeholder substituted)', () => {
    const cdn = DEFAULT_RECORDING_CONFIG.cdn_url;
    const rrwebLoader = SCRIPT_CONSTANTS.get('RRWEB_LOADER_JS') ?? '';
    expect(getRrwebLoaderJs(cdn)).toBe(rrwebLoader.replace('{{CDN_URL}}', cdn));
  });

  it('getFlushEventsJs matches FLUSH_EVENTS_JS', () => {
    const flushEvents = SCRIPT_CONSTANTS.get('FLUSH_EVENTS_JS') ?? '';
    expect(getFlushEventsJs()).toBe(flushEvents);
  });

  it('getStartRecordingSimpleJs matches START_RECORDING_SIMPLE_JS', () => {
    const startSimple = SCRIPT_CONSTANTS.get('START_RECORDING_SIMPLE_JS') ?? '';
    expect(getStartRecordingSimpleJs()).toBe(startSimple);
  });

  it('getStartRecordingJs matches START_RECORDING_JS', () => {
    const startRecording = SCRIPT_CONSTANTS.get('START_RECORDING_JS') ?? '';
    expect(getStartRecordingJs()).toBe(startRecording);
  });

  it('getStopRecordingJs matches STOP_RECORDING_JS', () => {
    const stopRecording = SCRIPT_CONSTANTS.get('STOP_RECORDING_JS') ?? '';
    expect(getStopRecordingJs()).toBe(stopRecording);
  });

  it('getWaitForRrwebJs matches WAIT_FOR_RRWEB_JS', () => {
    const waitRrweb = SCRIPT_CONSTANTS.get('WAIT_FOR_RRWEB_JS') ?? '';
    expect(getWaitForRrwebJs()).toBe(waitRrweb);
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
    const rrwebLoader = SCRIPT_CONSTANTS.get('RRWEB_LOADER_JS') ?? '';
    const out = getRrwebLoaderJs('https://example.test/rrweb.js');
    const expected = rrwebLoader.replace('{{CDN_URL}}', 'https://example.test/rrweb.js');
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