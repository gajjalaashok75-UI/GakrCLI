# Contributing to Gakr

Thanks for contributing.

Gakr (pronounced "gacker") is a terminal-based coding-agent CLI built with TypeScript. It runs on Node.js 20+ and uses Bun for development and building. The project supports multiple providers, local backends, MCP, and a terminal-first workflow. The best contributions are focused, well-tested, and easy to review.

For user-facing documentation, see [README.md](README.md). For security reports, see [SECURITY.md](SECURITY.md).

## Before You Start

- Search existing [issues](https://github.com/Gitlawb/gakr/issues) and [discussions](https://github.com/Gitlawb/gakr/discussions) before opening a new thread.
- Use issues for confirmed bugs and actionable feature work.
- Use discussions for setup help, ideas, and general community conversation.
- For larger changes, open an issue first so the scope is clear before implementation.
- For security reports, follow [SECURITY.md](SECURITY.md).

## Local Setup

**Requirements:** Node.js 20+ and Bun.

Install dependencies:

```bash
bun install
```

Build the CLI (output: `dist/cli.mjs`):

```bash
bun run build
```

Smoke test:

```bash
bun run smoke
```

Run the app locally:

```bash
bun run dev
```

Type checking (recommended before opening a PR):

```bash
bun run typecheck
```

If you are working on provider setup or saved profiles, test with:

```bash
bun run doctor:runtime
bun run dev:profile
```

## Development Workflow

- Keep PRs focused on one problem or feature.
- Avoid mixing unrelated cleanup into the same change.
- Preserve existing repo patterns unless the change is intentionally refactoring them.
- Add or update tests when the change affects behavior.
- Update docs when setup, commands, or user-facing behavior changes.
- The binary name is `gakrcli` and the package name is `@gakr-gakr/gakrcli`.

## Validation

At minimum, run the most relevant checks for your change.

Common checks:

```bash
bun run build
bun run typecheck
bun run smoke
```

Focused tests:

```bash
bun test ./path/to/test-file.test.ts
```

When working on provider/runtime setup, this can also help:

```bash
bun run doctor:runtime
```

## Pull Requests

Good PRs usually include:

- a short explanation of what changed
- why it changed
- the user or developer impact
- the exact checks you ran

If the PR touches UI, terminal presentation, or the VS Code extension, include screenshots when useful.

If the PR changes provider behavior, mention which provider path was tested.

## Code Style

- Follow the existing code style in the touched files.
- Prefer small, readable changes over broad rewrites.
- Do not reformat unrelated files just because they are nearby.
- Keep comments useful and concise.

## Provider Changes

Gakr supports multiple provider paths. If you change provider logic:

- be explicit about which providers are affected
- avoid breaking third-party providers while fixing first-party behavior
- test the exact provider/model path you changed when possible
- call out any limitations or follow-up work in the PR description

## Community

Please be respectful and constructive with other contributors.

Maintainers may ask for:

- narrower scope
- focused follow-up PRs
- stronger validation
- docs updates for behavior changes

That is normal and helps keep the project reviewable as it grows.
