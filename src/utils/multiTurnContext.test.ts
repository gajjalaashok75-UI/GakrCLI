import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  startNewTurn,
  getCurrentTurn,
  addMessageToTurn,
  addToolCallToTurn,
  setTurnState,
  getTurnState,
  getTurnHistory,
  getRecentTurns,
  getMultiTurnStats,
  resetMultiTurnState,
  createMultiTurnTracker,
} from './multiTurnContext.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

function createMessage(role: string, content: string): any {
  return {
    message: { role, content, id: 'test', type: 'message', created_at: Date.now() },
    sender: role,
  }
}

describe('multiTurnContext', () => {
  beforeEach(async () => {
    await acquireSharedMutationLock('utils/multiTurnContext.test.ts')
    createMultiTurnTracker()
    resetMultiTurnState()
  })

  afterEach(() => {
    try {
      createMultiTurnTracker()
      resetMultiTurnState()
    } finally {
      releaseSharedMutationLock()
    }
  })

  describe('startNewTurn', () => {
    it('creates a new turn', () => {
      const turn = startNewTurn()
      expect(turn.turnId).toBeDefined()
      expect(turn.startTime).toBeDefined()
      expect(turn.messages).toEqual([])
      expect(turn.toolCalls).toEqual([])
      expect(turn.tokens).toBe(0)
    })

    it('tracks turn count', () => {
      startNewTurn()
      const turn2 = startNewTurn()
      expect(turn2.turnId).toContain('turn_2')
    })

    it('tracks current turn', () => {
      const turn = startNewTurn()
      expect(getCurrentTurn()).toBe(turn)
    })
  })

  describe('addMessageToTurn', () => {
    it('adds message to current turn', () => {
      startNewTurn()
      addMessageToTurn(createMessage('user', 'Hello'))
      expect(getCurrentTurn()?.messages.length).toBe(1)
      expect(getCurrentTurn()?.tokens).toBeGreaterThan(0)
    })

    it('creates turn if none exists', () => {
      addMessageToTurn(createMessage('user', 'Hello'))
      expect(getCurrentTurn()).toBeDefined()
      expect(getCurrentTurn()?.messages.length).toBe(1)
    })
  })

  describe('addToolCallToTurn', () => {
    it('adds tool call to turn', () => {
      startNewTurn()
      const toolCall = {
        id: 'call_1',
        name: 'test_tool',
        input: { arg: 'value' },
        timestamp: Date.now(),
      }

      addToolCallToTurn(toolCall)
      expect(getCurrentTurn()?.toolCalls.length).toBe(1)
      expect(getCurrentTurn()?.toolCalls[0]).toEqual(toolCall)
    })
  })

  describe('state management', () => {
    it('sets and gets turn state', () => {
      startNewTurn()
      setTurnState('key', 'value')
      expect(getTurnState('key')).toBe('value')
    })

    it('returns undefined for unknown keys', () => {
      startNewTurn()
      expect(getTurnState('unknown')).toBeUndefined()
    })

    it('manages multiple state values', () => {
      startNewTurn()
      setTurnState('key1', 'value1')
      setTurnState('key2', 42)

      expect(getTurnState<string>('key1')).toBe('value1')
      expect(getTurnState<number>('key2')).toBe(42)
    })
  })

  describe('getTurnHistory', () => {
    it('returns turn history', () => {
      startNewTurn()
      startNewTurn()
      startNewTurn()

      const history = getTurnHistory()
      expect(history).toHaveLength(3)
    })
  })

  describe('getRecentTurns', () => {
    it('returns recent turns', () => {
      for (let i = 0; i < 5; i++) {
        startNewTurn()
      }

      const recent = getRecentTurns(2)
      expect(recent).toHaveLength(2)
    })
  })

  describe('getMultiTurnStats', () => {
    it('returns statistics', () => {
      startNewTurn()
      addMessageToTurn(createMessage('user', 'test message'))

      const stats = getMultiTurnStats()
      expect(stats.totalTurns).toBe(1)
      expect(stats.totalTokens).toBeGreaterThan(0)
      expect(stats.avgTokensPerTurn).toBeGreaterThan(0)
    })
  })

  describe('createMultiTurnTracker', () => {
    it('creates tracker with all methods', () => {
      const tracker = createMultiTurnTracker()
      expect(tracker.startTurn).toBeDefined()
      expect(tracker.addMessage).toBeDefined()
      expect(tracker.addToolCall).toBeDefined()
      expect(tracker.setState).toBeDefined()
      expect(tracker.getState).toBeDefined()
      expect(tracker.getHistory).toBeDefined()
      expect(tracker.getRecent).toBeDefined()
      expect(tracker.getStats).toBeDefined()
      expect(tracker.reset).toBeDefined()
    })

    it('respects the maxTurns option', () => {
      // Create a tracker with a very small maxTurns
      createMultiTurnTracker({ maxTurns: 2 })
      
      startNewTurn() // turn 1
      startNewTurn() // turn 2
      startNewTurn() // turn 3 - should drop turn 1
      
      const history = getTurnHistory()
      expect(history.length).toBe(2)
      // The first remaining turn should be the 2nd one created
      expect(history[0].turnId).toContain('turn_2')
    })
  })

  describe('resetMultiTurnState', () => {
    it('resets state', () => {
      startNewTurn()
      addMessageToTurn(createMessage('user', 'test'))

      resetMultiTurnState()

      expect(getCurrentTurn()).toBeNull()
      expect(getTurnHistory()).toEqual([])
    })
  })
})
