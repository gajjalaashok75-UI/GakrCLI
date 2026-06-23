import { expect, test } from 'bun:test'
import * as wf from '../index.js'

test('engine core API fully exported', () => {
  expect(typeof wf.runWorkflow).toBe('function')
  expect(typeof wf.parseScript).toBe('function')
  expect(typeof wf.extractMeta).toBe('function')
  expect(typeof wf.makeHooks).toBe('function')
  expect(typeof wf.createEngineContext).toBe('function')
  expect(typeof wf.createSharedResources).toBe('function')
})

test('ports / host API fully exported', () => {
  expect(typeof wf.createHostHandle).toBe('function')
  expect(typeof wf.isHostHandle).toBe('function')
  expect(typeof wf.unwrapHostHandle).toBe('function')
})

test('persistence / structured output / named workflow / progress API fully exported', () => {
  expect(typeof wf.createFileJournalStore).toBe('function')
  expect(typeof wf.agentCallKey).toBe('function')
  expect(typeof wf.validateAgainstSchema).toBe('function')
  expect(typeof wf.resolveNamedWorkflow).toBe('function')
  expect(typeof wf.listNamedWorkflows).toBe('function')
  expect(typeof wf.createBufferingEmitter).toBe('function')
  expect(typeof wf.createProgressEmitter).toBe('function')
})

test('concurrency / budget / error classes fully exported', () => {
  expect(typeof wf.Semaphore).toBe('function')
  expect(typeof wf.maxConcurrency).toBe('function')
  expect(typeof wf.clampMaxConcurrency).toBe('function')
  expect(typeof wf.Budget).toBe('function')
  expect(typeof wf.BudgetExhaustedError).toBe('function')
  expect(typeof wf.WorkflowError).toBe('function')
  expect(typeof wf.WorkflowAbortedError).toBe('function')
  expect(typeof wf.ScriptError).toBe('function')
})

test('WORKFLOW_TOOL_NAME exported from engine constants', () => {
  expect(wf.WORKFLOW_TOOL_NAME).toBe('Workflow')
})

test('engine constant values are stable', () => {
  expect(wf.WORKFLOW_DIR_NAME).toBe('.gakrcli/workflows')
  expect(wf.WORKFLOW_RUNS_DIR).toBe('.gakrcli/workflow-runs')
  expect(wf.WORKFLOW_TOOL_NAME).toBe('Workflow')
  expect(wf.MAX_TOTAL_AGENTS).toBe(1000)
  expect(wf.MAX_ITEMS_PER_CALL).toBe(4096)
  expect(wf.MAX_CONCURRENCY_CAP).toBe(16)
  expect(wf.DEFAULT_MAX_CONCURRENCY).toBe(3)
  expect(wf.WORKFLOW_SCRIPT_EXTENSIONS).toEqual(['.ts', '.js', '.mjs'])
})
