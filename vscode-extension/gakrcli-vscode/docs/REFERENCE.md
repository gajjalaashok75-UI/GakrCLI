# GakrCLI VS Code Reference

This reference is based on the current `vscode-extension/gakrcli-vscode/package.json` manifest and source registration in `src/extension.ts`.

## Package

| Field | Value |
| --- | --- |
| Extension ID | `gakr-gakr.gakrcli-vscode` |
| Package name | `gakrcli-vscode` |
| Version | `0.2.4` |
| VS Code engine | `^1.94.0` |
| Runtime dependency | `@gakr-gakr/gakrcli@^0.5.7` |
| Main entry | `dist/extension.js` |

## Commands

| Command | Title | Purpose |
| --- | --- | --- |
| `gakrcli.editor.open` | GakrCLI: Open in New Tab | Open a native GakrCLI webview in a new editor tab. |
| `gakrcli.editor.openLast` | GakrCLI: Open | Open the preferred GakrCLI location. |
| `gakrcli.primaryEditor.open` | GakrCLI: Open in Primary Editor | Open GakrCLI in the primary editor area when enabled. |
| `gakrcli.window.open` | GakrCLI: Open in New Window | Open GakrCLI in a separate VS Code window flow. |
| `gakrcli.createWorktree` | GakrCLI: Create Worktree | Create a worktree-backed GakrCLI workflow when enabled. |
| `gakrcli.sidebar.open` | GakrCLI: Open in Side Bar | Open the sidebar webview. |
| `gakrcli.newConversation` | GakrCLI: New Conversation | Start a fresh chat in the active GakrCLI view. |
| `gakrcli.update` | GakrCLI: Update extension | Trigger the extension update flow when supported. |
| `gakrcli.focus` | GakrCLI: Focus input | Focus the GakrCLI composer. |
| `gakrcli.blur` | GakrCLI: Blur input | Return focus away from the composer. |
| `gakrcli.logout` | GakrCLI: Logout | Clear the current authenticated extension session. |
| `gakrcli.terminal.open` | GakrCLI: Open in Terminal | Launch the terminal fallback UI. |
| `gakrcli.acceptProposedDiff` | GakrCLI: Accept Proposed Changes | Accept the active proposed diff. |
| `gakrcli.rejectProposedDiff` | GakrCLI: Reject Proposed Changes | Reject the active proposed diff. |
| `gakrcli.insertAtMention` | GakrCLI: Insert @-Mention Reference | Insert a native webview at-mention from editor context. |
| `gakrcli.installPlugin` | GakrCLI: Install Plugin | Install a plugin through the extension flow. |
| `gakrcli.insertAtMentioned` | GakrCLI: Insert At-Mentioned | Insert an at-mentioned editor reference for terminal mode. |
| `gakrcli.showLogs` | GakrCLI: Show Logs | Show the extension output channel. |
| `gakrcli.openWalkthrough` | GakrCLI: Open Walkthrough | Open the contributed onboarding walkthrough. |

## Keybindings

| Action | macOS | Windows/Linux | Condition |
| --- | --- | --- | --- |
| Insert at-mention | `Alt+K` | `Alt+K` | Editor text focus. |
| Focus or blur GakrCLI | `Cmd+Escape` | `Ctrl+Escape` | Native webview mode. |
| Open in a new tab | `Cmd+Shift+Escape` | `Ctrl+Shift+Escape` | Native webview mode. |
| Open terminal fallback | `Cmd+Escape` | `Ctrl+Escape` | `gakrcliCode.useTerminal` enabled. |
| Insert terminal at-mentioned reference | `Cmd+Alt+K` | `Ctrl+Alt+K` | Editor text focus. |
| New conversation | `Cmd+N` | `Ctrl+N` | `gakrcliCode.enableNewConversationShortcut` enabled and GakrCLI focused. |

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `gakrcliCode.selectedModel` | `default` | Explicit extension model fallback. |
| `gakrcliCode.environmentVariables` | `[]` | Extra environment variables passed to GakrCLI. |
| `gakrcliCode.useTerminal` | `false` | Use terminal fallback instead of the native webview. |
| `gakrcliCode.allowDangerouslySkipPermissions` | unset | Allow bypass permission mode when explicitly opted in. |
| `gakrcliCode.processWrapper` | unset | Executable path used to launch GakrCLI. |
| `gakrcliCode.respectGitIgnore` | `true` | Respect `.gitignore` during file searches. |
| `gakrcliCode.initialPermissionMode` | `default` | Initial permission mode for new conversations. |
| `gakrcliCode.disableLoginPrompt` | `false` | Suppress login prompts when auth is handled externally. |
| `gakrcliCode.autosave` | `true` | Save files before GakrCLI reads or writes them. |
| `gakrcliCode.useCtrlEnterToSend` | `false` | Use Ctrl/Cmd+Enter to send prompts. |
| `gakrcliCode.preferredLocation` | `panel` | Default location: `panel` or `sidebar`. |
| `gakrcliCode.enableNewConversationShortcut` | `false` | Enable Cmd/Ctrl+N inside GakrCLI. |
| `gakrcliCode.hideOnboarding` | `false` | Hide the onboarding checklist. |
| `gakrcliCode.usePythonEnvironment` | `true` | Activate the workspace Python environment when available. |
| `gakrcliCode.selectedProvider` | `anthropic` | Explicit extension provider fallback. |
| `gakrcliCode.apiKey` | empty | Explicit provider API key fallback. Prefer provider profiles or secret storage where possible. |
| `gakrcliCode.baseUrl` | empty | Explicit provider base URL fallback. |

## Views And UI Contributions

| Contribution | Purpose |
| --- | --- |
| Activity bar container `gakrcli-sidebar` | Sidebar location for older VS Code versions without secondary sidebar support. |
| Secondary sidebar container `gakrcli-sidebar-secondary` | Preferred sidebar location when secondary sidebar is supported. |
| Sessions sidebar `gakrcli-sessions-sidebar` | Past conversations list when session-list support is enabled. |
| Webview panel `gakrcliPanel` | Native chat panel/editor webview. |
| Walkthrough `gakrcli-walkthrough` | First-run onboarding steps for opening, chatting, and resuming sessions. |
| JSON validation | Applies `gakrcli-settings.schema.json` to `.gakrcli/settings.json` and `.gakrcli/settings.local.json`. |

## Runtime Paths

| Path | Purpose |
| --- | --- |
| `src/extension.ts` | Activation, command registration, context keys, status bar, auth, terminal fallback, and webview setup. |
| `src/webview/` | Webview provider/manager/bridge and HTML generation. |
| `src/settings/` | CLI executable resolution, provider profiles, model discovery, and settings sync. |
| `src/process/` | Process manager, NDJSON transport, and control routing compatibility helpers. |
| `src/permissions/` | Permission request handling and always-allow rule storage. |
| `src/diff/` | Proposed diff documents, accept/reject behavior, and diff context state. |
| `src/session/` | Session tracking and session-list webview provider. |
| `src/mcp/` | IDE-side MCP server integration. |
| `webview/src/` | React chat UI, hooks, message transforms, permission UI, and shared renderers. |
