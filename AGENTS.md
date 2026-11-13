`# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
\`\`\`
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
\`\`\`

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

check and conform and verify and then tests , proceed and continue

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Repo Notes

### Test suite

`bun run test` runs ~10.8k tests in a single long-lived process and, on a
16 GB container, accumulates enough memory to OOM-restart the machine. Run it
as bounded chunks in separate processes instead:

```bash
i=0; for f in $(find src -name '*.test.ts' -o -name '*.test.tsx' | sort); do
  bun test --feature=UNATTENDED_RETRY --max-concurrency=1 "$f"   # or shard by dir
done
```

A chunk that spawns the CLI can hang indefinitely; wrap each chunk in
`timeout`. There are ~380 pre-existing failures on the `e4a97aa` baseline
(unrelated areas: Gemini store field, openaiShim SSE timeout, Swarm polling,
`usage` command metadata, autoCompact circuit breaker). Compare failure sets
against a baseline worktree rather than expecting a green suite.

### `feature()` flags at dev runtime

`import { feature } from 'bun:bundle'` resolves to `false` for every flag
outside a real build. `scripts/build.ts` papers over this by transforming
`feature('FLAG')` calls into boolean literals at bundle time, so a dev-runtime
smoke test that needs a flag on must replicate that plugin (replace the
`bun:bundle` import and the `feature(...)` call) via `bun --preload`.
Note: a dev-time `onLoad` hook must return `{ contents, loader }`, not `null`.

### Config persistence

Project config lives in `~/.gakrcli.json` under `projects[<abs path>]`, not at
the top level. `setMcpServerEnabled` writes there and survives process restarts.
`

## GakrCLI-in-Chrome: terminal vs legacy agent server

The Chrome side panel is a **terminal**, not a chat UI. The data path is:

```
side panel (xterm.js) ──HTTP discovery + WebSocket──> gakrcli --chrome-extension
        (terminalBackend: PTY mgmt, ws, sessions)  ──node-pty──> gakrcli --chrome
```

- `gakrcli --chrome-extension` → `runTerminalBackend` (`src/utils/gakrcliInChrome/terminalBackend/`).
  Discovery on `127.0.0.1:64201-64210` (`GET /discover`, origin-gated), WebSocket on `/terminal`,
  token-authenticated. Port file: `~/.gakrcli/chrome/terminal-backend/port.json` (informational only;
  the extension discovers over HTTP, it cannot read files).
- `gakrcli --chrome` is the real Ink TUI the PTY spawns; it wires the in-process Chrome MCP server
  (`createChromeMcpServer()` in `src/services/mcp/client.ts`).
- Browser tool calls: extension background `handleCallTool` ← native host socket
  (`chromeNativeHost.ts`) ← `chromeNativeHostClient.callExtensionTool` ← `mcpServer.ts`.
  This is the **protected** MCP/native-host path; do not break it.

The **legacy agent server** (`src/utils/gakrcliInChrome/agentServer/*`, `panelAgent/*`) and the
extension's `AgentChat` UI and floating Quick Panel AI chat were the pre-terminal chat
architecture. They have been removed: `--chrome-extension` runs `runTerminalBackend`, and
`chromeNativeHost.ts` + `preflight.ts` read the terminal backend's discovery file
(`readDiscoveryPort`) instead of the old agent-server port file.

The **Web Editor** (in-page visual editing: `entrypoints/web-editor-v2*`, `inject-scripts/web-editor.js`,
`inject-scripts/props-agent.js`, `common/web-editor-types.ts`, `entrypoints/background/web-editor/*`)
and the **element-marker management** feature (`entrypoints/background/element-marker/index.ts`,
`inject-scripts/element-marker.js`, `ElementMarkerManagement.vue`, the `ELEMENT_MARKER_*` message
types, the `toggle_web_editor` command) have been removed. See
`docs/gakrcli-in-chrome/delete.md`.

Two couplings to **kept** features remain and are **protected**:

- `chrome_request_element_selection` (MCP tool) renders in the Quick Panel shadow host
  (`shared/quick-panel/ui`) and its panel controller (`shared/element-picker/`); both import the
  shared `Disposer` from `utils/disposables`.
- `chrome_read_page` (MCP tool) reads user markers via the retained read-only path
  `entrypoints/background/element-marker/element-marker-storage` (`listMarkersForUrl`).

Do not delete `shared/quick-panel/ui`, `shared/element-picker`, `utils/disposables`, or the
element-marker read path without replacing those couplings first.

## Built-in registries

Adding a feature follows a `register*` + Map pattern, one registry per surface:

- Slash commands: `src/commands.ts`
- Tools: `src/tools.ts`
- Skills: `src/skills/bundledSkills.ts` (`registerBundledSkill`), wired in `src/skills/bundled/index.ts`
- Plugins: `src/plugins/builtinPlugins.ts` (`registerBuiltinPlugin`), wired in `src/plugins/bundled/index.ts`
- MCP servers: `src/services/mcp/builtinMcpServers.ts` (`registerBuiltinMcpServer`), wired in `src/services/mcp/bundled/index.ts`

To add a built-in MCP server, create `src/services/mcp/bundled/<name>.ts` exporting a
`register<Name>McpServer()` helper and call it from `initBuiltinMcpServers()`. No edits to
`services/mcp/config.ts` or `main.tsx` are needed — enumeration, the reserved-name guard, and
default-disabled semantics are all registry-driven.

Registration happens lazily on first read (`ensureBuiltinMcpServersRegistered`) as well as
explicitly via `initBuiltinMcpServers()` at startup. This matters because the reserved-name check
in `main.tsx` runs BEFORE the startup block, and entrypoints other than `main.tsx` (print/headless,
standalone MCP mode, sub-agent runs) read the MCP config layer without running startup at all.

Note: `normalizeNameForMCP` replaces invalid characters with underscores but does NOT lowercase —
built-in name matching is case-sensitive.

