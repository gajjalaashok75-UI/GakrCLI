import { afterEach, beforeEach, expect, test } from 'bun:test'

import { getDefaultAppState, type AppState } from '../../state/AppState.js'
import { createTaskStateBase } from '../../Task.js'
import { asAgentId } from '../../types/ids.js'
import {
  getCommandQueue,
  resetCommandQueue,
} from '../../utils/messageQueueManager.js'
import {
  enqueueAgentNotification,
  type LocalAgentTaskState,
} from './LocalAgentTask.js'

let state: AppState

function setAppState(updater: (prev: AppState) => AppState): void {
  state = updater(state)
}

function addRunningAgentTask(taskId: string): void {
  const task: LocalAgentTaskState = {
    ...createTaskStateBase(taskId, 'local_agent', 'child analysis', 'tool-1'),
    type: 'local_agent',
    status: 'running',
    agentId: taskId,
    prompt: 'check the child slice',
    agentType: 'general-purpose',
    retrieved: false,
    lastReportedToolCount: 0,
    lastReportedTokenCount: 0,
    isBackgrounded: true,
    pendingMessages: [],
    retain: false,
    diskLoaded: false,
  }

  state = {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: task,
    },
  }
}

beforeEach(() => {
  resetCommandQueue()
  state = getDefaultAppState()
})

afterEach(() => {
  resetCommandQueue()
})

test('routes completed async agent notifications back to the invoking subagent', () => {
  addRunningAgentTask('a-child')
  const parentAgentId = asAgentId('a-parent')

  enqueueAgentNotification({
    taskId: 'a-child',
    description: 'child analysis',
    status: 'completed',
    setAppState,
    finalMessage: 'child result',
    usage: {
      totalTokens: 12,
      toolUses: 2,
      durationMs: 34,
    },
    toolUseId: 'tool-1',
    agentId: parentAgentId,
  })

  const queued = getCommandQueue()
  expect(queued).toHaveLength(1)
  expect(queued[0]?.mode).toBe('task-notification')
  expect(queued[0]?.agentId).toBe(parentAgentId)
  expect(queued[0]?.value).toContain('<status>completed</status>')
  expect(queued[0]?.value).toContain('<result>child result</result>')
  expect(queued[0]?.value).toContain('<tool-use-id>tool-1</tool-use-id>')
})

test('routes killed async agent notifications with partial output back to the invoking subagent', () => {
  addRunningAgentTask('a-child')
  const parentAgentId = asAgentId('a-parent')

  enqueueAgentNotification({
    taskId: 'a-child',
    description: 'child analysis',
    status: 'killed',
    setAppState,
    finalMessage: 'partial child result',
    toolUseId: 'tool-1',
    agentId: parentAgentId,
  })

  const queued = getCommandQueue()
  expect(queued).toHaveLength(1)
  expect(queued[0]?.agentId).toBe(parentAgentId)
  expect(queued[0]?.value).toContain('<status>killed</status>')
  expect(queued[0]?.value).toContain(
    '<summary>Agent "child analysis" was stopped</summary>',
  )
  expect(queued[0]?.value).toContain(
    '<result>partial child result</result>',
  )
})
