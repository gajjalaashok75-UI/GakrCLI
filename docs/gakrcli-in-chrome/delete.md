# Stage 9 — Safe Web Editor and Element-Marker Cleanup

This record documents the Chrome-extension cleanup performed under **Option 3**:
remove only the features and code that can be deleted without breaking protected
Chrome MCP functionality.

The protected surface — the terminal backend, `gakrcli --chrome`, the native
host, and the Chrome MCP tools — was left intact. Only the Web Editor and the
Element-Marker **management** feature were removed. The element-marker **read**
path and the element-picker stay, because protected MCP tools depend on them.

## What was removed

### Web Editor (in-page visual editing) — entire feature

The Web Editor was a standalone entry point with no remaining consumers.

- `entrypoints/web-editor-v2.ts` — entry point.
- `entrypoints/web-editor-v2/` — the whole implementation tree (core engine,
  design tokens, drag, overlay, selection, UI/property panel, utils).
- `entrypoints/background/web-editor/index.ts` — background listeners, including
  the `toggle_web_editor` command handler.
- `common/web-editor-types.ts` — shared types, unused after the feature was gone.
- `inject-scripts/web-editor.js` and `inject-scripts/props-agent.js` — injected
  page scripts used only by the Web Editor.
- `tests/web-editor-v2/` — the feature's test suite (and `test-utils/dom.ts`).
- `toggle_web_editor` entry in `wxt.config.ts` (`commands`).
- `WEB_EDITOR_*` message types in `common/message-types.ts`.

### Element-Marker management — UI and write path only

Markers can still be **read** by `chrome_read_page`; only the creation and
management UI was removed.

- `entrypoints/background/element-marker/index.ts` — `initElementMarkerListeners`.
- `entrypoints/popup/components/ElementMarkerManagement.vue` — orphaned UI.
- `inject-scripts/element-marker.js` — injected page script for the marker UI.
- `ELEMENT_MARKER_*` message types in `common/message-types.ts` (the management
  set and the content-side `ELEMENT_MARKER_START`).
- `entrypoints/background/utils/sidepanel.ts` — orphaned helper.

### Orphaned icons

- `entrypoints/popup/components/icons/EditIcon.vue`
- `entrypoints/popup/components/icons/MarkerIcon.vue`

(Removed together with their re-exports in `icons/index.ts`.)

## What was changed, not deleted

These files were trimmed so the protected read path keeps working.

- `entrypoints/background/index.ts` — dropped the Web Editor and Element-Marker
  listener wiring; keeps the native-host and storage-manager listeners.
- `entrypoints/background/element-marker/element-marker-storage.ts` — reduced to a
  read-only module (`listMarkersForUrl`), which is what `chrome_read_page` uses.
- `common/element-marker-types.ts` — keeps only `UrlMatchType` and `ElementMarker`.
- `shared/element-picker/controller.ts` and `shared/quick-panel/ui/shadow-host.ts`
  — import `Disposer` from `@/utils/disposables` instead of the deleted Web
  Editor path. No behavior change.
- `utils/disposables.ts` — new home for the shared `Disposer` utility.
- `web/public/docs/gakrcli-in-chrome/gakrcli-in-chrome.zip` — regenerated so the
  committed bundle matches the source (the packaging test guards this).

## What was kept (protected)

- `shared/element-picker/*` and the `chrome_request_element_selection` tool.
- `chrome_read_page` and its marker read path.
- The native host (`chromeNativeHost.ts`, `native-host.ts`) and the Chrome MCP
  server.
- The terminal backend (`src/utils/gakrcliInChrome/terminalBackend/`), `--chrome`,
  and `--chrome-extension`.
- The Quick Panel shadow host (shared with the element picker).

## Verification

- Extension build (`wxt build`) succeeds; `element-picker.js` is still emitted;
  the `commands` block no longer contains `toggle_web_editor`.
- Extension tests: 13 tests across 4 files pass, covering the retained
  protected modules (element-picker panel, Quick Panel shadow host, element-marker
  read path, MCP tool registry).
- CLI typecheck (`tsc --noEmit`) is clean; all 62 CLI Chrome tests pass.
- Packaging test passes against the regenerated zip.
- Terminal backend end-to-end: discovery binds a loopback port, rejects a wrong
  or missing origin with 403, accepts the configured extension origin, opens an
  authenticated WebSocket as `owner`, streams PTY output from a real
  `gakrcli --chrome` process, and rejects a bad token with close code 4001.
