# GakrCLI Web Landing Page Setup

## Summary
Created a new marketing landing page for gakrcli under `web/` with all necessary infrastructure to build, ignore, and gate it without affecting the published npm package.

## Changes Made

### 1. Web Directory Structure (`web/`)
Created a complete Vite + React 19 landing page with:

- **Configuration Files:**
  - `package.json` - Web dependencies (React 19, Vite 8, TypeScript 6)
  - `vite.config.ts` - Vite configuration with React plugin
  - `tsconfig.json` - TypeScript configuration for web
  - `.gitignore` - Excludes `.vercel`

- **HTML Entry Point:**
  - `index.html` - Main HTML with:
    - Meta tags for SEO and social sharing
    - Fira Code font preload
    - Theme bootstrap script (prevents flash, defaults to light)
    - References to gakrcli branding

- **React Components (`web/src/`):**
  - `main.tsx` - React entry point
  - `App.tsx` - Main app component with:
    - Theme toggle (☀/☾) persisted to localStorage
    - Navigation with logo and links
    - Hero section with pill, wordmark, install command
    - Features section (6 rows in hermes-style format)
    - Install block with copyable command + 3 steps
    - Footer with brand, version, gitlawb link, license
  - `content.ts` - Content configuration:
    - Install command: `npm install -g @gakr-gakr/gakrcli`
    - 6 feature descriptions
    - Navigation links (features, install, github, gitlawb)
  - `styles.css` - Complete styling with:
    - Light theme (default) and dark theme
    - Orange accent colors (#ff7a1a)
    - Dual radial gradients for warmth
    - Monospace typography (SF Mono / Fira Code)
    - Responsive design with mobile breakpoints
  - `vite-env.d.ts` - Vite type definitions

- **Assets (`web/public/`):**
  - `gakrcli.png` - Placeholder for 36px orange terminal-face logo (needs actual image)

### 2. Root Infrastructure Updates

#### `.npmignore`
Added safety net to exclude web/ from npm publish:
```
# Marketing / landing site — never ship with the CLI package.
web/
```

#### `.dockerignore` (NEW)
Created file to exclude web/ from Docker context:
```
web
```
Plus other standard exclusions (node_modules, dist, .git, etc.)

#### `.gitignore`
Added web build artifacts:
```
# Web landing page build artifacts
web/dist/
web/*.tsbuildinfo
```

#### `package.json`
Added web scripts that delegate via `--cwd web`:
```json
"web:dev": "bun run --cwd web dev",
"web:build": "bun run --cwd web build",
"web:preview": "bun run --cwd web preview",
"web:typecheck": "bun run --cwd web typecheck"
```

### 3. CI/CD Integration

#### `.github/workflows/pr-checks.yml` (NEW)
Created GitHub Actions workflow with two jobs:
1. **smoke-and-tests** - Existing CLI tests
2. **web** - New web checks:
   - Install web dependencies
   - Typecheck web (`bun run --cwd web typecheck`)
   - Build web (`bun run --cwd web build`)

## Design Features

### Visual Design
- **Typography:** Monospace (SF Mono / Fira Code) with gitlawb aesthetic
- **Color Scheme:** Orange accent (#ff7a1a) with dual theme support
- **Layout:** Clean, terminal-inspired with hairline dividers
- **Background:** Dual radial gradients for warmth on both themes

### Hero Section
- Pill badge: "open source · gitlawb-aligned · model-neutral"
- Two-line wordmark: "runs anywhere. / uses anything."
- Copy-to-clipboard install command
- GitHub CTA button
- Footer text: "works with openai, gemini, codex, ollama, lm studio, litellm, and 200+ models."

### Features Section
Six feature rows in hermes-style "title — sentence" format:
1. any model, one terminal
2. real tools, not just chat
3. profiles per repo
4. streaming, not batch
5. routes through a gateway
6. editor and server modes

### Install Section
- Copyable command block
- Three numbered steps:
  1. install (requires node ≥ 20)
  2. start (run `gakrcli` in any repo)
  3. pick a provider (type `/provider`)

### Theme Toggle
- Light theme is default
- No-flash bootstrap script
- ☀ / ☾ toggle button
- Persisted to localStorage as `gakrcli-theme`

## Next Steps

1. **Add Logo:** Replace `web/public/gakrcli.png` placeholder with actual 36px orange terminal-face icon
2. **Install Dependencies:** Run `bun install --cwd web` to install web dependencies
3. **Test Locally:** Run `bun run web:dev` to start development server
4. **Build:** Run `bun run web:build` to create production build
5. **Deploy:** Deploy `web/dist/` to hosting platform (Vercel, Netlify, etc.)

## Verification

All changes follow the reference implementation from `references/` and are adapted for gakrcli branding:
- ✅ web/ excluded from npm publish via .npmignore
- ✅ web/ excluded from Docker context via .dockerignore
- ✅ web:dev / web:build / web:preview / web:typecheck scripts in package.json
- ✅ web typecheck + build added to pr-checks workflow
- ✅ web/dist/ and web/*.tsbuildinfo ignored in .gitignore
- ✅ All "openclaude" references replaced with "gakrcli"
- ✅ All gitlawb links and branding preserved
- ✅ Version numbers updated to match current package (v0.5.1)

## Impact Assessment

### No Impact On:
- ✅ npm package (web/ excluded via .npmignore and files whitelist)
- ✅ Docker builds (web/ excluded via .dockerignore)
- ✅ CLI functionality (no code changes to src/)
- ✅ Existing tests (no test modifications)

### New Capabilities:
- ✅ Marketing landing page for gakrcli
- ✅ Web development workflow (dev, build, preview, typecheck)
- ✅ CI checks for web code quality
- ✅ Separate web dependencies (isolated in web/package.json)
