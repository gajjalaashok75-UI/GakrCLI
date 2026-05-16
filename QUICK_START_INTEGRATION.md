# GakrCLI + VS Code Extension Quick Start

This guide covers the current CLI package (`0.5.2`) and the VS Code extension package (`0.2.0`).

## Install

```bash
npm install -g @gakr-gakr/gakrcli
gakrcli --version
```

Install the VS Code extension from the marketplace or from the extension folder:

```bash
cd vscode-extension/gakrcli-vscode
npm run package
code --install-extension gakrcli-vscode-0.2.0.vsix
```

## Configure A Provider

The easiest path is to start GakrCLI and run `/provider`.

```bash
gakrcli
```

Then inside the CLI:

```text
/provider
```

You can also use environment variables.

OpenAI-compatible:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key
export OPENAI_MODEL=gpt-4o
```

Ollama:

```bash
ollama pull llama3.2:3b
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
```

Gemini:

```bash
export GAKR_CODE_USE_GEMINI=1
export GEMINI_API_KEY=your-key
export GEMINI_MODEL=gemini-3-flash-preview
```

## Use In VS Code

1. Open a workspace folder.
2. Open the GakrCLI activity-bar view.
3. Use `GakrCLI: Launch in Terminal` or `GakrCLI: Launch in Workspace Root`.
4. Use `Ctrl+Shift+L` (`Cmd+Shift+L` on macOS) to open the chat panel.

The extension shows whether the configured `gakrcli` command is available, which workspace it will launch from, and the provider status it can infer from the workspace profile or environment.

## Extension Settings

- `gakrcli.launchCommand`: command used to launch GakrCLI, default `gakrcli`.
- `gakrcli.terminalName`: integrated terminal name, default `GakrCLI`.
- `gakrcli.useOpenAIShim`: optionally injects `GAKR_CODE_USE_OPENAI=1` into launched terminals.
- `gakrcli.permissionMode`: `default`, `acceptEdits`, `bypassPermissions`, or `plan`.

## Validate Before Push

From the repo root:

```bash
bun run typecheck
bun test
bun run smoke
```

From `vscode-extension/gakrcli-vscode`:

```bash
npm run test
npm run lint
```
