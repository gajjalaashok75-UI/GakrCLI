interface StreamingIndicatorProps {
  visible: boolean;
}

export function StreamingIndicator({ visible }: StreamingIndicatorProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        padding: '10px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--app-secondary-foreground)',
        fontSize: 12,
      }}
      role="status"
      aria-live="polite"
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            animation: `streamingDot 1.4s ease-in-out ${i * 0.16}s infinite`,
          }} />
        ))}
      </span>
      <span style={{ fontStyle: 'italic' }}>Thinking...</span>
    </div>
  );
}
