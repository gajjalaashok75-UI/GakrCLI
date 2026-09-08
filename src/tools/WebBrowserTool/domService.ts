/**
 * DomService — runs DOM_TREE_SCRIPT against a live page and turns its
 * serialized output into a DOMState (element_tree + selector_map).
 *
 * LAYER 1 — GakrCLI-AGNOSTIC. Ported from browser-use-main's
 * `src/dom/service.ts` (MIT-licensed, github.com/browser-use/browser-use):
 * `get_clickable_elements`/`_build_dom_tree`/`_construct_dom_tree`/
 * `_parse_node` port essentially 1:1 (single page.evaluate round trip,
 * budget-limited extraction, then a two-pass id-map -> tree reconstruction).
 * Dropped: the `@observe_debug`/`@time_execution_async` telemetry
 * decorators (not part of this project's conventions — the methods just
 * run directly) and `get_cross_origin_iframes` (iframe security-domain
 * policy is an agent/session-level concern this stateless tool doesn't
 * own). `detect_pagination_buttons` lives on domTypes.ts instead of here,
 * since it only touches the already-built SelectorMap.
 */

import type { Page } from 'playwright';
import { DOM_TREE_SCRIPT } from './domTreeScript.js';
import { DOMBaseNode, DOMElementNode, DOMState, DOMTextNode, type SelectorMap } from './domTypes.js';

// DOM contents are controlled by the visited page — keep the evaluated
// script's own work bounded so a hostile or accidentally enormous document
// cannot exhaust the browser or Node process. Mirrors browser-use's
// defaults; see DOM_TREE_SCRIPT's own use of these via `args.domLimits`.
const DOM_EXTRACTION_LIMITS = {
  maxVisitedNodes: 100_000,
  maxSerializedNodes: 30_000,
  maxDepth: 512,
  maxTextLength: 16_384,
  maxAttributeNameLength: 256,
  maxAttributeValueLength: 8_192,
  maxAttributesPerNode: 100,
  maxSerializedStringLength: 8 * 1024 * 1024,
} as const;

type SerializedDOMNode = {
  type?: string;
  text?: string;
  isVisible?: boolean;
  tagName?: string;
  xpath?: string;
  attributes?: Record<string, string>;
  children?: Array<number | string>;
  isInteractive?: boolean;
  isTopElement?: boolean;
  isInViewport?: boolean;
  shadowRoot?: boolean;
  highlightIndex?: number | null;
};

type SerializedDOMTree = {
  rootId: string | number | null;
  map: Record<string, SerializedDOMNode>;
  metadata?: {
    truncated?: boolean;
    visitedNodeCount?: number;
    serializedNodeCount?: number;
    serializedStringLength?: number;
  };
};

export interface BuildDomTreeOptions {
  /** Draw on-page highlight overlays for interactive elements (for screenshots). Default: false. */
  highlightElements?: boolean;
  /** When >= 0 with highlightElements, only that single index is drawn. Default: -1 (all). */
  focusElement?: number;
  /** Pixels beyond the viewport edge still considered "in viewport". 0 = strict; -1 = unbounded (whole page). Default: 0. */
  viewportExpansion?: number;
}

export interface DomTreeMetadata {
  truncated: boolean;
  visitedNodeCount: number;
  serializedNodeCount: number;
}

/** `new tab` / blank pages the extraction script has nothing useful to walk. */
function isBlankOrInternalPage(url: string): boolean {
  return url === 'about:blank' || url === '' || url.startsWith('chrome://') || url.startsWith('devtools://');
}

export class DomService {
  constructor(private readonly page: Page) {}

