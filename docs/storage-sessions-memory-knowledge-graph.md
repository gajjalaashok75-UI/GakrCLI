# Storage, Sessions, Memory, and Knowledge Graph Architecture

This document maps the persistent and semi-persistent storage used by GakrCLI:
sessions, transcripts, subagents, tool results, memory, knowledge graph files,
SQLite, Orama, JSON configuration, wiki files, tasks, and team/subagent data.

The implementation is path-driven. Most runtime state is outside the repository
checkout and is keyed by the current project path, session UUID, or team/task
identifier.

## Scope And Assumptions

- `<configHome>` means `GAKR_CONFIG_DIR` if set, otherwise `~/.gakrcli`.
- `<workspace>` means `GAKRCLI_WORKSPACE_DIR` or `GAKR_WORKSPACE_DIR` if set,
  otherwise `<configHome>/workspace`.
- `<projects>` means `<workspace>/projects`.
- `<projectDir>` means `<projects>/<sanitized-project-path>`.
- `<sessionId>` is the active session UUID.
- `<cwd>` is the current project checkout unless a specific code path says it
  uses `getOriginalCwd()` or `getCwd()`.
- Runtime-created `.db` and `.orama` files are not checked into this repository.
  They are created under `<projectDir>` when the knowledge graph is used.

Primary source files:

- `src/utils/envUtils.ts`
- `src/utils/env.ts`
- `src/utils/workspace.ts`
- `src/utils/sessionStorage.ts`
- `src/utils/sessionPersistence.ts`
- `src/types/logs.ts`
- `src/utils/toolResultStorage.ts`
- `src/utils/knowledgeGraph.ts`
- `src/utils/storage/JSONProvider.ts`
- `src/utils/storage/SQLiteProvider.ts`
- `src/utils/conversationArc.ts`
- `src/memdir/*`
- `src/services/extractMemories/*`
- `src/services/autoDream/*`
- `src/services/SessionMemory/*`
- `src/tools/AgentTool/*`
- `src/utils/task/*`
- `src/utils/tasks.ts`
- `src/utils/swarm/teamHelpers.ts`
- `src/services/wiki/*`

## Storage Root Map

| Area | Path | Purpose |
| --- | --- | --- |
| Config home | `<configHome>` | User settings, installed plugins, auth-related caches, teams, tasks, workspace root by default. |
| Legacy global config | `~/.gakrcli*.json` or `<GAKR_CONFIG_DIR>/.gakrcli*.json` | Legacy/global JSON config and caches. Falls back to `<configHome>/.config.json` if present. |
| User settings | `<configHome>/settings.json` or `<configHome>/cowork_settings.json` | Global settings. |
| Project settings | `<cwd>/.gakrcli/settings.json` | Shared project settings. |
| Local project settings | `<cwd>/.gakrcli/settings.local.json` | Gitignored project-local settings. |
| Managed settings | platform path `managed-settings.json` and `managed-settings.d/*.json` | Enterprise/policy settings. Windows default is `C:\Program Files\gakrcliCode`. |
| Workspace | `<workspace>` | Durable cross-project workspace files. |
| Projects root | `<projects>` | Per-project session, graph, tool result, and generated state root. |
| Project runtime dir | `<projectDir>` | Runtime state for one sanitized project path. |
| Main transcript | `<projectDir>/<sessionId>.jsonl` | Append-only JSONL transcript for one main session. |
| Session sidecar dir | `<projectDir>/<sessionId>/` | Session-scoped subdirectories: subagents, remote agents, tool results, session memory. |
| Subagent transcript | `<projectDir>/<sessionId>/subagents/agent-<agentId>.jsonl` | Append-only JSONL sidechain for a subagent. |
| Subagent metadata | `<projectDir>/<sessionId>/subagents/agent-<agentId>.meta.json` | Agent type, worktree path, description. |
| Remote agent metadata | `<projectDir>/<sessionId>/remote-agents/remote-agent-<taskId>.meta.json` | Remote/background agent restore metadata. |
| Tool results | `<projectDir>/<sessionId>/tool-results/<toolUseId>.json|.txt` | Full persisted output for large tool results. |
| Session memory | `<projectDir>/<sessionId>/session-memory/summary.md` | Current-session rolling summary. |
| Knowledge JSON | `<projectDir>/knowledge_graph.json` | Human-readable graph backing store. |
| Knowledge SQLite | `<projectDir>/knowledge.db`, `knowledge.db-wal`, `knowledge.db-shm` | Working store for graph data. |
| Knowledge Orama | `<projectDir>/knowledge.orama` | Persisted Orama search index. |
| Auto memory | `<memoryBase>/projects/<sanitized-project-root>/memory/` | Durable semantic memory topic files and `MEMORY.md` index. |
| Team memory | `<autoMemory>/team/` | Shared project/team memory topic files and index. |
| Agent user memory | `<memoryBase>/agent-memory/<agentType>/` | User-level persistent agent memory. |
| Agent project memory | `<cwd>/.gakrcli/agent-memory/<agentType>/` | Project-level persistent agent memory. |
| Agent local memory | `<cwd>/.gakrcli/agent-memory-local/<agentType>/` or remote override | Local/private agent memory. |
| Agent memory snapshot | `<cwd>/.gakrcli/agent-memory-snapshots/<agentType>/snapshot.json` | Project snapshot metadata for agent memory bootstrap. |
| Project wiki | `<cwd>/.gakrcli/wiki/` | Human-readable project wiki pages, sources, log, schema. |
| Task output files | temp `<projectTemp>/<sessionId>/tasks/<taskId>.output` | Large/background process output. |
| Task coordination JSON | `<configHome>/tasks/<taskListId>/<taskId>.json` | Todo/task list persistence. |
| Team config JSON | `<configHome>/teams/<teamName>/config.json` | Swarm/team membership and coordination. |

## Confirmation Inventory: Supporting Stores

This second-pass inventory covers storage that is easy to miss because it is
not named "memory" or "session" directly. These files still affect resume,
replay, subagent coordination, tool output hydration, permissions, diagnostics,
or session-adjacent behavior.

### Bridge And Session Process State

| Store | Path | Schema / Contents | Lifecycle |
| --- | --- | --- | --- |
| Bridge pointer | `<projectDir>/bridge-pointer.json` | `{ sessionId: string; environmentId: string; source: 'standalone' | 'repl' }` | Reused by bridge attach flows; stale entries older than 4 hours are deleted. |
| Inbound bridge uploads | `<configHome>/uploads/<sessionId>/<uuid8>-<safe-filename>` | Raw downloaded file bytes for inbound attachment descriptors `{ file_uuid, file_name }` | Session-scoped upload cache. |
| Session env hook files | `<configHome>/session-env/<sessionId>/setup-hook-<n>.sh`, `sessionstart-hook-<n>.sh`, `cwdchanged-hook-<n>.sh`, `filechanged-hook-<n>.sh` | Shell snippets sourced through `GAKR_ENV_FILE` and sorted hook env files | Not supported on Windows; used to reconstruct session environment. |
| Concurrent session registry | `<configHome>/sessions/<pid>.json` | PID-named files with `{ pid, sessionId, cwd, startedAt, kind, entrypoint?, messagingSocketPath?, name?, logPath?, agent?, bridgeSessionId?, status?, waitingFor?, updatedAt? }` | Removed on cleanup; stale PID files swept where process liveness can be checked. |
| Simple session persistence | `<configHome>/sessions/<sessionId>.json` | Secondary session JSON from `sessionPersistence.ts` | Same directory as PID registry; distinguish by filename shape. |
| Computer-use lock | `<configHome>/computer-use.lock` | `{ sessionId: string; pid: number; acquiredAt: number }` | Atomic `wx` lock; stale PID recovery; released by cleanup. |
| Auto-updater lock | `<configHome>/.update.lock` | Plain PID string | 5 minute stale timeout; prevents concurrent updates. |

