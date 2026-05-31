// src/permissions/permissionHandler.ts
// Central coordinator for the permission system on the extension host side.
//
// Receives `can_use_tool` control_requests from the CLI (via ControlRouter),
// checks current mode + always-allow rules for auto-approve, and if not
// auto-approved, forwards to webview as permission_request. Handles webview
// responses (allow/deny/always-allow) and sends control_response back to CLI.

import * as vscode from 'vscode';
import type { WebviewManager } from '../webview/webviewManager';
import type { PermissionRules } from './permissionRules';
import type { ControlRequestPermission, ControlRequestSetPermissionMode } from '../types/messages';
import type { PermissionMode, PermissionResult } from '../types/session';
import { SELF_HANDLED } from '../process/controlRouter';

/** File edit tool names that are handled by DiffManager, not PermissionHandler */
const FILE_EDIT_TOOLS = new Set([
  'Write',
  'Edit',
  'MultiEdit',
  'FileEditTool',
  'FileWriteTool',
  'NotebookEditTool',
]);

/** Tools that are auto-allowed in acceptEdits mode */
const ACCEPT_EDITS_TOOLS = new Set([
  ...FILE_EDIT_TOOLS,
]);

const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion';

/** Callback to write a control_response to the CLI's stdin */
export type WriteToStdinFn = (message: unknown) => void;

interface PendingRequest {
  requestId: string;
  request: ControlRequestPermission;
  signal: AbortSignal;
}

export class PermissionHandler implements vscode.Disposable {
  private currentMode: PermissionMode = 'default';
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly pendingAskUserQuestions = new Map<string, PendingRequest>();
  private readonly disposables: vscode.Disposable[] = [];
  private writeToStdin: WriteToStdinFn | undefined;

  constructor(
    private readonly webviewManager: WebviewManager,
    private readonly rules: PermissionRules,
    private readonly output: vscode.OutputChannel,
    private readonly onPendingChange?: (pending: boolean) => void,
  ) {
    // Listen for permission_response from webview
    this.disposables.push(
      webviewManager.onMessage('permission_response', (message) => {
        this.handlePermissionResponse(
          message.requestId,
          message.allowed,
          message.alwaysAllow ?? false,
        );
      }),
    );

    // Listen for set_permission_mode from webview
    this.disposables.push(
      webviewManager.onMessage('set_permission_mode', (message) => {
        void this.setMode(message.mode as PermissionMode);
      }),
    );
  }

  /**
   * Set the callback used to write control_response messages to the CLI.
   * Must be called before handling any requests.
   */
  setWriteToStdin(fn: WriteToStdinFn): void {
    this.writeToStdin = fn;
  }

  /**
   * Get the current permission mode.
   */
  getMode(): PermissionMode {
    return this.currentMode;
  }

  /**
   * Set the permission mode. Called from CLI (set_permission_mode) or webview.
   */
  async setMode(mode: PermissionMode): Promise<PermissionMode> {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    this.broadcastModeState();

    if (mode === 'bypassPermissions') {
      const config = vscode.workspace.getConfiguration('gakrcliCode');
      const allowed = config.get<boolean>('allowDangerouslySkipPermissions', false);
      if (!allowed) {
        await config.update(
          'allowDangerouslySkipPermissions',
          true,
          vscode.ConfigurationTarget.Global,
        );
        this.output.appendLine(
          '[PermissionHandler] Enabled allowDangerouslySkipPermissions for bypassPermissions mode',
        );
      }
    }

    this.output.appendLine(`[PermissionHandler] Mode changed: ${previousMode} -> ${mode}`);
    return this.currentMode;
  }

  /**
   * Handle a can_use_tool control_request for a non-file-edit tool.
   * Returns a PermissionResult if auto-approved, or undefined if forwarded to webview.
   */
  async handleToolRequest(
    request: ControlRequestPermission,
    signal: AbortSignal,
    requestId: string,
  ): Promise<PermissionResult | symbol> {
    const { tool_name } = request;

    if (this.isAskUserQuestionRequest(request)) {
      return this.handleAskUserQuestionRequest(request, signal, requestId);
    }

    // Check auto-approve conditions
    const autoResult = this.checkAutoApprove(request);
    if (autoResult) {
      this.output.appendLine(
        `[PermissionHandler] Auto-approved: ${tool_name} (mode=${this.currentMode})`,
      );
      this.webviewManager.broadcast({
        type: 'cancel_request',
        requestId,
      });
      this.onPendingChange?.(this.pendingRequests.size > 0);
      return autoResult;
    }

    // Not auto-approved: forward to webview as permission_request
    this.output.appendLine(
      `[PermissionHandler] Requesting permission for: ${tool_name}`,
    );

    this.pendingRequests.set(requestId, { requestId, request, signal });
    this.onPendingChange?.(true);

    // Listen for abort (control_cancel_request)
    signal.addEventListener('abort', () => {
      this.pendingRequests.delete(requestId);
      this.webviewManager.broadcast({
        type: 'cancel_request',
        requestId,
      });
      this.onPendingChange?.(this.pendingRequests.size > 0);
    });

    // Send permission_request to webview
    this.webviewManager.broadcast({
      type: 'permission_request',
      requestId,
      toolName: request.tool_name,
      toolInput: request.input,
      riskLevel: this.classifyRisk(request.tool_name),
      title: request.title,
      description: request.description,
      decisionReason: request.decision_reason,
      blockedPath: request.blocked_path,
      permissionSuggestions: request.permission_suggestions,
      agentId: request.agent_id,
    });

    // Response is handled asynchronously via handlePermissionResponse
    // Return a sentinel so ControlRouter knows not to send an automatic response
    return SELF_HANDLED;
  }

