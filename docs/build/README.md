# Build Documentation

This folder documents build-time behavior for the root GakrCLI package.

## Pages

| Document | Purpose |
| --- | --- |
| [feature-flags-overview.md](feature-flags-overview.md) | How `scripts/build.ts` turns `feature('FLAG')` calls into build-time constants. |
| [feature-flags-reference.md](feature-flags-reference.md) | Full reference for every flag currently listed in `scripts/build.ts`. |
| [kairos-and-internal-flags.md](kairos-and-internal-flags.md) | Focused notes for Kairos, assistant mode, bridge, daemon, MCP skills, and other private/incomplete gates. |
| [feature-flag-change-checklist.md](feature-flag-change-checklist.md) | Safe process for changing a feature flag and validating the result. |

## Source Of Truth

The source of truth for the open-build flag values is `scripts/build.ts`.

During `bun run build`, the build script bundles:

- CLI entrypoint: `src/entrypoints/cli.tsx` to `dist/cli.mjs`
- SDK entrypoint: `src/entrypoints/sdk/index.ts` to `dist/sdk.mjs`

The same feature-flag preprocessing plugin is applied to both bundles.
