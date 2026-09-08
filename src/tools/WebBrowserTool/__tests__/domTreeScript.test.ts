/**
 * Tests for the inlined DOM_TREE_SCRIPT constant in `domTreeScript.ts`.
 *
 * Mirrors this project's existing convention for injected-script constants
 * (see jsScripts.test.ts, which does the same for recording.ts's inlined
 * scripts): verify the constant is present, non-empty, and its body is
 * syntactically valid JavaScript that evaluates to a callable function —
 * without needing a real browser page to actually run it in (that would
 * require a DOM implementation like jsdom, which this project doesn't
 * otherwise depend on; domService.test.ts covers the PARSING side against
 * hand-built fixtures in the script's own output shape instead).
 */

import { describe, it, expect } from 'bun:test';
import { DOM_TREE_SCRIPT } from '../domTreeScript.js';

describe('DOM_TREE_SCRIPT', () => {
  it('is present and non-empty', () => {
    expect(typeof DOM_TREE_SCRIPT).toBe('string');
    expect(DOM_TREE_SCRIPT.length).toBeGreaterThan(1000);
  });

  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(DOM_TREE_SCRIPT)).not.toThrow();
  });

  it('evaluates (via the exact `eval()` invocation domService.ts uses) to a callable function', () => {
    // eslint-disable-next-line no-eval -- matching domService.ts's own invocation convention exactly.
    const fn = eval(DOM_TREE_SCRIPT);
    expect(typeof fn).toBe('function');
  });

  it('does not reference Node-only or module globals (require/import/module/exports) — it must run standalone inside a page', () => {
    // A loose guard, not a full static-analysis check: the ported script is
    // meant to run entirely inside the browser's own JS sandbox with zero
    // external dependencies. `module`/`exports`/`require(` as bare
    // identifiers would indicate it accidentally picked up CommonJS wrapping
    // during the port; `eval(DOM_TREE_SCRIPT)` above already proves it has
    // no static `import`/`export` syntax (those would be a SyntaxError
    // outside a module context), so this only needs to additionally rule
    // out the CommonJS globals.
    expect(/\brequire\s*\(/.test(DOM_TREE_SCRIPT)).toBe(false);
    expect(/\bmodule\.exports\b/.test(DOM_TREE_SCRIPT)).toBe(false);
  });
});
