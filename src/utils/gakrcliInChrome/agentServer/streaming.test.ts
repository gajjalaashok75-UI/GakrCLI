/**
 * Tests for the streamed-text bookkeeping the side panel depends on.
 *
 * The panel replaces a message by id, so the two properties asserted here are
 * the whole point of this module: each delta carries the full block of text so
 * far, and the final `assistant` message uses the same id as the deltas, so the
 * answer is not rendered twice.
 */

import { describe, expect, it } from 'bun:test'
import { StreamBlockTracker } from './streaming.js'

const messageStart = { type: 'message_start' }
const textBlockStart = (index: number) => ({
  type: 'content_block_start',
  index,
  content_block: { type: 'text', text: '' },
})
const textDelta = (text: string, index = 0) => ({
  type: 'content_block_delta',
  index,
  delta: { type: 'text_delta', text },
})

describe('StreamBlockTracker', () => {
  it('accumulates deltas into the full block of text so far', () => {
    const tracker = new StreamBlockTracker()
    tracker.apply(messageStart, 'req')
    tracker.apply(textBlockStart(0), 'req')

    const first = tracker.apply(textDelta('Hel'), 'req')
    expect(first?.text).toBe('Hel')

    const second = tracker.apply(textDelta('lo'), 'req')
    expect(second?.text).toBe('Hello')
    expect(second?.id).toBe(first?.id)
  })

  it('gives the final assistant message the id its deltas streamed under', () => {
    const tracker = new StreamBlockTracker()
    tracker.apply(messageStart, 'req')
    tracker.apply(textBlockStart(0), 'req')
    const delta = tracker.apply(textDelta('hi'), 'req')

    // runner.handleSdkMessage looks the id up by content-block index.
    expect(tracker.idForBlock(0)).toBe(delta?.id)
    expect(tracker.idForBlock(1)).toBeUndefined()
  })

  it('does not reuse an id for a later message in the same turn', () => {
    const tracker = new StreamBlockTracker()
    tracker.apply(messageStart, 'req')
    tracker.apply(textBlockStart(0), 'req')
    const first = tracker.apply(textDelta('first'), 'req')

    // Tool-use turns produce several assistant messages per turn; each restarts
    // block indexes, so a shared id would overwrite the earlier answer.
    tracker.apply(messageStart, 'req')
    tracker.apply(textBlockStart(0), 'req')
    const second = tracker.apply(textDelta('second'), 'req')

    expect(second?.id).not.toBe(first?.id)
    expect(second?.text).toBe('second')
    expect(tracker.idForBlock(0)).toBe(second?.id)
  })

  it('separates messages even when no message_start arrives', () => {
    const tracker = new StreamBlockTracker()
    tracker.apply(textBlockStart(0), 'req')
    const first = tracker.apply(textDelta('a'), 'req')
    tracker.apply(textBlockStart(0), 'req')
    const second = tracker.apply(textDelta('b'), 'req')

    expect(second?.id).not.toBe(first?.id)
  })

  it('tracks two text blocks in one message independently', () => {
    const tracker = new StreamBlockTracker()
    tracker.apply(messageStart, 'req')
    tracker.apply(textBlockStart(0), 'req')
    tracker.apply(textBlockStart(1), 'req')
    tracker.apply(textDelta('one', 0), 'req')
    const other = tracker.apply(textDelta('two', 1), 'req')

    expect(other?.text).toBe('two')
    expect(tracker.idForBlock(0)).not.toBe(tracker.idForBlock(1))
  })

  it('ignores events that carry no text to show', () => {
    const tracker = new StreamBlockTracker()
    expect(
      tracker.apply(
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use' },
        },
        'req',
      ),
    ).toBeUndefined()
    expect(tracker.apply({ type: 'message_delta' }, 'req')).toBeUndefined()
    expect(tracker.apply({ type: 'content_block_stop', index: 0 }, 'req'))
      .toBeUndefined()
    // A delta for a block that never started has nothing to append to.
    expect(tracker.apply(textDelta('orphan'), 'req')).toBeUndefined()
    expect(tracker.apply(null, 'req')).toBeUndefined()
  })

  it('stops emitting once the message is complete', () => {
    const tracker = new StreamBlockTracker()
    tracker.apply(messageStart, 'req')
    tracker.apply(textBlockStart(0), 'req')
    tracker.apply(textDelta('done'), 'req')

    tracker.reset()

    expect(tracker.apply(textDelta('late'), 'req')).toBeUndefined()
    expect(tracker.idForBlock(0)).toBeUndefined()
  })
})
