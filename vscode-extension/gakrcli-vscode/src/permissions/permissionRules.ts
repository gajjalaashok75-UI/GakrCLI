// src/permissions/permissionRules.ts
// Simple in-memory store that tracks "always allow" rules for the current
// session only. Rules are NOT persisted to workspace state — each extension
// restart starts with a clean slate, matching the documented "for the current
// session" contract.
//
// Previously rules were persisted to workspaceState, which caused always-allow
// choices from previous sessions to silently carry over and auto-approve tools
// in new sessions even when the permission mode was set to 'default' — a
// fixture that violated user expectations and the mode's documented behavior.

import * as vscode from 'vscode';

export class PermissionRules {
  private readonly rules = new Set<string>();

  constructor(_context: vscode.ExtensionContext) {
    // Rules are in-memory only. No workspace state loading means every
    // extension restart starts fresh — "Always Allow for Session" truly
    // means for this session.
  }

  has(toolName: string): boolean {
    return this.rules.has(toolName);
  }

  add(toolName: string): void {
    this.rules.add(toolName);
  }

  remove(toolName: string): void {
    this.rules.delete(toolName);
  }

  getAll(): string[] {
    return Array.from(this.rules);
  }

  clear(): void {
    this.rules.clear();
  }
}
