# GakrCLI System Flow Diagrams

Current versions:

- GakrCLI CLI/SDK: `0.5.6`
- GakrCLI VS Code extension: `0.2.4`

## Native VS Code Webview Flow

```text
User prompt
  -> React webview
  -> VS Code postMessage bridge
  -> Extension host runtime manager
  -> @gakr-gakr/gakrcli/sdk query/session
  -> Provider router
  -> LLM provider
  -> Tool calls and assistant output
  -> SDK messages
  -> Webview transcript
```

The native webview path uses the SDK directly. It does not require a child-process stdin/stdout wrapper.

## Terminal Fallback Flow

```text
VS Code command
  -> Integrated terminal
  -> gakrcli executable
  -> Classic terminal UI
```

Use terminal mode when you want the CLI terminal experience or need to debug provider environment variables directly.

## Tool Execution Flow

```text
Assistant requests a tool
  -> Permission mode check
  -> Optional user permission dialog
  -> Tool execution
  -> Tool result
  -> Compact webview tool row
  -> Result sent back to the model when needed
```

Tool rows are compact by default. Inputs and outputs are available on click and use bounded scroll regions for large content.

## Context And Autocompact Flow

```text
SDK runtime state
  -> context usage snapshot
  -> webview context meter
  -> autocompact threshold display
  -> compacting divider during compaction
  -> compacted divider after completion
  -> conversation continues
```

When a refresh returns no token capacity, the webview preserves the last known context value so the meter does not flicker to zero.

## Session Flow

```text
New or resumed session
  -> SDK session id
  -> transcript events
  -> webview message transforms
  -> persisted history
  -> resume/fork/delete operations
```

New live chats derive a temporary title from the first user prompt until the host/session title is available. Resumed chats keep their stored title.

## Provider Flow

```text
Provider profile or environment
  -> route resolver
  -> model discovery where supported
  -> runtime provider state
  -> composer provider/model controls
  -> request execution
```

Supported provider families are documented in [PROVIDERS.md](PROVIDERS.md).
