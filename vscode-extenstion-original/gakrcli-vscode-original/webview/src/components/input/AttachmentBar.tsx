export interface AttachmentItem {
  type: 'file' | 'image' | 'url' | 'text';
  name: string;
  content: string; // base64 for images, path for files, raw for text/url
}

export interface AttachmentBarProps {
  attachments: AttachmentItem[];
  onRemove: (index: number) => void;
}

export function AttachmentBar({ attachments, onRemove }: AttachmentBarProps) {
  if (attachments.length === 0) return null;

  const countLabel = `${attachments.length} ${attachments.length === 1 ? 'file' : 'files'} attached`;

  return (
    <div
      style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--app-input-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
          fontSize: 11,
          color: 'var(--app-secondary-foreground)',
        }}
      >
        <span>{countLabel}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 6,
          maxHeight: 96,
          overflowY: 'auto',
          paddingRight: 2,
        }}
      >
        {attachments.map((attachment, index) => (
          <div
            key={`${attachment.type}-${attachment.content || attachment.name}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
              padding: '4px 6px',
              borderRadius: 'var(--corner-radius-small)',
              background: 'var(--app-input-background)',
              border: '1px solid var(--app-input-border)',
              fontSize: 12,
            }}
          >
            {attachment.type === 'image' && attachment.content.startsWith('data:') ? (
              <img
                src={attachment.content}
                alt={attachment.name}
                style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
              />
            ) : (
              <AttachmentIcon type={attachment.type} />
            )}

            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--app-primary-foreground)',
              }}
              title={attachment.content || attachment.name}
            >
              {attachment.name}
            </span>

            <button
              onClick={() => onRemove(index)}
              title={`Remove ${attachment.name}`}
              aria-label={`Remove ${attachment.name}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                borderRadius: 2,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                opacity: 0.65,
                color: 'var(--app-primary-foreground)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '0.65';
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttachmentIcon({ type }: { type: AttachmentItem['type'] }) {
  if (type === 'url') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flexShrink: 0, opacity: 0.65 }}>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 1.5C6 4 5 6 5 8s1 4 3 6.5M8 1.5C10 4 11 6 11 8s-1 4-3 6.5M1.5 8h13" />
      </svg>
    );
  }

  if (type === 'text') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flexShrink: 0, opacity: 0.65 }}>
        <path d="M4 3h8M4 6.5h8M4 10h5" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, opacity: 0.65 }}>
      <path d="M13.85 4.44l-3.28-3.3A.5.5 0 0010.21 1H3.5A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V4.8a.5.5 0 00-.15-.36zM10.5 2.12L12.88 4.5H10.5V2.12zM13 13.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5v-11a.5.5 0 01.5-.5H9.5V5h4v8.5z" />
    </svg>
  );
}
