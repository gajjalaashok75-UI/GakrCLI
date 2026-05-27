import { describe, expect, it } from 'vitest';
import {
  applyCompatibilityFlag,
  getProfileSearchPaths,
  parseProfileFile,
} from '../../src/settings/profileFile';

describe('profileFile', () => {
  it('searches workspace profile before user config fallback', () => {
    expect(getProfileSearchPaths({
      cwd: 'C:\\workspace\\project',
      configDir: 'C:\\Users\\test\\.gakrcli',
    })).toEqual([
      'C:\\workspace\\project\\.gakrcli-profile.json',
      'C:\\Users\\test\\.gakrcli\\.gakrcli-profile.json',
    ]);
  });

  it('parses valid profile files and rejects malformed payloads', () => {
    expect(parseProfileFile(JSON.stringify({
      profile: 'nvidia-nim',
      env: {
        OPENAI_MODEL: 'z-ai/glm-5.1',
        OPENAI_API_KEY: 'secret',
        IGNORED_NUMBER: 123,
      },
    }))).toEqual({
      profile: 'nvidia-nim',
      env: {
        OPENAI_MODEL: 'z-ai/glm-5.1',
        OPENAI_API_KEY: 'secret',
      },
      createdAt: undefined,
    });

    expect(parseProfileFile('{ nope')).toBeNull();
    expect(parseProfileFile(JSON.stringify({ profile: 'openai' }))).toBeNull();
  });

  it('adds GakrCLI compatibility flags for OpenAI-compatible saved profiles', () => {
    expect(applyCompatibilityFlag('xai', {
      OPENAI_MODEL: 'grok-4.3',
    })).toEqual({
      OPENAI_MODEL: 'grok-4.3',
      GAKR_CODE_USE_OPENAI: '1',
    });
  });
});
