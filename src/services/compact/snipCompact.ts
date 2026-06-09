import { randomUUID } from 'crypto'
import type { UUID } from 'crypto'
import { deriveShortMessageId } from '../../utils/messages.js'

const pendingSnipUuids = new Set<UUID>()

export function markForSnip(shortIds: string[], messages: any[]): UUID[] {
  const shortIdToUuid = new Map<string, UUID>()
  for (const msg of messages) {
    if (msg?.uuid) {
      shortIdToUuid.set(deriveShortMessageId(msg.uuid as string), msg.uuid as UUID)
    }
  }
  const matched = new Set<UUID>()
  for (const shortId of shortIds) {
    const uuid = shortIdToUuid.get(shortId)
    if (uuid) {
      pendingSnipUuids.add(uuid)
      matched.add(uuid)
    }
  }
  return [...matched]
}

export function isSnipRuntimeEnabled(): boolean {
  return true
}

export const SNIP_NUDGE_TEXT =
  `Your context window is filling up. Use the \`snip\` tool to remove messages ` +
  `that are no longer needed - look for \`[id:...]\` tags on user messages and pass the IDs ` +
  `of stale sections (old explorations, superseded plans, resolved errors). This frees up ` +
  `space so you can continue working without a full compaction.`

const NUDGE_INTERVAL_TOKENS = 10_000

function estimateTokens(msg: any): number {
  const content = msg?.message?.content ?? msg?.content ?? ''
  const text = typeof content === 'string' ? content : JSON.stringify(content)
  return Math.ceil(text.length / 4)
}

export function shouldNudgeForSnips(messages: any[]): boolean {
  let accumulated = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg?.type === 'system' && msg?.subtype === 'compact_boundary') return false
    if (msg?.snipMetadata) return false
    if (
      msg?.type === 'attachment' &&
      msg?.attachment?.type === 'context_efficiency'
    ) return false
    accumulated += estimateTokens(msg)
    if (accumulated >= NUDGE_INTERVAL_TOKENS) return true
  }
  return false
}

export function snipCompactIfNeeded(
  messages: any[],
): { messages: any[]; tokensFreed: number; boundaryMessage?: any } {
  if (pendingSnipUuids.size === 0) {
    return { messages, tokensFreed: 0 }
  }

  const uuidsToRemove = new Set<UUID>()
  for (const msg of messages) {
    const uuid = msg?.uuid as UUID | undefined
    if (uuid && pendingSnipUuids.has(uuid)) uuidsToRemove.add(uuid)
  }

  if (uuidsToRemove.size === 0) {
    return { messages, tokensFreed: 0 }
  }

  for (const uuid of uuidsToRemove) pendingSnipUuids.delete(uuid)

  const snippedToolUseIds = new Set<string>()
  const snippedResultToolUseIds = new Set<string>()
  for (const msg of messages) {
    if (!uuidsToRemove.has(msg?.uuid)) continue
    const blocks = msg?.message?.content
    if (!Array.isArray(blocks)) continue
    if (msg?.type === 'assistant') {
      for (const block of blocks) {
        if (block?.type === 'tool_use' && block?.id) snippedToolUseIds.add(block.id as string)
      }
    } else if (msg?.type === 'user') {
      for (const block of blocks) {
        if (block?.type === 'tool_result' && block?.tool_use_id) {
          snippedResultToolUseIds.add(block.tool_use_id as string)
        }
      }
    }
  }

  const safeToolUseIds = new Set<string>()
  for (const msg of messages) {
    if (msg?.type !== 'assistant') continue
    const blocks = msg?.message?.content
    if (!Array.isArray(blocks)) continue
    const toolUses = (blocks as any[]).filter(b => b?.type === 'tool_use')
    if (toolUses.length === 0) continue
    const isPureToolUseTurn = toolUses.length === blocks.length
    const droppable =
      uuidsToRemove.has(msg?.uuid) ||
      (isPureToolUseTurn &&
        toolUses.every((t: any) => snippedResultToolUseIds.has(t?.id)))
    if (droppable) {
      for (const t of toolUses) if (t?.id) safeToolUseIds.add(t.id as string)
    }
  }

  let tokensFreed = 0
  const surviving: any[] = []
  const removedUuids = new Set<UUID>()

  for (const msg of messages) {
    if (uuidsToRemove.has(msg?.uuid)) {
      if (msg?.type === 'user' && Array.isArray(msg?.message?.content)) {
        const results = (msg.message.content as any[]).filter(b => b?.type === 'tool_result')
        if (
          results.length > 0 &&
          !results.every((r: any) => safeToolUseIds.has(r?.tool_use_id))
        ) {
          surviving.push(msg)
          continue
        }
      }
      tokensFreed += estimateTokens(msg)
      if (msg?.uuid) removedUuids.add(msg.uuid as UUID)
      continue
    }

    if (msg?.type === 'user' && Array.isArray(msg?.message?.content)) {
      const blocks = msg.message.content as any[]
      const results = blocks.filter(b => b?.type === 'tool_result')
      if (
        results.length > 0 &&
        results.length === blocks.length &&
        results.every((r: any) => snippedToolUseIds.has(r?.tool_use_id))
      ) {
        tokensFreed += estimateTokens(msg)
        if (msg?.uuid) removedUuids.add(msg.uuid as UUID)
        continue
      }
    }

    if (msg?.type === 'assistant' && Array.isArray(msg?.message?.content)) {
      const blocks = msg.message.content as any[]
      const toolUses = blocks.filter(b => b?.type === 'tool_use')
      if (
        toolUses.length > 0 &&
        toolUses.length === blocks.length &&
        toolUses.every((t: any) => snippedResultToolUseIds.has(t?.id))
      ) {
        tokensFreed += estimateTokens(msg)
        if (msg?.uuid) removedUuids.add(msg.uuid as UUID)
        continue
      }
    }
    surviving.push(msg)
  }

  if (removedUuids.size === 0) {
    return { messages, tokensFreed: 0 }
  }

  const boundaryMessage = {
    type: 'system' as const,
    subtype: 'snip_boundary',
    content: 'Conversation history snipped',
    isMeta: false as const,
    timestamp: new Date().toISOString(),
    uuid: randomUUID() as UUID,
    level: 'info' as const,
    snipMetadata: {
      removedUuids: [...removedUuids] as UUID[],
    },
  }

  return { messages: surviving, tokensFreed, boundaryMessage }
}

export function isSnipMarkerMessage(message: unknown): boolean {
  return (message as any)?.subtype === 'snip_boundary'
}

export function _resetForTesting(): void {
  pendingSnipUuids.clear()
}