Source files: `src/bridge/bridgePointer.ts`,
`src/bridge/inboundAttachments.ts`, `src/utils/sessionEnvironment.ts`,
`src/utils/concurrentSessions.ts`, `src/utils/sessionPersistence.ts`,
`src/utils/computerUse/computerUseLock.ts`, `src/utils/autoUpdater.ts`.

### Prompt, Input, Plans, And Temporary Work Areas

| Store | Path | Schema / Contents | Lifecycle |
| --- | --- | --- | --- |
| Prompt history | `<configHome>/history.jsonl` | JSONL entries `{ display, pastedContents, timestamp, project, sessionId? }` where pasted contents map numeric ids to `{ id, type: 'text' | 'image', content?, contentHash?, mediaType?, filename? }` | Reads last 100 entries. Small pasted text is inline; large text is hash-backed. |
| Paste cache | `<configHome>/paste-cache/<sha256-16>.txt` | Large pasted text by first 16 hex chars of SHA-256 | Referenced from prompt history. |
| Image cache | `<configHome>/image-cache/<sessionId>/<imageId>.<ext>` | Prompt image bytes | In-memory path map is bounded; old session dirs are cleaned opportunistically. |
| Plans | `<plansDir>/<planSlug>.md`, `<plansDir>/<planSlug>-agent-<agentId>.md` | Markdown plan text | Default `<configHome>/plans`, override by `plansDirectory` if it remains inside the project root. |
| Scratchpad | `<tmp>/gakrcli/<sanitized-original-cwd>/<sessionId>/scratchpad/` | Free-form temporary files created by tools when scratchpad gate is enabled | Per-session temp directory with owner-only permissions. |
| Task output files | `<tmp>/gakrcli/<sanitized-original-cwd>/<sessionId>/tasks/<taskId>.output` | Large task output text | Temp, used to avoid oversized in-memory/task UI output. |
| BYOC outputs | `<cwd>/<remoteSessionId>/outputs/**` | User/output files modified during a turn; uploaded to Files API as `{ filename, file_id? }` plus failures `{ filename, error }` | Scanned by mtime from turn start, symlinks skipped, max 100 files. |
| Shell snapshots | `<configHome>/shell-snapshots/snapshot-<shellType>-<timestamp>-<random>.sh` | Shell state restoration script | Registered for graceful cleanup. |
| Auto-mode dumps | `<tmp>/gakrcli/auto-mode/<timestamp>[.<suffix>].req.json` and `.res.json` | Classifier request/response JSON when `GAKR_CODE_DUMP_AUTO_MODE` is set | Ant/debug only. |
| Auto-mode error dump | `<tmp>/gakrcli/auto-mode-classifier-errors/<sessionId>.txt` | Classifier error, context comparison, system prompt, user prompt | Session-scoped and collected by share/debug flows. |
| Dump prompts | `<configHome>/dump-prompts/<agentIdOrSessionId>.jsonl` | JSONL entries `{ type: 'init' | 'system_update' | 'message' | 'response', timestamp, data }` | Debug/support capture for recent API request/response content. |

Source files: `src/history.ts`, `src/utils/pasteStore.ts`,
`src/utils/imageStore.ts`, `src/utils/plans.ts`,
`src/utils/permissions/filesystem.ts`, `src/utils/task/outputFile.ts`,
`src/utils/bash/ShellSnapshot.ts`, `src/utils/filePersistence/*`,
`src/utils/permissions/yoloClassifier.ts`, `src/services/api/dumpPrompts.ts`.

### File Recovery And Edited Content

| Store | Path | Schema / Contents | Lifecycle |
| --- | --- | --- | --- |
| File-history backups | `<configHome>/file-history/<sessionId>/<sha256(filePath).slice(0,16)>@v<version>` | Raw backup copy of file contents before edits; `null` backup in memory means the file did not previously exist | Used by restore/rewind flows; forked resumes may hard-link or copy previous backups. |
| File-history transcript entries | Main transcript JSONL entries with type/subtype `file-history-snapshot` | Snapshot metadata tying paths, versions, and backup identifiers to a transcript point | Persisted with normal session replay data. |
| Git operation attribution | Main transcript JSONL attribution entries | Session-linked git operation metadata | Stored in transcript, not a separate DB. |

Source files: `src/utils/fileHistory.ts`, `src/utils/sessionStorage.ts`,
`src/tools/shared/gitOperationTracking.ts`.

### Durable Jobs, Hooks, Teams, And Swarm Mailboxes

| Store | Path | Schema / Contents | Lifecycle |
| --- | --- | --- | --- |
| Durable scheduled tasks | `<cwd>/.gakrcli/scheduled_tasks.json` | `{ tasks: CronTask[] }`, where `CronTask` has `id`, `cron`, `prompt`, `createdAt`, `lastFiredAt?`, `recurring?`, `permanent?`; runtime-only fields include `durable?`, `agentId?` | Only written when `durable: true`; non-durable jobs are in-memory session state. |
| Hook chains | `<cwd>/.gakrcli/hook-chains.json` or `GAKR_CODE_HOOK_CHAINS_CONFIG_PATH` | `{ version: 1, enabled, maxChainDepth, defaultCooldownMs, defaultDedupWindowMs, rules }` | Runtime cooldown/dedup maps are not persisted. |
| Teammate mailbox | `<configHome>/teams/<team>/inboxes/<agentName>.json` and `.lock` | Array of `{ from, text, timestamp, read, color?, summary? }`; protocol payloads are embedded in `text` | Used for team/subagent DMs, approvals, shutdowns, and assignments. |
| Deprecated swarm permission pending | `<configHome>/teams/<team>/permissions/pending/<requestId>.json` | `SwarmPermissionRequest` with id, worker fields, team, tool, input, permission suggestions, status, timestamps | File-based sync path retained for compatibility. |
| Deprecated swarm permission resolved | `<configHome>/teams/<team>/permissions/resolved/<requestId>.json` | Same request plus `resolvedBy?`, `resolvedAt?`, `feedback?`, `updatedInput?`, `permissionUpdates?` | Resolved permission archive. |

