# GakrCLI VS Code User Guide

This guide covers GakrCLI VS Code 0.2.4.

For the full manifest-level command, setting, keybinding, view, and package reference, see [REFERENCE.md](REFERENCE.md).

## First Run

1. Open a workspace folder in VS Code.
2. Run `GakrCLI: Open` from the Command Palette.
3. Choose or configure a provider with the provider badge or `/provider`.
4. Ask a question or request a code change.

The native webview uses `@gakr-gakr/gakrcli/sdk`. Terminal mode is available from `GakrCLI: Open in Terminal`.

## Composer Controls

The composer contains:

- Add menu: attach files, images, context, MCP servers, plugins, and web browsing prompts.
- Runtime status: Active, Starting, Running, and related states.
- Model selector: switch models discovered from the active provider.
- Permission mode: Default, Plan, Accept Edits, Bypass, or Don't Ask.
- Provider picker: switch provider profiles or configure explicit provider settings.
- Context usage: live context percentage, token capacity, and autocompact threshold.
- Fast mode: toggle faster/lower-latency behavior when available.
- Reasoning effort: low, medium, or high where supported.

## Tool Rows

Tool calls render as compact rows. Click a row to expand details.

- The collapsed row shows the tool name, summary, and status.
- Expanded input and result panels are bounded and scroll independently.
- Large command output stays inside the tool row instead of stretching the whole chat.
- Failed tools show an error border and result summary.

## Thinking And Compacting

Reasoning content is hidden from the transcript. While hidden thinking is active, the webview shows a compact shining thinking indicator.

When context compaction starts, the transcript shows an active compacting divider. When compaction finishes, it becomes a completed compacted divider and the conversation continues from the compacted state.

## Session History

Use the history button or `/resume` to load previous sessions. Resumed sessions keep their title, visible messages, compact markers, tool rows, and latest known context state.

Use the plus button or `GakrCLI: New Conversation` to start fresh.

## Permissions

Permission modes:

- Default: ask for risky operations.
- Plan: prefer planning before edits.
- Accept Edits: allow edit operations while still protecting unsafe commands.
- Bypass: skip permission checks only when explicitly enabled.
- Don't Ask: deny prompts that require permission.

The extension uses native dialogs for tool permissions and clarification questions.

## Provider Profiles

The extension prefers the active GakrCLI provider profile. You can also configure explicit fallback settings:

- `gakrcliCode.selectedProvider`
- `gakrcliCode.selectedModel`
- `gakrcliCode.apiKey`
- `gakrcliCode.baseUrl`
- `gakrcliCode.environmentVariables`

Use `/provider` when possible because it keeps CLI, SDK, and VS Code behavior aligned.

## Troubleshooting

If the webview is stale after installing a new build:

1. Run `Developer: Reload Window`.
2. Open GakrCLI again.
3. If terminal mode is enabled, confirm `gakrcli --version`.

If Bash or edits fail:

- Check the permission mode.
- Check whether the file has changed since the tool read it.
- Expand the tool row and read the input/result.
- Use a fresh Read before retrying a precise Edit.

If provider state is wrong:

- Run `/provider`.
- Click the refresh button in the header.
- Confirm the active profile and model in the composer footer.
