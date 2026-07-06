# GakrCLI VS Code Publishing Checklist

This checklist is for publishing GakrCLI VS Code 0.2.4.

## Versions

- `package.json` version: `0.2.4`
- root GakrCLI dependency: `@gakr-gakr/gakrcli@^0.5.7`
- root GakrCLI package version: `0.5.7`

Publish order matters: publish `@gakr-gakr/gakrcli@0.5.7` to npm first, then refresh this extension lockfile and package the VSIX. npm cannot resolve `@gakr-gakr/gakrcli@^0.5.7` until that root package version exists on the registry.

## Preflight

From the repository root:

```bash
bun.cmd run build
```

From `vscode-extension/gakrcli-vscode/webview`:

```bash
npm.cmd run build
```

From `vscode-extension/gakrcli-vscode`:

```bash
npm.cmd install --package-lock-only --ignore-scripts
npm.cmd test
npm.cmd run build:extension
npx.cmd @vscode/vsce package
npx.cmd @vscode/vsce ls --tree
```

Typecheck is intentionally not part of the required publishing gate for this release because the repository has known broader TypeScript debt outside the validated publication path.

## Secret And Leakage Checks

Before publishing, confirm:

- No `.env` files are inside the VSIX.
- No `.gakrcli` or `.gakrcli-profile.json` files are inside the VSIX.
- No source maps are inside the VSIX.
- No local `.vsix` files are inside the VSIX.
- No workspace transcripts, logs, or cache directories are inside the VSIX.
- Docs are excluded by `.vscodeignore`.

Useful commands:

```bash
npx.cmd @vscode/vsce ls --tree
rg -n "sk-|ghp_|AIza|BEGIN .*PRIVATE KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN" .
```

The `rg` command is a heuristic. It can match documentation placeholders; investigate real-looking secrets before packaging.

## Publish

```bash
npx.cmd @vscode/vsce login gakr-gakr
npx.cmd @vscode/vsce publish
```

For local install testing:

```bash
code --install-extension gakrcli-vscode-0.2.4.vsix
```
