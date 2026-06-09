# Windows aliases and launchers

This page documents optional PowerShell helper functions for launching GakrCLI on Windows after a global npm install.

These helpers are designed for the installed package workflow:

~~~powershell
npm install -g @gakr-gakr/gakrcli
~~~

The helpers use the installed `gakrcli` CLI command. They do not require a source checkout and do not call source-only `bun run scripts/*.ts` entrypoints.

## One-time setup

Run this once in PowerShell:

~~~powershell
$packageRoot = Join-Path (npm root -g) "@gakr-gakr/gakrcli"
$aliases = Join-Path $packageRoot "scripts\windows\gakrcli-aliases.ps1"

if (-not (Test-Path $aliases)) {
  throw "Alias script not found at $aliases. Update or reinstall @gakr-gakr/gakrcli."
}

if (-not (Test-Path $PROFILE)) {
  New-Item -ItemType File -Path $PROFILE -Force | Out-Null
}

$profileLine = ". `"$aliases`""

if (-not (Select-String -Path $PROFILE -Pattern ([regex]::Escape($profileLine)) -Quiet)) {
  Add-Content -Path $PROFILE -Value "`n$profileLine"
}

. $aliases
cli-help
~~~

Open a new PowerShell window after setup, or dot-source the profile:

~~~powershell
. $PROFILE
~~~

## Daily commands

### Launch GakrCLI using the installed CLI

~~~powershell
cli
~~~

You can pass normal CLI arguments through `cli`:

~~~powershell
cli --version
cli --help
~~~

### Launch with local Ollama/OpenAI-compatible environment hints

~~~powershell
cli-local
~~~

By default, this uses local Ollama through the OpenAI-compatible API:

~~~text
GAKR_CODE_USE_OPENAI=1
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.1:8b
~~~

To use a different local model for that invocation:

~~~powershell
cli-local -Model "qwen2.5-coder:7b"
~~~

The environment overrides are scoped to that single `gakrcli` invocation. A later plain `cli` call returns to normal installed CLI behavior and saved-provider-profile behavior.

### Launch with low-latency local defaults

~~~powershell
cli-fast
~~~

To use a different model:

~~~powershell
cli-fast -Model "qwen2.5-coder:7b"
~~~

Like `cli-local`, the environment overrides are scoped to that single invocation.

### Open the provider manager

~~~powershell
cli-provider
~~~

This opens the provider manager through the installed GakrCLI CLI.

### Check local Ollama state

~~~powershell
cli-check
~~~

To check a specific model:

~~~powershell
cli-check -Model "qwen2.5-coder:7b"
~~~

### Pull/check a local model, then launch local mode

~~~powershell
cli-init
~~~

To choose a model:

~~~powershell
cli-init -Model "qwen2.5-coder:7b"
~~~

To skip pulling the model and only check/launch:

~~~powershell
cli-init -Model "qwen2.5-coder:7b" -SkipModelPull
~~~

`cli-init` does not save a provider profile. It pulls/checks the local Ollama model and then launches `cli-local`.

### Show quick help

~~~powershell
cli-help
~~~

## Command summary

| Command | Purpose |
| --- | --- |
| `cli` | Launch GakrCLI using the installed CLI and saved/default behavior |
| `cli-local` | Launch once with local Ollama/OpenAI-compatible environment hints |
| `cli-fast` | Launch once with local Ollama/OpenAI-compatible low-latency hints |
| `cli-provider` | Open the provider manager |
| `cli-check` | Show local Ollama install/listening/model state |
| `cli-init` | Pull/check a local Ollama model, then launch local mode |
| `cli-help` | Show quick command help |

## Notes

These helpers are intentionally global-install oriented. They use the installed CLI instead of source-checkout development scripts.

For advanced provider setup, use the built-in provider manager:

~~~powershell
cli-provider
~~~

