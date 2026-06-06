# Feature Flags Overview

GakrCLI uses build-time feature flags in `scripts/build.ts` to decide which code is compiled into the open build.

These flags are not normal runtime settings. They are read while building the distributable files and converted into literal booleans before Bun finishes bundling.

## What The Build Script Does

The build script handles three important jobs:

1. Clean and recreate `dist/`.
2. Build the CLI bundle from `src/entrypoints/cli.tsx`.
3. Build the SDK bundle from `src/entrypoints/sdk/index.ts`.

For feature flags, the important section is:

```ts
const featureFlags: Record<string, boolean> = {
  COORDINATOR_MODE: true,
  KAIROS: false,
}
```

The build script then preprocesses source files under `src/`:

```ts
feature('COORDINATOR_MODE')
```

becomes:

```ts
true
```

and:

```ts
feature('KAIROS')
```

becomes:

```ts
false
```

Unknown feature names default to `false`.

## True Versus False

| Value | Meaning |
| --- | --- |
| `true` | The feature-gated code is compiled into the CLI and SDK bundles. |
| `false` | The feature-gated code is disabled at build time. Bun can often remove the disabled branch and skip its imports. |

`true` does not always mean the feature runs automatically. Many features still have runtime gates such as environment variables, settings, command-line flags, or UI actions.

Examples:

| Feature | Build flag | Runtime activation |
| --- | --- | --- |
| Coordinator mode | `COORDINATOR_MODE: true` | Requires `GAKR_CODE_COORDINATOR_MODE` in relevant paths. |
| System prompt dump | `DUMP_SYSTEM_PROMPT: true` | Runs only when the CLI receives `--dump-system-prompt`. |
| Message actions | `MESSAGE_ACTIONS: true` | Can still be disabled with `GAKR_CODE_DISABLE_MESSAGE_ACTIONS`. |
| Kairos assistant mode | `KAIROS: false` today | If compiled in, startup still needs `--assistant` or assistant settings. |

## Why Build-Time Flags Exist

These flags are used for:

- Dead-code elimination for private or incomplete modules.
- Keeping the open build from importing private infrastructure.
- Preventing runtime failures when mirrored source files are missing.
- Reducing bundle size by removing unreachable code paths.
- Letting selected open-build features ship without enabling every upstream path.

## Why Some Features Stay Off

Some flags point at code that depends on private infrastructure, native modules, cloud backends, or source files that are not present in this checkout.

When such a flag is turned on without its real implementation, the build may fall back to a stub. A stub can satisfy bundling but still fail at runtime if downstream code expects a named export.

The repository has a regression guard for this:

```bash
bun test scripts/feature-flags-source-guard.test.ts
```

That test currently guards flags such as `MCP_SKILLS` and `KAIROS` against being enabled without required source files.

## Important Pattern

The safest source pattern is:

```ts
const module = feature('FLAG')
  ? require('./optional-module.js')
  : null
```

This lets the bundler remove the import when the feature is false.

Less safe patterns can accidentally keep imports alive or make dead-code elimination harder. The codebase has comments in several files about "feature() DCE complexity" because very large functions can make build-time elimination fragile.

## How To Use A Flag

1. Change the value in `scripts/build.ts`.
2. Run the source guard if the flag touches private or optional code.
3. Rebuild the CLI and SDK.
4. Smoke-test the relevant command or UI path.

Recommended commands:

```bash
bun test scripts/feature-flags-source-guard.test.ts
bun run build
bun run smoke
```

For SDK-impacting changes, also run SDK tests:

```bash
bun test tests/sdk
```