Source files: `src/utils/cronTasks.ts`, `src/utils/hookChains.ts`,
`src/utils/teammateMailbox.ts`, `src/utils/swarm/permissionSync.ts`.

### Plugin, Marketplace, MCPB, And Plugin Option Stores

| Store | Path | Schema / Contents | Lifecycle |
| --- | --- | --- | --- |
| Plugin root | `GAKR_CODE_PLUGIN_CACHE_DIR` or `<configHome>/plugins` (`cowork_plugins` in cowork mode) | Plugin install/cache root | Shared by all plugin stores below. |
| Installed plugins | `<pluginsDir>/installed_plugins.json` | V2 install metadata: plugin identity, install path, version, timestamps, source, cache path/scope data | Legacy `installed_plugins_v2.json` is migrated/renamed. |
| Plugin caches | `<pluginsDir>/cache/<marketplace>/<plugin>/<version>/` and legacy `<pluginsDir>/cache/<plugin-name>/` | Cached plugin source trees | Legacy caches are migrated/cleaned. |
| Orphan marker | `<versioned-plugin-cache>/.orphaned_at` | Timestamp marker | Removed if installed again; orphan dirs deleted after 7 days. |
| Persistent plugin data | `<pluginsDir>/data/<sanitizedPluginId>/` | Plugin-owned durable data, exposed to plugins as `GAKR_PLUGIN_DATA` | Survives plugin updates; removed on last-scope uninstall. |
| Known marketplaces | `<pluginsDir>/known_marketplaces.json` | Map of marketplace name to `{ source, installLocation, lastUpdated }` | State layer; not deleted just because a cache refresh fails. |
| Marketplace cache | `<pluginsDir>/marketplaces/<name>.json` or `<pluginsDir>/marketplaces/<name>/.gakrcli-plugin/marketplace.json` | Cached marketplace manifest | URL/file/GitHub/directory sources normalize here. |
| Install counts cache | `<pluginsDir>/install-counts-cache.json` | `{ version: 1, fetchedAt, counts: [{ plugin, unique_installs }] }` | TTL 24 hours. |
| MCPB cache | `<pluginPath>/.mcpb-cache/<sourceHash>.metadata.json`, `<sourceHash>.mcpb`, `<contentHash>/` | Metadata includes source, source mtime/url, extracted path, content hash, cachedAt | Per-plugin binary package cache. |
| Plugin options | User/project settings `pluginConfigs[pluginId].options` | Non-sensitive plugin configuration | Deleted on last-scope uninstall. |
| Plugin secrets | Secure storage `pluginSecrets[pluginId]` | Sensitive plugin option values | Stored through secure storage backend. |

Source files: `src/utils/plugins/pluginDirectories.ts`,
`src/utils/plugins/installedPluginsManager.ts`,
`src/utils/plugins/cacheUtils.ts`, `src/utils/plugins/marketplaceManager.ts`,
`src/utils/plugins/installCounts.ts`, `src/utils/plugins/mcpbHandler.ts`,
`src/utils/plugins/pluginOptionsStorage.ts`.

### MCP, Auth, Provider, And Policy Stores

| Store | Path | Schema / Contents | Lifecycle |
| --- | --- | --- | --- |
| Project MCP config | `<cwd>/.mcp.json` | `{ mcpServers: Record<string, McpServerConfig> }`; server configs include stdio, SSE, HTTP, WebSocket, SDK, IDE, and Gakr.ai proxy variants | Atomic temp write plus rename; preserves permissions. |
| Enterprise MCP config | `<managedPath>/managed-mcp.json` | Same MCP server shape, policy-managed | Read-only to normal project config flows. |
| MCP needs-auth cache | `<configHome>/mcp-needs-auth-cache.json` | `Record<serverId, { timestamp: number }>` | TTL 15 minutes; suppresses repeated auth prompts/events. |
| MCP refresh locks | `<configHome>/mcp-refresh-<sanitizedServerKey>.lock` | Lockfile only | Coordinates OAuth token refresh across processes. |
| Secure storage fallback | `<configHome>/.credentials.json` | `SecureStorageData`: Codex tokens, MCP OAuth entries, MCP client secrets, trusted device token, plugin secrets | Plaintext fallback chmod 0600; native vault preferred. |
| Windows secure storage | `<configHome>/<resourceName>.secure.dpapi` | DPAPI-protected secure storage blob | Windows Credential Locker/DPAPI backend. |
| Provider profile | `<configHome>/.gakrcli-profile.json` or legacy `<cwd>/.gakrcli-profile.json` | `{ profile, env, createdAt }` | Stores provider/environment profile; secrets are masked/sanitized where possible. |
| Codex auth fallback | `$CODEX_HOME/auth.json` or `~/.codex/auth.json` | External Codex auth token file | Read as a provider credential source, not owned by this project. |
| Remote managed settings cache | `<configHome>/remote-settings.json` | Settings JSON from remote policy sync | Session cache invalidates merged settings when first loaded. |
| Policy limits cache | `<configHome>/policy-limits.json` | `{ restrictions: Record<string, { allowed: boolean }> }` | ETag/checksum aware, mode 0600, fails open, stale cache can be used after fetch failure. |

`McpServerConfig` summary:

```ts
type McpServerConfig =
  | { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string>; cwd?: string }
  | { type: 'sse' | 'http'; url: string; headers?: Record<string, string>; headersHelper?: string; oauth?: McpOAuthConfig }
  | { type: 'ws'; url: string; headers?: Record<string, string>; headersHelper?: string }
  | { type: 'sdk'; name: string }
  | { type: 'sse-ide' | 'ws-ide'; url: string; ideName: string; authToken?: string }
  | { type: 'gakrcliai-proxy'; url: string; id: string }
```

Source files: `src/services/mcp/config.ts`, `src/services/mcp/types.ts`,
`src/services/mcp/client.ts`, `src/services/mcp/auth.ts`,
`src/utils/secureStorage/*`, `src/utils/providerProfile.ts`,
`src/services/api/providerConfig.ts`,
`src/services/remoteManagedSettings/syncCacheState.ts`,
`src/services/policyLimits/*`.

### Stats, Models, Insights, Logs, And Telemetry

