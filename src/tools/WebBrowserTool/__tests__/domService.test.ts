import { describe, it, expect } from 'bun:test';
import { DomService } from '../domService.js';
import { detectPaginationButtons } from '../domTypes.js';

// ============================================================
// DOM-tree/highlight-index system — the get_state/click/type mechanism
// ported from browser-use (see domTreeScript.ts/domService.ts/domTypes.ts
// header comments for the full port rationale). These tests exercise the
// REAL parser (DomService.getClickableElements()) against a hand-built
// SerializedDOMTree fixture — the same shape DOM_TREE_SCRIPT itself
// returns from inside the page — so they catch parser bugs without
// needing a real browser.
// ============================================================

function fakePage(evalResult: unknown, url = 'https://example.com/') {
  return { url: () => url, evaluate: async () => evalResult } as any;
}

describe('DomService.getClickableElements()', () => {
  it('builds a selector map keyed by highlightIndex', async () => {
    const tree = {
      rootId: 'root',
      map: {
        root: { tagName: 'body', xpath: '/html/body', attributes: {}, children: ['btn', 'txt'], isVisible: true, isTopElement: true },
        btn: {
          tagName: 'button',
          xpath: '/html/body/button[1]',
          attributes: { id: 'submit' },
          children: ['btnText'],
          isVisible: true,
          isInteractive: true,
          isTopElement: true,
          isInViewport: true,
          highlightIndex: 0,
        },
        btnText: { type: 'TEXT_NODE', text: 'Submit', isVisible: true },
        txt: { type: 'TEXT_NODE', text: 'Welcome', isVisible: true },
      },
      metadata: { truncated: false, visitedNodeCount: 4, serializedNodeCount: 4 },
    };

    const { state, metadata } = await new DomService(fakePage(tree)).getClickableElements();
    expect(Object.keys(state.selector_map)).toEqual(['0']);
    expect(state.selector_map[0].tag_name).toBe('button');
    expect(state.selector_map[0].xpath).toBe('/html/body/button[1]');
    expect(state.selector_map[0].attributes.id).toBe('submit');
    expect(metadata.truncated).toBe(false);
  });

  it('llm_representation() renders "[index]<tag attr>text</tag />" lines', async () => {
    const tree = {
      rootId: 'root',
      map: {
        root: { tagName: 'body', xpath: '/html/body', attributes: {}, children: ['btn'], isVisible: true, isTopElement: true },
        btn: {
          tagName: 'button',
          xpath: '/html/body/button[1]',
          attributes: { 'aria-label': 'Submit' },
          children: ['btnText'],
          isVisible: true,
          isInteractive: true,
          isTopElement: true,
          isInViewport: true,
          highlightIndex: 0,
        },
        btnText: { type: 'TEXT_NODE', text: 'Submit', isVisible: true },
      },
      metadata: {},
    };

    const { state } = await new DomService(fakePage(tree)).getClickableElements();
    const text = state.llm_representation();
    expect(text).toContain('[0]<button');
    expect(text).toContain('Submit');
    // An aria-label that exactly duplicates the element's own visible text
    // is dropped to keep lines short (see clickable_elements_to_string()).
    expect(text).not.toContain('aria-label=Submit');
  });

  it('never lets a password field value leak into the tree (sanitizeDomAttributes)', async () => {
    const tree = {
      rootId: 'root',
      map: {
        root: { tagName: 'body', xpath: '/html/body', attributes: {}, children: ['pwd'], isVisible: true, isTopElement: true },
        pwd: {
          tagName: 'input',
          xpath: '/html/body/input[1]',
          attributes: { type: 'password', value: 'hunter2', name: 'password' },
          children: [],
          isVisible: true,
          isInteractive: true,
          isTopElement: true,
          isInViewport: true,
          highlightIndex: 0,
        },
      },
      metadata: {},
    };

    const { state } = await new DomService(fakePage(tree)).getClickableElements();
    expect(state.selector_map[0].attributes.value).toBeUndefined();
    expect(state.selector_map[0].attributes.name).toBe('password');
  });

  it('is_new is always null (no cross-step diffing for a stateless per-call tool)', async () => {
    const tree = {
      rootId: 'root',
      map: {
        root: { tagName: 'body', xpath: '/html/body', attributes: {}, children: ['btn'], isVisible: true, isTopElement: true },
        btn: {
          tagName: 'button', xpath: '/html/body/button[1]', attributes: {}, children: [],
          isVisible: true, isInteractive: true, isTopElement: true, isInViewport: true, highlightIndex: 0,
        },
      },
      metadata: {},
    };
    const { state } = await new DomService(fakePage(tree)).getClickableElements();
    expect(state.selector_map[0].is_new).toBeNull();
    expect(state.llm_representation().startsWith('[0]')).toBe(true); // never "*[0]"
  });

  it('returns an empty tree for about:blank without evaluating the page', async () => {
    let evaluateCalled = false;
    const page = { url: () => 'about:blank', evaluate: async () => { evaluateCalled = true; return {}; } } as any;
    const { state } = await new DomService(page).getClickableElements();
    expect(Object.keys(state.selector_map).length).toBe(0);
    expect(evaluateCalled).toBe(false);
  });
});

