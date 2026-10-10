import * as React from 'react'
import { Text } from '../../ink.js'
import { MessageResponse } from 'src/components/MessageResponse.js'
import type { ToolProgressData } from 'src/Tool.js'
import type { ProgressMessage } from 'src/types/message.js'
import type { MemoryRecallHit, MemoryRecallOutput } from './MemoryRecallTool.js'

export function renderToolUseMessage(
  input: { query?: string; limit?: number } | undefined,
  _options: {
    theme?: unknown
    verbose?: boolean
    commands?: unknown
  } = {},
): React.ReactNode {
  void _options
  const query = input?.query?.trim()
  return query ? `query: ${query}` : 'searching memory'
}

function renderHit(hit: MemoryRecallHit): React.ReactNode {
  const provenance =
    hit.sessionId != null ? ` (session ${hit.sessionId.slice(0, 8)})` : ''
  return (
    <Text key={hit.path}>
      {'• '}
      <Text bold>{hit.title}</Text>
      {provenance ? <Text dimColor>{provenance}</Text> : null}
      {hit.content ? (
        <Text dimColor>{` — ${hit.content.slice(0, 120)}`}</Text>
      ) : null}
    </Text>
  )
}

export function renderToolResultMessage(
  output: MemoryRecallOutput,
  _progressMessagesForMessage: ProgressMessage<ToolProgressData>[],
  _options: { verbose?: boolean } = {},
): React.ReactNode {
  void _progressMessagesForMessage
  void _options
  if (output.totalHits === 0) {
    return (
      <MessageResponse height={1}>
        <Text dimColor>No memory matches for "{output.query}"</Text>
      </MessageResponse>
    )
  }

  const shown = output.hits.length
  return (
    <MessageResponse>
      <Text>
        Found {shown} {shown === 1 ? 'match' : 'matches'}
        {output.totalHits > shown ? ` (of ${output.totalHits})` : ''}:
      </Text>
      {output.hits.map(hit => renderHit(hit))}
    </MessageResponse>
  )
}
