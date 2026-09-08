/**
 * DOM tree node types + selector map — the data model behind the
 * highlight-index element system (get_state/click/type).
 *
 * LAYER 1 — GakrCLI-AGNOSTIC. Ported from browser-use-main's
 * `src/dom/views.ts` (MIT-licensed, github.com/browser-use/browser-use),
 * trimmed to what a stateless single-call tool needs:
 *   - KEPT: DOMBaseNode/DOMTextNode/DOMElementNode, DEFAULT_INCLUDE_ATTRIBUTES,
 *     clickable_elements_to_string() (the "[index]<tag attr>text</tag />"
 *     serialization the LLM reads), get_all_text_till_next_clickable_element(),
 *     the password-value attribute redaction, SelectorMap, DOMState.
 *   - DROPPED: HistoryTreeProcessor-based element hashing and `is_new`
 *     cross-step diffing. That machinery exists so a browsing AGENT can tell
 *     "which elements are new since my last step" across its own action
 *     loop — this tool has no concept of an agent step (GakrCLI calls it
 *     once per action and owns any multi-step loop itself), so `is_new`
 *     is always `null` here and the highlight indicator is always `[N]`,
 *     never `*[N]`. `hash`/`cached_hash` are dropped along with it.
 *   - DROPPED: the `time_execution_sync` perf-logging decorator wrapper —
 *     not part of this project's logging conventions; the function runs
 *     directly instead.
 */

export abstract class DOMBaseNode {
  constructor(
    public is_visible: boolean,
    public parent: DOMElementNode | null = null,
  ) {}

  abstract toJSON(): Record<string, unknown>;
}

export class DOMTextNode extends DOMBaseNode {
  type = 'TEXT_NODE';

  constructor(is_visible: boolean, parent: DOMElementNode | null, public text: string) {
    super(is_visible, parent);
  }

  has_parent_with_highlight_index(): boolean {
    let current = this.parent;
    while (current) {
      if (current.highlight_index !== null && current.highlight_index !== undefined) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  toJSON() {
    return { text: this.text, type: this.type };
  }
}

/** Attributes worth showing the LLM when an element is interactive. */
export const DEFAULT_INCLUDE_ATTRIBUTES = [
  'title', 'type', 'checked', 'id', 'name', 'role', 'value', 'placeholder',
  'data-date-format', 'alt', 'aria-label', 'aria-expanded', 'data-state',
  'aria-checked', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow',
  'aria-placeholder', 'pattern', 'min', 'max', 'minlength', 'maxlength',
  'step', 'accept', 'multiple', 'inputmode', 'autocomplete', 'aria-autocomplete',
  'list', 'data-mask', 'data-inputmask', 'data-datepicker', 'format', 'expected_format',
  'contenteditable', 'pseudo', 'selected', 'expanded', 'pressed',
  'disabled', 'invalid', 'valuemin', 'valuemax', 'valuenow', 'keyshortcuts',
  'haspopup', 'multiselectable', 'required', 'valuetext', 'level', 'busy', 'live', 'ax_name',
];

const PASSWORD_VALUE_ATTRIBUTE_NAMES = new Set(['value', 'valuetext', 'aria-valuetext']);

/** Never let a password field's current value leak into the LLM-visible tree. */
function sanitizeDomAttributes(tagName: string, attributes: Record<string, string>): Record<string, string> {
  if (tagName.trim().toLowerCase() !== 'input') return attributes;
  const type = Object.entries(attributes).find(([key]) => key.toLowerCase() === 'type')?.[1];
  if (String(type ?? '').trim().toLowerCase() !== 'password') return attributes;
  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => !PASSWORD_VALUE_ATTRIBUTE_NAMES.has(key.toLowerCase())),
  );
}

