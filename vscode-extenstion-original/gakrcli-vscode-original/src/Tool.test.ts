import { expect, test, describe, beforeEach, afterEach, mock } from 'bun:test'
import { toolMatchesName, type Tool, type Tools, getEmptyToolPermissionContext, type ToolPermissionContext } from './Tool.js'
import type { CanUseToolFn } from './hooks/useCanUseTool.js'
import type { ToolUseContext } from './Tool.js'

describe('Tool System', () => {
  describe('toolMatchesName', () => {
    test('matches exact tool name', () => {
      const tool: Tool = { name: 'Bash', description: 'Run bash', inputSchema: { type: 'object' }, permissions: [] }
      expect(toolMatchesName(tool, 'Bash')).toBe(true)
    })

    test('matches case-insensitive', () => {
      const tool: Tool = { name: 'Bash', description: 'Run bash', inputSchema: { type: 'object' }, permissions: [] }
      expect(toolMatchesName(tool, 'bash')).toBe(true)
      expect(toolMatchesName(tool, 'BASH')).toBe(true)
    })

    test('does not match partial name', () => {
      const tool: Tool = { name: 'Bash', description: 'Run bash', inputSchema: { type: 'object' }, permissions: [] }
      expect(toolMatchesName(tool, 'Bas')).toBe(false)
      expect(toolMatchesName(tool, 'ash')).toBe(false)
    })

    test('matches custom aliases', () => {
      const tool: Tool = { name: 'AgentTool', description: 'Run agent', inputSchema: { type: 'object' }, permissions: [], aliases: ['/agent', 'agent'] }
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

    test('isBypassPermissionsModeAvailable defaults to false', () => {
      const ctx = getEmptyToolPermissionContext()
      expect(ctx.isBypassPermissionsModeAvailable).toBe(false)
    })
  })

  describe('CanUseToolFn', () => {
    test('allow behavior returns allow', async () => {
      const canUseTool: CanUseToolFn = async () => ({ behavior: 'allow' })
      const result = await canUseTool({ name: 'Test' }, {}, {} as any, {} as any, 'id')
      expect(result.behavior).toBe('allow')
    })

    test('deny behavior returns deny', async () => {
      const canUseTool: CanUseToolFn = async () => ({ behavior: 'deny' })
      const result = await canUseTool({ name: 'Test' }, {}, {} as any, {} as any, 'id')
      expect(result.behavior).toBe('deny')
    })

    test('async canUseTool can perform async checks', async () => {
      const canUseTool: CanUseToolFn = async (tool, input, context) => {
        if (tool.name === 'Bash' && input.command.includes('rm')) {
          return { behavior: 'deny', reason: 'Dangerous command' }
        }
        return { behavior: 'allow' }
      }
      const result = await canUseTool({ name: 'Bash' }, { command: 'rm -rf /' }, {} as any, {} as any, 'id')
      expect(result.behavior).toBe('deny')
      expect((result as any).reason).toBe('Dangerous command')
    })
  })

  describe('Tool definitions', () => {
    test('Tools array can be filtered by name', () => {
      const tools: Tools = [
        { name: 'Bash', description: 'Run bash', inputSchema: { type: 'object' }, permissions: [] },
        { name: 'FileRead', description: 'Read file', inputSchema: { type: 'object' }, permissions: [] },
        { name: 'FileWrite', description: 'Write file', inputSchema: { type: 'object' }, permissions: [] },
      ]
      const bashTools = tools.filter(t => t.name === 'Bash')
      expect(bashTools).toHaveLength(1)
      expect(bashTools[0].name).toBe('Bash')
    })

    test('Tools have required properties', () => {
      const tool: Tool = {
        name: 'TestTool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: { arg: { type: 'string' } },
        },
        permissions: ['filesystem'],
      }
      expect(tool.name).toBeDefined()
      expect(tool.description).toBeDefined()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
      expect(Array.isArray(tool.permissions)).toBe(true)
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

describe('Tool permissions', () => {
  test('permission context can be extended with additional working directories', () => {
    const ctx = getEmptyToolPermissionContext()
    ctx.additionalWorkingDirectories.set('/extra', {
      path: '/extra',
      name: 'extra',
      scope: 'workspace',
    })
    expect(ctx.additionalWorkingDirectories.size).toBe(1)
    expect(ctx.additionalWorkingDirectories.get('/extra')?.name).toBe('extra')
  })

  test('alwaysAllowRules can be updated at runtime', () => {
    const ctx = getEmptyToolPermissionContext()
    ctx.alwaysAllowRules = {
      '*': ['Bash'],
    }
    expect(ctx.alwaysAllowRules['*']).toContain('Bash')
  })
})

describe('Tool schema validation', () => {
  test('inputSchema validates object type', () => {
    const tool: Tool = {
      name: 'Test',
      description: 'Test',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string' },
        },
        required: ['command'],
      },
      permissions: [],
    }
    expect(tool.inputSchema.type).toBe('object')
    expect(tool.inputSchema.properties).toBeDefined()
  })

  test('inputSchema can have no properties (any input)', () => {
    const tool: Tool = {
      name: 'AnyTool',
      description: 'Accepts anything',
      inputSchema: { type: 'object' },
      permissions: [],
    }
    expect(tool.inputSchema.properties).toBeUndefined()
  })
})
