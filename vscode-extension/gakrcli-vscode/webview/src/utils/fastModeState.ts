export interface WebviewFastModeState {
  enabled: boolean;
  canToggle: boolean;
}

export function normalizeFastModeState(
  value: unknown,
  fallback: WebviewFastModeState = { enabled: false, canToggle: true },
): WebviewFastModeState {
  if (typeof value === 'string') {
    return {
      enabled: value === 'on',
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
          ? false
          : fallback.enabled;

    return {
      enabled,
      canToggle: typeof record.canToggle === 'boolean' ? record.canToggle : fallback.canToggle,
    };
  }

  return fallback;
}