export class DOMElementNode extends DOMBaseNode {
  is_interactive = false;
  is_top_element = false;
  is_in_viewport = false;
  shadow_root = false;
  highlight_index: number | null = null;
  viewport_coordinates: unknown = null;
  page_coordinates: unknown = null;
  viewport_info: unknown = null;
  /** Always null — see the file header on why cross-step "is_new" diffing is out of scope. */
  is_new: boolean | null = null;
  public attributes: Record<string, string>;

  constructor(
    is_visible: boolean,
    parent: DOMElementNode | null,
    public tag_name: string,
    public xpath: string,
    attributes: Record<string, string>,
    public children: DOMBaseNode[],
  ) {
    super(is_visible, parent);
    this.attributes = sanitizeDomAttributes(tag_name, attributes);
  }

  toJSON() {
    return {
      tag_name: this.tag_name,
      xpath: this.xpath,
      attributes: this.attributes,
      is_visible: this.is_visible,
      is_interactive: this.is_interactive,
      is_top_element: this.is_top_element,
      is_in_viewport: this.is_in_viewport,
      shadow_root: this.shadow_root,
      highlight_index: this.highlight_index,
      children: this.children.map((child) => child.toJSON()),
    };
  }

  get_all_text_till_next_clickable_element(max_depth = -1): string {
    const text_parts: string[] = [];
    const collect = (node: DOMBaseNode, depth: number) => {
      if (max_depth !== -1 && depth > max_depth) return;
      if (node instanceof DOMElementNode && node !== this && node.highlight_index !== null && node.highlight_index !== undefined) {
        return;
      }
      if (node instanceof DOMTextNode) {
        text_parts.push(node.text);
      } else if (node instanceof DOMElementNode) {
        for (const child of node.children) collect(child, depth + 1);
      }
    };
    collect(this, 0);
    return text_parts.join('\n').trim();
  }

  /**
   * Renders the interactive subtree as one line per highlighted element:
   *   [3]<button aria-label=Submit>Submit />
   * Indices match `SelectorMap` keys 1:1 — this is the text the LLM reads
   * from get_state, and `index` in click/type resolves back through the
   * same map.
   */
  clickable_elements_to_string(include_attributes?: string[]): string {
    const formatted: string[] = [];
    const attributes_list = include_attributes ?? DEFAULT_INCLUDE_ATTRIBUTES;

    const process = (node: DOMBaseNode, depth: number) => {
      let working_depth = depth;
      if (node instanceof DOMElementNode) {
        const depth_str = '\t'.repeat(depth);
        if (node.highlight_index !== null && node.highlight_index !== undefined) {
          working_depth += 1;
          let text = node.get_all_text_till_next_clickable_element();
          let attributes_html_str: string | null = null;

          if (attributes_list.length) {
            const included = Object.fromEntries(
              Object.entries(node.attributes).filter(
                ([key, value]) => attributes_list.includes(key) && String(value).trim() !== '',
              ).map(([key, value]) => [key, String(value).trim()]),
            );

            // Drop attributes whose value duplicates another attribute already
            // being shown (e.g. aria-label repeating id) to keep lines short.
            const ordered_keys = attributes_list.filter((k) => k in included);
            if (ordered_keys.length > 1) {
              const seen: Record<string, string> = {};
              const remove = new Set<string>();
              for (const key of ordered_keys) {
                const value = included[key];
                if (value && value.length > 5) {
                  if (seen[value]) remove.add(key);
                  else seen[value] = key;
                }
              }
              for (const key of remove) delete included[key];
            }
            if (node.tag_name === included.role) delete included.role;
            for (const attr of ['aria-label', 'placeholder', 'title']) {
              if (included[attr] && included[attr].trim().toLowerCase() === text.trim().toLowerCase()) {
                delete included[attr];
              }
            }
            if (Object.entries(included).length) {
              attributes_html_str = Object.entries(included)
                .map(([key, value]) => `${key}=${value.length > 15 ? `${value.slice(0, 15)}...` : value}`)
                .join(' ');
            }
          }

          const indicator = `[${node.highlight_index}]`;
          let line = `${depth_str}${indicator}<${node.tag_name}`;
          if (attributes_html_str) line += ` ${attributes_html_str}`;
          if (text) {
            text = text.trim();
            if (!attributes_html_str) line += ' ';
            line += `>${text}`;
          } else if (!attributes_html_str) {
            line += ' ';
          }
          line += ' />';
          formatted.push(line);
        }
        for (const child of node.children) process(child, working_depth);
      } else if (node instanceof DOMTextNode) {
        if (node.has_parent_with_highlight_index()) return;
        if (node.parent?.is_visible && node.parent.is_top_element) {
          formatted.push(`${'\t'.repeat(depth)}${node.text}`);
        }
      }
    };

    process(this, 0);
    return formatted.join('\n');
  }
}

