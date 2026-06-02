import type { CSSProperties } from 'react';
import type { WebviewContextUsage } from '../../utils/contextUsage';
import {
  buildContextUsageTooltip,
  formatContextTokens,
} from '../../utils/contextUsage';

interface ContextUsageIndicatorProps {
  usage: WebviewContextUsage | null;
}

export function ContextUsageIndicator({ usage }: ContextUsageIndicatorProps) {
  if (!usage) {
    return null;
  }

  const capacity = usage.rawMaxTokens || usage.maxTokens;
  const tooltip = buildContextUsageTooltip(usage);
  const tone = !usage.isKnown
    ? 'var(--app-glass-sky)'
    : usage.percentage >= 90
    ? 'var(--app-glass-danger)'
    : usage.percentage >= 75
      ? 'var(--app-glass-amber)'
      : 'var(--app-glass-mint)';
  const capacityLabel = usage.isKnown ? formatContextTokens(capacity) : 'live';

  return (
    <div
      className="context-usage-indicator glass-control"
      data-known={usage.isKnown ? 'true' : 'false'}
      title={tooltip}
      aria-label={tooltip}
      role="status"
      style={{
        '--context-usage-percent': `${usage.percentage}%`,
        '--context-usage-color': tone,
      } as CSSProperties}
    >
      <span className="context-usage-ring" aria-hidden="true">
        <span className="context-usage-ring-core" />
      </span>
      <span className="context-usage-label">{usage.percentage}%</span>
      <span className="context-usage-capacity">{capacityLabel}</span>
    </div>
  );
}
