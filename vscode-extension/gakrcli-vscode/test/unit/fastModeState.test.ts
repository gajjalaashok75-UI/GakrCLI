import { describe, expect, it } from 'vitest';
import { normalizeFastModeState } from '../../webview/src/utils/fastModeState';

describe('webview fast mode state normalization', () => {
  it('treats SDK string states as enabled flags', () => {
    expect(normalizeFastModeState('on')).toEqual({ enabled: true, canToggle: true });
    expect(normalizeFastModeState('off')).toEqual({ enabled: false, canToggle: true });
    expect(normalizeFastModeState('cooldown')).toEqual({ enabled: false, canToggle: true });
  });

  it('can preserve the user toggle when turn-level runtime state reports off', () => {
    const fallback = { enabled: true, canToggle: true };

    expect(normalizeFastModeState('off', fallback, { preserveEnabled: true })).toEqual({
      enabled: true,
      canToggle: true,
    });
    expect(normalizeFastModeState({ state: 'cooldown' }, fallback, { preserveEnabled: true })).toEqual({
      enabled: true,
      canToggle: true,
    });
  });

  it('preserves SDK object states and canToggle', () => {
    expect(normalizeFastModeState({ state: 'on', canToggle: false })).toEqual({
      enabled: true,
      canToggle: false,
    });
    expect(normalizeFastModeState({ enabled: true, canToggle: true })).toEqual({
      enabled: true,
      canToggle: true,
    });
  });
});