export type SelectorMap = Record<number, DOMElementNode>;

export class DOMState {
  constructor(public element_tree: DOMElementNode, public selector_map: SelectorMap) {}

  llm_representation(include_attributes?: string[]): string {
    return this.element_tree.clickable_elements_to_string(include_attributes);
  }
}

export interface PaginationButton {
  button_type: 'next' | 'prev' | 'first' | 'last' | 'page_number';
  index: number;
  text: string;
  xpath: string;
  is_disabled: boolean;
}

/**
 * Pure text/attribute pattern matching over an already-built selector map —
 * zero LLM, zero extra page round-trip. Ported from browser-use-main's
 * `DomService.detect_pagination_buttons`. Used to give get_state an optional
 * "pagination controls detected" hint.
 */
export function detectPaginationButtons(selector_map: SelectorMap): PaginationButton[] {
  const nextPatterns = ['next', '>', '>>', 'siguiente', 'suivant', 'weiter', 'volgende'];
  const prevPatterns = ['prev', 'previous', '<', '<<', 'anterior', 'precedent', 'zuruck', 'vorige'];
  const firstPatterns = ['first', 'primera', 'premiere', 'erste'];
  const lastPatterns = ['last', 'ultima', 'dernier', 'letzte'];
  const hasPattern = (text: string, patterns: string[]) => patterns.some((p) => text.includes(p));

  const buttons: PaginationButton[] = [];
  for (const [indexStr, node] of Object.entries(selector_map)) {
    const text = node.get_all_text_till_next_clickable_element().trim();
    const textLower = text.toLowerCase();
    const ariaLabel = String(node.attributes?.['aria-label'] ?? '').toLowerCase();
    const title = String(node.attributes?.title ?? '').toLowerCase();
    const className = String(node.attributes?.class ?? '').toLowerCase();
    const role = String(node.attributes?.role ?? '').toLowerCase();
    const allText = `${textLower} ${ariaLabel} ${title} ${className}`.trim();

    const disabledRaw = node.attributes?.disabled;
    const ariaDisabledRaw = node.attributes?.['aria-disabled'];
    const isDisabled =
      (typeof disabledRaw === 'string' && disabledRaw.toLowerCase() !== '' && disabledRaw.toLowerCase() !== 'false') ||
      String(ariaDisabledRaw ?? '').toLowerCase() === 'true' ||
      className.includes('disabled');

    let button_type: PaginationButton['button_type'] | null = null;
    if (hasPattern(allText, nextPatterns)) button_type = 'next';
    else if (hasPattern(allText, prevPatterns)) button_type = 'prev';
    else if (hasPattern(allText, firstPatterns)) button_type = 'first';
    else if (hasPattern(allText, lastPatterns)) button_type = 'last';
    else if (/^\d{1,2}$/.test(textLower) && (role === 'button' || role === 'link' || role === '')) button_type = 'page_number';

    if (!button_type) continue;
    buttons.push({
      button_type,
      index: Number(indexStr),
      text: text || ariaLabel || title || node.tag_name,
      xpath: node.xpath,
      is_disabled: isDisabled,
    });
  }
  return buttons;
}