| Store | Path | Schema / Contents | Lifecycle |
| --- | --- | --- | --- |
| Stats cache | `<configHome>/stats-cache.json` | Versioned aggregate stats: daily activity, model tokens, model usage, totals, longest session, hour counts, speculation time saved, shot distribution | Current version 3; migrates older cache versions; atomic temp+rename. |
| Model discovery cache | `<configHome>/model-discovery-cache.json` | `{ version: 1, entries: Record<string, { models, updatedAt, error }> }` | Provider model list cache. |
| OpenAI-compatible model cache | `<configHome>/model-cache/<provider>.json` | `{ version: '1', timestamp, provider, models: [{ value, label, description }] }` | TTL 24 hours; used for local/OpenAI-compatible providers. |
| Model capabilities | `<configHome>/cache/model-capabilities.json` | `{ models: [{ id, max_input_tokens?, max_tokens? }], timestamp }` | First-party eligible only; mode 0600. |
| Changelog cache | `<configHome>/cache/changelog.md` | Serialized public release notes | Migrated from older global config field. |
| Usage insights facets | `<configHome>/usage-data/facets/<sessionId>.json` | `SessionFacets`: goal, categories, outcome, satisfaction/helpfulness, type, friction, success fields | Corrupt facet files are deleted and regenerated. |
| Usage insights meta | `<configHome>/usage-data/session-meta/<sessionId>.json` | Cached session metadata derived from transcripts | Used by `/insights`. |
| Usage insights report | `<configHome>/usage-data/report.html` | Generated HTML report | Overwritten when report is regenerated. |
| Debug logs | `<configHome>/debug/<sessionId>.txt` or `GAKR_CODE_DEBUG_LOGS_DIR` or `--debug-file` | Text log lines; `latest` symlink points to current log where supported | Buffered unless immediate debug mode is active. |
| Error logs | env-paths cache `gakrcli-cli/<sanitized-cwd>/errors/<date>.jsonl` | JSONL `{ timestamp, error, cwd, userType, sessionId, version }` | Ant/debug sink only. |
| MCP logs | env-paths cache `gakrcli-cli/<sanitized-cwd>/mcp-logs-<server>/<date>.jsonl` | JSONL debug/error entries for MCP server | Buffered log writer. |
| First-party failed events | `<configHome>/telemetry/1p_failed_events.<sessionId>.<batchUuid>.json` | JSONL first-party event envelopes | Retried with backoff, dropped after max attempts. |
| Perfetto trace | `<configHome>/traces/trace-<sessionId>.json` or `GAKR_CODE_PERFETTO_TRACE=<path>` | Chrome Trace JSON `{ traceEvents, metadata }` | Optional, feature-gated, final write on cleanup/exit. |
| VCR fixtures | `<cwd>/fixtures/*.json` or `GAKR_CODE_TEST_FIXTURES_ROOT/fixtures/*.json` | Test request/response fixtures | Used only in tests or forced ant VCR mode. |

Source files: `src/utils/statsCache.ts`,
`src/integrations/discoveryCache.ts`, `src/utils/model/modelCache.ts`,
`src/utils/model/modelCapabilities.ts`, `src/utils/releaseNotes.ts`,
`src/commands/insights.ts`, `src/utils/debug.ts`,
`src/utils/errorLogSink.ts`, `src/utils/cachePaths.ts`,
`src/services/analytics/firstPartyEventLoggingExporter.ts`,
`src/utils/telemetry/perfettoTracing.ts`, `src/services/vcr.ts`.

### UI, Extension, Keybindings, And Workspace State

| Store | Path / API | Schema / Contents | Lifecycle |
| --- | --- | --- | --- |
| Workspace state | `<workspace>/.gakrcli/workspace-state.json` | Workspace metadata managed by `src/utils/workspace.ts` | Created with workspace bootstrap files. |
| User keybindings | `<configHome>/keybindings.json` | `{ bindings: KeybindingBlock[] }`, where each block has `context` and `bindings` | Hot-reloaded when customization is enabled. |
| Project launch config | `<cwd>/.gakrcli/launch.json` | Desktop preview/dev-server launch configuration | Treated as project config for permission purposes. |
| Web theme | Browser `localStorage['gakrcli-theme']` | Theme string | Frontend only. |
| VS Code onboarding | Webview/browser `localStorage['gakrcli.onboarding.dismissed']` | `'1'` when dismissed | Extension webview only. |
| VS Code webview state | VS Code `acquireVsCodeApi().getState()/setState()` | `{ scrollTop?, draftText?, sessionId?, isScrollPaused?, collapsedToolCalls?, ... }` | Persists webview UI state across hide/show and serializer restores. |
| VS Code always-allow rules | VS Code `workspaceState['gakrcli.permissionRules.alwaysAllow']` | `string[]` of tool names/rules | Extension workspace-scoped permission cache. |

Source files: `src/utils/workspace.ts`, `src/keybindings/loadUserBindings.ts`,
`src/utils/permissions/filesystem.ts`, `web/src/App.tsx`,
`web/index.html`, `vscode-extension/gakrcli-vscode/webview/src/vscode.ts`,
`vscode-extension/gakrcli-vscode/src/permissions/permissionRules.ts`.

## Path Resolution Details

### Config And Workspace

`getGakrcliConfigHomeDir()` returns `GAKR_CONFIG_DIR` if present; otherwise it
uses `~/.gakrcli`. `getGakrcliWorkspaceDir()` returns `GAKRCLI_WORKSPACE_DIR` or
`GAKR_WORKSPACE_DIR` if set; otherwise it uses `<configHome>/workspace`.
`getProjectsDir()` is always `<workspace>/projects`.

`getGlobalGakrcliFile()` is separate from `<configHome>/settings.json`. By
default it points at `~/.gakrcli*.json`, with an OAuth suffix if configured. If
`<configHome>/.config.json` exists, that legacy path wins.

Workspace files are initialized by `ensureGakrcliWorkspace()`:

- `<workspace>/GAKRCLI.md`
- `<workspace>/RULEBOOK.md`
- `<workspace>/SOUL.md`
- `<workspace>/IDENTITY.md`
- `<workspace>/USER.md`
- `<workspace>/BOOTSTRAP.md`
- `<workspace>/MEMORY.md`
- `<workspace>/.gakrcli/workspace-state.json`
- `<workspace>/projects/`

`BOOTSTRAP.md` is special one-shot bootstrap material. The other workspace
Markdown files are durable cross-project context.

### Project Directory Sanitization

Session and graph paths use a sanitized version of the original project path.
The portable sanitizer replaces non-alphanumeric characters with hyphens and
truncates very long names with a hash suffix. `resolveSessionFilePath()` can
recover from long-path hash mismatches by scanning project directories and
worktree siblings.

## Settings And Config JSON

Settings load order is:

1. User settings: `<configHome>/settings.json` or `cowork_settings.json`.
2. Project settings: `<cwd>/.gakrcli/settings.json`.
3. Local settings: `<cwd>/.gakrcli/settings.local.json`.
4. Flag settings: inline or file from the `--settings` flag.
5. Policy settings: remote, OS/MDM, managed settings file, or drop-ins.

Later sources override earlier sources. Policy and flag settings are read-only
from the normal settings editing API.

Managed file settings:

- Windows: `C:\Program Files\gakrcliCode\managed-settings.json`
- macOS: `/Library/Application Support/gakrcliCode/managed-settings.json`
- Linux: `/etc/gakrcli-code/managed-settings.json`
- Drop-ins: `managed-settings.d/*.json`, sorted alphabetically and merged after
  the base file.

Legacy/global config stores account, onboarding, cache, feature, usage, and
project config state. The important shape is:

```ts
type GlobalConfig = {
  projects?: Record<string, ProjectConfig>
  numStartups: number
  theme: ThemeSetting
  oauthAccount?: AccountInfo
  autoCompactEnabled: boolean
  toolHistoryCompressionEnabled: boolean
  cachedStatsigGates: Record<string, unknown>
  cachedDynamicConfigs?: Record<string, unknown>
  cachedGrowthBookFeatures?: Record<string, unknown>
  memoryUsageCount: number
  mcpServers?: Record<string, McpServerConfig>
  // many UI, auth, provider, cache, and usage fields omitted here
}
```

