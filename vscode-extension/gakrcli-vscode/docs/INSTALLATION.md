# Installation Guide

## Prerequisites

- **VS Code** 1.94.0 or later
- **Node.js** 18.x or later
- **GakrCLI CLI** (`npm install -g @gitlawb/gakrcli`)

The extension is a UI wrapper around the [GakrCLI CLI](https://www.npmjs.com/package/@gitlawb/gakrcli). The CLI must be installed separately — it handles all provider communication, tool execution, and AI orchestration.

## Install from VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **GakrCLI**
4. Click **Install**

Or via command line:

```bash
code --install-extension gakr-gakr.gakrcli-vscode
```

## Install from VSIX

Download the latest `.vsix` from the [Releases page](https://github.com/gajjalaashok75-UI/gakrcli-vscode/releases):

```bash
code --install-extension gakrcli-vscode-1.0.0.vsix
```

## Quick Setup

### 1. Install the CLI

```bash
npm install -g @gitlawb/gakrcli
```

### 2. Configure an AI provider

Set environment variables OR use `/provider` inside GakrCLI:

```bash
# OpenAI
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Google Gemini
export GOOGLE_API_KEY=AIza-your-key-here
export GEMINI_MODEL=gemini-2.0-flash

# Ollama (local)
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3
```

### 3. Open GakrCLI

- Press `Ctrl+Escape` (Windows/Linux) or `Cmd+Escape` (macOS)
- Click the GakrCLI icon in the Activity Bar
- Or run `GakrCLI: Open in New Tab` from the Command Palette

## Verify Installation

Open GakrCLI and type a prompt. If the CLI is properly installed and a provider is configured, you should see a streaming response.

## Troubleshooting

### "GakrCLI CLI not found"

Ensure `@gitlawb/gakrcli` is installed globally:

```bash
npm install -g @gitlawb/gakrcli
gakrcli --version
```

### "Not logged in" or provider errors

Configure a provider via `/provider` in the chat or set the appropriate environment variables. See [USAGE.md](USAGE.md#provider-setup) for provider-specific setup.

### Extension fails to start

Check the GakrCLI output channel: run `GakrCLI: Show Logs` from the Command Palette. Common issues include missing CLI, provider configuration, or Windows path resolution (see [ARCHITECTURE.md](ARCHITECTURE.md#windows-compatibility)).