  /**
   * Handle a set_permission_mode control_request from the CLI.
   */
  handleSetPermissionMode(request: ControlRequestSetPermissionMode): Record<string, unknown> {
    void this.setMode(request.mode);
    return { mode: request.mode };
  }

  private broadcastModeState(rejectedMode?: PermissionMode): void {
    this.webviewManager.broadcast({
      type: 'permission_mode_state',
      mode: this.currentMode,
      rejectedMode,
    });
  }

  /**
   * Handle a control_cancel_request: dismiss the permission dialog.
   */
  handleCancel(requestId: string): void {
    this.pendingRequests.delete(requestId);
    this.pendingAskUserQuestions.delete(requestId);
    this.webviewManager.broadcast({
      type: 'cancel_request',
      requestId,
    });
    this.webviewManager.broadcast({
      type: 'dismiss_elicitation',
      requestId,
    } as never);
    this.onPendingChange?.(this.pendingRequests.size > 0);
  }

  cancelAll(): void {
    const requestIds = Array.from(this.pendingRequests.keys());
    const questionRequestIds = Array.from(this.pendingAskUserQuestions.keys());
    this.pendingRequests.clear();
    this.pendingAskUserQuestions.clear();
    for (const requestId of requestIds) {
      this.webviewManager.broadcast({
        type: 'cancel_request',
        requestId,
      });
    }
    for (const requestId of questionRequestIds) {
      this.webviewManager.broadcast({
        type: 'dismiss_elicitation',
        requestId,
      } as never);
    }
    this.webviewManager.broadcast({
      type: 'permissions_cleared',
    } as never);
    this.onPendingChange?.(false);
  }

  allowTool(toolName: string): number {
    const normalized = toolName.trim();
    if (!normalized) {
      return 0;
    }

    this.rules.add(normalized);
    let resolved = 0;

    for (const pending of Array.from(this.pendingRequests.values())) {
      if (pending.request.tool_name.toLowerCase() === normalized.toLowerCase()) {
        this.handlePermissionResponse(pending.requestId, true, true);
        resolved++;
      }
    }

    return resolved;
  }

  handleAskUserQuestionResponse(
    requestId: string,
    values: Record<string, unknown>,
  ): boolean {
    const pending = this.pendingAskUserQuestions.get(requestId);
    if (!pending) {
      return false;
    }

    this.pendingAskUserQuestions.delete(requestId);
    const input = (pending.request.input ?? {}) as Record<string, unknown>;
    const questions = this.getAskUserQuestions(input);
    const answers: Record<string, string> = {};

    for (const question of questions) {
      const questionText = String(question.question ?? '');
      if (!questionText) continue;

      const value = values[questionText];
      if (Array.isArray(value)) {
        const answer = value.map(String).filter(Boolean).join(', ');
        if (answer) answers[questionText] = answer;
      } else if (typeof value === 'string' && value.trim()) {
        answers[questionText] = value.trim();
      }
    }

    this.output.appendLine(
      `[PermissionHandler] Answered AskUserQuestion request: ${requestId}`,
    );
    this.sendControlResponse(requestId, {
      behavior: 'allow',
      updatedInput: {
        ...input,
        answers,
      },
      toolUseID: pending.request.tool_use_id,
      decisionClassification: 'user_temporary',
    });
    return true;
  }

  handleAskUserQuestionCancel(requestId: string): boolean {
    const pending = this.pendingAskUserQuestions.get(requestId);
    if (!pending) {
      return false;
    }

    this.pendingAskUserQuestions.delete(requestId);
    this.output.appendLine(
      `[PermissionHandler] Cancelled AskUserQuestion request: ${requestId}`,
    );
    this.sendControlResponse(requestId, {
      behavior: 'deny',
      message: 'User declined to answer questions',
      toolUseID: pending.request.tool_use_id,
      decisionClassification: 'user_reject',
    });
    return true;
  }

