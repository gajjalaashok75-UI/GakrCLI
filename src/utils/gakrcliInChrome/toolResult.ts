/**
 * Normalises what the extension returns into an MCP tool result.
 *
 * The extension already answers in MCP shape — see `createErrorResponse` in
 * packages/chrome-extension/common/tool-handler.ts, which returns
 * `{ content: [{ type: 'text', text }], isError: true }`. Forwarding that
 * envelope as-is keeps `isError` and avoids burying the payload one level
 * deeper in a JSON string.
 */

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

/** Cap on any single text block, so a full-page dump cannot blow up context. */
const MAX_RESULT_CHARS = 100_000

function capText(text: string): string {
  if (text.length <= MAX_RESULT_CHARS) {
    return text
  }
  return `${text.slice(0, MAX_RESULT_CHARS)}\n…[truncated]`
}

/** True for the `{ content: [{ type: 'text', text }], isError? }` envelope. */
function isMcpResult(value: unknown): value is ToolResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const content = (value as { content?: unknown }).content
  return (
    Array.isArray(content) &&
    content.every(
      block =>
        typeof block === 'object' &&
        block !== null &&
        typeof (block as { text?: unknown }).text === 'string',
    )
  )
}

/**
 * Turn an extension response into a tool result. `isError` is set when the
 * executor threw, or when the extension itself flagged the result.
 */
export function toToolResult(value: unknown, isError = false): ToolResult {
  if (isMcpResult(value)) {
    return {
      content: value.content.map(block => ({
        type: 'text',
        text: capText(block.text),
      })),
      isError: isError || value.isError === true,
    }
  }

  let text: string
  if (typeof value === 'string') {
    text = value
  } else {
    try {
      text = JSON.stringify(value, null, 2) ?? String(value)
    } catch {
      text = String(value)
    }
  }
  return { content: [{ type: 'text', text: capText(text) }], isError }
}
