# GakrCLI Web

This directory contains the Vite, React, and TypeScript web experience for GakrCLI.

## Structure

```text
web/
  public/          static assets
  src/             React source
  src/App.tsx      app shell, navigation, landing page, and route selection
  src/*.tsx        get-started, providers, and commands pages
  src/content*.ts  page content
  src/styles.css   global styles and themes
```

## Scripts

Run these from the repository root:

```sh
bun run web:dev
bun run web:typecheck
bun run web:build
bun run web:preview
```

On Windows PowerShell, if the `bun` PowerShell shim is blocked by execution policy, use `bun.cmd` instead:

```sh
bun.cmd run web:build
```

## Notes

- The app is a small single-page React site with client-side navigation for `/`, `/get-started`, `/providers`, and `/commands`.
- Theme preference is stored in `localStorage` as `gakrcli-theme`.
- Production output is written to `web/dist/`.
