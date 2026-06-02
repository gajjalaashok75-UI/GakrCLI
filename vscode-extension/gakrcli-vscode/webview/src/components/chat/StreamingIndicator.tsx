interface StreamingIndicatorProps {
  visible: boolean;
}

export function StreamingIndicator({ visible }: StreamingIndicatorProps) {
  if (!visible) return null;

  return (
    <div
      className="thinking-status"
      role="status"
      aria-live="polite"
    >
      <span className="thinking-status-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M8 2.2 9.15 5.8 12.8 7 9.15 8.2 8 11.8 6.85 8.2 3.2 7l3.65-1.2L8 2.2Z" />
          <path d="M12 10.2 12.45 11.55 13.8 12 12.45 12.45 12 13.8 11.55 12.45 10.2 12l1.35-.45L12 10.2Z" />
        </svg>
      </span>
      <span className="thinking-status-label">Thinking...</span>
    </div>
  );
}
