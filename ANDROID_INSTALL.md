# GakrCLI On Android (Termux)

This guide explains how to run GakrCLI on Android with Termux and a proot Ubuntu environment.

## What Works

- Running the built CLI with Node.js 20+
- Building from source inside Ubuntu proot with Bun
- Cloud providers and OpenAI-compatible gateways
- Local Android inference only if you provide a compatible local `/v1` endpoint

## Prerequisites

- Android phone with at least 1 GB free storage
- Termux installed from F-Droid, not the Play Store
- A provider API key, unless you are using a local OpenAI-compatible endpoint

## Why Use proot Ubuntu?

GakrCLI uses Bun for source builds. Bun does not support Android directly, but its Linux binary works inside an Ubuntu userspace created by `proot-distro`.

## Install

### 1. Update Termux

```bash
pkg update && pkg upgrade
```

Press Enter for normal package prompts unless you know you need a custom choice.

### 2. Install Termux Dependencies

```bash
pkg install git proot-distro ripgrep
```

### 3. Install Ubuntu

```bash
proot-distro install ubuntu
proot-distro login ubuntu
```

All remaining commands in this guide run inside the Ubuntu shell.

### 4. Install Ubuntu Dependencies

```bash
apt update
apt install -y curl git nodejs npm ripgrep
node --version
npm --version
```

GakrCLI requires Node.js 20 or newer. If Ubuntu's package repository provides an older Node.js, install a current Node.js release before continuing.

### 5. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

Use Bun `1.3.11` or newer.

### 6. Clone And Build GakrCLI

```bash
git clone https://github.com/gajjalaashok75-UI/GakrCLI.git
cd GakrCLI # Not work then use this before clone , cd /data/data/com.termux/files/home
bun install
bun run build
node dist/cli.mjs --version
```

### 7. Configure A Provider

Use any OpenAI-compatible provider by setting the standard environment variables:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=your_provider_key_here
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
export OPENAI_MODEL=your/provider-model
```

For OpenRouter, model availability and free tiers change over time. Check OpenRouter's model page and choose a currently available model that supports tool use and has enough context for coding-agent prompts.

To persist the provider setup:

```bash
cat >> ~/.bashrc <<'EOF'
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=your_provider_key_here
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
export OPENAI_MODEL=your/provider-model
EOF
source ~/.bashrc
```

Do not commit real keys to this repository.

### 8. Run GakrCLI

```bash
node dist/cli.mjs
```

Inside the CLI, run `/provider` if you prefer guided provider setup.

## Restarting Later

After reopening Termux:

```bash
proot-distro login ubuntu
cd ~/GakrCLI
node dist/cli.mjs
```

## Updating

```bash
proot-distro login ubuntu
cd ~/GakrCLI
git pull
bun install
bun run build
node dist/cli.mjs --version
```

## Troubleshooting

### `bun: command not found`

Run:

```bash
source ~/.bashrc
```

If Bun is still missing, rerun the Bun installer inside Ubuntu.

### `node --version` Is Below 20

Install a current Node.js release inside Ubuntu before building or running GakrCLI.

### Provider Fails With Context Or Rate Limit Errors

Coding-agent prompts can be large. Choose a provider/model with a sufficiently large context window and rate limits. Free tiers may fail even when a model is otherwise compatible.

### Termux Session Stops

Avoid swiping Termux away while GakrCLI is working. Use the home button to background it instead.
