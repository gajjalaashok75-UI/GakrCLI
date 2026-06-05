# Feature Flag Change Checklist

Use this checklist before changing a flag in `scripts/build.ts`.

## 1. Identify The Feature Surface

Search for the flag:

```bash
rg "feature\\('FLAG_NAME'|feature\\(\"FLAG_NAME\"" src scripts
```

Check:

- Which commands become available.
- Which tools become available.
- Which UI components become available.
- Which settings become available.
- Which imports become live.
- Whether the SDK bundle is affected.

## 2. Check Source Availability

If the flag enables optional modules, confirm those modules exist.

Important guarded examples:

| Flag | Required source |
| --- | --- |
| `MCP_SKILLS` | `src/skills/mcpSkills.ts` |
| `KAIROS` | `src/assistant/index.ts` |
| `KAIROS` | `src/assistant/gate.ts` |
| `KAIROS` | `src/assistant/sessionDiscovery.ts` |

Run:

```bash
bun test scripts/feature-flags-source-guard.test.ts
```

## 3. Check Runtime Requirements

Ask whether the feature also needs:

- Environment variables.
- User settings.
- Native addons.
- MCP servers.
- Cloud services.
- OAuth credentials.
- Provider-specific support.
- VS Code extension support.

If yes, document the runtime activation path. A build flag alone may not be enough.

## 4. Rebuild

Run:

```bash
bun run build
```

The build should print both:

```text
Built CLI bundle
Built SDK bundle
```

It should also validate that the SDK bundle has no React/Ink leakage.

## 5. Smoke Test

Run:

```bash
bun run smoke
```

For feature-specific checks, use the command or UI path that the flag controls.

Examples:

| Flag | Example check |
| --- | --- |
| `DUMP_SYSTEM_PROMPT` | `node dist/cli.mjs --dump-system-prompt` |
| `COORDINATOR_MODE` | Build with `GAKR_CODE_COORDINATOR_MODE=1` and verify coordinator startup paths. |
| `KAIROS` | `node dist/cli.mjs --assistant` |
| `MCP_SKILLS` | Connect an MCP server with resources and confirm skill discovery does not throw missing-export errors. |
| `MESSAGE_ACTIONS` | Start the TUI and verify message actions in fullscreen mode. |

## 6. Check SDK Impact

If the flag touches `src/query.ts`, `src/QueryEngine.ts`, `src/tools/`, `src/services/mcp/`, or `src/entrypoints/sdk/`, run SDK tests:

```bash
bun test tests/sdk
```

The SDK bundle intentionally stubs terminal UI and React/Ink imports. Feature changes can accidentally pull UI code into the SDK bundle.

## 7. Check Package Privacy

Run:

```bash
bun run verify:privacy
npm pack --dry-run
```

Confirm no private source, local state, `.env`, `.gakrcli`, workspace transcript, source map, or local-only artifact enters the package.

## 8. Update Docs

When changing a flag, update:

- `docs/build/feature-flags-reference.md`
- `docs/build/kairos-and-internal-flags.md` if the change touches Kairos or private/incomplete gates
- Any user-facing setup docs if a command or setting becomes available

## 9. Commit Scope

Keep the commit focused:

- Build flag change.
- Required source/runtime fix.
- Tests.
- Docs.

Avoid mixing unrelated package, provider, or extension changes into the same commit.