  /**
   * Builds the interactive-element tree for the current page. Returns the
   * DOMState (tree + selector_map) alongside the script's own truncation
   * metadata, so callers can surface a "page was very large, results may
   * be incomplete" hint without re-deriving it.
   */
  async getClickableElements(opts: BuildDomTreeOptions = {}): Promise<{ state: DOMState; metadata: DomTreeMetadata }> {
    // Upstream's default is `true`; we default to `false` because this tool
    // only wants overlays painted on a get_state-with-screenshot call (see
    // browserServer.refreshDomTree's caller at line ~1432, which always
    // passes the explicit value).
    const { highlightElements = false, focusElement = -1, viewportExpansion = 0 } = opts;

    const pageUrl = this.page.url();
    if (isBlankOrInternalPage(pageUrl)) {
      return {
        state: new DOMState(new DOMElementNode(false, null, 'body', '/body', {}, []), {}),
        metadata: { truncated: false, visitedNodeCount: 0, serializedNodeCount: 0 },
      };
    }

    const args = {
      doHighlightElements: highlightElements,
      focusHighlightIndex: focusElement,
      viewportExpansion,
      debugMode: false,
      domLimits: DOM_EXTRACTION_LIMITS,
    };

    const evalPage = await this.page.evaluate<SerializedDOMTree, { script: string; evaluateArgs: typeof args }>(
      ({ script, evaluateArgs }) => {
        // eslint-disable-next-line no-eval -- see domTreeScript.ts's header: this
        // is the exact invocation convention the ported script expects.
        const fn = eval(script) as (a: typeof args) => SerializedDOMTree;
        return fn(evaluateArgs);
      },
      { script: DOM_TREE_SCRIPT, evaluateArgs: args },
    );

    const { element_tree, selector_map } = this.constructDomTree(evalPage);
    return {
      state: new DOMState(element_tree, selector_map),
      metadata: {
        truncated: Boolean(evalPage.metadata?.truncated),
        visitedNodeCount: evalPage.metadata?.visitedNodeCount ?? 0,
        serializedNodeCount: evalPage.metadata?.serializedNodeCount ?? 0,
      },
    };
  }

  /** Also removes any highlight overlays the last highlighted build left on the page. */
  async removeHighlights(): Promise<void> {
    try {
      await this.page.evaluate(() => {
        const cleanupFns = Array.isArray((window as any)._highlightCleanupFunctions)
          ? (window as any)._highlightCleanupFunctions
          : [];
        for (const fn of cleanupFns) {
          try {
            if (typeof fn === 'function') fn();
          } catch {
            // best-effort cleanup
          }
        }
        (window as any)._highlightCleanupFunctions = [];
        const container = document.getElementById('playwright-highlight-container');
        if (container) container.remove();
      });
    } catch {
      // Page may have navigated away already — nothing to clean up.
    }
  }

  private constructDomTree(evalPage: SerializedDOMTree): { element_tree: DOMElementNode; selector_map: SelectorMap } {
    const selector_map: SelectorMap = {};
    const nodeMap = new Map<string, DOMBaseNode>();
    const childIndex = new Map<string, Array<number | string>>();

    for (const [id, nodeData] of Object.entries(evalPage.map ?? {})) {
      const [node, children] = this.parseNode(nodeData);
      if (!node) continue;
      nodeMap.set(id, node);
      childIndex.set(id, children);
      if (node instanceof DOMElementNode && node.highlight_index !== null && node.highlight_index !== undefined) {
        selector_map[node.highlight_index] = node;
      }
    }

    for (const [id, childrenIds] of childIndex.entries()) {
      const parentNode = nodeMap.get(id);
      if (!(parentNode instanceof DOMElementNode)) continue;
      for (const childId of childrenIds ?? []) {
        const childNode = nodeMap.get(String(childId));
        if (!childNode) continue;
        childNode.parent = parentNode;
        parentNode.children.push(childNode);
      }
    }

    const rootNode = evalPage.rootId !== null ? nodeMap.get(String(evalPage.rootId)) : undefined;
    if (!(rootNode instanceof DOMElementNode)) {
      // A page the script genuinely couldn't walk (rare — e.g. document.body
      // missing entirely). Degrade to an empty tree rather than throwing, so
      // get_state can still report SOMETHING (url, tabs, scroll) instead of
      // failing the whole action.
      return { element_tree: new DOMElementNode(false, null, 'body', '/body', {}, []), selector_map: {} };
    }
    return { element_tree: rootNode, selector_map };
  }

  private parseNode(nodeData: SerializedDOMNode): [DOMBaseNode | null, Array<number | string>] {
    if (!nodeData) return [null, []];
    if (nodeData.type === 'TEXT_NODE') {
      return [new DOMTextNode(nodeData.isVisible ?? false, null, nodeData.text ?? ''), []];
    }
    const children = Array.isArray(nodeData.children) ? nodeData.children : [];
    const element = new DOMElementNode(
      nodeData.isVisible ?? false,
      null,
      nodeData.tagName ?? 'div',
      nodeData.xpath ?? '',
      nodeData.attributes ?? {},
      [],
    );
    element.is_interactive = Boolean(nodeData.isInteractive);
    element.is_top_element = Boolean(nodeData.isTopElement);
    element.is_in_viewport = Boolean(nodeData.isInViewport);
    element.shadow_root = Boolean(nodeData.shadowRoot);
    element.highlight_index =
      nodeData.highlightIndex === undefined || nodeData.highlightIndex === null ? null : Number(nodeData.highlightIndex);
    return [element, children];
  }
}
