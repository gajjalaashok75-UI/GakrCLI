**GakrCLI brings AI-powered coding assistance directly into VS Code.**

GakrCLI can read your files, make edits, run terminal commands, and help you navigate complex codebases — powered by any LLM including GPT-4o, Gemini, DeepSeek, Ollama, and 200+ models via a single interface.

### Before You Start

GakrCLI requires the **GakrCLI CLI** to be installed. Open a terminal and run:

```bash
npm install -g @gitlawb/gakrcli
```

> The VS Code extension is a UI wrapper — all AI intelligence lives in the CLI.

### Configure a Provider

Set up an AI provider in your terminal (or use `/provider` inside GakrCLI):

```bash
# OpenAI (easiest to start)
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> **Credentials you set in the terminal are automatically available in the extension** — the extension spawns the CLI with your terminal's environment.

Prefer working entirely in the terminal? Run **GakrCLI: Open in Terminal** from the Command Palette, or enable it permanently in settings (`gakrcli.useTerminal`).
