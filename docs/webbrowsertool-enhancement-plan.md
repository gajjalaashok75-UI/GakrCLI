# WebBrowserTool Enhancement Plan

## Objective

Port selected tool-only features from `references/browser-use-main/` into the root `src/tools/WebBrowserTool/`. No agent/LLM code, no registry-architecture refactor in this pass — only callable tool actions that make the browser tool faster, richer, and more reliable for GakrCLI.

## Scope

**In scope:**
- New callable actions (schemas in `types.ts`, handlers in `browserServer.ts`, dispatch in `WebBrowserTool.ts`)
- Small enhancements to existing actions
- One cross-cutting concern: `AbortSignal` plumbing through `BrowserToolExecutor.call()` → `BrowserServer`
- One cross-cutting concern: `<secret>` preprocessing in `WebBrowserTool.ts` `call()`
- Tests per task (unit + integration shape matching existing tests)

**Out of scope (defer or skip):**
- Agent loop, message manager, memory, LLM provider integrations
- Registry/decorator architecture refactor
- `extract_structured_data` (requires LLM call inside the tool)
- Filesystem abstraction + read/write/replace actions
- Watchdogs (crash, permissions, popups, CAPTCHA, HAR, downloads)
- Cloud browser / sandbox
- Google Sheets actions
- Any code from `references/browser-use-main/src/agent/`, `src/llm/`, `src/code-use/`

## Reference Source

Primary: `references/browser-use-main/src/controller/views.ts` (schemas) and `references/browser-use-main/src/controller/service.ts` (handlers).

Secondary: `references/browser-use-main/docs/ACTIONS.md` (action descriptions and examples).

## Execution Model

Each task follows the same sequence:

1. **Gather** — read the reference action schema + handler implementation. Note Playwright APIs used, edge cases, error paths.
2. **Port** — add the schema to `src/tools/WebBrowserTool/types.ts`, add the handler to `src/tools/WebBrowserTool/browserServer.ts`, register dispatch in `src/tools/WebBrowserTool/WebBrowserTool.ts`.
3. **Test** — add unit tests in `src/tools/WebBrowserTool/__tests__/` matching existing patterns (mock page, fake context, Bun test).
4. **Verify** — run `bun test` for the relevant test files; confirm no regressions in existing tests.
5. **Proceed** — move to the next task only after the current one passes.

## Task List

### Task 1: Port `scroll_to_text`

**Source:** `ScrollToTextActionSchema` + `scroll_to_text` handler in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`.

**What to add:**
- `BrowserScrollToTextActionSchema` in `types.ts` — `{ action: 'scroll_to_text', text: string }`
- `scrollToText(text: string): Promise<string>` in `browserServer.ts` — scroll page until text is visible using Playwright `page.evaluate()` or locator-based approach
- Register `scroll_to_text` in `WebBrowserTool.ts` dispatch and in `BROWSER_ACTION_SCHEMA_BY_NAME` / `BROWSER_ACTION_NAMES`

**Tests:**
- scroll succeeds when text is found
- scroll returns "not found" when text does not exist
- scroll works with case-sensitive flag (if reference supports it)

**Verification:**
- `bun test src/tools/WebBrowserTool/__tests__/WebBrowserTool.test.ts -t "scroll_to_text"` passes
- No regressions in existing scroll tests

---

### Task 2: Port `evaluate`

**Source:** `EvaluateActionSchema` + `evaluate` handler in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`.

**What to add:**
- `BrowserEvaluateActionSchema` in `types.ts` — `{ action: 'evaluate', code: string }`
- `evaluate(code: string): Promise<string>` in `browserServer.ts` — execute JS via `page.evaluate(code)` and return result as string
- Safety: bound execution time, catch errors, return error string on failure
- Register `evaluate` in `WebBrowserTool.ts` dispatch and schema maps

**Tests:**
- evaluate returns a simple value
- evaluate returns an object (JSON-serialized)
- evaluate returns an error string when code throws
- evaluate returns an error string when result is a circular/unsupported type

**Verification:**
- `bun test -t "evaluate"` passes for relevant files
- No regressions in existing action tests

---

### Task 3: Port `find_elements` + `search_page`

**Source:** `FindElementsActionSchema` + `find_elements` handler, `SearchPageActionSchema` + `search_page` handler in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`.

**What to add:**
- `BrowserFindElementsActionSchema` in `types.ts` — `{ action: 'find_elements', selector: string, attributes?: string[], max_results?: number, include_text?: boolean }`
- `BrowserSearchPageActionSchema` in `types.ts` — `{ action: 'search_page', pattern: string, regex?: boolean, case_sensitive?: boolean, context_chars?: number, css_scope?: string, max_results?: number }`
- `findElements(selector, ...)` in `browserServer.ts` — query DOM via `page.evaluate()` returning matching elements with optional attributes
- `searchPage(pattern, ...)` in `browserServer.ts` — in-page text search via `page.evaluate()` returning context snippets
- Register both in dispatch and schema maps

**Tests:**
- find_elements returns matching elements by CSS selector
- find_elements respects max_results
- find_elements includes attributes when requested
- search_page finds text with default settings
- search_page respects regex, case_sensitive, context_chars
- search_page respects css_scope

**Verification:**
- `bun test -t "find_elements|search_page"` passes
- No regressions in existing get_state/content tests

---

### Task 4: Port `send_keys`

**Source:** `SendKeysActionSchema` + `send_keys` handler in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`.

