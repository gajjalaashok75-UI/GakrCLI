import { describe, expect, test } from 'bun:test'
import { SandboxManager } from './sandbox-adapter'

describe('SandboxManager adapter', () => {
  test('always exposes a safe sandbox stderr annotation helper', () => {
    expect(typeof SandboxManager.annotateStderrWithSandboxFailures).toBe('function')
    expect(SandboxManager.annotateStderrWithSandboxFailures('ls', 'output')).toBeString()
  })
})
