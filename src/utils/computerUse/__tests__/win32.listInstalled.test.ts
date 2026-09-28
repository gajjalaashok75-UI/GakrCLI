import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';
import { platform } from '../platforms/win32.js';

// Integration test against the real Windows app registry + AppxPackage DB.
// Slow (spawns PowerShell) and Windows-only, which is the point: the defect
// this guards was invisible to the mocked listInstalled tests because only
// the real enumeration drops the executable path for Store apps.
const isWindows = process.platform === 'win32';

describe.skipIf(!isWindows)('win32 listInstalled (real enumeration)', () => {
  it(
    'resolves an exePath for every Store app that declares an executable',
    async () => {
      const apps = await platform.apps.listInstalled();
      const storeApps = apps.filter(a => /\\WindowsApps\\/i.test(a.path ?? ''));
      expect(storeApps.length).toBeGreaterThan(0);

      // Store apps were the case that regressed: they were emitted with no
      // executable at all, so approving one produced a grant that could never
      // match a bound window. Media codec packages (VP9/AV1/HEIF/WebP) ship
      // no executable at all, so the invariant is conditioned on the manifest
      // actually declaring one.
      const shouldHaveExe: string[] = [];
      const missing: string[] = [];
      for (const app of storeApps) {
        const manifest = join(app.path!, 'AppxManifest.xml');
        if (!existsSync(manifest)) continue;
        if (!/Executable="[^"]+"/.test(readFileSync(manifest, 'utf8'))) continue;
        shouldHaveExe.push(app.displayName!);
        if (!app.exePath) missing.push(app.displayName!);
      }

      expect({ checked: shouldHaveExe.length > 0, missing }).toEqual({
        checked: true,
        missing: [],
      });
    },
    120_000,
  );

  it(
    'resolves the Store app Notepad to its real process image',
    async () => {
      const apps = await platform.apps.listInstalled();
      const notepad = apps.find(
        a => a.displayName?.toLowerCase() === 'notepad' && a.exePath,
      );
      if (!notepad) return; // Notepad not installed on this machine.

      // Notepad ships with its binary in a subfolder (Notepad\Notepad.exe), so
      // a flat directory scan cannot find it — the manifest can.
      expect(notepad.exePath).toMatch(/notepad\.exe$/i);
    },
    120_000,
  );
});