`ProjectConfig` inside the global config tracks per-project runtime state such
as allowed tools, MCP state, last metrics, trust dialog flags, and active
worktree session metadata.

## Main Session Transcript Storage

### Path

Primary transcript:

```text
<projectDir>/<sessionId>.jsonl
```

Each line is one JSON object. Main sessions are UUID-named `.jsonl` files.
Agent sidechains are not considered main session files.

### Transcript Entry Schema

The `Entry` union in `src/types/logs.ts` includes transcript messages and
metadata records.

Transcript message base:

```ts
type SerializedMessage = Message & {
  cwd: string
  userType: string
  entrypoint?: string
  sessionId: string
  timestamp: string
  version: string
  gitBranch?: string
  slug?: string
}

type TranscriptMessage = SerializedMessage & {
  parentUuid: UUID | null
  logicalParentUuid?: UUID | null
  isSidechain: boolean
  agentId?: string
  teamName?: string
  agentName?: string
  agentColor?: string
  promptId?: string
}
```

`isTranscriptMessage()` treats these message types as conversation messages:

- `user`
- `assistant`
- `attachment`
- `system`

Progress entries may exist in old transcripts, but new parent-chain logic does
not treat `progress` as a transcript message. Resume has a compatibility bridge
for old progress-parent chains.

Metadata entries:

```ts
type SummaryMessage = { type: 'summary'; leafUuid: UUID; summary: string }
type CustomTitleMessage = { type: 'custom-title'; sessionId: UUID; customTitle: string }
type AiTitleMessage = { type: 'ai-title'; sessionId: UUID; aiTitle: string }
type LastPromptMessage = { type: 'last-prompt'; sessionId: UUID; lastPrompt: string }
type TaskSummaryMessage = { type: 'task-summary'; sessionId: UUID; summary: string; timestamp: string }
type TagMessage = { type: 'tag'; sessionId: UUID; tag: string }
type AgentNameMessage = { type: 'agent-name'; sessionId: UUID; agentName: string }
type AgentColorMessage = { type: 'agent-color'; sessionId: UUID; agentColor: string }
type AgentSettingMessage = { type: 'agent-setting'; sessionId: UUID; agentSetting: string }
type PRLinkMessage = { type: 'pr-link'; sessionId: UUID; prNumber: number; prUrl: string; prRepository: string; timestamp: string }
type ModeEntry = { type: 'mode'; sessionId: UUID; mode: 'coordinator' | 'normal' }
type WorktreeStateEntry = { type: 'worktree-state'; sessionId: UUID; worktreeSession: PersistedWorktreeSession | null }
type ContentReplacementEntry = { type: 'content-replacement'; sessionId: UUID; agentId?: AgentId; replacements: ContentReplacementRecord[] }
type FileHistorySnapshotMessage = { type: 'file-history-snapshot'; messageId: UUID; snapshot: FileHistorySnapshot; isSnapshotUpdate: boolean }
type AttributionSnapshotMessage = { type: 'attribution-snapshot'; messageId: UUID; surface: string; fileStates: Record<string, FileAttributionState>; promptCount?: number; promptCountAtLastCommit?: number; permissionPromptCount?: number; permissionPromptCountAtLastCommit?: number; escapeCount?: number; escapeCountAtLastCommit?: number }
type SpeculationAcceptMessage = { type: 'speculation-accept'; timestamp: string; timeSavedMs: number }
```

Context collapse entries:

```ts
type ContextCollapseCommitEntry = {
  type: 'marble-origami-commit'
  sessionId: UUID
  collapseId: string
  summaryUuid: string
  summaryContent: string
  summary: string
  firstArchivedUuid: string
  lastArchivedUuid: string
}

type ContextCollapseSnapshotEntry = {
  type: 'marble-origami-snapshot'
  sessionId: UUID
  staged: Array<{
    startUuid: string
    endUuid: string
    summary: string
    risk: number
    stagedAt: number
  }>
  armed: boolean
  lastSpawnTokens: number
}
```

### Load, Resume, And Metadata

`resolveSessionFilePath(sessionId, dir?)` finds a non-empty transcript by
looking in the exact project directory, long-path fallback prefixes, sibling git
worktrees, or all projects if no directory was provided.

`readLiteMetadata()` reads the first and last chunks of a transcript to power
resume lists without loading the whole file. It extracts:

- first prompt
- custom title
- AI title
- summary
- tag
- PR link
- mode
- latest git branch
- project path
- worktree state

`readTranscriptForLoad()` reads in chunks and skips attribution snapshots for
normal replay. It also truncates pre-compact messages at the latest compact
boundary unless a preserved segment applies.

Important size behavior:

- Raw transcript read cap is `50MB`.
- Progressive/lite metadata reads the transcript head and tail rather than full
  content.
- Zero-byte transcript files are treated as missing.

### Append-Only Metadata Updates

Session metadata updates are append-only:

- Rename appends `custom-title`.
- AI title appends `ai-title`.
- Tag appends `tag`; an empty tag clears it.
- Session mode appends `mode`.
- Worktree enter/exit appends `worktree-state`.
- Large-output replacement decisions append `content-replacement`.

Resume uses last-wins behavior for most metadata.

## Secondary JSON Session Store

`src/utils/sessionPersistence.ts` implements a simpler JSON session store:

```text
<configHome>/sessions/<id>.json
```

Schema:

```ts
interface Session {
  id: string
  messages: SessionMessage[]
  config: SessionConfig
  createdAt: string
  updatedAt: string
  deviceId?: string
  pagination?: unknown
}

interface SessionMessage {
  role?: string
  content?: unknown
  timestamp?: string
  tool_calls?: unknown
  tool_use_id?: string
}

interface SessionConfig {
  model?: string
  effort?: string
  maxTokens?: number
  provider?: string
  systemPrompt?: string
}
```

This is separate from the primary JSONL transcript system.

## Subagent And Remote Agent Storage

### Local Subagent Sidechains

Default sidechain transcript:

```text
<projectDir>/<sessionId>/subagents/agent-<agentId>.jsonl
```

With a transcript subdirectory:

```text
<projectDir>/<sessionId>/subagents/<subdir>/agent-<agentId>.jsonl
```

Sidechain metadata:

```text
<same-dir>/agent-<agentId>.meta.json
```

Schema:

```ts
type AgentMetadata = {
  agentType: string
  worktreePath?: string
  description?: string
}
```

`runAgent()` records initial messages and every recordable sidechain message via
`recordSidechainTranscript()`. `resumeAgent()` loads the JSONL sidechain,
filters unresolved tool-use state, reconstructs large-output replacement state,
reads metadata, and restores the original agent type/worktree when available.

### Forked Subagents

