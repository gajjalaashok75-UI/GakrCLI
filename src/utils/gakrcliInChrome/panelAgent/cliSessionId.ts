/**
 * Panel sessions are stored as arbitrary ids by the extension (the side panel
 * uses uuids, the web editor uses `web-editor-<tabId>`). The CLI requires
 * `--session-id` / `--resume` to be a uuid, so non-uuid panel ids are mapped
 * deterministically: the same panel session always resumes the same CLI
 * conversation, and different panel sessions never collide.
 */

import { createHash } from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NAMESPACE = 'gakr:panel-session:';

/** Whether `value` is already a CLI-acceptable session uuid. */
export function isCliSessionId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/**
 * Map a panel session id to a CLI session uuid.
 *
 * uuids pass through unchanged (lower-cased); anything else is hashed into a
 * name-based uuid (version 5 layout) so the mapping is stable across restarts.
 */
export function toCliSessionId(panelSessionId: string): string {
  const trimmed = panelSessionId.trim();
  if (!trimmed) {
    throw new Error('panel session id is required');
  }
  if (isCliSessionId(trimmed)) {
    return trimmed.toLowerCase();
  }

  const digest = createHash('sha256')
    .update(NAMESPACE + trimmed)
    .digest();
  const bytes = new Uint8Array(digest).slice(0, 16);
  // Version 5 (name-based, SHA-256) and RFC 4122 variant bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
