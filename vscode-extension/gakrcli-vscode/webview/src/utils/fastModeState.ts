export interface WebviewFastModeState {
  enabled: boolean;
  canToggle: boolean;
}

export interface NormalizeFastModeStateOptions {
  /**
   * Turn-level SDK messages can report the operational fast-mode route as
   * "off" or "cooldown" even when the user preference remains enabled. In
   * those cases the toggle should keep showing the user-selected state.
   */
  preserveEnabled?: boolean;
}

export function normalizeFastModeState(
  value: unknown,
  fallback: WebviewFastModeState = { enabled: false, canToggle: true },
  options: NormalizeFastModeStateOptions = {},
): WebviewFastModeState {
  if (typeof value === 'string') {
    const enabled = options.preserveEnabled ? fallback.enabled : value === 'on';
    return {
      enabled,
      canToggle: true,
    };
  }

  if (typeof value === 'boolean') {
    return {
      enabled: value,
      canToggle: fallback.canToggle,
    };
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const state = typeof record.state === 'string' ? record.state : undefined;
    const enabled = typeof record.enabled === 'boolean'
      ? record.enabled
      : state === 'on'
        ? true
        : state === 'off' || state === 'cooldown'
          ? options.preserveEnabled
            ? fallback.enabled
            : false
          : fallback.enabled;

    return {
      enabled,
      canToggle: typeof record.canToggle === 'boolean' ? record.canToggle : fallback.canToggle,
    };
  }

  return fallback;
}
