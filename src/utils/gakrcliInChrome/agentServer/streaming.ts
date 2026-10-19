/**
 * Streaming text-block bookkeeping for the side-panel agent server.
 *
 * The model streams a response as `stream_event` deltas, but the panel replaces
 * a message by id instead of appending to it, so two things have to hold:
 *
 *  1. each delta must carry the whole block of text so far, and
 *  2. the final `assistant` message for that block must publish under the same
 *     id, or the panel shows the answer twice.
 *
 * Anthropic text blocks carry no id of their own, so block ids are synthesised
 * here and keyed by content-block index.
 */

export type StreamDelta = {
  /** Id the delta must be published under. */
  id: string
  /** Full text of the block so far, including this delta. */
  text: string
}

type Block = { id: string; text: string }

export class StreamBlockTracker {
  private blocks = new Map<number, Block>()
  /** Bumped per streamed message so ids stay unique across a turn. */
  private seq = 0

  /**
   * Apply one raw Anthropic stream event.
   *
   * Returns the text to publish for a `text_delta`, or undefined for every
   * other event — tool-use deltas are ignored because the `tool_use` block
   * arrives complete in the following `assistant` message.
   */
  apply(event: unknown, requestId: string): StreamDelta | undefined {
    if (!event || typeof event !== 'object') {
      return undefined
    }
    const typed = event as {
      type?: string
      index?: number
      content_block?: { type?: string; text?: string }
      delta?: { type?: string; text?: string }
    }

    switch (typed.type) {
      case 'message_start': {
        this.nextMessage()
        return undefined
      }

      case 'content_block_start': {
        if (typed.content_block?.type !== 'text') {
          return undefined
        }
        const index = typed.index ?? 0
        if (index === 0) {
          // Also reset here: not every emitter sends `message_start`, and a new
          // message starting at index 0 must not inherit the previous
          // message's block id.
          this.nextMessage()
        }
        this.blocks.set(index, {
          id: `${requestId}:${this.seq}:${index}`,
          text: typed.content_block.text ?? '',
        })
        return undefined
      }

      case 'content_block_delta': {
        if (
          typed.delta?.type !== 'text_delta' ||
          typeof typed.delta.text !== 'string'
        ) {
          return undefined
        }
        const block = this.blocks.get(typed.index ?? 0)
        if (!block) {
          return undefined
        }
        block.text += typed.delta.text
        return { id: block.id, text: block.text }
      }

      default:
        return undefined
    }
  }

  /** Id a completed text block must be published under, if it streamed. */
  idForBlock(index: number): string | undefined {
    return this.blocks.get(index)?.id
  }

  /** Call once an `assistant` message has been published in full. */
  reset(): void {
    this.blocks.clear()
  }

  private nextMessage(): void {
    this.seq += 1
    this.blocks.clear()
  }
}
