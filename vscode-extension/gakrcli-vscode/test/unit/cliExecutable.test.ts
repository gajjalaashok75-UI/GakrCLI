import { describe, expect, it } from 'vitest';
import { resolveCliExecutable } from '../../src/settings/cliExecutable';

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

  it('falls back to gakrcli when the wrapper is empty', () => {
    const config = {
      get: (_key: string, _defaultValue?: string) => '   ',
    };

    expect(resolveCliExecutable(config)).toBe('gakrcli');
  });
});
