/**
 * Tests for the init data flow: CLI InitializeResponse → extension broadcast → webview.
 *
 * Validates that:
 * 1. The extension constructs the broadcast message correctly after spawn
 * 2. The webview's model extraction logic processes models from the init message
 * 3. The full data contract between extension and webview is consistent
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Extension-side: post-spawn broadcast construction
// (extracted logic from extension.ts lines 411-452)
// ============================================================

interface InitResponse {
  commands?: Array<{ name: string; description?: string; argument_hint?: string }>;
  agents?: Array<{ name: string; description?: string }>;
  models?: Array<{ value: string; displayName?: string }>;
  account?: Record<string, unknown>;
  fast_mode_state?: { enabled: boolean; canToggle?: boolean };
  permission_mode?: string;
  permissionMode?: string;
  session_id?: string;
}

interface BroadcastMessage {
  type: string;
  data?: Record<string, unknown>;
  // cli_output fields
  commands?: Array<{ name: string; description: string; argumentHint: string }>;
  // direct broadcast fields
  model?: string;
  models?: Array<{ value: string; displayName: string }>;
  fast_mode_state?: { enabled: boolean; canToggle?: boolean };
  permissionMode?: string;
  account?: Record<string, unknown>;
}

/**
 * Simulates the extension's post-spawn broadcast construction (extension.ts lines 414-452).
 */
function buildInitBroadcast(response: InitResponse): {
  slashCommands: BroadcastMessage;
  cliOutput: BroadcastMessage;
} {
  const commands = Array.isArray(response.commands) ? response.commands : [];
  const slashCommands: BroadcastMessage = {
    type: 'slash_commands_available',
    commands: commands.map((c) => ({
      name: c.name || '',
      description: c.description || '',
      argumentHint: c.argument_hint || '',
    })),
  };

  const models = Array.isArray(response.models) ? response.models : [];
  const fastModeState = response.fast_mode_state ?? { enabled: false, canToggle: true };
  const account = response.account ?? {};
  const permMode = response.permission_mode ?? response.permissionMode ?? 'accept';

  const cliOutput: BroadcastMessage = {
    type: 'cli_output',
    data: {
      type: 'system',
      subtype: 'init',
      session_id: response.session_id ?? '',
      model: (models[0] as { value?: string })?.value ?? '',
      models,
      fast_mode_state: fastModeState,
      permissionMode: permMode,
      account,
    },
  };

  return { slashCommands, cliOutput };
}

/**
 * Simulates the webview's model extraction from the init cli_output message
 * (useChat.ts lines 627-635).
 */
function extractModelsFromInit(data: Record<string, unknown>): Array<{ value: string; displayName: string }> {
  if (!Array.isArray(data.models)) return [];
  return (data.models as Array<Record<string, unknown>>)
    .map((m) => ({
      value: (m.value as string) || '',
      displayName: (m.displayName as string) || (m.value as string) || '',
    }))
    .filter((m) => m.value);
}

// ============================================================
// Tests
// ============================================================

