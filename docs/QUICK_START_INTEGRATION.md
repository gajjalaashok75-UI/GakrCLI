# GakrCLI + VS Code Extension Quick Start

This guide covers:

- GakrCLI CLI package: `0.5.6`
- GakrCLI VS Code extension: `0.2.4`

## Install The CLI

```bash
npm install -g @gakr-gakr/gakrcli@0.5.6
gakrcli --version
```

## Install The VS Code Extension

From Marketplace:

```bash
code --install-extension gakr-gakr.gakrcli-vscode
```

From a local VSIX:

```bash
cd vscode-extension/gakrcli-vscode
npx @vscode/vsce package
code --install-extension gakrcli-vscode-0.2.4.vsix
```

## Configure A Provider

The recommended path is:

```bash
gakrcli
```

Then inside GakrCLI:

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
2. Run `GakrCLI: Open` from the Command Palette.
3. Use `@` to mention files and `/` to open slash commands.
4. Use the lower composer row to switch permission mode, provider, context meter, and Fast mode.
5. Expand tool rows when you want to inspect commands, inputs, and results.

The native webview uses the GakrCLI SDK. Terminal mode is still available with `GakrCLI: Open in Terminal`.

## Validate Before Publishing

From the repository root:

```bash
bun.cmd run build
bun.cmd test src/tools/FileEditTool/utils.test.ts
npm.cmd pack --dry-run
```

From `vscode-extension/gakrcli-vscode/webview`:

```bash
npm.cmd run build
```

From `vscode-extension/gakrcli-vscode`:

```bash
npm.cmd test
npm.cmd run build:extension
npx.cmd @vscode/vsce package
npx.cmd @vscode/vsce ls --tree
```

Typecheck is not a required publication gate for this release because there is known broader TypeScript debt outside the validated publishing path.