**What to add:**
- `BrowserSendKeysActionSchema` in `types.ts` — `{ action: 'send_keys', keys: string }`
- `sendKeys(keys: string): Promise<string>` in `browserServer.ts` — use Playwright `page.keyboard.press(keys)` (supports combos like `Control+a`, `Shift+End`)
- Register `send_keys` in dispatch and schema maps

**Tests:**
- send_keys with single key (Enter, Escape)
- send_keys with combo (Control+a)
- send_keys returns error string when page is closed

**Verification:**
- `bun test -t "send_keys"` passes
- No regressions in existing `press_key` tests

---

### Task 5: Add explicit `screenshot` action

**Source:** `ScreenshotActionSchema` + `screenshot` handler in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`. Root already has `include_screenshot` on `get_state`; this extracts it into a standalone action.

**What to add:**
- `BrowserScreenshotActionSchema` in `types.ts` — `{ action: 'screenshot', file_name?: string }`
- `takeScreenshot(fileName?: string): Promise<string>` in `browserServer.ts` — capture via `page.screenshot()`, save to disk if `file_name` given, return base64 data URL or saved path
- Register `screenshot` in dispatch and schema maps

**Tests:**
- screenshot returns base64 data URL when no file_name
- screenshot saves to disk and returns path when file_name given
- screenshot returns error string when page is closed

**Verification:**
- `bun test -t "screenshot"` passes
- No regressions in existing `get_state` screenshot tests

---

### Task 6: Port `select_dropdown` + `dropdown_options`

**Source:** `DropdownOptionsActionSchema` + `select_dropdown` handler in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`.

**What to add:**
- `BrowserDropdownOptionsActionSchema` in `types.ts` — `{ action: 'dropdown_options', index: number }`
- `BrowserSelectDropdownActionSchema` in `types.ts` — `{ action: 'select_dropdown', index: number, text: string }`
- `getDropdownOptions(index: number): Promise<string>` in `browserServer.ts` — return available options from a dropdown/ARIA menu
- `selectDropdown(index: number, text: string): Promise<string>` in `browserServer.ts` — select option by visible text
- Register both in dispatch and schema maps

**Tests:**
- dropdown_options returns option list for a real select element
- dropdown_options returns error for non-dropdown element
- select_dropdown selects the matching option
- select_dropdown returns error when text not found

**Verification:**
- `bun test -t "dropdown"` passes
- No regressions in existing click/type tests

---

### Task 7: Enhance `click` with coordinate fallback

**Source:** `ClickElementActionSchema` with `coordinate_x`/`coordinate_y` in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`.

**What to add:**
- Add `coordinate_x?: number` and `coordinate_y?: number` to `BrowserClickActionSchema` in `types.ts`
- In `browserServer.ts` `click()`: if `selector` is absent and `coordinate_x`/`coordinate_y` are provided, use `page.mouse.click(coordinate_x, coordinate_y)` instead of ref-based click
- At least one of `index`, `selector`, or `(coordinate_x + coordinate_y)` must be present — enforce in handler

**Tests:**
- click with coordinates clicks at the right position
- click with coordinates returns error when page is closed
- click still prefers selector over coordinates when both provided

**Verification:**
- `bun test -t "click"` passes
- No regressions in existing click tests

---

### Task 8: Port `upload_file`

**Source:** `UploadFileActionSchema` + `upload_file` handler in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`.

**What to add:**
- `BrowserUploadFileActionSchema` in `types.ts` — `{ action: 'upload_file', index: number, path: string }`
- `uploadFile(index: number, path: string): Promise<string>` in `browserServer.ts` — use Playwright `locator.setInputFiles(path)` on the element at `index`
- Register `upload_file` in dispatch and schema maps

**Tests:**
- upload_file sets files on the target input
- upload_file returns error when element is not a file input
- upload_file returns error when file does not exist

**Verification:**
- `bun test -t "upload_file"` passes
- No regressions in existing type/click tests

---

### Task 9: Port `search_google`

**Source:** `SearchGoogleActionSchema` + `search_google` handler in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`.

**What to add:**
- `BrowserSearchGoogleActionSchema` in `types.ts` — `{ action: 'search_google', query: string }`
- `searchGoogle(query: string): Promise<string>` in `browserServer.ts` — navigate to `https://www.google.com/search?q=...` and return page content or URL
- Register `search_google` in dispatch and schema maps

**Tests:**
- search_google navigates to a Google search URL
- search_google returns an error string when navigation fails
- search_google does not open a new tab (or does, matching reference behavior)

**Verification:**
- `bun test -t "search_google"` passes
- No regressions in existing navigate tests