  private checkAutoApprove(request: ControlRequestPermission): PermissionResult | null {
    const { tool_name } = request;

    // bypassPermissions mode: auto-allow everything
    if (this.currentMode === 'bypassPermissions') {
      return {
        behavior: 'allow',
        updatedInput: request.input,
        toolUseID: request.tool_use_id,
      };
    }

    // dontAsk mode: auto-allow everything
    if (this.currentMode === 'dontAsk') {
      return {
        behavior: 'allow',
        updatedInput: request.input,
        toolUseID: request.tool_use_id,
      };
    }

    // acceptEdits mode: auto-allow file edit tools
    if (this.currentMode === 'acceptEdits' && ACCEPT_EDITS_TOOLS.has(tool_name)) {
      return {
        behavior: 'allow',
        updatedInput: request.input,
        toolUseID: request.tool_use_id,
      };
    }

    // Session "always allow" rules
    if (this.rules.has(tool_name)) {
      return {
        behavior: 'allow',
        updatedInput: request.input,
        toolUseID: request.tool_use_id,
        decisionClassification: 'user_permanent',
      };
    }

    return null;
  }

  private handleAskUserQuestionRequest(
    request: ControlRequestPermission,
    signal: AbortSignal,
    requestId: string,
  ): symbol {
    this.output.appendLine(
      `[PermissionHandler] Forwarding AskUserQuestion to clarification dialog: ${requestId}`,
    );

    this.pendingAskUserQuestions.set(requestId, { requestId, request, signal });

    signal.addEventListener('abort', () => {
      this.pendingAskUserQuestions.delete(requestId);
      this.webviewManager.broadcast({
        type: 'dismiss_elicitation',
        requestId,
      } as never);
    }, { once: true });

    const input = (request.input ?? {}) as Record<string, unknown>;
    const questions = this.getAskUserQuestions(input);
    this.webviewManager.broadcast({
      type: 'show_elicitation',
      requestId,
      message: 'GakrCLI needs your input',
      fields: questions.map((question) => this.toAskUserQuestionField(question)),
    } as never);

    return SELF_HANDLED;
  }

  private isAskUserQuestionRequest(request: ControlRequestPermission): boolean {
    return request.tool_name === ASK_USER_QUESTION_TOOL_NAME &&
      this.getAskUserQuestions((request.input ?? {}) as Record<string, unknown>).length > 0;
  }

  private getAskUserQuestions(input: Record<string, unknown>): Array<Record<string, unknown>> {
    return Array.isArray(input.questions)
      ? input.questions.filter((q): q is Record<string, unknown> => Boolean(q && typeof q === 'object'))
      : [];
  }

  private toAskUserQuestionField(question: Record<string, unknown>): Record<string, unknown> {
    const questionText = String(question.question ?? 'Question');
    const options = Array.isArray(question.options)
      ? question.options
          .filter((option): option is Record<string, unknown> => Boolean(option && typeof option === 'object'))
          .map((option) => {
            const label = String(option.label ?? option.value ?? '');
            return {
              value: label,
              label,
              description: typeof option.description === 'string' ? option.description : undefined,
            };
          })
          .filter((option) => option.value)
      : [];

    return {
      name: questionText,
      label: questionText,
      required: true,
      type: options.length > 0
        ? {
            type: question.multiSelect ? 'multiselect' : 'select',
            options,
          }
        : {
            type: 'text',
          },
    };
  }

  private handlePermissionResponse(
    requestId: string,
    allowed: boolean,
    alwaysAllow: boolean,
  ): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      this.output.appendLine(
        `[PermissionHandler] No pending request for ID: ${requestId}`,
      );
      return;
    }

    this.pendingRequests.delete(requestId);
    this.onPendingChange?.(this.pendingRequests.size > 0);

    if (alwaysAllow && allowed) {
      this.rules.add(pending.request.tool_name);
      this.output.appendLine(
        `[PermissionHandler] Added always-allow rule for: ${pending.request.tool_name}`,
      );
    }

    let result: PermissionResult;
    if (allowed) {
      result = {
        behavior: 'allow',
        updatedInput: pending.request.input,
        toolUseID: pending.request.tool_use_id,
        decisionClassification: alwaysAllow ? 'user_permanent' : 'user_temporary',
      };
    } else {
      result = {
        behavior: 'deny',
        message: 'User denied permission',
        toolUseID: pending.request.tool_use_id,
        decisionClassification: 'user_reject',
      };
    }

    // Send control_response back to CLI
    this.sendControlResponse(requestId, result);
  }

  private sendControlResponse(requestId: string, result: PermissionResult): void {
    if (!this.writeToStdin) {
      this.output.appendLine(
        '[PermissionHandler] No writeToStdin callback set, cannot send response',
      );
      return;
    }

    this.writeToStdin({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: result,
      },
    });
  }

  private classifyRisk(toolName: string): string {
    const dangerousTools = ['Bash', 'bash', 'execute', 'Execute', 'BashTool'];
    const editTools = ['Write', 'Edit', 'MultiEdit', 'FileEditTool', 'FileWriteTool', 'NotebookEditTool'];

    if (dangerousTools.some((t) => toolName.includes(t))) return 'high';
    if (editTools.some((t) => toolName.includes(t))) return 'medium';
    return 'low';
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    this.pendingRequests.clear();
    this.pendingAskUserQuestions.clear();
    this.onPendingChange?.(false);
  }
}