`forkSubagent.ts` creates synthetic `fork` subagents. They inherit full parent
conversation context and system prompt, use `bubble` permissions, and record as
sidechains like other local agents.

### Remote Agent Metadata

Remote/background agent metadata is stored here:

```text
<projectDir>/<sessionId>/remote-agents/remote-agent-<taskId>.meta.json
```

Schema:

```ts
type RemoteAgentMetadata = {
  taskId: string
  remoteTaskType: string
  sessionId: string
  title: string
  command: string
  spawnedAt: string
  toolUseId?: string
  isLongRunning?: boolean
  isUltraplan?: boolean
  isRemoteReview?: boolean
  remoteTaskMetadata?: unknown
}
```

`listRemoteAgentMetadata()` scans `remote-agents/*.meta.json`.

## Tool Result Storage

Large tool outputs are stored under the active session directory:

```text
<projectDir>/<sessionId>/tool-results/<toolUseId>.json
<projectDir>/<sessionId>/tool-results/<toolUseId>.txt
```

`.json` is used when the original content is a text-only array of tool-result
blocks. `.txt` is used for string content. Image and non-text blocks are not
persisted by this mechanism.

Schema returned internally:

```ts
type PersistedToolResult = {
  filepath: string
  originalSize: number
  isJson: boolean
  preview: string
  hasMore: boolean
}
```

When output is persisted, the model receives a replacement wrapper:

```text
<persisted-output>
Output too large (...). Full output saved to: <path>
Preview (first ...):
...
</persisted-output>
```

Content-replacement resume schema:

```ts
type ContentReplacementRecord = {
  kind: 'tool-result'
  toolUseId: string
  replacement: string
}
```

The replacement decisions are appended to the transcript as
`content-replacement` entries. Resume reconstructs this state for both main
sessions and subagents so prompt-cache behavior remains stable.

Threshold behavior:

- A tool can set `maxResultSizeChars`.
- `Infinity` opts out of persistence.
- GrowthBook flags can override thresholds and per-message aggregate budgets.
- Empty tool results become `(<toolName> completed with no output)`.

## Task Output And Task JSON

There are two task-related storage systems.

### Process Output Files

Background command output is stored in a per-project temp tree:

```text
<projectTemp>/<sessionId>/tasks/<taskId>.output
```

`<projectTemp>` is:

```text
<system-temp>/gakrcli/<sanitized-original-cwd>/
```

On Unix the temp root is `/tmp/gakrcli-<uid>/` unless overridden by
`GAKR_CODE_TMPDIR`. On Windows it is the user temp directory plus `gakrcli`.

Output behavior:

- File-mode commands write stdout/stderr directly to the output file.
- Pipe-mode hooks buffer in memory up to `8MB`, then spill to disk.
- Disk cap is `5GB`.
- Reads use ranges/tails to avoid loading huge files.
- Agent background task output can be a symlink to the subagent transcript.

### Task Coordination JSON

Todo/task coordination files live in:

```text
<configHome>/tasks/<taskListId>/<taskId>.json
<configHome>/tasks/<taskListId>/.highwatermark
```

`taskListId` priority:

1. `GAKR_CODE_TASK_LIST_ID`
2. in-process teammate team name
3. `GAKR_CODE_TEAM_NAME`
4. leader team name
5. session ID

Task schema:

```ts
type Task = {
  id: string
  subject: string
  description: string
  activeForm?: string
  owner?: string
  status: 'pending' | 'in_progress' | 'completed'
  blocks: string[]
  blockedBy: string[]
  metadata?: Record<string, unknown>
}
```

Writes use lock files to coordinate concurrent swarm agents.

## Swarm And Team Storage

Team directories:

```text
<configHome>/teams/<sanitized-team-name>/
<configHome>/teams/<sanitized-team-name>/config.json
<configHome>/teams/<sanitized-team-name>/permissions/
```

Team config schema:

```ts
type TeamFile = {
  name: string
  description?: string
  createdAt: number
  leadAgentId: string
  leadSessionId?: string
  hiddenPaneIds?: string[]
  teamAllowedPaths?: Array<{
    path: string
    toolName: string
    addedBy: string
    addedAt: number
  }>
  members: Array<{
    agentId: string
    name: string
    agentType?: string
    model?: string
    prompt?: string
    color?: string
    planModeRequired?: boolean
    joinedAt: number
    tmuxPaneId: string
    cwd: string
    worktreePath?: string
    sessionId?: string
    subscriptions: string[]
    backendType?: BackendType
    isActive?: boolean
    mode?: PermissionMode
  }>
}
```

Team files are used for swarm membership, reconnection, permission sync,
teammate status, and cleanup.

## Auto Memory

Auto memory is the durable cross-session project memory system.

### Enablement

`isAutoMemoryEnabled()` disables memory when:

- `GAKR_CODE_DISABLE_AUTO_MEMORY` is truthy.
- `GAKR_CODE_SIMPLE` is set.
- remote mode is active without `GAKR_CODE_REMOTE_MEMORY_DIR`.
- settings disable auto memory.

Otherwise auto memory is enabled by default.

### Path

Memory base:

```text
GAKR_CODE_REMOTE_MEMORY_DIR if set
otherwise <workspace>
```

Auto-memory path resolution:

1. `GAKR_COWORK_MEMORY_PATH_OVERRIDE`
2. trusted `autoMemoryDirectory` setting
3. default:

```text
<memoryBase>/projects/<sanitized-canonical-git-root-or-project-root>/memory/
```

Entrypoint:

```text
<autoMemory>/MEMORY.md
```

`MEMORY.md` is an index, not the main content store.

### Topic File Schema

Memory topic files are Markdown files with YAML frontmatter:

```markdown
---
name: Memory name
description: One-line description
type: user | feedback | project | reference
---

Memory content.
```

`MEMORY.md` points at topic files with short index entries. It is capped:

- `400` lines
- `50,000` bytes

Memory scanning:

- Recursively scans `.md` files.
- Excludes `MEMORY.md`.
- Max depth is `3`.
- Max files is `200`.
- Reads the first `30` lines for frontmatter.

Query-time recall selects up to `5` relevant memory files from the manifest.

## Auto Memory Update Flow

### Extract Memories

`extractMemories.ts` runs a background extraction after a completed main-agent
turn when the feature gate and auto-memory settings allow it.

Key rules:

- Main agent only; subagents do not trigger it.
- Not remote mode unless the remote memory directory is configured.
- Skips if the main conversation already wrote to memory/workspace files since
  the cursor.
- Uses a forked agent with `querySource: 'extract_memories'`.
- Uses `skipTranscript: true`; extraction does not create a normal transcript.
- Allows reading/searching memory, but only allows edits inside auto-memory or
  workspace persistence files.
- Appends a system message when memories are saved.

### Auto Dream

`autoDream.ts` consolidates memory after enough time and enough touched
sessions.

Default config:

- minimum hours: `24`
- minimum sessions: `5`

The lock file is:

```text
<autoMemory>/.consolidate-lock
```

Its mtime is the last consolidated timestamp; its body is the holder PID.
Stale live-holder protection is `1` hour.

