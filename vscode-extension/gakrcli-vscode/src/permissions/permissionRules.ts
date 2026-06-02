// src/permissions/permissionRules.ts
// Simple store that tracks "always allow" rules for the current session,
// persisted to VS Code workspace state.

import * as vscode from 'vscode';

const STORAGE_KEY = 'gakrcli.permissionRules.alwaysAllow';

export class PermissionRules {
  private readonly rules = new Set<string>();

  constructor(private readonly context: vscode.ExtensionContext) {
    const stored = context.workspaceState.get<string[]>(STORAGE_KEY, []);
    for (const rule of stored) {
      this.rules.add(rule);
    }
  }

  has(toolName: string): boolean {
    if (this.rules.has(toolName)) {
      return true;
    }
    const normalized = toolName.toLowerCase();
    return Array.from(this.rules).some((rule) => rule.toLowerCase() === normalized);
  }

  add(toolName: string): void {
    this.rules.add(toolName);
    this.persist();
  }

  remove(toolName: string): void {
    this.rules.delete(toolName);
    this.persist();
  }

  getAll(): string[] {
    return Array.from(this.rules);
  }

  clear(): void {
    this.rules.clear();
    this.persist();
  }

  private persist(): void {
    this.context.workspaceState.update(STORAGE_KEY, Array.from(this.rules));
  }
}
