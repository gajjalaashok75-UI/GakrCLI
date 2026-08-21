import type { WebBrowserOutput } from './WebBrowserTool.js';

/**
 * Build the two-part text for the Browser action row.
 *
 *   Browser(navigate https://example.com)      ← primary (verb + inputs)
 *   ⎿ navigated to https://example.com         ← secondary (what actually happened)
 *
 * The primary line is exactly what renderToolResultMessage already returns for the
 * `○ Browser(...)` tool-result display, so both rows describe the same call.
 */
export function buildActionResultText(observationText: string): string {
  const text = observationText.trim();
  if (!text) return '';

  // Trim progress noise, then wrap the first sentence as human-readable body text.
  const body = text
    .split('\n')
    .filter((line) => {
      const lower = line.trim().toLowerCase();
      if (!lower) return false;
      if (lower.startsWith('[progress]')) return false;
      if (lower.startsWith('[warning]')) return false;
      if (/thought|chain of thought|coT/.test(lower.split(':')[0])) return false;
      return true;
    })
    .join(' ')
    .trim();

  if (body) return body.length > 100 ? `${body.slice(0, 97)}...` : body;
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
}

export function renderToolResultMessage(
  content: WebBrowserOutput,
  _progressMessagesForMessage: never,
  _options: { verbose: boolean },
): string {
  const statusLine = content.isError
    ? `WebBrowser error: ${content.observationText}`
    : content.observationText;
  const isLong = statusLine.includes('\n') || statusLine.length > 100;
  return isLong ? `${statusLine.slice(0, 97)}...` : statusLine;
}

export function extractSearchText(output: WebBrowserOutput): string {
  const prefix = output.isError ? 'WebBrowser error: ' : '';
  const text = output.observationText.replace(/\n/g, ' ');
  return prefix + (text.length > 120 ? `${text.slice(0, 117)}...` : text);
}