---

### Task 10: Add `save_as_pdf`

**Source:** `SaveAsPdfActionSchema` + `save_as_pdf` handler in `references/browser-use-main/src/controller/views.ts` and `src/controller/service.ts`.

**What to add:**
- `BrowserSaveAsPdfActionSchema` in `types.ts` — `{ action: 'save_as_pdf', file_name?: string, print_background?: boolean, landscape?: boolean, scale?: number, paper_format?: string, display_header_footer?: boolean }`
- `saveAsPdf(params): Promise<string>` in `browserServer.ts` — use Playwright `page.pdf()` with the given options, return saved path
- Register `save_as_pdf` in dispatch and schema maps

**Tests:**
- save_as_pdf saves a PDF and returns the path
- save_as_pdf uses default options when none provided
- save_as_pdf returns error when page is closed

**Verification:**
- `bun test -t "save_as_pdf"` passes
- No regressions in existing tests

---

### Task 11: Add `AbortSignal` plumbing

**Source:** `AbortSignal` usage in `references/browser-use-main/src/controller/registry/service.ts` (`signal?.aborted` checks, `createAbortError`, `isAbortError`).

**What to add:**
- Add optional `signal?: AbortSignal` to `BrowserToolExecutor.call()` signature in `browserEngine.ts`
- Thread `signal` through to `BrowserServer` methods
- In `browserServer.ts` action handlers: check `signal?.aborted` before and after Playwright calls, throw `AbortError` when aborted
- In `WebBrowserTool.ts` `call()`: accept and forward `signal`

**Tests:**
- action completes normally when signal is not aborted
- action throws `AbortError` when signal is aborted before start
- action throws `AbortError` when signal is aborted mid-flight
- tool call returns a clean error string (not a raw throw) when aborted

**Verification:**
- `bun test -t "abort"` passes
- No regressions in existing tool call tests

---

### Task 12: Add `<secret>` preprocessing in `WebBrowserTool.ts` `call()`

**Source:** `replace_sensitive_data` in `references/browser-use-main/src/controller/registry/service.ts`.

**What to add:**
- In `WebBrowserTool.ts` `call()`, before dispatching to `BrowserToolExecutor`, scan the action params for `<secret>key</secret>` tags
- Replace with values from a new `sensitive_data?: Record<string, string>` field on `BrowserConfig` or tool call options
- Support TOTP auto-generation for keys ending in `_2fa_code` or `_totp` (base32 secret → 6-digit code)
- Redact secrets from logs/error messages

**Tests:**
- `<secret>username</secret>` is replaced with the configured value
- Missing secret key leaves the placeholder untouched and logs a warning
- TOTP secret generates a 6-digit code for `_2fa_code` keys
- secret values do not appear in error messages

**Verification:**
- `bun test -t "secret"` passes
- No regressions in existing tool call tests

---

## Execution Order

Tasks are ordered by dependency and risk:

```
Task 1  scroll_to_text          (standalone, no cross-cutting changes)
Task 2  evaluate                (standalone)
Task 3  find_elements + search_page  (related pair, standalone)
Task 4  send_keys               (standalone)
Task 5  explicit screenshot     (standalone)
Task 6  select_dropdown + dropdown_options  (related pair)
Task 7  click coordinate fallback  (enhancement to existing action)
Task 8  upload_file             (standalone)
Task 9  search_google           (standalone)
Task 10 save_as_pdf             (standalone)
Task 11 AbortSignal plumbing    (cross-cutting — do after all actions exist)
Task 12 <secret> preprocessing  (cross-cutting — do after all actions exist)
```

Tasks 1–10 can be done in any order relative to each other. Tasks 11–12 should be last because they touch shared plumbing.

## File Touch Map

| File | Tasks that touch it |
|---|---|
| `src/tools/WebBrowserTool/types.ts` | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 |
| `src/tools/WebBrowserTool/browserServer.ts` | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 |
| `src/tools/WebBrowserTool/WebBrowserTool.ts` | 1–10 (dispatch + schema maps), 11, 12 |
| `src/tools/WebBrowserTool/browserEngine.ts` | 11 (signal in call()) |
| `src/tools/WebBrowserTool/__tests__/WebBrowserTool.test.ts` | 1–10 |
| `src/tools/WebBrowserTool/__tests__/WebBrowserTool.newtab.test.ts` | 7 (click enhancement) |
| `src/tools/WebBrowserTool/__tests__/WebBrowserTool.mocks.test.ts` | 11 |
| New test file or additions to existing | 12 |

## Non-Negotiable Rules

1. No agent/LLM code enters the tool layer.
2. No registry-architecture refactor in this pass.
3. Each action must have tests before the task is marked complete.
4. Existing tests must not regress.
5. All new actions must produce the same output shape as existing actions: `{ extracted_content, error?, is_done?, ... }` consistent with `BrowserObservation`.
6. `allowed_domains` behavior must be preserved for all new actions.
7. New actions must respect `action_timeout_seconds` and degraded-timeout behavior.
