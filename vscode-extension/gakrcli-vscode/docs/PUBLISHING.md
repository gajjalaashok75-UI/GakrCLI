# Publishing Guide

## Prerequisites

- [VS Code Extension Manager](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) (`vsce`)
- Publisher account on [VS Code Marketplace](https://marketplace.visualstudio.com/manage)
- Logged in via `vsce` (uses `vsce login <publisher>` or personal access token)

## Quick Start

```bash
# 1. Build
npm run build

# 2. Package (creates .vsix)
npm run package

# 3. Publish to marketplace
npx @vscode/vsce publish
```

## Step-by-Step

### 1. Build

```bash
npm run build
```

This builds both the extension host (`esbuild`) and webview UI (`vite`). Verify the build succeeds without errors.

### 2. Package

```bash
npm run package
```

This runs `npx @vscode/vsce package --no-dependencies` and creates `gakrcli-vscode-<version>.vsix`.

**Note**: `--no-dependencies` is used because the SDK dependency is bundled at build time, not installed separately.

### 3. Verify the VSIX

```bash
# Check contents
unzip -l gakrcli-vscode-1.0.0.vsix

# Install locally to test
code --install-extension gakrcli-vscode-1.0.0.vsix
```

### 4. Publish

```bash
# Publish to marketplace
npx @vscode/vsce publish
```

### 5. Create a GitHub Release

```bash
# Create release and upload VSIX
gh release create v1.0.0 gakrcli-vscode-1.0.0.vsix \
  --title "v1.0.0" \
  --notes "Release notes here"
```

## Version Bumping

Update the `version` field in `package.json` before publishing. Follow [semver](https://semver.org/):

- **Patch** (`1.0.0` → `1.0.1`): Bug fixes
- **Minor** (`1.0.0` → `1.1.0`): New features, backward compatible
- **Major** (`1.0.0` → `2.0.0`): Breaking changes

## CI/CD Publishing

### GitHub Actions

The repository includes a publish workflow. On tag push (`v*`), it:

1. Builds the extension
2. Packages the `.vsix`
3. Publishes to VS Code Marketplace
4. Creates a GitHub Release with the `.vsix` attached

## Troubleshooting

### "Extension not found" after install

Ensure the CLI is installed: `npm install -g @gitlawb/gakrcli`. The extension requires the CLI.

### Marketplace publish fails

- Check you're logged in: `vsce verify-pat`
- Verify the publisher name matches `package.json`'s `publisher` field
- Check for marketplace naming conflicts

### VSIX size concerns

The `.vsix` includes the bundled webview (JS + CSS). If size is a concern:
- Enable chunk splitting in `webview/vite.config.ts`
- Tree-shake unused dependencies
- Review `.vscodeignore` for excluded files

## Security Checklist

Before publishing, verify:

- [ ] No hardcoded API keys, tokens, or secrets
- [ ] No credentials in source code
- [ ] `.env` files excluded from packaging (`.vscodeignore`)
- [ ] No local paths or machine-specific configuration
- [ ] All dependencies are from trusted sources
- [ ] `npm audit` shows no critical vulnerabilities