Auto dream scans session files touched after the last consolidation, excludes
the current session, and runs a forked consolidation agent with
`querySource: 'auto_dream'` and `skipTranscript: true`.

## Team Memory

Team memory sits inside auto memory:

```text
<autoMemory>/team/
<autoMemory>/team/MEMORY.md
```

It requires auto memory and the TEAMMEM feature gate.

Path validation protects against:

- path traversal
- encoded traversal
- Unicode normalization tricks
- absolute paths
- backslashes
- symlink escapes
- dangling symlinks

Server sync schema:

```ts
type TeamMemoryContent = {
  entries: Record<string, string>
  entryChecksums?: Record<string, string>
}

type TeamMemoryData = {
  organizationId: string
  repo: string
  version: string
  lastModified: string
  checksum: string
  content: TeamMemoryContent
}

type SkippedSecretFile = {
  path: string
  ruleId: string
  label: string
}
```

Sync behavior:

- Initial pull, then recursive `fs.watch`.
- Debounced push after `2s`.
- ETag/optimistic locking for conflicts.
- Server-side local deletes are not pushed as deletes; server entries can return
  on the next pull.
- Secret scanning skips files that look sensitive.
- Oversized or invalid entries are skipped/reported.

## Agent Memory

Agent memory is scoped by agent type and memory scope.

Paths:

```text
user:    <memoryBase>/agent-memory/<agentType>/
project: <cwd>/.gakrcli/agent-memory/<agentType>/
local:   <cwd>/.gakrcli/agent-memory-local/<agentType>/
remote local override:
         <GAKR_CODE_REMOTE_MEMORY_DIR>/projects/<sanitized-project-root>/agent-memory-local/<agentType>/
```

Entrypoint:

```text
<agentMemoryDir>/MEMORY.md
```

Agent memory paths are explicitly allowed by the internal permission system for
agent self-improvement.

### Agent Memory Snapshots

Snapshot directory:

```text
<cwd>/.gakrcli/agent-memory-snapshots/<agentType>/
```

Snapshot metadata:

```text
snapshot.json
```

Schema:

```ts
type SnapshotMeta = { updatedAt: string }
```

Per-memory synced marker:

```text
<agentMemoryDir>/.snapshot-synced.json
```

Schema:

```ts
type SyncedMeta = { syncedFrom: string }
```

Snapshots can initialize or replace local agent memory when newer than the last
synced marker.

## Session Memory

Session memory is a rolling summary for the current session:

```text
<projectDir>/<sessionId>/session-memory/summary.md
```

It is enabled by the `tengu_session_memory` gate, auto-compact settings, and
non-remote mode.

Defaults:

- init after at least `10000` tokens
- update after at least `5000` new tokens
- require enough tool calls between updates

Session memory extraction:

- Creates the directory with owner-only permissions.
- Creates the summary file with owner-only permissions.
- Uses a forked agent with `querySource: 'session_memory'`.
- The fork can edit only the exact session-memory summary path.
- `/summary` can trigger manual extraction.

Session-memory compaction can use `summary.md` as the compact summary and keep
messages after the last summarized message ID. It expands kept messages to
preserve API invariants such as tool-use/tool-result pairs.

## Knowledge Graph

The project knowledge graph has three storage layers:

1. JSON audit/readable store.
2. SQLite working store.
3. Orama search index.

All three are keyed by `<projectDir>`.

### Paths

```text
<projectDir>/knowledge_graph.json
<projectDir>/knowledge.db
<projectDir>/knowledge.db-wal
<projectDir>/knowledge.db-shm
<projectDir>/knowledge.orama
```

### Graph Schema

```ts
type Entity = {
  id: string
  type: string
  name: string
  attributes: Record<string, string>
}

type Relation = {
  sourceId: string
  targetId: string
  type: string
}

type SemanticSummary = {
  id: string
  content: string
  keywords: string[]
  timestamp: number
}

type KnowledgeGraph = {
  entities: Record<string, Entity>
  relations: Relation[]
  summaries: SemanticSummary[]
  rules: string[]
  lastUpdateTime: number
}
```

IDs are generated as:

```text
entity_<timestamp>_<random>
summary_<timestamp>_<random>
```

### JSON Provider

JSON file:

```text
<projectDir>/knowledge_graph.json
```

Behavior:

- Loads graph JSON if valid.
- Fills missing `summaries` and `rules` arrays for compatibility.
- Returns `null` on invalid/corrupt data.
- Saves formatted JSON.
- Can delete the file.

### SQLite Provider

SQLite file:

```text
<projectDir>/knowledge.db
```

Runtime:

- Bun uses `bun:sqlite`.
- Node uses `node:sqlite` when available.
- If SQLite is unavailable, JSON still works.

Pragmas:

- WAL mode
- foreign keys

Tables:

```sql
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  attributes TEXT NOT NULL,
  last_updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS relations (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type TEXT NOT NULL,
  PRIMARY KEY (source_id, target_id, type),
  FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  keywords TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rules (
  content TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Serialized columns:

- `entities.attributes` is JSON.
- `summaries.keywords` is JSON.
- `sync_meta.last_update_time` stores the graph timestamp.

SQLite self-heal deletes `knowledge.db`, `knowledge.db-wal`, and
`knowledge.db-shm` on critical failure, then falls back to JSON.

### Orama Index

Orama file:

```text
<projectDir>/knowledge.orama
```

Orama schema:

```ts
{
  id: 'string',
  type: 'string',
  name: 'string',
  content: 'string',
  attributes: 'string',
}
```

Each graph entity and summary is inserted into Orama. A special metadata
document with id `meta:sync` stores the graph `lastUpdateTime` so Orama can be
checked for freshness against JSON/SQLite.

If Orama load fails, the corrupt file is renamed:

```text
knowledge.orama.corrupted.<timestamp>
```

Then the index is rebuilt from the graph.

### Load And Save Flow

`initOrama(cwd)`:

1. Initializes SQLite if available.
2. Loads the graph from JSON/SQLite.
3. Chooses the freshest graph by `lastUpdateTime`; JSON wins exact ties.
4. Self-heals by writing the chosen graph back to the stale/missing backend.
5. Loads Orama from disk if `meta:sync` matches.
6. Otherwise rebuilds Orama from the graph and persists it.

`saveProjectGraph(cwd)` dual-writes JSON and SQLite when SQLite is ready.

Mutations are serialized through a promise queue and async-local mutation lock
to prevent interleaved JSON, SQLite, and Orama updates.

Mutation APIs:

- `addGlobalEntity(type, name, attributes)`
- `addGlobalRelation(sourceId, targetId, type)`
- `addGlobalSummary(content, keywords)`
- `addGlobalRule(rule)`

Reset deletes or clears:

- JSON graph
- SQLite DB/WAL/SHM
- Orama index
- provider cache
- in-memory graph

### Search Flow

`getOrchestratedMemory(query)` searches Orama first. If Orama is unavailable or
fails, it falls back to native keyword/BM25-style search over the graph.

Returned prompt section names:

- `PERSISTENT PROJECT MEMORY (ORAMA RAG)`
- `PERSISTENT PROJECT MEMORY (NATIVE RAG)`

### Conversation Arc Auto Updates

`conversationArc.ts` maintains a runtime `ConversationArc`:

```ts
type Goal = {
  id: string
  description: string
  status: 'pending' | 'active' | 'completed' | 'abandoned'
  createdAt: number
  completedAt?: number
}

