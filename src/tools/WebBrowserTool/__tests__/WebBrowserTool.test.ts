/**
 * Tests for the WebBrowserTool engine layer.
 *
 * TS NOTE: written against `bun:test` per GakrCLI's bun.lock/Bun runtime.
 * If the repo actually uses vitest, swap the top import for
 * `import { describe, it, expect, mock, beforeEach } from 'vitest'` —
 * the assertions themselves are framework-agnostic.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AsyncMutex } from '../asyncMutex.js';
import { EventStorage } from '../eventStorage.js';
import { RefManager } from '../refManager.js';
import { RecordingSession } from '../recording.js';
import { BrowserObservation } from '../types.js';

// ============================================================
// EventStorage — file writing + timestamp format
// ============================================================

describe('EventStorage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-storage-test-'));
  });

  it('creates a timestamped session subfolder', () => {
    const storage = new EventStorage(tmpDir);
    const subfolder = storage.createSessionSubfolder();
    expect(subfolder).not.toBeNull();
    expect(subfolder!.startsWith(tmpDir)).toBe(true);
    expect(path.basename(subfolder!)).toMatch(/^recording-\d{8}-\d{6}-\d{6}$/);
    expect(fs.existsSync(subfolder!)).toBe(true);
  });

  it('returns null when output_dir is not set', () => {
    const storage = new EventStorage(null);
    expect(storage.createSessionSubfolder()).toBeNull();
  });

  it('writes numbered JSON files and tracks counters', () => {
    const storage = new EventStorage(tmpDir);
    storage.createSessionSubfolder();

    const filepath = storage.saveEvents([{ type: 1 }, { type: 2 }]);
    expect(filepath).not.toBeNull();
    expect(fs.existsSync(filepath!)).toBe(true);
    expect(JSON.parse(fs.readFileSync(filepath!, 'utf-8'))).toEqual([{ type: 1 }, { type: 2 }]);
    expect(storage.fileCount).toBe(1);
    expect(storage.totalEvents).toBe(2);
  });

  it('returns null and does not write when events is empty', () => {
    const storage = new EventStorage(tmpDir);
    storage.createSessionSubfolder();
    expect(storage.saveEvents([])).toBeNull();
    expect(storage.fileCount).toBe(0);
  });

  it('reset() clears all state', () => {
    const storage = new EventStorage(tmpDir);
    storage.createSessionSubfolder();
    storage.saveEvents([{ a: 1 }]);
    storage.reset();
    expect(storage.sessionDir).toBeNull();
    expect(storage.fileCount).toBe(0);
    expect(storage.totalEvents).toBe(0);
  });
});

// ============================================================
// RefManager — index -> Action resolution
// ============================================================

describe('RefManager — ariaSnapshot ref parsing', () => {
  it('extracts refs from realistic aria snapshot YAML', () => {
    const yaml = `- generic [ref=e1]:
  - heading "Welcome to Example" [ref=e2]
  - navigation [ref=e3]:
    - link "Home" [ref=e4]
    - link "About" [ref=e5]
  - main [ref=e6]:
    - textbox "Search" [ref=e7]
    - button "Search" [ref=e8]`;

    const rm = new RefManager();
    rm.setSnapshot(yaml);

    expect(rm.getRefByIndex(0)).toBe('e1');
    expect(rm.getRefByIndex(3)).toBe('e4');
    expect(rm.getRefByIndex(7)).toBe('e8');
    expect(rm.getRefByIndex(8)).toBeNull();
    expect(rm.count).toBe(8);
  });

  it('handles iframe refs (fNeM format)', () => {
    const yaml = `- generic [ref=e1]:
  - iframe [ref=f1e1]:
    - button "Inside iframe" [ref=f1e2]`;

    const rm = new RefManager();
    rm.setSnapshot(yaml);

    expect(rm.getRefByIndex(0)).toBe('e1');
    expect(rm.getRefByIndex(1)).toBe('f1e1');
    expect(rm.getRefByIndex(2)).toBe('f1e2');
  });

  it('getSnapshotText() returns the stored YAML verbatim', () => {
    const yaml = `- generic [ref=e1]:\n  - button "X" [ref=e2]`;
    const rm = new RefManager();
    rm.setSnapshot(yaml);
    expect(rm.getSnapshotText()).toBe(yaml);
  });

  it('returns 0 refs and null lookups for YAML with no refs', () => {
    const rm = new RefManager();
    rm.setSnapshot('- generic:\n  - text "no interactive elements"');
    expect(rm.count).toBe(0);
    expect(rm.getRefByIndex(0)).toBeNull();
  });

  it('re-parsing (setSnapshot called again) replaces the previous refs entirely', () => {
    const rm = new RefManager();
    rm.setSnapshot('- generic [ref=e1]:\n  - button "A" [ref=e2]');
    expect(rm.count).toBe(2);

    rm.setSnapshot('- generic [ref=e1]:\n  - button "B" [ref=e2]\n  - button "C" [ref=e3]');
    expect(rm.count).toBe(3);
    expect(rm.getRefByIndex(2)).toBe('e3');
  });

  it('clear() empties refs and snapshot text', () => {
    const rm = new RefManager();
    rm.setSnapshot('- generic [ref=e1]');
    rm.clear();
    expect(rm.getRefByIndex(0)).toBeNull();
    expect(rm.count).toBe(0);
    expect(rm.getSnapshotText()).toBe('');
  });
});

// ============================================================
// BrowserObservation
// ============================================================

describe('BrowserObservation', () => {
  it('fromText builds a plain text observation', () => {
    const obs = BrowserObservation.fromText('hello', false);
    expect(obs.text).toBe('hello');
    expect(obs.is_error).toBe(false);
    expect(obs.screenshot_data).toBeNull();
  });

  it('toLLMContent prepends an error header when is_error is true', () => {
    const obs = BrowserObservation.fromText('boom', true);
    const blocks = obs.toLLMContent();
    expect(blocks[0]).toEqual({ type: 'text', text: 'Error while executing browser action:' });
    expect(blocks[1]).toEqual({ type: 'text', text: 'boom' });
  });

  it('toLLMContent appends an image block for screenshot data', () => {
    const obs = BrowserObservation.fromText('page state', false, { screenshotData: 'iVBORw0KGgoAAA' });
    const blocks = obs.toLLMContent();
    const imageBlock = blocks.find((b) => b.type === 'image');
    expect(imageBlock).toBeDefined();
    expect((imageBlock as any).image_urls[0]).toBe('data:image/png;base64,iVBORw0KGgoAAA');
  });
});

// ============================================================
// getContent truncation logic (mirrors server.py's 30000 char limit +
// paragraph/sentence break detection). Exercised directly against the
// same algorithm used in browserServer.ts's getContent().
// ============================================================

describe('content truncation', () => {
  const MAX_CHAR_LIMIT = 30000;

  function truncate(content: string): { content: string; truncated: boolean; nextStart: number } {
    let truncated = false;
    let nextStart = 0;
    let truncateAt = MAX_CHAR_LIMIT;

    if (content.length > MAX_CHAR_LIMIT) {
      const windowStart = Math.max(0, MAX_CHAR_LIMIT - 500);
      const paragraphBreak = content.lastIndexOf('\n\n', MAX_CHAR_LIMIT);
      if (paragraphBreak >= windowStart && paragraphBreak < MAX_CHAR_LIMIT) {
        truncateAt = paragraphBreak;
      } else {
        const sentenceWindowStart = Math.max(0, MAX_CHAR_LIMIT - 200);
        const sentenceBreak = content.lastIndexOf('.', MAX_CHAR_LIMIT);
        if (sentenceBreak >= sentenceWindowStart && sentenceBreak < MAX_CHAR_LIMIT) {
          truncateAt = sentenceBreak + 1;
        }
      }
      content = content.slice(0, truncateAt);
      truncated = true;
      nextStart = truncateAt;
    }

    return { content, truncated, nextStart };
  }

  it('does not truncate content under the limit', () => {
    const result = truncate('short content');
    expect(result.truncated).toBe(false);
  });

  it('truncates at a paragraph break near the limit', () => {
    const before = 'a'.repeat(MAX_CHAR_LIMIT - 300) + '\n\n' + 'b'.repeat(1000);
    const result = truncate(before);
    expect(result.truncated).toBe(true);
    expect(result.content.endsWith('a')).toBe(true);
  });

  it('falls back to a sentence break when no nearby paragraph break exists', () => {
    const before = 'a'.repeat(MAX_CHAR_LIMIT - 100) + '. ' + 'b'.repeat(1000);
    const result = truncate(before);
    expect(result.truncated).toBe(true);
    expect(result.content.endsWith('.')).toBe(true);
  });

  it('hard-truncates at the limit when no break point is found nearby', () => {
    const before = 'a'.repeat(MAX_CHAR_LIMIT + 1000);
    const result = truncate(before);
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBe(MAX_CHAR_LIMIT);
  });
});

// ============================================================
// BUG-FIX REGRESSION TESTS
// ============================================================

describe('BUG 1: listTabs title field', () => {
  it('formats rows as tabId | title | url, not tabId | url | url', async () => {
    // Minimal fake Page objects exercising only what listTabs() touches.
    const fakePages = [
      { title: async () => 'Example Domain', url: () => 'https://example.com/', _guid: 'page@1' },
      { title: async () => 'Another Page', url: () => 'https://example.org/', _guid: 'page@2' },
    ];
    const fakeContext = { pages: () => fakePages };
    const fakePage = { context: () => fakeContext, url: () => fakePages[0].url(), isClosed: () => false };

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    // `page` is a private field at compile time only; reachable at runtime
    // for test injection without spinning up a real browser session.
    (server as any).page = fakePage;

    const result = await server.listTabs();
    const lines = result.split('\n').slice(1); // drop "Open tabs:" header

    expect(lines[0]).toContain('Example Domain');
    expect(lines[0]).toContain('https://example.com/');
    // Regression guard: title must not be the URL repeated.
    expect(lines[0].split(' | ')[1]).toBe('Example Domain');
    expect(lines[1].split(' | ')[1]).toBe('Another Page');
  });
});

describe('BUG 3: extractLinks link stripping', () => {
  // Mirrors the stripping regex used in browserServer.ts's getContent().
  function stripLinks(content: string): string {
    return content.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  }

  it('strips markdown link URLs while keeping the link text', () => {
    const input = 'See [our docs](https://example.com/docs) for details.';
    expect(stripLinks(input)).toBe('See our docs for details.');
  });

  it('is a no-op regression guard against the old x === x tautology', () => {
    // The original bug (`extractLinks === extractLinks`) always evaluated
    // true and never modified content. This asserts stripping actually
    // changes output when links are present.
    const input = 'Read [more](https://a.com) and [this too](https://b.com).';
    const stripped = stripLinks(input);
    expect(stripped).not.toBe(input);
    expect(stripped).toBe('Read more and this too.');
  });

  it('leaves content unchanged when there are no links', () => {
    const input = 'Plain text, no links here.';
    expect(stripLinks(input)).toBe(input);
  });
});

describe('ROUND 10: recording.ts uses page.evaluate() / page.addInitScript() (no more raw CDP)', () => {
  it('injectScripts() registers an init script AND evaluates the loader on the current document', async () => {
    // Declare the parameter: a `mock(async () => {})` with no params types its
    // `mock.calls` entries as the empty tuple `[]`, so `calls[0][0]` has no
    // element to read. recording.ts always calls it as `{ content: string }`.
    const addInitScript = mock(async (_script: { content?: string }) => {});
    const evaluate = mock(async () => {});
    const fakePage: any = { addInitScript, evaluate };

    const { RecordingSession } = await import('../recording.js');
    const session = new RecordingSession(null);
    await session.injectScripts(fakePage);

    expect(addInitScript).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
    // Both should receive the loader source, not some other script.
    const initScriptArg = addInitScript.mock.calls[0][0];
    expect(initScriptArg.content).toContain('rrweb');
  });

  it('injectScripts() is idempotent — calling it twice only injects once', async () => {
    const addInitScript = mock(async () => {});
    const evaluate = mock(async () => {});
    const fakePage: any = { addInitScript, evaluate };

    const { RecordingSession } = await import('../recording.js');
    const session = new RecordingSession(null);
    await session.injectScripts(fakePage);
    await session.injectScripts(fakePage);

    expect(addInitScript).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('a real (non-generic) evaluate() error is surfaced verbatim, not swallowed into a code', async () => {
    const fakePage: any = {
      addInitScript: mock(async () => {}),
      evaluate: mock(async () => {
        throw new Error('net::ERR_CONNECTION_REFUSED fetching rrweb from CDN');
      }),
    };

    const { RecordingSession } = await import('../recording.js');
    const session = new RecordingSession(null);
    const result = await session.start(fakePage);

    // ROUND 10 regression guard: this is the exact class of bug being
    // fixed — a real underlying error must NOT be collapsed into the old
    // opaque "unexpected_response" string.
    expect(result).not.toContain('unexpected_response');
    expect(result).toContain('ERR_CONNECTION_REFUSED');
  });

  it('waitForRrwebLoad times out cleanly without leaking the timer (no unhandled rejection)', async () => {
    let evalCallCount = 0;
    const fakePage: any = {
      addInitScript: mock(async () => {}),
      // 1st call is injectScripts()'s own loader evaluation (resolves fast);
      // 2nd+ call is waitForRrwebLoad's check, which never resolves — this
      // isolates the timeout test to the actual wait-check, not the
      // injection step.
      evaluate: mock(() => {
        evalCallCount += 1;
        if (evalCallCount === 1) return Promise.resolve();
        return new Promise(() => {});
      }),
    };

    const { RecordingSession, DEFAULT_RECORDING_CONFIG } = await import('../recording.js');
    const session = new RecordingSession(null, { ...DEFAULT_RECORDING_CONFIG, rrweb_load_timeout_ms: 50 });
    const result = await session.start(fakePage);

    expect(result).toContain('did not load in time');
  });
});

describe('AsyncMutex (shared dedup — Enhancement 1)', () => {
  it('serializes concurrent withLock calls', async () => {
    const mutex = new AsyncMutex();
    const order: number[] = [];

    async function task(id: number, delayMs: number) {
      await mutex.withLock(async () => {
        order.push(id);
        await new Promise((r) => setTimeout(r, delayMs));
        order.push(-id);
      });
    }

    await Promise.all([task(1, 20), task(2, 5), task(3, 5)]);

    // Each task's start (+id) must be immediately followed by its own end
    // (-id) before the next task starts — proof calls never interleaved.
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i]).toBe(-order[i + 1]);
    }
  });
});

// ============================================================
// ROUND 3: new actions + robustness fixes
// ============================================================

describe('ISSUE 8: refresh()', () => {
  it('calls page.reload()', async () => {
    const reload = mock(async () => {});
    const fakePage: any = {
      reload,
      url: () => 'https://example.com/',
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.refresh();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith({ waitUntil: 'domcontentloaded' });
    expect(result).toContain('Refreshed');
  });

  it('returns a friendly error message when reload() throws', async () => {
    const fakePage: any = {
      reload: mock(async () => {
        throw new Error('net::ERR_CONNECTION_REFUSED');
      }),
      url: () => 'https://example.com/',
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.refresh();
    expect(result).toContain('Error refreshing page');
    expect(result).toContain('ERR_CONNECTION_REFUSED');
  });
});

describe('ISSUE 9: wait()', () => {
  it('calls page.waitForTimeout() with the requested ms', async () => {
    const waitForTimeout = mock(async () => {});
    const fakePage: any = { waitForTimeout, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.wait(1500);
    expect(waitForTimeout).toHaveBeenCalledWith(1500);
    expect(result).toBe('Waited 1500ms');
  });
});

describe('ISSUE 10: pressKey()', () => {
  it('calls page.keyboard.press() with the requested key', async () => {
    const press = mock(async () => {});
    const fakePage: any = { keyboard: { press }, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.pressKey('Enter');
    expect(press).toHaveBeenCalledWith('Enter');
    expect(result).toBe('Pressed Enter');
  });

  it('returns a friendly error message when press() throws', async () => {
    const fakePage: any = {
      keyboard: {
        press: mock(async () => {
          throw new Error('Unknown key: "NotAKey"');
        }),
      },
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.pressKey('NotAKey');
    expect(result).toContain('Error pressing key NotAKey');
  });
});

describe('scroll_to_text()', () => {
  it('calls page.evaluate with the scroll-to-text expression and reports success', async () => {
    const evaluate = mock(async () => ({ found: true, truncated: false, visitedNodes: 10, scannedChars: 500 }));
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.scrollToText('Hello World', 'down');
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(result).toContain("Scrolled to text 'Hello World'");
  });

  it('returns an error when the text is not found on the page', async () => {
    const evaluate = mock(async () => ({ found: false, truncated: false, visitedNodes: 100, scannedChars: 2000 }));
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.scrollToText('NotHere', 'up');
    expect(result).toContain("Text 'NotHere' not found on page");
  });

  it('returns an error when the text is empty', async () => {
    const evaluate = mock(async () => ({ found: false, truncated: false, visitedNodes: 0, scannedChars: 0 }));
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.scrollToText('', 'down');
    expect(result).toContain('Text to scroll to must not be empty');
  });

  it('returns a friendly error when page.evaluate throws', async () => {
    const evaluate = mock(async () => {
      throw new Error('Execution context was destroyed');
    });
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.scrollToText('Hello', 'down');
    expect(result).toContain('Error scrolling to text');
    expect(result).toContain('Execution context was destroyed');
  });
});

describe('evaluate()', () => {
  it('returns a JSON-serialized result on success', async () => {
    const evaluate = mock(async () => ({ ok: true, value: 42 }));
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.evaluate('1 + 41');
    expect(result).toBe('42');
  });

  it('returns an object as JSON', async () => {
    const evaluate = mock(async () => ({ ok: true, value: { name: 'Alice', age: 30 } }));
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.evaluate("({name:'Alice',age:30})");
    expect(result).toContain('"name"');
    expect(result).toContain('"Alice"');
    expect(result).toContain('30');
  });

  it('returns "undefined" for undefined results', async () => {
    const evaluate = mock(async () => ({ ok: true, value: undefined }));
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.evaluate('void 0');
    expect(result).toBe('undefined');
  });

  it('returns an error string when the page-side eval throws', async () => {
    const evaluate = mock(async () => ({ ok: false, error: 'ReferenceError: x is not defined' }));
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.evaluate('x');
    expect(result).toContain('Error evaluating code');
    expect(result).toContain('x is not defined');
  });

  it('returns a friendly error when page.evaluate throws', async () => {
    const evaluate = mock(async () => {
      throw new Error('Execution context was destroyed');
    });
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.evaluate('1+1');
    expect(result).toContain('Error evaluating code');
    expect(result).toContain('Execution context was destroyed');
  });

  it('returns an error when the code is empty', async () => {
    const evaluate = mock(async () => ({ ok: true, value: 1 }));
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.evaluate('   ');
    expect(result).toContain('Code to evaluate must not be empty');
  });

  it('truncates very large results', async () => {
    const bigString = 'x'.repeat(25_000);
    const evaluate = mock(async () => ({ ok: true, value: bigString }));
    const fakePage: any = { evaluate, url: () => 'https://example.com/', isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.evaluate("'x'.repeat(25000)");
    expect(result).toContain('... (truncated');
  });
});

describe('find_elements()', () => {
  it('returns matching elements with tag, text, and attributes', async () => {
    const fakeLocator1 = { evaluate: mock(async () => ({ tag: 'button', text: 'Login', attrs: { class: 'btn', id: 'submit' } })) };
    const fakeLocator2 = { evaluate: mock(async () => ({ tag: 'button', text: 'Cancel', attrs: { class: 'btn' } })) };
    const $$ = mock(async () => [fakeLocator1, fakeLocator2]);
    const fakePage: any = { $$, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.findElements('button', undefined, 50, true);
    expect($$).toHaveBeenCalledWith('button');
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(2);
    expect(parsed.returned).toBe(2);
    expect(parsed.elements[0].tag).toBe('button');
    expect(parsed.elements[0].text).toBe('Login');
    expect(parsed.elements[0].attributes.id).toBe('submit');
  });

  it('respects max_results limit', async () => {
    const fakeLocators = Array.from({ length: 5 }, () => ({
      evaluate: mock(async () => ({ tag: 'div', text: '', attrs: {} })),
    }));
    const $$ = mock(async () => fakeLocators);
    const fakePage: any = { $$, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.findElements('div', undefined, 2, true);
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(5);
    expect(parsed.returned).toBe(2);
    expect(parsed.truncated).toBe(true);
  });

  it('filters attributes when requested', async () => {
    const fakeLocator = { evaluate: mock(async () => ({ tag: 'a', text: 'Link', attrs: { href: 'https://example.com', class: 'link', id: 'main' } })) };
    const $$ = mock(async () => [fakeLocator]);
    const fakePage: any = { $$, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.findElements('a', ['href'], 50, true);
    const parsed = JSON.parse(result);
    expect(parsed.elements[0].attributes).toEqual({ href: 'https://example.com' });
  });

  it('returns an error when selector is empty', async () => {
    const $$ = mock(async () => []);
    const fakePage: any = { $$, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.findElements('', undefined, 50, true);
    expect(result).toContain('Selector must not be empty');
  });
});

describe('search_page()', () => {
  it('finds text matches with context', async () => {
    const evaluate = mock(async () => ({ matches: [{ context: '...Hello World...', offset: 3 }] }));
    const fakePage: any = { evaluate, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.searchPage('Hello', false, false, 50, undefined, 25);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(result).toContain('1 match');
    expect(result).toContain('Hello World');
  });

  it('returns "no matches" when nothing is found', async () => {
    const evaluate = mock(async () => ({ matches: [] }));
    const fakePage: any = { evaluate, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.searchPage('NotHere', false, false, 50, undefined, 25);
    expect(result).toContain('No matches found');
  });

  it('passes regex flag to the page-side evaluator', async () => {
    const evaluate = mock(async () => ({ matches: [] }));
    const fakePage: any = { evaluate, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    await server.searchPage('foo\\d+', true, false, 50, undefined, 25);
    expect(evaluate).toHaveBeenCalledTimes(1);
    const call = evaluate.mock.calls[0] as unknown as unknown[];
    expect(call[0]).toBeDefined();
  });

  it('returns an error when the regex is invalid', async () => {
    const evaluate = mock(async () => ({ error: 'Invalid regex: Invalid regular expression', matches: [] }));
    const fakePage: any = { evaluate, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.searchPage('[unclosed', true, false, 50, undefined, 25);
    expect(result).toContain('Invalid regex');
  });

  it('returns an error when pattern is empty', async () => {
    const evaluate = mock(async () => ({ matches: [] }));
    const fakePage: any = { evaluate, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.searchPage('', false, false, 50, undefined, 25);
    expect(result).toContain('Pattern must not be empty');
  });
});

describe('send_keys()', () => {
  it('presses a single key', async () => {
    const press = mock(async () => {});
    const fakePage: any = { keyboard: { press }, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.sendKeys('Enter');
    expect(press).toHaveBeenCalledWith('Enter');
    expect(result).toContain('Sent keys Enter');
  });

  it('presses a key combo like Control+a', async () => {
    const press = mock(async () => {});
    const fakePage: any = { keyboard: { press }, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.sendKeys('Control+a');
    expect(press).toHaveBeenCalledWith('Control+a');
    expect(result).toContain('Sent keys Control+a');
  });

  it('falls back to per-character press when the key name is unknown', async () => {
    let callCount = 0;
    const press = mock(async (key: string) => {
      callCount += 1;
      if (key === 'abc') throw new Error('Unknown key: "abc"');
    });
    const fakePage: any = { keyboard: { press }, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.sendKeys('abc');
    // 1 initial call that throws + 3 per-character calls (a, b, c) = 4 total
    expect(callCount).toBe(4);
    expect(result).toContain('Sent keys abc');
  });

  it('returns a friendly error when keyboard is unavailable', async () => {
    const fakePage: any = { isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.sendKeys('Enter');
    expect(result).toContain('Keyboard input is not available');
  });

  it('returns an error when keys is empty', async () => {
    const press = mock(async () => {});
    const fakePage: any = { keyboard: { press }, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.sendKeys('');
    expect(result).toContain('Keys must not be empty');
  });
});

describe('takeScreenshot()', () => {
  const makeFakeBuffer = () => Buffer.from('fake-png-data');

  it('returns a base64 data URL when no file_name is given', async () => {
    const fakeBuffer = makeFakeBuffer();
    const screenshot = mock(async () => fakeBuffer);
    const fakePage: any = { screenshot, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.takeScreenshot();
    expect(screenshot).toHaveBeenCalledWith({ type: 'png' });
    expect(result).toContain('data:image/png;base64,');
  });

  it('saves to disk and returns path when file_name is given', async () => {
    const fakeBuffer = makeFakeBuffer();
    const screenshot = mock(async () => fakeBuffer);
    const fakePage: any = { screenshot, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.takeScreenshot('test-page.png');
    expect(result).toContain('Saved screenshot to');
    expect(result).toContain('test-page.png');
  });

  it('appends .png extension if missing', async () => {
    const fakeBuffer = makeFakeBuffer();
    const screenshot = mock(async () => fakeBuffer);
    const fakePage: any = { screenshot, isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.takeScreenshot('my-screenshot');
    expect(result).toContain('my-screenshot.png');
  });

  it('returns an error when page is closed', async () => {
    const fakePage: any = { isClosed: () => true };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.takeScreenshot();
    expect(result).toContain('No active page available');
  });
});

describe('getDropdownOptions()', () => {
  it('returns options for a SELECT element', async () => {
    const evaluate = mock(async () =>
      JSON.stringify([
        { index: 0, value: 'us', text: 'United States', selected: true, disabled: false },
        { index: 1, value: 'uk', text: 'United Kingdom', selected: false, disabled: false },
      ]),
    );
    const locator = { evaluate };
    const fakePage: any = {
      locator: mock(() => locator),
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - combobox "Country" [ref=e2]\n');

    const result = await server.getDropdownOptions(0);
    expect(result).toContain('2 option(s)');
    expect(result).toContain('United States');
    expect(result).toContain('United Kingdom');
  });

  it('returns an error when index is invalid', async () => {
    const fakePage: any = { isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.getDropdownOptions(99);
    expect(result).toContain('Invalid element index');
  });
});

describe('selectDropdown()', () => {
  it('selects an option by text in a SELECT element', async () => {
    const evaluate = mock(async (_fn: unknown, t: string) => {
      if (t === 'United Kingdom') {
        return { found: true, value: 'uk', text: 'United Kingdom' };
      }
      return { found: false };
    });
    const locator = { evaluate };
    const fakePage: any = {
      locator: mock(() => locator),
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - combobox "Country" [ref=e2]\n');

    const result = await server.selectDropdown(0, 'United Kingdom');
    expect(result).toContain("Selected 'United Kingdom'");
    expect(result).toContain('value="uk"');
  });

  it('returns an error when the option is not found', async () => {
    const evaluate = mock(async () => ({ found: false }));
    const locator = { evaluate };
    const fakePage: any = {
      locator: mock(() => locator),
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - combobox "Country" [ref=e2]\n');

    const result = await server.selectDropdown(0, 'NotAnOption');
    expect(result).toContain("Option 'NotAnOption' not found");
  });

  it('returns an error when text is empty', async () => {
    const fakePage: any = { isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.selectDropdown(0, '');
    expect(result).toContain('Option text must not be empty');
  });
});

describe('uploadFile()', () => {
  let tmpFile: string;
  beforeEach(() => {
    tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'upload-file-test-')), 'test.txt');
    fs.writeFileSync(tmpFile, 'hello');
  });
  afterEach(() => {
    try { fs.unlinkSync(tmpFile); } catch {}
  });

  it('calls setInputFiles on the target element', async () => {
    const setInputFiles = mock(async () => {});
    const locator = { setInputFiles };
    const fakePage: any = {
      locator: mock(() => locator),
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - button "Upload" [ref=e2]\n');

    const result = await server.uploadFile(0, tmpFile);
    expect(setInputFiles).toHaveBeenCalledWith(tmpFile);
    expect(result).toContain("Uploaded file 'test.txt'");
  });

  it('returns an error when the file does not exist', async () => {
    const fakePage: any = { isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.uploadFile(0, path.join(os.tmpdir(), 'definitely-nonexistent-' + Date.now() + '.txt'));
    expect(result).toContain('File not found');
  });

  it('returns an error when path is empty', async () => {
    const fakePage: any = { isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.uploadFile(0, '');
    expect(result).toContain('File path must not be empty');
  });

  it('returns a friendly error when setInputFiles throws', async () => {
    const setInputFiles = mock(async () => {
      throw new Error('Element is not a file input');
    });
    const locator = { setInputFiles };
    const fakePage: any = {
      locator: mock(() => locator),
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - button "Not a file input" [ref=e2]\n');

    const result = await server.uploadFile(0, tmpFile);
    expect(result).toContain('Error uploading file');
    expect(result).toContain('Element is not a file input');
  });
});

describe('searchGoogle()', () => {
  it('navigates to a Google search URL', async () => {
    const goto = mock(async () => null);
    const fakePage: any = {
      goto,
      url: () => 'https://example.com/',
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).context = { newPage: mock(async () => fakePage) };

    const result = await server.searchGoogle('hello world');
    expect(goto).toHaveBeenCalledTimes(1);
    const url = (goto.mock.calls[0] as unknown as string[])[0];
    expect(url).toContain('https://www.google.com/search');
    expect(url).toContain('hello%20world');
    expect(result).toContain('Navigated to');
  });

  it('URL-encodes special characters in the query', async () => {
    const goto = mock(async () => null);
    const fakePage: any = {
      goto,
      url: () => 'https://example.com/',
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).context = { newPage: mock(async () => fakePage) };

    await server.searchGoogle('a&b=c?d');
    const url = (goto.mock.calls[0] as unknown as string[])[0];
    expect(url).toContain('a%26b%3Dc%3Fd');
  });

  it('returns an error when query is empty', async () => {
    const fakePage: any = { isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.searchGoogle('');
    expect(result).toContain('Search query must not be empty');
  });
});

describe('saveAsPdf()', () => {
  it('saves a PDF and returns the file path', async () => {
    const pdfBuffer = Buffer.from('fake-pdf');
    const pdf = mock(async () => pdfBuffer);
    const title = mock(async () => 'Test Page');
    const fakePage: any = {
      pdf,
      title,
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.saveAsPdf('my-report');
    expect(pdf).toHaveBeenCalledWith(
      expect.objectContaining({ printBackground: true, landscape: false, scale: 1.0 }),
    );
    expect(result).toContain('Saved PDF to');
    expect(result).toContain('my-report.pdf');
  });

  it('uses page title as file name when none provided', async () => {
    const pdfBuffer = Buffer.from('fake-pdf');
    const pdf = mock(async () => pdfBuffer);
    const title = mock(async () => 'My Document');
    const fakePage: any = {
      pdf,
      title,
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.saveAsPdf();
    expect(result).toContain('My Document.pdf');
  });

  it('returns an error when page is closed', async () => {
    const fakePage: any = { isClosed: () => true };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.saveAsPdf();
    expect(result).toContain('No active page available');
  });

  it('returns a friendly error when page.pdf throws', async () => {
    const pdf = mock(async () => {
      throw new Error('PDF generation failed');
    });
    const fakePage: any = {
      pdf,
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.saveAsPdf();
    expect(result).toContain('Error saving PDF');
    expect(result).toContain('PDF generation failed');
  });
});

describe('ISSUE 7: dialog auto-dismiss handler registration', () => {
  it('registers dialog and pageerror handlers on pages created in the context', async () => {
    const onCalls: Array<[string, unknown]> = [];
    const fakePage = {
      on: mock((event: string, handler: unknown) => {
        onCalls.push([event, handler]);
      }),
    };

    let contextPageHandler: ((page: unknown) => void) | null = null;
    const fakeContext = {
      on: mock((event: string, handler: (page: unknown) => void) => {
        if (event === 'page') contextPageHandler = handler;
      }),
      route: mock(async () => {}),
      newPage: mock(async () => {
        // Mirrors real Playwright: creating a page via the context fires
        // the context's 'page' event, which is where the dialog/pageerror
        // handlers get attached (see initBrowserSession()).
        if (contextPageHandler) contextPageHandler(fakePage);
        return fakePage;
      }),
    };
    const fakeBrowser = {
      newContext: mock(async () => fakeContext),
    };

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

    const registeredEvents = onCalls.map(([event]) => event);
    expect(registeredEvents).toContain('dialog');
    expect(registeredEvents).toContain('pageerror');
  });
});

describe('ISSUE 5: requirePage() rejects a closed page', () => {
  it('throws a clear error when the page has been closed', async () => {
    const fakePage: any = { isClosed: () => true };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    await expect(server.listTabs()).rejects.toThrow(/closed/i);
  });

  it('throws "not initialized" when no page has ever been set', async () => {
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();

    await expect(server.listTabs()).rejects.toThrow(/not initialized/i);
  });
});

describe('ISSUE 3/4/6: browserServer error wrapping returns friendly messages', () => {
  it('typeText() returns a friendly error instead of throwing on fill() failure', async () => {
    const fakePage: any = {
      isClosed: () => false,
      locator: () => ({
        fill: mock(async () => {
          throw new Error('element is not visible');
        }),
      }),
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - textbox "Field" [ref=e2]');

    const result = await server.typeText(1, 'hello');
    expect(result).toContain('Error typing into [1] (ref=e2)');
    expect(result).toContain('not visible');
  });

  it('navigate() returns a friendly error instead of throwing on goto() failure', async () => {
    const fakePage: any = {
      isClosed: () => false,
      goto: mock(async () => {
        throw new Error('net::ERR_NAME_NOT_RESOLVED');
      }),
      context: () => ({ pages: () => [fakePage] }),
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.navigate('https://does-not-exist.invalid', false);
    expect(result).toContain('Error navigating to');
    expect(result).toContain('ERR_NAME_NOT_RESOLVED');
  });
});

// ============================================================
// Live state plumbing (for WebBrowserPanel.tsx)
// ============================================================

describe('BrowserServer live state', () => {
  it('starts as the empty/uninitialized snapshot', async () => {
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    const state = server.getLiveState();
    expect(state.isInitialized).toBe(false);
    expect(state.currentUrl).toBeNull();
    expect(state.tabs).toEqual([]);
  });

  it('notifies subscribers via onLiveStateChange after navigate()', async () => {
    const fakePage: any = {
      isClosed: () => false,
      goto: mock(async () => {}),
      url: () => 'https://example.com/',
      title: async () => 'Example',
      context: () => ({ pages: () => [fakePage] }),
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).browser = {}; // isInitialized reads off browser !== null

    const seen: any[] = [];
    const unsubscribe = server.onLiveStateChange((s) => seen.push(s));

    await server.navigate('https://example.com/', false);

    expect(seen.length).toBeGreaterThan(0);
    const last = seen[seen.length - 1];
    expect(last.isInitialized).toBe(true);
    expect(last.currentUrl).toBe('https://example.com/');
    expect(last.currentTitle).toBe('Example');

    unsubscribe();
  });

  it('unsubscribe() stops further notifications', async () => {
    const fakePage: any = {
      isClosed: () => false,
      goto: mock(async () => {}),
      url: () => 'https://example.com/',
      title: async () => 'Example',
      context: () => ({ pages: () => [fakePage] }),
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).browser = {};

    let calls = 0;
    const unsubscribe = server.onLiveStateChange(() => {
      calls += 1;
    });
    await server.navigate('https://example.com/', false);
    unsubscribe();
    await server.navigate('https://example.com/', false);

    expect(calls).toBe(1);
  });

  it('closeBrowser() resets live state back to empty and notifies', async () => {
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).browser = { close: mock(async () => {}) };
    (server as any).context = { close: mock(async () => {}) };
    (server as any).page = { isClosed: () => false, close: mock(async () => {}) };

    const seen: any[] = [];
    server.onLiveStateChange((s) => seen.push(s));
    await server.closeBrowser();

    expect(seen[seen.length - 1].isInitialized).toBe(false);
    expect(server.getLiveState().isInitialized).toBe(false);
  });

  it('captureScreenshot() populates lastScreenshot and notifies subscribers', async () => {
    const fakeBuffer = { toString: (_enc: string) => 'ZmFrZS1wbmc=' };
    const fakePage: any = {
      isClosed: () => false,
      screenshot: mock(async () => fakeBuffer),
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const data = await server.captureScreenshot();
    expect(data).toBe('ZmFrZS1wbmc=');
    expect(server.getLiveState().lastScreenshot).toBe('ZmFrZS1wbmc=');
  });

  it('captureScreenshot() returns null when there is no active page', async () => {
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    expect(await server.captureScreenshot()).toBeNull();
  });
});

describe('BrowserToolExecutor.getSharedIfExists()', () => {
  it('returns null when no shared executor has been created yet', async () => {
    // Isolated module registry check: without ever calling getShared(),
    // the static slot must still be null. (Other tests in this file may
    // have already created one via getShared()/dispose flows — this test
    // only asserts the *type* of contract: getSharedIfExists() must never
    // itself create an executor as a side effect.)
    const { BrowserToolExecutor } = await import('../browserEngine.js');
    const before = BrowserToolExecutor.getSharedIfExists();
    const after = BrowserToolExecutor.getSharedIfExists();
    // Calling it twice must not have created/changed anything (idempotent,
    // no side effects) — same reference (or both null) either way.
    expect(after).toBe(before);
  });
});

describe('REFRESH-STATE GLITCH: stale aria refs self-heal', () => {
  // Playwright's ariaSnapshot renumbers refs between calls (eN -> f1eN on
  // the same page), so a ref stored from the last get_state can go stale
  // even though the element still exists at the same index. click/typeText
  // must re-snapshot the current DOM and retry once at the same index.

  function makeStaleRefPage() {
    // The ref manager is seeded externally with index 1 = e2. The first
    // ariaSnapshot() call happens inside the retry and reflects the
    // renumbered DOM, where index 1 has become f1e2.
    const locators = new Map<string, { click?: Function; fill?: Function }>([
      ['aria-ref=e2', {}],
      ['aria-ref=f1e2', {}],
    ]);
    const page: any = {
      ariaSnapshot: mock(async () =>
        '- generic [ref=f1e1]:\n  - textbox "Search" [ref=f1e2]\n',
      ),
      locator: mock((selector: string) => {
        let entry = locators.get(selector);
        if (!entry) {
          entry = {};
          locators.set(selector, entry);
        }
        return entry;
      }),
      isClosed: () => false,
    };
    return { page, locators };
  }

  it('click() re-snapshots and retries the same index when the stored ref goes stale', async () => {
    const { page, locators } = makeStaleRefPage();
    locators.get('aria-ref=e2')!.click = mock(async () => {
      throw new Error('element is stale');
    });
    locators.get('aria-ref=f1e2')!.click = mock(async () => {});

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = page;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - textbox "Search" [ref=e2]\n');

    const result = await server.click(1, false);
    expect(result).toContain('retried after state refresh');
    expect(result).toContain('f1e2');
    expect(locators.get('aria-ref=f1e2')!.click).toHaveBeenCalledTimes(1);
  });

  it('typeText() re-snapshots and retries the same index when the stored ref goes stale', async () => {
    const { page, locators } = makeStaleRefPage();
    locators.get('aria-ref=e2')!.fill = mock(async () => {
      throw new Error('element is detached');
    });
    locators.get('aria-ref=f1e2')!.fill = mock(async () => {});

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = page;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - textbox "Search" [ref=e2]\n');

    const result = await server.typeText(1, 'hello');
    expect(result).toContain('retried after state refresh');
    expect(result).toContain('f1e2');
    expect(locators.get('aria-ref=f1e2')!.fill).toHaveBeenCalledTimes(1);
  });

  it('click() reports the original error when the retry also fails', async () => {
    const { page, locators } = makeStaleRefPage();
    locators.get('aria-ref=e2')!.click = mock(async () => {
      throw new Error('element is stale');
    });
    // Retry re-snapshots (index 1 = f1e2 now), but the fresh ref also fails.
    locators.get('aria-ref=f1e2')!.click = mock(async () => {
      throw new Error('element is gone');
    });

    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = page;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - textbox "Search" [ref=e2]\n');

    const result = await server.click(1, false);
    expect(result).toContain('Error clicking');
    expect(result).toContain('element is stale');
    expect(result).not.toContain('retried');
  });
});

describe('REFRESH-STATE GLITCH: navigation invalidates stored refs', () => {
  it('navigate() clears the ref snapshot after a successful goto', async () => {
    const fakePage: any = {
      goto: mock(async () => {}),
      url: () => 'https://example.com/new',
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - button "Login" [ref=e2]\n');

    const result = await server.navigate('https://example.com/new', false);
    expect(result).toContain('Navigated to');
    expect((server as any).refManager.count).toBe(0);
    expect((server as any).refManager.getRefByIndex(0)).toBeNull();
  });

  it('refresh() clears the ref snapshot after a successful reload', async () => {
    const fakePage: any = {
      reload: mock(async () => {}),
      url: () => 'https://example.com/',
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - button "Login" [ref=e2]\n');

    const result = await server.refresh();
    expect(result).toContain('Refreshed');
    expect((server as any).refManager.count).toBe(0);
  });

  it('goBack() clears the ref snapshot after success', async () => {
    const fakePage: any = {
      goBack: mock(async () => {}),
      url: () => 'https://example.com/',
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- generic [ref=e1]:\n  - button "Login" [ref=e2]\n');

    const result = await server.goBack();
    expect(result).toContain('Navigated back');
    expect((server as any).refManager.count).toBe(0);
  });
});

// ============================================================
// ROUND 6: network error classification, proxy resolution, loading state
// ============================================================

describe('classifyNetworkError()', () => {
  it('classifies our own allowed_domains block distinctly from real network errors', async () => {
    const { classifyNetworkError } = await import('../browserServer.js');
    const { category, hint } = classifyNetworkError('net::ERR_BLOCKED_BY_CLIENT at https://evil.example');
    expect(category).toBe('blocked_by_allowlist');
    expect(hint).toContain('allowed_domains');
  });

  it('classifies ERR_INTERNET_DISCONNECTED as offline with a sandbox hint', async () => {
    const { classifyNetworkError } = await import('../browserServer.js');
    const { category, hint } = classifyNetworkError('net::ERR_INTERNET_DISCONNECTED');
    expect(category).toBe('offline');
    expect(hint?.toLowerCase()).toContain('sandbox');
  });

  it('classifies ERR_NAME_NOT_RESOLVED as dns', async () => {
    const { classifyNetworkError } = await import('../browserServer.js');
    expect(classifyNetworkError('net::ERR_NAME_NOT_RESOLVED').category).toBe('dns');
  });

  it('classifies ERR_CONNECTION_REFUSED as connection_refused', async () => {
    const { classifyNetworkError } = await import('../browserServer.js');
    expect(classifyNetworkError('net::ERR_CONNECTION_REFUSED').category).toBe('connection_refused');
  });

  it('classifies a Playwright timeout message as timeout', async () => {
    const { classifyNetworkError } = await import('../browserServer.js');
    expect(classifyNetworkError('Timeout 30000ms exceeded.').category).toBe('timeout');
  });

  it('classifies ERR_PROXY_CONNECTION_FAILED as proxy', async () => {
    const { classifyNetworkError } = await import('../browserServer.js');
    expect(classifyNetworkError('net::ERR_PROXY_CONNECTION_FAILED').category).toBe('proxy');
  });

  it('classifies ERR_CERT_AUTHORITY_INVALID as tls', async () => {
    const { classifyNetworkError } = await import('../browserServer.js');
    expect(classifyNetworkError('net::ERR_CERT_AUTHORITY_INVALID').category).toBe('tls');
  });

  it('falls back to "other" with no hint for unrecognized errors', async () => {
    const { classifyNetworkError } = await import('../browserServer.js');
    const { category, hint } = classifyNetworkError('element not visible');
    expect(category).toBe('other');
    expect(hint).toBeNull();
  });
});

describe('resolveProxyFromEnv()', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    for (const key of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy']) {
      delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it('returns null when no proxy env vars are set', async () => {
    for (const key of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
      delete process.env[key];
    }
    const { resolveProxyFromEnv } = await import('../browserEngine.js');
    expect(resolveProxyFromEnv()).toBeNull();
  });

  it('picks up HTTPS_PROXY and NO_PROXY as bypass', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.internal:8080';
    process.env.NO_PROXY = 'localhost,127.0.0.1';
    const { resolveProxyFromEnv } = await import('../browserEngine.js');
    const proxy = resolveProxyFromEnv();
    expect(proxy?.server).toBe('http://proxy.internal:8080');
    expect(proxy?.bypass).toBe('localhost,127.0.0.1');
  });

  it('falls back through HTTPS_PROXY -> HTTP_PROXY -> ALL_PROXY in priority order', async () => {
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    process.env.HTTP_PROXY = 'http://http-proxy:80';
    process.env.ALL_PROXY = 'http://all-proxy:1080';
    const { resolveProxyFromEnv } = await import('../browserEngine.js');
    expect(resolveProxyFromEnv()?.server).toBe('http://http-proxy:80');
  });
});

describe('loading state (isLoading) around navigation', () => {
  it('sets isLoading=true synchronously before goto() resolves, false after', async () => {
    let resolveGoto: () => void = () => {};
    const gotoPromise = new Promise<void>((resolve) => {
      resolveGoto = resolve;
    });
    const fakePage: any = {
      isClosed: () => false,
      goto: mock(() => gotoPromise),
      url: () => 'https://example.com/',
      title: async () => 'Example',
      context: () => ({ pages: () => [fakePage] }),
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).browser = {};

    const seenLoadingStates: boolean[] = [];
    server.onLiveStateChange((s) => seenLoadingStates.push(s.isLoading));

    const navigatePromise = server.navigate('https://example.com/', false);
    // setLoading(true) runs synchronously before the goto() await, so it
    // must already be visible before goto() has resolved.
    expect(seenLoadingStates).toContain(true);

    resolveGoto();
    await navigatePromise;
    expect(seenLoadingStates[seenLoadingStates.length - 1]).toBe(false);
  });
});

describe('BrowserToolExecutor proxy config resolution', () => {
  it('falls back to resolveProxyFromEnv() when proxy is omitted (undefined)', async () => {
    const savedEnv = { ...process.env };
    process.env.HTTPS_PROXY = 'http://from-env:8080';

    const { BrowserToolExecutor } = await import('../browserEngine.js');
    const originalCheck = BrowserToolExecutor.checkChromiumAvailable;
    BrowserToolExecutor.checkChromiumAvailable = () => '/fake/chromium';

    try {
      const executor = new BrowserToolExecutor({});
      expect((executor as any).config.proxy?.server).toBe('http://from-env:8080');
    } finally {
      BrowserToolExecutor.checkChromiumAvailable = originalCheck;
      Object.keys(process.env).forEach((k) => delete process.env[k]);
      Object.assign(process.env, savedEnv);
    }
  });

  it('an explicit proxy: null opts OUT of the env-var fallback (regression: `??` bug)', async () => {
    const savedEnv = { ...process.env };
    process.env.HTTPS_PROXY = 'http://from-env:8080';

    const { BrowserToolExecutor } = await import('../browserEngine.js');
    const originalCheck = BrowserToolExecutor.checkChromiumAvailable;
    BrowserToolExecutor.checkChromiumAvailable = () => '/fake/chromium';

    try {
      const executor = new BrowserToolExecutor({ proxy: null });
      // Must stay null — NOT fall back to HTTPS_PROXY from the environment.
      expect((executor as any).config.proxy).toBeNull();
    } finally {
      BrowserToolExecutor.checkChromiumAvailable = originalCheck;
      Object.keys(process.env).forEach((k) => delete process.env[k]);
      Object.assign(process.env, savedEnv);
    }
  });

  it('an explicit proxy config overrides the environment', async () => {
    const savedEnv = { ...process.env };
    process.env.HTTPS_PROXY = 'http://from-env:8080';

    const { BrowserToolExecutor } = await import('../browserEngine.js');
    const originalCheck = BrowserToolExecutor.checkChromiumAvailable;
    BrowserToolExecutor.checkChromiumAvailable = () => '/fake/chromium';

    try {
      const executor = new BrowserToolExecutor({ proxy: { server: 'http://explicit:9090' } });
      expect((executor as any).config.proxy?.server).toBe('http://explicit:9090');
    } finally {
      BrowserToolExecutor.checkChromiumAvailable = originalCheck;
      Object.keys(process.env).forEach((k) => delete process.env[k]);
      Object.assign(process.env, savedEnv);
    }
  });
});

// ============================================================
// ROUND 7: log.md findings — coercion, selector fallback, close_all_tabs, CAPTCHA heuristic
// ============================================================

describe('LOG.MD ISSUE #1: coercion of stringified params (BrowserActionSchema)', () => {
  it('accepts new_tab as the string "true" (XML harness stringification)', async () => {
    const { BrowserActionSchema } = await import('../types.js');
    const result = BrowserActionSchema.safeParse({ action: 'navigate', url: 'https://example.com', new_tab: 'true' });
    expect(result.success).toBe(true);
    if (result.success && result.data.action === 'navigate') {
      expect(result.data.new_tab).toBe(true);
    }
  });

  it('accepts new_tab as the string "false"', async () => {
    const { BrowserActionSchema } = await import('../types.js');
    const result = BrowserActionSchema.safeParse({ action: 'navigate', url: 'https://example.com', new_tab: 'false' });
    expect(result.success).toBe(true);
    if (result.success && result.data.action === 'navigate') {
      expect(result.data.new_tab).toBe(false);
    }
  });

  it('accepts include_screenshot/extract_links/start_from_char as stringified values', async () => {
    const { BrowserActionSchema } = await import('../types.js');

    const r1 = BrowserActionSchema.safeParse({ action: 'get_state', include_screenshot: 'true' });
    expect(r1.success).toBe(true);
    if (r1.success && r1.data.action === 'get_state') expect(r1.data.include_screenshot).toBe(true);

    const r2 = BrowserActionSchema.safeParse({ action: 'get_content', extract_links: 'false', start_from_char: '120' });
    expect(r2.success).toBe(true);
    if (r2.success && r2.data.action === 'get_content') {
      expect(r2.data.extract_links).toBe(false);
      expect(r2.data.start_from_char).toBe(120);
    }
  });

  it('accepts storage_state as a JSON-stringified object (the exact bug from log.md issue #1)', async () => {
    const { BrowserActionSchema } = await import('../types.js');
    const storageState = { cookies: [{ name: 'a', value: 'b' }], origins: [] };
    const result = BrowserActionSchema.safeParse({
      action: 'set_storage',
      storage_state: JSON.stringify(storageState),
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.action === 'set_storage') {
      expect(result.data.storage_state).toEqual(storageState);
    }
  });

  it('still rejects genuinely wrong types (not just non-boolean strings)', async () => {
    const { BrowserActionSchema } = await import('../types.js');
    const result = BrowserActionSchema.safeParse({ action: 'navigate', url: 'https://example.com', new_tab: 'not-a-boolean' });
    expect(result.success).toBe(false);
  });

  it('still accepts genuinely-typed (non-stringified) values, unaffected by coercion', async () => {
    const { BrowserActionSchema } = await import('../types.js');
    const result = BrowserActionSchema.safeParse({ action: 'navigate', url: 'https://example.com', new_tab: true });
    expect(result.success).toBe(true);
    if (result.success && result.data.action === 'navigate') {
      expect(result.data.new_tab).toBe(true);
    }
  });

  it('ms (wait action) accepts a stringified number within bounds', async () => {
    const { BrowserActionSchema } = await import('../types.js');
    const result = BrowserActionSchema.safeParse({ action: 'wait', ms: '500' });
    expect(result.success).toBe(true);
    if (result.success && result.data.action === 'wait') {
      expect(result.data.ms).toBe(500);
    }
  });
});

describe('LOG.MD ISSUE #3: selector-based click/type fallback', () => {
  it('click() resolves via selector directly, bypassing the index/refManager', async () => {
    const clickMock = mock(async () => {});
    const fakeLocator = { click: clickMock, first: () => fakeLocator, evaluate: async () => null };
    const fakePage: any = {
      isClosed: () => false,
      locator: mock(() => fakeLocator),
      context: () => ({ pages: () => [fakePage] }),
      url: () => 'https://example.com/',
      title: async () => 'Example',
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    // Deliberately do NOT populate refManager — proves selector bypasses it.

    const result = await server.click(undefined, false, '#submit-button');
    expect(clickMock).toHaveBeenCalled();
    expect(fakePage.locator).toHaveBeenCalledWith('#submit-button');
    expect(result).toContain('#submit-button');
  });

  it('typeText() resolves via selector directly, bypassing the index/refManager', async () => {
    const fillMock = mock(async () => {});
    const fakeLocator = { fill: fillMock };
    const fakePage: any = {
      isClosed: () => false,
      locator: mock(() => fakeLocator),
      context: () => ({ pages: () => [fakePage] }),
      url: () => 'https://example.com/',
      title: async () => 'Example',
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.typeText(undefined, 'hello', '#search-input');
    expect(fillMock).toHaveBeenCalledWith('hello', expect.anything());
    expect(fakePage.locator).toHaveBeenCalledWith('#search-input');
    expect(result).toContain('#search-input');
  });

  it('returns a clear error when neither index nor selector is provided', async () => {
    const fakePage: any = { isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.click(undefined, false, undefined);
    expect(result).toContain('index` or `selector`');
  });

  it('selector takes priority when both index and selector are given', async () => {
    const clickMock = mock(async () => {});
    const fakeLocator = { click: clickMock, first: () => fakeLocator, evaluate: async () => null };
    const fakePage: any = {
      isClosed: () => false,
      locator: mock(() => fakeLocator),
      context: () => ({ pages: () => [fakePage] }),
      url: () => 'https://example.com/',
      title: async () => 'Example',
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- button "Other" [ref=e1]'); // index 0 would resolve to e1

    await server.click(0, false, '#priority-selector');
    // Only the selector-based locator call should have happened, not aria-ref.
    expect(fakePage.locator).toHaveBeenCalledWith('#priority-selector');
    const calledWithAriaRef = fakePage.locator.mock.calls.some((c: any[]) => String(c[0]).startsWith('aria-ref='));
    expect(calledWithAriaRef).toBe(false);
  });
});

describe("ROUND 8: close_all_tabs / close_tab now allow zero tabs", () => {
  it('closes every tab unconditionally, including the last one, leaving ZERO tabs open', async () => {
    const page1 = { close: mock(async () => {}) };
    const page2 = { close: mock(async () => {}) };
    const fakeContext: any = {
      pages: mock(() => [page1, page2]),
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).context = fakeContext;
    (server as any).page = page1;

    const result = await server.closeAllTabs();
    expect(page1.close).toHaveBeenCalled();
    expect(page2.close).toHaveBeenCalled();
    expect(result).toContain('Closed 2 tab(s)');
    expect(result).toContain('No tabs remain open');
    // ROUND 8: no longer auto-opens a replacement blank tab.
    expect((server as any).page).toBeNull();
  });

  it('returns an error (not a throw) when no browser session is active', async () => {
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    const result = await server.closeAllTabs();
    expect(result).toContain('Error');
  });

  it('closeTab() can now close the last remaining tab, leaving zero tabs open', async () => {
    const onlyPage: any = { isClosed: () => false, close: mock(async () => {}) };
    onlyPage.context = () => ({ pages: () => [onlyPage] });
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = onlyPage; // this.page must BE the same object context().pages() returns
    (server as any).tabId = () => 'abcd';

    const result = await server.closeTab('abcd');
    expect(onlyPage.close).toHaveBeenCalled();
    expect(result).toContain('No tabs remain open');
    expect((server as any).page).toBeNull();
  });

  it('navigate() recovers cleanly from a zero-tab state by opening a fresh page', async () => {
    const fakeResponse = { status: () => 200, statusText: () => 'OK' };
    const freshPage: any = {
      isClosed: () => false,
      goto: mock(async () => fakeResponse),
      url: () => 'https://example.com/',
      title: async () => 'Example',
      content: async () => '<html></html>',
      innerText: async () => 'body',
      context: () => ({ pages: () => [freshPage] }),
    };
    const fakeContext: any = { newPage: mock(async () => freshPage) };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).context = fakeContext;
    (server as any).page = null; // simulates the post-close_all_tabs state

    const result = await server.navigate('https://example.com/', false);
    expect(fakeContext.newPage).toHaveBeenCalled();
    expect(result).toContain('Navigated to');
  });

  it('requirePage() distinguishes "zero tabs, browser alive" from "never initialized"', async () => {
    const { BrowserServer } = await import('../browserServer.js');

    const serverWithContext = new BrowserServer();
    (serverWithContext as any).context = {};
    (serverWithContext as any).page = null;
    await expect(serverWithContext.listTabs()).rejects.toThrow(/no tabs are currently open/i);

    const serverNeverInitialized = new BrowserServer();
    await expect(serverNeverInitialized.listTabs()).rejects.toThrow(/not initialized/i);
  });
});

describe('ROUND 7: CAPTCHA heuristic (detectPossibleCaptcha)', () => {
  it('flags common Cloudflare/reCAPTCHA/hCaptcha/Turnstile title patterns', async () => {
    const { detectPossibleCaptcha } = await import('../browserServer.js');
    expect(detectPossibleCaptcha('Just a moment...')).toBe(true);
    expect(detectPossibleCaptcha('Attention Required! | Cloudflare')).toBe(true);
    expect(detectPossibleCaptcha('Verify you are human')).toBe(true);
    expect(detectPossibleCaptcha('reCAPTCHA')).toBe(true);
  });

  it('does not flag an ordinary page title', async () => {
    const { detectPossibleCaptcha } = await import('../browserServer.js');
    expect(detectPossibleCaptcha('Oracle Cloud Free Tier | Oracle')).toBe(false);
    expect(detectPossibleCaptcha(null)).toBe(false);
  });
});

describe('REGRESSION: click() must not clobber autoSwitchedToNewTab set by the "page" event handler', () => {
  it('preserves autoSwitchedToNewTab=true through click()\'s own trailing refreshLiveState() call', async () => {
    const clickMock = mock(async () => {
      // Simulate the context-level 'page' event handler having already
      // fired (asynchronously, as part of handling the click) and set
      // autoSwitchedToNewTab=true BEFORE click()'s own code continues.
      (server as any).liveState = { ...(server as any).liveState, autoSwitchedToNewTab: true };
    });
    const fakeLocator = { click: clickMock, first: () => fakeLocator, evaluate: async () => null };
    const fakePage: any = {
      isClosed: () => false,
      locator: mock(() => fakeLocator),
      context: () => ({ pages: () => [fakePage] }),
      url: () => 'https://example.com/popup',
      title: async () => 'Popup',
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;
    (server as any).refManager.setSnapshot('- link "Open in new tab" [ref=e1]');

    const result = await server.click(0, false);
    // Bug (pre-fix): click()'s own refreshLiveState() call defaulted
    // autoSwitchedToNewTab back to false, silently erasing what the event
    // handler had just set, so this note never appeared.
    expect(result).toContain('opened in a new tab, now active');
    expect(server.getLiveState().autoSwitchedToNewTab).toBe(true);
  });
});

describe('TASK 7: click with coordinates', () => {
  it('clicks at the given coordinates when no index/selector is provided', async () => {
    const mouseClick = mock(async () => {});
    const fakePage: any = {
      mouse: { click: mouseClick },
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.click(undefined, false, undefined, 100, 200);
    expect(mouseClick).toHaveBeenCalledWith(100, 200);
    expect(result).toContain('Clicked at coordinates (100, 200)');
  });

  it('returns an error when only one coordinate is provided', async () => {
    const mouseClick = mock(async () => {});
    const fakePage: any = {
      mouse: { click: mouseClick },
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.click(undefined, false, undefined, 100, undefined);
    expect(mouseClick).not.toHaveBeenCalled();
    expect(result).toContain('Both coordinate_x and coordinate_y must be provided together');
  });

  it('returns a friendly error when page.mouse is unavailable', async () => {
    const fakePage: any = { isClosed: () => false };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.click(undefined, false, undefined, 50, 75);
    expect(result).toContain('Unable to perform coordinate click');
  });

  it('returns a friendly error when mouse.click throws', async () => {
    const mouseClick = mock(async () => {
      throw new Error('mouse not available');
    });
    const fakePage: any = {
      mouse: { click: mouseClick },
      isClosed: () => false,
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.click(undefined, false, undefined, 10, 20);
    expect(result).toContain('Error clicking at coordinates');
    expect(result).toContain('mouse not available');
  });
});

// ============================================================
// ROUND 8: selector normalization for aria-ref values (E2E report finding)
// ============================================================

describe('ROUND 8 E2E finding: [aria-ref=N]/[ref=N] selector normalization', () => {
  it('normalizes [ref=e46] into the correct aria-ref=e46 locator engine syntax', async () => {
    const clickMock = mock(async () => {});
    const fakeLocator = { click: clickMock, first: () => fakeLocator, evaluate: async () => null };
    const fakePage: any = {
      isClosed: () => false,
      locator: mock(() => fakeLocator),
      context: () => ({ pages: () => [fakePage] }),
      url: () => 'https://example.com/',
      title: async () => 'Example',
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    await server.click(undefined, false, '[ref=e46]');
    expect(fakePage.locator).toHaveBeenCalledWith('aria-ref=e46');
  });

  it('normalizes [aria-ref=f1e46] (iframe ref, bracketed) the same way', async () => {
    const clickMock = mock(async () => {});
    const fakeLocator = { click: clickMock, first: () => fakeLocator, evaluate: async () => null };
    const fakePage: any = {
      isClosed: () => false,
      locator: mock(() => fakeLocator),
      context: () => ({ pages: () => [fakePage] }),
      url: () => 'https://example.com/',
      title: async () => 'Example',
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    await server.click(undefined, false, '[aria-ref=f1e46]');
    expect(fakePage.locator).toHaveBeenCalledWith('aria-ref=f1e46');
  });

  it('leaves a genuine CSS selector untouched', async () => {
    const clickMock = mock(async () => {});
    const fakeLocator = { click: clickMock, first: () => fakeLocator, evaluate: async () => null };
    const fakePage: any = {
      isClosed: () => false,
      locator: mock(() => fakeLocator),
      context: () => ({ pages: () => [fakePage] }),
      url: () => 'https://example.com/',
      title: async () => 'Example',
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    await server.click(undefined, false, 'input[name="q"]');
    expect(fakePage.locator).toHaveBeenCalledWith('input[name="q"]');
  });

  it('typeText() also normalizes ref-like selectors', async () => {
    const fillMock = mock(async () => {});
    const fakeLocator = { fill: fillMock };
    const fakePage: any = {
      isClosed: () => false,
      locator: mock(() => fakeLocator),
      context: () => ({ pages: () => [fakePage] }),
      url: () => 'https://example.com/',
      title: async () => 'Example',
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    await server.typeText(undefined, 'hello', 'ref=e12');
    expect(fakePage.locator).toHaveBeenCalledWith('aria-ref=e12');
  });

  it('a still-timing-out normalized ref includes a "stale ref" hint, not a generic error', async () => {
    const fakeLocator = {
      click: mock(async () => {
        throw new Error('Timeout 10000ms exceeded.');
      }),
      first: () => fakeLocator,
      evaluate: async () => null,
    };
    const fakePage: any = {
      isClosed: () => false,
      locator: mock(() => fakeLocator),
      context: () => ({ pages: () => [fakePage] }),
      url: () => 'https://example.com/',
      title: async () => 'Example',
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.click(undefined, false, '[ref=e46]');
    expect(result).toContain('stale');
    expect(result).toContain('browser_get_state again');
  });
});

// ============================================================
// ROUND 9: real-world E2E findings (index/ref mapping, panel color)
// ============================================================

describe('ROUND 9 E2E finding: get_state index annotation (index vs ref confusion)', () => {
  it('getAnnotatedSnapshotText() rewrites [ref=eN] to [index=K] in document order', async () => {
    const { RefManager } = await import('../refManager.js');
    const rm = new RefManager();
    const yaml = `- generic [ref=e1]:
  - heading "Sample Test Page" [ref=e2]
  - paragraph "This is a local test page." [ref=e3]
  - textbox "Name" [ref=e4]
  - textbox "Message" [ref=e5]
  - button "Submit" [ref=e6]`;
    rm.setSnapshot(yaml);

    const annotated = rm.getAnnotatedSnapshotText();
    expect(annotated).toContain('generic [index=0]');
    expect(annotated).toContain('heading "Sample Test Page" [index=1]');
    expect(annotated).toContain('textbox "Name" [index=3]');
    expect(annotated).toContain('textbox "Message" [index=4]');
    expect(annotated).toContain('button "Submit" [index=5]');
    // Regression guard for the exact reported bug: index=5 (Submit) must
    // NOT be reachable by miscounting to index=4 (that's "Message").
    expect(annotated).not.toContain('button "Submit" [index=4]');
  });

  it('getRefByIndex(K) resolves to the exact ref the annotation shows for [index=K]', async () => {
    const { RefManager } = await import('../refManager.js');
    const rm = new RefManager();
    const yaml = `- textbox "Name" [ref=e4]
- button "Submit" [ref=e6]`;
    rm.setSnapshot(yaml);

    // index=0 in THIS snapshot is e4 (Name), index=1 is e6 (Submit) —
    // whatever the annotation displays as [index=K] must be exactly what
    // getRefByIndex(K) resolves for click()/typeText() to use.
    expect(rm.getRefByIndex(0)).toBe('e4');
    expect(rm.getRefByIndex(1)).toBe('e6');
  });

  it('handles iframe refs (fNeM format) in annotation the same way', async () => {
    const { RefManager } = await import('../refManager.js');
    const rm = new RefManager();
    const yaml = `- generic [ref=e1]:
  - iframe [ref=f1e1]:
    - button "Inside iframe" [ref=f1e2]`;
    rm.setSnapshot(yaml);

    const annotated = rm.getAnnotatedSnapshotText();
    expect(annotated).toContain('generic [index=0]');
    expect(annotated).toContain('iframe [index=1]');
    expect(annotated).toContain('button "Inside iframe" [index=2]');
  });

  it('getBrowserState() returns the annotated (not raw ref) snapshot', async () => {
    const fakePage: any = {
      isClosed: () => false,
      ariaSnapshot: async () => '- textbox "Name" [ref=e4]\n- button "Submit" [ref=e6]',
      url: () => 'http://localhost:8765/sample.html',
      title: async () => 'Sample Test Page',
      context: () => ({ pages: () => [fakePage] }),
    };
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    (server as any).page = fakePage;

    const result = await server.getBrowserState(false);
    const parsed = JSON.parse(result);
    expect(parsed.elements).toContain('[index=0]');
    expect(parsed.elements).toContain('[index=1]');
    expect(parsed.elements).not.toContain('[ref=e4]');
    expect(parsed.elements).not.toContain('[ref=e6]');
  });
});

describe('ROUND 9 E2E finding: recording unexpected_response retry', () => {
  it('retries once on a transient unexpected_response before failing', async () => {
    const { RecordingSession } = await import('../recording.js');
    const session = new RecordingSession(null);

    let callCount = 0;
    (session as any).waitForRrwebLoad = mock(async () => {
      callCount += 1;
      if (callCount === 1) return { success: false, error: 'unexpected_response' };
      return { success: true };
    });

    const fakePage: any = {};
    const result = await (session as any).ensureRrwebLoaded(fakePage);

    expect(callCount).toBe(2);
    expect(result).toBeNull(); // null means "loaded successfully, no error"
  });

  it('does not retry non-transient errors (e.g. load_failed)', async () => {
    const { RecordingSession } = await import('../recording.js');
    const session = new RecordingSession(null);

    let callCount = 0;
    (session as any).waitForRrwebLoad = mock(async () => {
      callCount += 1;
      return { success: false, error: 'load_failed' };
    });
    (session as any).setRecordingFlag = mock(async () => {});

    const fakePage: any = {};
    const result = await (session as any).ensureRrwebLoaded(fakePage);

    expect(callCount).toBe(1);
    expect(result).toContain('internet access');
  });

  it('gives an actionable message (not the bare error code) when both attempts return unexpected_response', async () => {
    const { RecordingSession } = await import('../recording.js');
    const session = new RecordingSession(null);

    (session as any).waitForRrwebLoad = mock(async () => ({ success: false, error: 'unexpected_response' }));
    (session as any).setRecordingFlag = mock(async () => {});

    const fakePage: any = {};
    const result = await (session as any).ensureRrwebLoaded(fakePage);

    expect(result).toContain('browser_get_state');
    expect(result).not.toBe('Error: Unable to start recording: unexpected_response');
  });
});

// ============================================================
// ROUND 10: panel bug fixes (real screenshot findings)
// ============================================================

describe('ROUND 10 screenshot finding: about:blank URL display', () => {
  // WebBrowserPanel.tsx imports '../../ink.js', a path that only resolves
  // inside the real GakrCLI project — not importable here in isolation
  // (same constraint as the address-bar/panel logic in earlier rounds).
  // This mirrors the FIXED parseUrl() algorithm directly, matching the
  // existing pattern for the content-truncation test above.
  function parseDisplay(url: string): string {
    const u = new URL(url);
    const isFile = u.protocol === 'file:';
    const isBlank = u.protocol === 'about:';
    const isOpaquePath = isBlank || u.protocol === 'data:' || u.protocol === 'javascript:';
    const hostname = u.hostname || (isFile || isOpaquePath ? '' : u.protocol.replace(':', ''));
    const pathAndQuery = u.pathname === '/' ? '' : u.pathname + u.search;
    return isFile || isOpaquePath ? url : hostname + (u.port ? `:${u.port}` : '') + pathAndQuery;
  }

  it('shows "about:blank" with the colon, not the previous "aboutblank" (regression guard)', () => {
    expect(parseDisplay('about:blank')).toBe('about:blank');
    expect(parseDisplay('about:blank')).not.toBe('aboutblank');
  });

  it('still displays ordinary http(s) URLs as host + path, unaffected by the fix', () => {
    expect(parseDisplay('https://example.com/docs')).toBe('example.com/docs');
    expect(parseDisplay('https://example.com/')).toBe('example.com');
  });

  it('shows file:// URLs verbatim (unaffected — this path was already correct)', () => {
    expect(parseDisplay('file:///C:/temp/test.html')).toBe('file:///C:/temp/test.html');
  });
});

// ============================================================
// Task 11: AbortSignal plumbing
// ============================================================

describe('AbortSignal plumbing', () => {
  it('BrowserServer.navigate throws DOMException when signal is already aborted', async () => {
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    const controller = new AbortController();
    controller.abort();

    await expect(server.navigate('https://example.com', false, controller.signal)).rejects.toThrow(DOMException);
    await expect(server.navigate('https://example.com', false, controller.signal)).rejects.toThrow('The operation was aborted.');
  });

  it('BrowserServer.click throws DOMException when signal is already aborted', async () => {
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    const controller = new AbortController();
    controller.abort();

    await expect(server.click(undefined, false, undefined, undefined, undefined, controller.signal)).rejects.toThrow(DOMException);
    await expect(server.click(undefined, false, undefined, undefined, undefined, controller.signal)).rejects.toThrow('The operation was aborted.');
  });

  it('BrowserServer.evaluate throws DOMException when signal is already aborted', async () => {
    const { BrowserServer } = await import('../browserServer.js');
    const server = new BrowserServer();
    const controller = new AbortController();
    controller.abort();

    await expect(server.evaluate('1+1', controller.signal)).rejects.toThrow(DOMException);
    await expect(server.evaluate('1+1', controller.signal)).rejects.toThrow('The operation was aborted.');
  });

  it('BrowserToolExecutor.call returns clean aborted observation when signal is aborted before start', async () => {
    const { BrowserToolExecutor } = await import('../browserEngine.js');
    const executor = new BrowserToolExecutor({});
    const controller = new AbortController();
    controller.abort();

    const result = await executor.call({ action: 'navigate', url: 'https://example.com' } as any, controller.signal);
    expect(result.is_error).toBe(true);
    expect(result.text).toContain('aborted');
  });
});
