export interface WebviewContextUsage {
  totalTokens: number;
  maxTokens: number;
  rawMaxTokens: number;
  percentage: number;
  model: string | null;
  autoCompactThreshold: number | null;
  isAutoCompactEnabled: boolean;
  isKnown: boolean;
}

export function createPendingContextUsage(model: string | null = null): WebviewContextUsage {
  return {
    totalTokens: 0,
    maxTokens: 0,
    rawMaxTokens: 0,
    percentage: 0,
    model,
    autoCompactThreshold: null,
    isAutoCompactEnabled: false,
    isKnown: false,
  };
}

export function normalizeContextUsage(
  value: unknown,
  fallback: WebviewContextUsage | null = null,
): WebviewContextUsage {
  if (!value || typeof value !== 'object') {
    return fallback ?? createPendingContextUsage();
  }

  const record = value as Record<string, unknown>;
  const totalTokens = readNumber(record.totalTokens, record.total_tokens) ?? 0;
  const maxTokens = readNumber(record.maxTokens, record.max_tokens) ?? 0;
  const rawMaxTokens = readNumber(record.rawMaxTokens, record.raw_max_tokens) ?? maxTokens;
  const capacity = rawMaxTokens || maxTokens;

  if (capacity <= 0 && fallback?.isKnown) {
    return fallback;
  }

  const reportedPercentage = readNumber(record.percentage, record.utilization);
  const percentage = clampPercentage(
    reportedPercentage ?? (capacity > 0 ? (totalTokens / capacity) * 100 : fallback?.percentage ?? 0),
  );

  return {
    totalTokens: Math.max(0, Math.round(totalTokens)),
    maxTokens: Math.max(0, Math.round(maxTokens)),
    rawMaxTokens: Math.max(0, Math.round(rawMaxTokens)),
    percentage,
    model: typeof record.model === 'string' && record.model.trim() ? record.model : null,
    autoCompactThreshold: readPositiveNumber(record.autoCompactThreshold, record.auto_compact_threshold),
    isAutoCompactEnabled: Boolean(record.isAutoCompactEnabled ?? record.is_auto_compact_enabled),
    isKnown: capacity > 0,
  };
}

export function formatContextTokens(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return '0';
  }

  if (tokens >= 1_000_000) {
    return `${trimFixed(tokens / 1_000_000)}M`;
  }

  if (tokens >= 1_000) {
    return `${trimFixed(tokens / 1_000)}K`;
  }

  return String(Math.round(tokens));
}

export function buildContextUsageTooltip(usage: WebviewContextUsage): string {
  const capacity = usage.rawMaxTokens || usage.maxTokens;
  if (!usage.isKnown) {
    const lines = [
      `Context: ${usage.percentage}% used`,
      'Token capacity is refreshing from the CLI/SDK.',
      'Autocompact status will update when context data is available.',
    ];
    if (usage.model) {
      lines.push(`Model: ${usage.model}`);
    }
    return lines.join('\n');
  }

  const lines = [
    `Context: ${usage.percentage}% used`,
    `Tokens: ${formatContextTokens(usage.totalTokens)} / ${formatContextTokens(capacity)}`,
  ];

  if (usage.autoCompactThreshold && usage.isAutoCompactEnabled) {
    const thresholdPercent = Math.round((usage.autoCompactThreshold / capacity) * 100);
    lines.push(`Autocompact starts around ${formatContextTokens(usage.autoCompactThreshold)} tokens (${thresholdPercent}%).`);
  } else if (usage.isAutoCompactEnabled) {
    lines.push('Autocompact is enabled for this session.');
  } else {
    lines.push('Autocompact is not enabled for this session.');
  }

  if (usage.model) {
    lines.push(`Model: ${usage.model}`);
  }

  return lines.join('\n');
}

function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function readPositiveNumber(...values: unknown[]): number | null {
  const value = readNumber(...values);
  return value && value > 0 ? Math.round(value) : null;
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function trimFixed(value: number): string {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, '');
}
