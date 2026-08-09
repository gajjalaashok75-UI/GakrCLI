import { expect, test, describe } from 'bun:test'
import { z } from 'zod/v4'
import {
  buildTool,
  toolMatchesName,
  type Tool,
  type Tools,
  getEmptyToolPermissionContext,
  type ToolUseContext,
} from './Tool.js'
import type { CanUseToolFn } from './hooks/useCanUseTool.tsx'
import type { PermissionDecision } from './types/permissions.ts'

// Minimal tool definition for testing buildTool (fills required Tool fields)
function makeMinimalToolDef(overrides: Record<string, unknown> = {}) {
  return {
    name: 'TestTool',
    inputSchema: z.object({}),
    maxResultSizeChars: 100000,
    isConcurrencySafe: () => true,
    isEnabled: () => true,
    isReadOnly: () => true,
    call: async () => ({ data: undefined }),
    description: async () => '',
    prompt: async () => 'test prompt',
    userFacingName: () => 'TestTool',
    checkPermissions: async () => ({ behavior: 'allow' as const }),
    toAutoClassifierInput: () => null,
    mapToolResultToToolResultBlockParam: (
      content: unknown,
      toolUseID: string,
    ) => ({
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: String(content),
    }),
    renderToolUseMessage: () => null,
    ...overrides,
  }
}

const baseTool = buildTool(makeMinimalToolDef())

describe('Tool System', () => {
  describe('toolMatchesName', () => {
    test('matches exact tool name', () => {
      const tool = { name: 'Bash', aliases: [] }
      expect(toolMatchesName(tool, 'Bash')).toBe(true)
    })

    test('matches case-insensitive', () => {
      const tool = { name: 'Bash', aliases: [] }
      expect(toolMatchesName(tool, 'bash')).toBe(true)
      expect(toolMatchesName(tool, 'BASH')).toBe(true)
    })

    test('does not match partial name', () => {
      const tool = { name: 'Bash', aliases: [] }
      expect(toolMatchesName(tool, 'Bas')).toBe(false)
      expect(toolMatchesName(tool, 'ash')).toBe(false)
    })

    test('matches custom aliases', () => {
      const tool = { name: 'AgentTool', aliases: ['/agent', 'agent'] }
      expect(toolMatchesName(tool, '/agent')).toBe(true)
      expect(toolMatchesName(tool, 'agent')).toBe(true)
    })

    test('returns false for null/undefined tool', () => {
      expect(toolMatchesName(null as any, 'Bash')).toBe(false)
      expect(toolMatchesName(undefined as any, 'Bash')).toBe(false)
    })
  })

  describe('getEmptyToolPermissionContext', () => {
    test('returns default mode', () => {
      const ctx = getEmptyToolPermissionContext()
      expect(ctx.mode).toBe('default')
    })

    test('initializes empty maps', () => {
      const ctx = getEmptyToolPermissionContext()
      expect(ctx.additionalWorkingDirectories).toBeInstanceOf(Map)
      expect(ctx.additionalWorkingDirectories.size).toBe(0)
    })

    test('initializes empty alwaysAllow/Deny/Ask rules', () => {
      const ctx = getEmptyToolPermissionContext()
      expect(ctx.alwaysAllowRules).toEqual({})
      expect(ctx.alwaysDenyRules).toEqual({})
      expect(ctx.alwaysAskRules).toEqual({})
    })

    test('isBypassPermissionsModeAvailable defaults to true', () => {
      const ctx = getEmptyToolPermissionContext()
      expect(ctx.isBypassPermissionsModeAvailable).toBe(true)
    })
  })

  describe('CanUseToolFn', () => {
    test('allow behavior returns allow', async () => {
      const canUseTool: CanUseToolFn = async () => ({ behavior: 'allow' })
      const result = await canUseTool(
        baseTool as Tool,
        {},
        {} as any,
        {} as any,
        'id',
      )
      expect(result.behavior).toBe('allow')
    })

    test('deny behavior returns deny', async () => {
      const canUseTool: CanUseToolFn = async () => ({
        behavior: 'deny',
        message: 'Denied',
        decisionReason: {
          type: 'rule',
          rule: {
            source: 'command',
            ruleBehavior: 'deny',
            ruleValue: { toolName: 'Bash' },
          },
        },
      })
      const result = await canUseTool(
        baseTool as Tool,
        {},
        {} as any,
        {} as any,
        'id',
      )
      expect(result.behavior).toBe('deny')
    })

    test('async canUseTool can perform async checks', async () => {
      const canUseTool: CanUseToolFn = async (tool, input) => {
        if (tool.name === 'Bash' && (input as { command?: string }).command?.includes('rm')) {
          return {
            behavior: 'deny',
            message: 'Dangerous command',
            decisionReason: {
          type: 'rule',
          rule: {
            source: 'command',
            ruleBehavior: 'deny',
            ruleValue: { toolName: 'Bash' },
          },
        },
          }
        }
        return { behavior: 'allow' }
      }
      const result = await canUseTool(
        { ...baseTool, name: 'Bash' } as Tool,
        { command: 'rm -rf /' },
        {} as any,
        {} as any,
        'id',
      )
      expect(result.behavior).toBe('deny')
      expect((result as PermissionDecision).behavior === 'deny' && (result as any).message).toBe(
        'Dangerous command',
      )
    })
  })

  describe('Tool definitions', () => {
    test('Tools array can be filtered by name', () => {
      const tools: Tools = [
        { ...baseTool, name: 'Bash' },
        { ...baseTool, name: 'FileRead' },
        { ...baseTool, name: 'FileWrite' },
      ]
      const bashTools = tools.filter(t => t.name === 'Bash')
      expect(bashTools).toHaveLength(1)
      expect(bashTools[0].name).toBe('Bash')
    })

    test('Tools have required properties', () => {
      const tool: Tool = {
        ...baseTool,
        name: 'TestTool',
        inputSchema: z.object({ arg: z.string() }),
      }
      expect(tool.name).toBeDefined()
      expect(tool.inputSchema).toBeDefined()
    })
  })

  describe('ToolUseContext type', () => {
    test('ToolUseContext has correct structure (type check)', () => {
      // This is a compilation test - verify the type exists
      const context: ToolUseContext = {} as any
      expect(context).toBeDefined()
    })
  })
})

describe('Tool schema validation', () => {
  test('inputSchema validates object type', () => {
    const tool: Tool = {
      ...baseTool,
      name: 'Test',
      inputSchema: z.object({ command: z.string() }),
    }
    expect(tool.inputSchema).toBeDefined()
  })

  test('inputSchema can have no properties (any input)', () => {
    const tool: Tool = {
      ...baseTool,
      name: 'AnyTool',
      inputSchema: z.object({}),
    }
    expect(tool.inputSchema).toBeDefined()
  })
})
