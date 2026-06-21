import { describe, expect, it, vi } from 'vitest';
import { PermissionRules } from '../../src/permissions/permissionRules';

interface MockContext {
  workspaceState: {
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function createMockContext(): MockContext {
  const stored: string[] = [];
  return {
    workspaceState: {
      get: vi.fn((_key: string, defaultValue: unknown) => stored.length > 0 ? stored : defaultValue),
      update: vi.fn((_key: string, value: string[]) => {
        stored.length = 0;
        stored.push(...value);
      }),
    },
  } as unknown as MockContext;
}

describe('PermissionRules', () => {
  it('loads empty rules from empty storage', () => {
    const ctx = createMockContext();
    const rules = new PermissionRules(ctx as never);
    expect(rules.getAll()).toEqual([]);
  });

  it('loads persisted rules from storage', () => {
    const ctx = createMockContext();
    ctx.workspaceState.get = vi.fn(() => ['Write', 'Read']);
    const rules = new PermissionRules(ctx as never);
    expect(rules.getAll()).toEqual(['Write', 'Read']);
  });

  it('has() returns true for added rules', () => {
    const rules = new PermissionRules(createMockContext() as never);
    expect(rules.has('Write')).toBe(false);
    rules.add('Write');
    expect(rules.has('Write')).toBe(true);
  });

  it('has() returns false for unknown tools', () => {
    const rules = new PermissionRules(createMockContext() as never);
    expect(rules.has('UnknownTool')).toBe(false);
  });

  it('remove() deletes a rule', () => {
    const rules = new PermissionRules(createMockContext() as never);
    rules.add('Edit');
    expect(rules.has('Edit')).toBe(true);
    rules.remove('Edit');
    expect(rules.has('Edit')).toBe(false);
  });

  it('clear() removes all rules', () => {
    const rules = new PermissionRules(createMockContext() as never);
    rules.add('Write');
    rules.add('Read');
    rules.add('Edit');
    expect(rules.getAll()).toHaveLength(3);
    rules.clear();
    expect(rules.getAll()).toEqual([]);
  });

  it('is idempotent on duplicate add', () => {
    const rules = new PermissionRules(createMockContext() as never);
    rules.add('Write');
    rules.add('Write');
    expect(rules.getAll()).toEqual(['Write']);
  });

  it('persists rules across multiple add calls', () => {
    const ctx = createMockContext();
    const rules = new PermissionRules(ctx as never);
    rules.add('Write');
    rules.add('Read');
    rules.add('Edit');

    // Verify persist was called (workspaceState.update stores the data)
    expect(ctx.workspaceState.update).toHaveBeenCalledWith(
      'gakrcli.permissionRules.alwaysAllow',
      expect.arrayContaining(['Write', 'Read', 'Edit']),
    );
  });

  it('is case-sensitive for tool names', () => {
    const rules = new PermissionRules(createMockContext() as never);
    rules.add('write');
    expect(rules.has('Write')).toBe(false);
    expect(rules.has('write')).toBe(true);
  });

  it('supports remove on non-existent rule without error', () => {
    const rules = new PermissionRules(createMockContext() as never);
    expect(() => rules.remove('NonExistent')).not.toThrow();
  });
});
