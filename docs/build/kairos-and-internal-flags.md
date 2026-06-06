# Kairos And Internal Feature Flags

This page focuses on the feature flags that are most likely to confuse maintainers: `KAIROS` and the private or incomplete flags around it.

## Summary

`KAIROS` is currently `false` in `scripts/build.ts`.

The open checkout contains a small assistant-mode shim in `src/assistant/`. That shim keeps the expected export shape available, but it does not provide private cloud assistant backend behavior.

That means `KAIROS: true` is not simply "turn on a finished product surface." It compiles local assistant-mode paths, but cloud/backend/session-discovery behavior may still be unavailable or reduced.

## What Kairos Means In This Codebase

Kairos is the build gate for assistant-mode behavior. When compiled in, it affects:

- CLI startup paths that parse assistant-mode options.
- Assistant command registration.
- Assistant mode system prompt addendum.
- Brief/user-message layout behavior.
- Some bridge and session continuity paths.
- Tool availability for assistant-style flows.
- Settings and UI paths that expose assistant/default-view behavior.

The open build assistant shim says local assistant mode is allowed when startup requested it through settings or `--assistant`. It also reports that remote assistant sessions are not supported.

## Current Assistant Shim Behavior

The open-build assistant module provides:

| Export | Behavior |
| --- | --- |
| `markAssistantForced()` | Records that assistant mode was requested explicitly. |
| `isAssistantForced()` | Returns whether assistant mode was forced. |
| `isAssistantMode()` | Returns true when forced or when initial settings have `assistant: true`. |
| `initializeAssistantTeam()` | No-op returning `undefined`. |
| `getAssistantSystemPromptAddendum()` | Returns a local assistant-mode prompt addendum. |
| `getAssistantActivationPath()` | Reports `--assistant` or `settings.assistant`. |
| `supportsRemoteAssistantSessions()` | Always returns `false`. |

The gate in `src/assistant/gate.ts` returns `true`, but it is only reachable when the `KAIROS` build flag compiles those paths into the bundle.

## Why `KAIROS` Is Still Off

The comments in the source make the intent clear:

- Private cloud assistant backend code is not mirrored here.
- The shim is deliberately small.
- Remote assistant/session discovery is not supported by the open shim.
- Enabling the build gate can activate many branches across CLI, REPL, bridge, tools, permissions, attachments, and prompts.

Because of that blast radius, `KAIROS` should only be enabled after source and runtime checks are reviewed.

## Related Flags

| Flag | Relationship To Kairos |
| --- | --- |
| `PROACTIVE` | Shares several prompt, UI, and REPL branches with `KAIROS` using `feature('PROACTIVE') || feature('KAIROS')`. It is currently off. |
| `BRIDGE_MODE` | Some Kairos paths interact with bridge/session continuity, but bridge mode itself is private infrastructure and currently off. |
| `KAIROS_BRIEF` | Mentioned in source but not listed in `featureFlags`, so it defaults to false in this build. |
| `KAIROS_CHANNELS` | Mentioned in source but not listed in `featureFlags`, so it defaults to false. |
| `KAIROS_GITHUB_WEBHOOKS` | Mentioned in source but not listed in `featureFlags`, so it defaults to false. |
| `KAIROS_PUSH_NOTIFICATION` | Mentioned in source but not listed in `featureFlags`, so it defaults to false. |

## What Happens If `KAIROS` Is True

At build time:

- Kairos-gated imports become live.
- Assistant command paths can be included.
- Brief layout and assistant-specific UI branches can be included.
- Assistant startup state and session-handling branches can be included.
- Tool schemas may include assistant-specific fields or tools.

At runtime:

- Assistant behavior still depends on settings, command-line options, and local shim behavior.
- Remote assistant sessions remain unsupported by the open shim unless real backend modules are added.
- Bridge/channel/push-notification paths remain unavailable unless their own build flags and infrastructure are also enabled.

## What Happens If `KAIROS` Is False

At build time:

- Kairos branches are replaced with `false`.
- Many Kairos-only imports can be removed.
- Assistant command and assistant-mode startup paths are not included.
- Unknown related flags such as `KAIROS_BRIEF` and `KAIROS_CHANNELS` stay false unless explicitly added to `featureFlags`.

At runtime:

- The normal CLI, SDK, provider, tool, agent, and VS Code extension flows continue without assistant-mode-specific behavior.

## Other Internal Or Incomplete Flags

These flags are also intentionally off because they depend on private infrastructure, native modules, or missing source.

| Flag | Why It Is Sensitive |
| --- | --- |
| `VOICE_MODE` | Depends on voice/STT infrastructure and voice runtime support. |
| `BRIDGE_MODE` | Depends on remote-control/CCR infrastructure. |
| `DAEMON` | Daemon implementation is stubbed in the open build. |
| `AGENT_TRIGGERS` | Scheduled remote agent trigger infrastructure is not present. |
| `BG_SESSIONS` | Background/tmux session handlers are stubbed. |
| `WEB_BROWSER_TOOL` | Browser automation source is not mirrored. |
| `CHICAGO_MCP` | Computer-use native/private modules are stubbed. |
| `MCP_SKILLS` | Requires MCP skill source and named exports that are not present in the open build. |

## Safe Review Questions Before Enabling Kairos

Before setting `KAIROS: true`, answer these:

1. Do `src/assistant/index.ts`, `src/assistant/gate.ts`, and `src/assistant/sessionDiscovery.ts` exist and export the names expected by all Kairos-gated code?
2. Are assistant-mode runtime expectations local-only, or do they need private cloud services?
3. Are bridge/channel/push-notification branches still build-disabled, and is that acceptable?
4. Does `bun test scripts/feature-flags-source-guard.test.ts` pass?
5. Does `bun run build` pass for both CLI and SDK?
6. Does `node dist/cli.mjs --assistant` start without missing-module or missing-export errors?
7. Does the normal CLI still work when assistant mode is not requested?