type Decision = {
  id: string
  description: string
  rationale?: string
  timestamp: number
}

type Milestone = {
  id: string
  description: string
  achievedAt: number
}

type ConversationArc = {
  id: string
  goals: Goal[]
  decisions: Decision[]
  milestones: Milestone[]
  currentPhase: 'init' | 'exploring' | 'implementing' | 'reviewing' | 'completed'
  startTime: number
  lastUpdateTime: number
}
```

Recent messages are scanned for facts such as:

- environment variables
- absolute paths
- semantic versions
- URLs and hostnames
- IPv4 addresses
- backtick symbols
- technical concepts
- percentages
- project rules
- React/Redux mentions
- common config files

At turn finalization, arc summaries, facts, rules, and entities can be written
into the global graph.

### `/knowledge` Command

`/knowledge status` reports:

- whether the feature is enabled
- entity/relation/summary/rule counts
- JSON/SQLite/Orama path existence
- SQLite availability/runtime state

`/knowledge enable yes|no` writes `knowledgeGraphEnabled` to global config.

`/knowledge clear` resets the arc and graph.

`/knowledge list` prints the arc summary.

## Project Wiki

The wiki is separate from the JSON/SQLite/Orama knowledge graph. It is a
human-readable project knowledge layer stored directly in the checkout:

```text
<cwd>/.gakrcli/wiki/
<cwd>/.gakrcli/wiki/schema.md
<cwd>/.gakrcli/wiki/index.md
<cwd>/.gakrcli/wiki/log.md
<cwd>/.gakrcli/wiki/pages/
<cwd>/.gakrcli/wiki/sources/
```

`/wiki init` creates:

- `schema.md`
- `index.md`
- `log.md`
- `pages/architecture.md`
- `pages/`
- `sources/`

`/wiki ingest <path>`:

1. Ensures the wiki exists.
2. Reads the local file.
3. Creates a source note in `sources/<slug>.md`.
4. Appends to `log.md`.
5. Rebuilds `index.md`.

Source note shape:

````markdown
# Title

## Source

- Path: `relative/source/path`
- Ingested at: ISO timestamp

## Summary

...

## Excerpt

```text
first 20 lines
```

## Linked Pages

- [Architecture](../pages/architecture.md)
````

## Graphify Cache Files In This Repository

This checkout contains JSON files under:

```text
src/commands/plugin/graphify-out/cache/*.json
```

These are repository files, not the runtime knowledge graph store described
above. They appear to be generated/cache artifacts for the plugin graphify
command area. They are the only `.json` files found in the source tree that look
like graph/cache output after excluding `node_modules`, `dist`, and `.git`.

No runtime `.db` or `.orama` files were found in the repository checkout during
this audit. Those are created under `<projectDir>` at runtime.

## Permissions And Internal Read/Write Access

The permission system has explicit internal allowlists for these storage areas.

Readable without normal user file permissions:

- session memory
- `<projectDir>` files, including transcripts and knowledge graph files
- current session plan files
- tool results
- scratchpad
- project temp directory
- agent memory
- auto memory
- `<configHome>/tasks/`
- `<configHome>/teams/`
- bundled skill reference extraction directory

Writable without normal user file permissions:

- current session plan files
- scratchpad
- current job directory under `<configHome>/jobs/`
- agent memory
- auto memory, unless `GAKR_COWORK_MEMORY_PATH_OVERRIDE` points elsewhere
- project `.gakrcli/launch.json`

Protected paths still include `.git`, `.vscode`, `.idea`, and most `.gakrcli`
configuration unless specifically carved out or allowed by a session rule.

## Operational Notes

### How To Find One Session On Disk

Given a session UUID:

1. Compute `<projectDir>` from the original project path.
2. Check `<projectDir>/<sessionId>.jsonl`.
3. If not present, scan all `<projects>/*/<sessionId>.jsonl`.
4. For subagents, check `<projectDir>/<sessionId>/subagents/`.
5. For large outputs, check `<projectDir>/<sessionId>/tool-results/`.
6. For session summary, check `<projectDir>/<sessionId>/session-memory/summary.md`.

### How To Inspect Knowledge Graph State

Check:

```text
<projectDir>/knowledge_graph.json
<projectDir>/knowledge.db
<projectDir>/knowledge.orama
```

If `knowledge_graph.json` exists but SQLite does not, SQLite may be unavailable
or not initialized yet. If Orama is missing, it can be rebuilt from JSON/SQLite.

### Which Storage Is Append-Only

Append-only or mostly append-only:

- main JSONL transcript
- subagent JSONL transcripts
- transcript metadata entries
- wiki `log.md`

Mutable/rewritten:

- `knowledge_graph.json`
- `knowledge.db`
- `knowledge.orama`
- memory topic files and `MEMORY.md`
- team memory files
- settings JSON
- task JSON files
- team config JSON
- session-memory `summary.md`

### Separate Session Directories

Main transcript stays at:

```text
<projectDir>/<sessionId>.jsonl
```

Session-scoped side data stays under:

```text
<projectDir>/<sessionId>/
```

This separation means resume lists can scan main `.jsonl` files quickly, while
large/auxiliary per-session data stays in a directory keyed by the same UUID.

### Subagent Data Separation

Subagents do not write separate main session files. They write sidechains inside
the parent session directory:

```text
<projectDir>/<parentSessionId>/subagents/
```

Agent task output files may symlink to those sidechain transcripts so task UI
and transcript storage share the same data source.

### Large Output Separation

Tool-result persistence and task-output persistence are separate:

- `tool-results/` stores finalized large tool result content that would
  otherwise be too large for transcript/model context.
- temp `tasks/*.output` stores running/background process streams.

Both are readable through internal path checks, but they have different
lifetimes and consumers.

## Verification References

Relevant tests for this document's storage areas:

- `src/utils/sessionStorage.test.ts`
- `src/utils/sessionPersistence.test.ts`
- `tests/sdk/session-functions.test.ts`
- `tests/sdk/sdk-v2-lifecycle.test.ts`
- `tests/sdk/sdk-context-isolation.test.ts`
- `tests/sdk/sdk-preserved-segment.test.ts`
- `src/utils/toolResultStorage.test.ts`
- `src/utils/storage/JSONProvider.test.ts`
- `src/utils/storage/SQLiteProvider.test.ts`
- `src/commands/knowledge/knowledge.test.ts`
- `src/memdir/memoryScan.test.ts`
- `src/services/wiki/init.test.ts`
- `src/services/wiki/ingest.test.ts`
- `src/services/wiki/status.test.ts`
- `src/commands/wiki/wiki.test.ts`
