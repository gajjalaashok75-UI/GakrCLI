import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { resolveCliExecutable, resolveCliLaunchCommand } from '../../src/settings/cliExecutable';

describe('resolveCliExecutable', () => {
  it('uses the GakrCLI wrapper setting', () => {
    const config = {
      get: (key: string, defaultValue?: string) => {
        if (key === 'processWrapper') return '  C:\\Tools\\gakrcli.exe  ';
        return defaultValue;
      },
    };

    expect(resolveCliExecutable(config)).toBe('C:\\Tools\\gakrcli.exe');
  });

  it('uses a configured wrapper when it is non-empty', () => {
    const config = {
      get: (_key: string, _defaultValue?: string) => '  C:\\Tools\\gakrcli.cmd  ',
    };

    expect(resolveCliExecutable(config)).toBe('C:\\Tools\\gakrcli.cmd');
  });

  it('parses a configured wrapper with launch arguments', () => {
    const config = {
      get: (_key: string, _defaultValue?: string) => 'node "C:\\Tools\\Gakr CLI\\dist\\cli.mjs"',
    };

    const launch = resolveCliLaunchCommand(config);

    expect(launch.executable).toBe('node');
    expect(launch.args).toEqual(['C:\\Tools\\Gakr CLI\\dist\\cli.mjs']);
  });

  it('falls back to gakrcli when the wrapper is empty', () => {
    const config = {
      get: (_key: string, _defaultValue?: string) => '   ',
    };

    expect(resolveCliExecutable(config)).toBe('gakrcli');
  });

  it('uses the local source-built CLI when the workspace is the GakrCLI repo', () => {
    const workspace = join(tmpdir(), `gakrcli-vscode-cli-${Date.now()}`);
    mkdirSync(join(workspace, 'dist'), { recursive: true });
    writeFileSync(join(workspace, 'dist', 'cli.mjs'), '');
    writeFileSync(
      join(workspace, 'package.json'),
      JSON.stringify({
        name: '@gakr-gakr/gakrcli',
        bin: { gakrcli: 'bin/gakrcli.js' },
      }),
    );

    try {
      const config = {
        get: (_key: string, defaultValue?: string) => defaultValue,
      };

      const launch = resolveCliLaunchCommand(config, workspace);

      expect(launch.executable).toBe('node');
      expect(launch.args).toEqual([join(workspace, 'dist', 'cli.mjs')]);
      expect(launch.displayCommand).toContain('cli.mjs');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
