<div align="center">

<img src="resources/gakrcli-logo.png" alt="GakrCLI VS Code" width="400" height="400">

# GakrCLI VS Code

**Version 0.2.3**

Native VS Code chat for GakrCLI, powered by the `@gakr-gakr/gakrcli` SDK.

</div>

GakrCLI VS Code brings the GakrCLI agent into the editor with a webview chat, compact tool-call rows, native model/provider controls, permission prompts, session history, file mentions, diff workflows, live context usage, and terminal fallback.

## Install

From the VS Code Marketplace:

```bash
code --install-extension gakr-gakr.gakrcli-vscode
```

From a local package:

```bash
code --install-extension gakrcli-vscode-0.2.3.vsix
```

The extension package depends on `@gakr-gakr/gakrcli`. For terminal mode, install the CLI globally too:

```bash
npm install -g @gakr-gakr/gakrcli@0.5.5
```

## Open GakrCLI

- Command Palette: `GakrCLI: Open`
- New editor tab: `GakrCLI: Open in New Tab`
- Primary editor: `GakrCLI: Open in Primary Editor`
- Side bar: `GakrCLI: Open in Side Bar`
- Terminal fallback: `GakrCLI: Open in Terminal`

Keyboard shortcuts:

| Action | macOS | Windows/Linux |
| --- | --- | --- |
| Open or focus GakrCLI | `Cmd+Escape` | `Ctrl+Escape` |
| Open in a new tab | `Cmd+Shift+Escape` | `Ctrl+Shift+Escape` |
| Insert an at-mention from the editor | `Alt+K` | `Alt+K` |
| New conversation | `Cmd+N` when enabled | `Ctrl+N` when enabled |

## Provider Setup

Use the provider badge in the composer or run `/provider` from the chat.

Supported provider families include:

- Anthropic Claude
- OpenAI
- Google Gemini
- DeepSeek
- Bankr
- Moonshot AI and Kimi Code
- MiniMax
- Mistral AI
- NVIDIA NIM
- xAI
- Xiaomi MiMo
- Z.AI
- Azure OpenAI
- Alibaba DashScope China and International
- GitHub Copilot / GitHub Models
- Groq
- Hicap
- OpenRouter
- Together AI
- Venice
- AWS Bedrock
- Google Vertex AI
- Ollama
- LM Studio
- Atomic Chat
- Custom OpenAI-compatible endpoints

The extension reads active GakrCLI provider profiles and can also use explicit VS Code settings under `gakrcliCode.*`.

## Features

- Streaming assistant messages with markdown, code blocks, tables, and visible list markers.
- Compact tool rows for Bash, Read, Write, Edit, Glob, and other tools.
- Expandable tool details that keep large inputs and outputs scrollable without stretching the whole chat.
- Conversation-level copy action instead of repeated copy icons on every text fragment.
- Hidden reasoning blocks with only a live thinking indicator during active reasoning.
- Live context usage meter with token capacity, fill line, and autocompact tooltip.
- Compacting and compacted transcript dividers.
- Native permission and clarification dialogs.
- Permission modes: Default, Plan, Accept Edits, Bypass, and Don't Ask.
- Provider picker, model picker, Fast mode, reasoning effort, MCP, and plugin controls.
- Session history, resume, new conversation, and live title fallback.
- File and image attachments through the add menu.
- At-mentions for files and editor context.
- Diff accept/reject integration for proposed edits.
- Terminal fallback for users who prefer the CLI terminal UI.

## SDK Runtime

The native webview path uses the SDK directly. This avoids scraping terminal text and lets the UI render structured events:

```text
React webview
  -> VS Code extension host
  -> @gakr-gakr/gakrcli/sdk
  -> provider runtime, tools, MCP, sessions, plugins
```

SDK-backed behavior in this release:

- Live context percent is scoped per conversation and updates from SDK usage snapshots.
- Context display remains stable during refreshes instead of bouncing to zero between snapshots.
- Autocompact state is surfaced as compacting and compacted transcript dividers.
- Tool calls render as compact rows first, then expand to input/output details on click.
- Thinking content is hidden, while the active thinking indicator remains visible.
- Bash sandbox errors are annotated without breaking tool output rendering.
- Session title fallback is kept in sync for new and resumed chats.

Terminal mode still uses the integrated terminal:

```text
VS Code command
  -> integrated terminal
  -> gakrcli command
```

## Settings

Important settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| `gakrcliCode.initialPermissionMode` | `default` | Starting permission mode for new chats. |
| `gakrcliCode.environmentVariables` | `[]` | Extra environment variables passed to the runtime. |
| `gakrcliCode.useTerminal` | `false` | Open the terminal UI instead of the native webview. |
| `gakrcliCode.allowDangerouslySkipPermissions` | `false` | Allow bypass mode when you explicitly opt in. |
| `gakrcliCode.respectGitIgnore` | `true` | Respect `.gitignore` during file searches. |
| `gakrcliCode.autosave` | `true` | Save files before GakrCLI reads or writes. |
| `gakrcliCode.useCtrlEnterToSend` | `false` | Use Ctrl/Cmd+Enter to send. |
| `gakrcliCode.preferredLocation` | `panel` | Default UI location. |
| `gakrcliCode.enableNewConversationShortcut` | `false` | Enable Cmd/Ctrl+N in the GakrCLI view. |
| `gakrcliCode.hideOnboarding` | `false` | Hide onboarding. |
| `gakrcliCode.selectedProvider` | `anthropic` | Explicit extension provider fallback. |
| `gakrcliCode.selectedModel` | `default` | Explicit extension model fallback. |
| `gakrcliCode.apiKey` | empty | Explicit extension API key fallback. |
| `gakrcliCode.baseUrl` | empty | Explicit extension base URL fallback. |

## Developer Tools

- `/provider` to set up and switch providers.
- `/model` to switch the active model.
- `/compact` to compact conversation context.
- `/resume` to browse and resume sessions.
- `/diff` to show current git changes.
- `/commit` to create a commit message and commit when approved.
- `/review` to review code, a diff, or a PR.
- `/mcp` to manage MCP servers.
- `/plugins` to manage plugins.
- `/agents` and `/skills` to browse local agent and skill catalogs.

## Development

```bash
cd vscode-extension/gakrcli-vscode
npm install
cd webview
npm install
cd ..
npm run build
npm test
```

Package locally:

```bash
npx @vscode/vsce package
```

Dry-run package inspection:

```bash
npx @vscode/vsce ls --tree
```

Release note: `gakrcli-vscode@0.2.3` depends on `@gakr-gakr/gakrcli@0.5.5`, so publish the root npm package first, then refresh this extension lockfile before building the final VSIX.

## More Docs

- [User guide](docs/USER_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Publishing checklist](docs/PUBLISHING.md)
- [Root GakrCLI README](../../README.md)

## License

MIT. See [LICENSE](LICENSE).