describe('detectPaginationButtons()', () => {
  it('recognizes next/prev/page-number buttons by text and attributes', async () => {
    const tree = {
      rootId: 'root',
      map: {
        root: { tagName: 'nav', xpath: '/html/body/nav', attributes: {}, children: ['next', 'prev', 'p2', 'unrelated'], isVisible: true, isTopElement: true },
        next: {
          tagName: 'button', xpath: '/html/body/nav/button[1]', attributes: { 'aria-label': 'Next page' }, children: [],
          isVisible: true, isInteractive: true, isTopElement: true, isInViewport: true, highlightIndex: 0,
        },
        prev: {
          tagName: 'button', xpath: '/html/body/nav/button[2]', attributes: { disabled: 'true' }, children: ['prevText'],
          isVisible: true, isInteractive: true, isTopElement: true, isInViewport: true, highlightIndex: 1,
        },
        prevText: { type: 'TEXT_NODE', text: 'Previous', isVisible: true },
        p2: {
          tagName: 'a', xpath: '/html/body/nav/a[1]', attributes: { role: 'button' }, children: ['p2Text'],
          isVisible: true, isInteractive: true, isTopElement: true, isInViewport: true, highlightIndex: 2,
        },
        p2Text: { type: 'TEXT_NODE', text: '2', isVisible: true },
        unrelated: {
          tagName: 'button', xpath: '/html/body/nav/button[3]', attributes: {}, children: ['unrelatedText'],
          isVisible: true, isInteractive: true, isTopElement: true, isInViewport: true, highlightIndex: 3,
        },
        unrelatedText: { type: 'TEXT_NODE', text: 'Add to cart', isVisible: true },
      },
      metadata: {},
    };
    const { state } = await new DomService(fakePage(tree)).getClickableElements();
    const buttons = detectPaginationButtons(state.selector_map);

    expect(buttons.find((b) => b.index === 0)?.button_type).toBe('next');
    expect(buttons.find((b) => b.index === 1)?.button_type).toBe('prev');
    expect(buttons.find((b) => b.index === 1)?.is_disabled).toBe(true);
    expect(buttons.find((b) => b.index === 2)?.button_type).toBe('page_number');
    expect(buttons.find((b) => b.index === 3)).toBeUndefined();
  });

  it('returns an empty array when there is nothing pagination-like', async () => {
    const tree = {
      rootId: 'root',
      map: {
        root: { tagName: 'body', xpath: '/html/body', attributes: {}, children: ['btn'], isVisible: true, isTopElement: true },
        btn: {
          tagName: 'button', xpath: '/html/body/button[1]', attributes: {}, children: ['t'],
          isVisible: true, isInteractive: true, isTopElement: true, isInViewport: true, highlightIndex: 0,
        },
        t: { type: 'TEXT_NODE', text: 'Add to cart', isVisible: true },
      },
      metadata: {},
    };
    const { state } = await new DomService(fakePage(tree)).getClickableElements();
    expect(detectPaginationButtons(state.selector_map)).toEqual([]);
  });
});
