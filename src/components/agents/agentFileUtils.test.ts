import { describe, expect, it } from 'bun:test'
import { join } from 'path'
import type { AgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js'
import {
  formatAgentAsMarkdown,
  getActualAgentFilePath,
} from './agentFileUtils.js'

describe('formatAgentAsMarkdown', () => {
  it('formats a normal string whenToUse', () => {
    const md = formatAgentAsMarkdown(
      'my-agent',
      'Use this agent when X',
      ['Read'],
      'You are a helpful agent.',
    )
    expect(md).toContain('name: my-agent')
    expect(md).toContain('description: "Use this agent when X"')
    expect(md).toContain('You are a helpful agent.')
  })

  it('escapes embedded quotes, backslashes, and newlines in whenToUse', () => {
    const md = formatAgentAsMarkdown(
      'esc',
      'a "quoted" \\path\nand newline',
      undefined,
      'sp',
    )
    expect(md).toContain('description: "a \\"quoted\\" \\\\path\\\\nand newline"')
  })

  // Regression for #1086: weak local models (qwen3.5:9b in the report) can
  // return non-string values for whenToUse, which previously crashed agent
  // creation with "whenToUse.replace is not a function". Fail closed by
  // writing an empty description rather than serializing junk.
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['array', ['array', 'value']],
    ['object', { nested: 'object' }],
  ])('writes an empty description when whenToUse is %s (issue #1086)', (_label, value) => {
    const md = formatAgentAsMarkdown(
      'a',
      value as unknown as string,
      undefined,
      'sp',
    )
    expect(md).toContain('description: ""')
  })
})

describe('getActualAgentFilePath', () => {
  it('uses the loaded baseDir for existing agent files', () => {
    const baseDir = join('tmp', 'loaded-agents')
    const filePath = getActualAgentFilePath({
      source: 'projectSettings',
      agentType: 'reviewer',
      filename: 'disk-reviewer',
      baseDir,
    } as unknown as AgentDefinition)

    expect(filePath).toBe(join(baseDir, 'disk-reviewer.md'))
  })
})