describe('Init data flow', () => {
  describe('buildInitBroadcast', () => {
    it('should broadcast slash commands from init response', () => {
      const response: InitResponse = {
        commands: [
          { name: 'help', description: 'Show help', argument_hint: '[command]' },
          { name: 'clear', description: 'Clear conversation' },
        ],
        session_id: 'sess_abc123',
      };

      const { slashCommands } = buildInitBroadcast(response);

      expect(slashCommands.type).toBe('slash_commands_available');
      expect(slashCommands.commands).toHaveLength(2);
      expect(slashCommands.commands![0]).toEqual({
        name: 'help',
        description: 'Show help',
        argumentHint: '[command]',
      });
      expect(slashCommands.commands![1]).toEqual({
        name: 'clear',
        description: 'Clear conversation',
        argumentHint: '',
      });
    });

    it('should broadcast empty slash commands when none provided', () => {
      const response: InitResponse = { session_id: 'sess_empty' };
      const { slashCommands } = buildInitBroadcast(response);
      expect(slashCommands.commands).toEqual([]);
    });

    it('should broadcast cli_output with models from init response', () => {
      const response: InitResponse = {
        models: [
          { value: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
          { value: 'claude-opus-4-20250514', displayName: 'Claude Opus 4' },
        ],
        fast_mode_state: { enabled: false, canToggle: true },
        permission_mode: 'accept',
        session_id: 'sess_model123',
        account: { user_id: 'test-user' },
      };

      const { cliOutput } = buildInitBroadcast(response);

      expect(cliOutput.type).toBe('cli_output');
      expect(cliOutput.data).toBeDefined();
      expect(cliOutput.data!.type).toBe('system');
      expect(cliOutput.data!.subtype).toBe('init');
      expect(cliOutput.data!.session_id).toBe('sess_model123');
      expect(cliOutput.data!.model).toBe('claude-sonnet-4-20250514');
      expect(cliOutput.data!.models).toEqual(response.models);
      expect(cliOutput.data!.fast_mode_state).toEqual({ enabled: false, canToggle: true });
      expect(cliOutput.data!.permissionMode).toBe('accept');
      expect(cliOutput.data!.account).toEqual({ user_id: 'test-user' });
    });

    it('should handle empty models array gracefully', () => {
      const response: InitResponse = {
        models: [],
        session_id: 'sess_no_models',
      };

      const { cliOutput } = buildInitBroadcast(response);

      expect(cliOutput.data!.model).toBe('');
      expect(cliOutput.data!.models).toEqual([]);
    });

    it('should default permissionMode to accept when not provided', () => {
      const response: InitResponse = { session_id: 'sess_perm_default' };
      const { cliOutput } = buildInitBroadcast(response);
      expect(cliOutput.data!.permissionMode).toBe('accept');
    });

    it('should default fast_mode_state when not provided', () => {
      const response: InitResponse = { session_id: 'sess_fast_default' };
      const { cliOutput } = buildInitBroadcast(response);
      expect(cliOutput.data!.fast_mode_state).toEqual({ enabled: false, canToggle: true });
    });

    it('should handle permission_mode (underscore) as fallback for permissionMode', () => {
      const response: InitResponse = {
        permission_mode: 'bypass',
        session_id: 'sess_perm_underscore',
      };
      const { cliOutput } = buildInitBroadcast(response);
      expect(cliOutput.data!.permissionMode).toBe('bypass');
    });

    it('should handle empty account gracefully', () => {
      const response: InitResponse = { session_id: 'sess_account' };
      const { cliOutput } = buildInitBroadcast(response);
      expect(cliOutput.data!.account).toEqual({});
    });

    it('should broadcast the init message with all expected fields in cli_output.data', () => {
      const response: InitResponse = {
        commands: [{ name: 'help' }],
        agents: [{ name: 'planner', description: 'Plan tasks' }],
        models: [
          { value: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
          { value: 'claude-opus-4-20250514', displayName: 'Claude Opus 4' },
        ],
        fast_mode_state: { enabled: true, canToggle: true },
        permission_mode: 'accept',
        session_id: 'sess_full',
        account: { user_id: 'u1', email: 'test@example.com' },
      };

      const { cliOutput } = buildInitBroadcast(response);

      // Verify ALL fields the webview expects from the init cli_output
      const data = cliOutput.data!;
      expect(data).toHaveProperty('type', 'system');
      expect(data).toHaveProperty('subtype', 'init');
      expect(data).toHaveProperty('session_id');
      expect(data).toHaveProperty('model');
      expect(data).toHaveProperty('models');
      expect(data).toHaveProperty('fast_mode_state');
      expect(data).toHaveProperty('permissionMode');
      expect(data).toHaveProperty('account');
    });

    it('should set model from first model in the array', () => {
      const response: InitResponse = {
        models: [
          { value: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
        ],
        session_id: 'sess_first_model',
      };

      const { cliOutput } = buildInitBroadcast(response);
      expect(cliOutput.data!.model).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('webview model extraction (useChat equivalent)', () => {
    it('should extract models from init cli_output data', () => {
      const data: Record<string, unknown> = {
        type: 'system',
        subtype: 'init',
        models: [
          { value: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
          { value: 'claude-opus-4-20250514', displayName: 'Claude Opus 4' },
        ],
      };

      const models = extractModelsFromInit(data);

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({ value: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' });
      expect(models[1]).toEqual({ value: 'claude-opus-4-20250514', displayName: 'Claude Opus 4' });
    });

    it('should fall back displayName to value when displayName is missing', () => {
      const data: Record<string, unknown> = {
        models: [
          { value: 'claude-sonnet-4-20250514' },
        ],
      };

      const models = extractModelsFromInit(data);
      expect(models[0].displayName).toBe('claude-sonnet-4-20250514');
      expect(models[0].value).toBe('claude-sonnet-4-20250514');
    });

    it('should filter out models with empty value', () => {
      const data: Record<string, unknown> = {
        models: [
          { value: 'valid-model', displayName: 'Valid' },
          { value: '', displayName: 'Empty' },
          { value: null, displayName: 'Null' },
        ],
      };

      const models = extractModelsFromInit(data);
      expect(models).toHaveLength(1);
      expect(models[0].value).toBe('valid-model');
    });

    it('should return empty array when models is missing', () => {
      const data: Record<string, unknown> = { type: 'system', subtype: 'init' };
      const models = extractModelsFromInit(data);
      expect(models).toEqual([]);
    });

    it('should return empty array when models is not an array', () => {
      const data: Record<string, unknown> = { models: 'not-an-array' };
      const models = extractModelsFromInit(data);
      expect(models).toEqual([]);
    });

    it('should handle empty models array', () => {
      const data: Record<string, unknown> = { models: [] };
      const models = extractModelsFromInit(data);
      expect(models).toEqual([]);
    });

    it('should handle models with numeric value (edge case — passes filter as-is)', () => {
      const data: Record<string, unknown> = {
        models: [
          { value: 123, displayName: 'Model 123' },
        ],
      };

      const models = extractModelsFromInit(data);
      expect(models).toHaveLength(1);
      // numeric value stays as-is (TypeScript 'as string' is compile-time only)
      expect(models[0].value).toBe(123);
    });
  });

  describe('end-to-end data contract', () => {
    it('should produce webview-consumable models from a realistic init response', () => {
      // Simulate the full flow: CLI init response → extension broadcast → webview extraction
      const cliResponse: InitResponse = {
        commands: [{ name: 'help', description: 'Show available commands' }],
        agents: [
          { name: 'planner', description: 'Creates implementation plans' },
          { name: 'code-reviewer', description: 'Reviews code changes' },
        ],
        models: [
          { value: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
          { value: 'claude-opus-4-20250514', displayName: 'Claude Opus 4' },
        ],
        fast_mode_state: { enabled: false, canToggle: true },
        permission_mode: 'accept',
        session_id: 'sess_e2e_test',
        account: { user_id: 'test_user', provider: 'anthropic' },
      };

      // Extension constructs broadcast
      const { cliOutput } = buildInitBroadcast(cliResponse);

      // Webview receives cli_output message and extracts models
      const data = cliOutput.data!;
      expect(data.subtype).toBe('init');
      expect(data.model).toBe('claude-sonnet-4-20250514');

      const models = extractModelsFromInit(data);
      expect(models).toHaveLength(2);
      expect(models.map((m) => m.value)).toEqual([
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
      ]);

      // Webview's fast_mode_state extraction
      expect(data.fast_mode_state).toEqual({ enabled: false, canToggle: true });

      // Webview's permissionMode extraction
      expect(data.permissionMode).toBe('accept');

      // Webview's account extraction
      expect(data.account).toEqual({ user_id: 'test_user', provider: 'anthropic' });
    });
  });
});
