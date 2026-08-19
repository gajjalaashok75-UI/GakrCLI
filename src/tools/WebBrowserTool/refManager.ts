/**
 * RefManager — parses `[ref=eN]` references from Playwright's
 * `page.ariaSnapshot({ mode: 'ai' })` YAML output and maps them to
 * `[index]` numbers for the LLM.
 *
 * LAYER 1 — GakrCLI-AGNOSTIC. This has no direct Python equivalent — it
 * replaces browser_use's DOM serializer + actor. Unlike the earlier
 * Stagehand-based version (which stored `Action[]` from `stagehand.observe()`),
 * this is 100% deterministic: Playwright's built-in `ariaSnapshot({ mode:
 * 'ai' })` generates the accessibility tree with `[ref=e1]`, `[ref=e2]`, ...
 * tags already embedded in the YAML text, and `page.locator('aria-ref=e1')`
 * resolves a ref straight back to a clickable/fillable Locator — no LLM
 * involved at any point. This is the same approach Microsoft's official
 * Playwright MCP server uses.
 *
 * The aria snapshot YAML looks like:
 *   - generic [ref=e1]:
 *     - heading "Welcome" [ref=e2]
 *     - link "About" [ref=e3]
 *     - textbox "Search" [ref=e4]
 *     - button "Submit" [ref=e5]
 *
 * Ref format: "e1", "e2", ... for main-frame elements; "f1e3" for element 3
 * inside iframe 1 (regex: /^(f\d+)?e\d+$/).
 */

/** Extracts [ref=eN] or [ref=fNeM] tags from an ariaSnapshot YAML string. */
const REF_TAG_REGEX = /\[ref=((?:f\d+)?e\d+)\]/g;

export class RefManager {
  private refs: string[] = [];
  private snapshotText = '';

  /** Store the aria snapshot YAML and extract refs in document order. */
  setSnapshot(ariaSnapshotYaml: string): void {
    this.snapshotText = ariaSnapshotYaml;
    this.refs = [];
    // Fresh RegExp instance per call: a shared global-flag regex retains
    // `lastIndex` state across calls, which would corrupt parsing on reuse.
    const regex = new RegExp(REF_TAG_REGEX);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(ariaSnapshotYaml)) !== null) {
      this.refs.push(match[1]);
    }
  }

  /** Get the ref string (e.g. "e3", "f1e2") for a given [index]. */
  getRefByIndex(index: number): string | null {
    return this.refs[index] ?? null;
  }

  /** The full aria snapshot YAML most recently stored (for debugging/display). */
  getSnapshotText(): string {
    return this.snapshotText;
  }

  /**
   * ROUND 9 FIX (real-world E2E finding): `getSnapshotText()` shows
   * Playwright's internal `[ref=e5]`/`[ref=f1e3]` tags — but `click()`/
   * `type()` take an `[index]` number, a completely different numbering
   * scheme (0-based position among refs, not Playwright's own ref IDs).
   * Nothing ever showed the caller this mapping, so the only way to use
   * `index` correctly was to manually count `[ref=...]` occurrences in the
   * raw YAML — exactly the failure mode reported: `type index=4` landed on
   * the 5th element (a `<button>`) instead of the intended 5th ELEMENT the
   * caller thought they were counting, because labels/headings/paragraphs
   * are ALSO refs and easy to miscount past.
   *
   * This returns the SAME YAML with every `[ref=eN]`/`[ref=fNeM]` tag
   * rewritten to `[index=K]` (K = the exact number `click`/`type` expect),
   * in one pass, preserving the surrounding role/name/hierarchy text
   * untouched — so what the caller reads IS the number to use, with zero
   * counting required. This is now what `getBrowserState()` returns
   * instead of the raw snapshot.
   */
  getAnnotatedSnapshotText(): string {
    let i = 0;
    // Fresh RegExp instance per call for the same lastIndex-state reason as setSnapshot().
    const regex = new RegExp(REF_TAG_REGEX);
    return this.snapshotText.replace(regex, () => `[index=${i++}]`);
  }

  /** Total number of ref elements found in the current snapshot. */
  get count(): number {
    return this.refs.length;
  }

  clear(): void {
    this.refs = [];
    this.snapshotText = '';
  }
}
