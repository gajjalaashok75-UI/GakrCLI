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

/** Callback to write a control_response to the CLI's stdin */
export type WriteToStdinFn = (message: unknown) => void;

interface PendingRequest {
  requestId: string;
  request: ControlRequestPermission;
  signal: AbortSignal;
}

interface ElicitationRequest {
  requestId: string;
  rawQuestions: unknown[];
  toolUseId: string | undefined;
}

interface ElicitationQuestion {
  question: string;
  label?: string;
  multiSelect?: boolean;
  options?: Array<{ label: string; description?: string }>;
}

export class PermissionHandler implements vscode.Disposable {
  private currentMode: PermissionMode = 'default';
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly elicitationRequests = new Map<string, ElicitationRequest>();
  private readonly disposables: vscode.Disposable[] = [];
  private writeToStdin: WriteToStdinFn | undefined;

  constructor(
    private readonly webviewManager: WebviewManager,
    private readonly rules: PermissionRules,
    private readonly output: vscode.OutputChannel,
  ) {
    // Listen for permission_response from webview
    this.disposables.push(
      webviewManager.onMessage('permission_response', (message) => {
        this.handlePermissionResponse(
          message.requestId,
          message.allowed,
          message.alwaysAllow ?? false,
          message.reason,
        );
      }),
    );

    // Listen for set_permission_mode from webview
    this.disposables.push(
      webviewManager.onMessage('set_permission_mode', (message) => {
        this.setMode(message.mode as PermissionMode);
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
  setMode(mode: PermissionMode): void {
    // Bypass mode is gated behind the allowDangerouslySkipPermissions setting
    if (mode === 'bypassPermissions') {
      const config = vscode.workspace.getConfiguration('gakrcli');
      const allowed = config.get<boolean>('allowDangerouslySkipPermissions', false);
      if (!allowed) {
        this.output.appendLine(
          '[PermissionHandler] Bypass mode blocked — allowDangerouslySkipPermissions is false',
        );
        vscode.window.showWarningMessage(
          'GakrCLI: Bypass permissions mode is disabled. Enable "gakrcli.allowDangerouslySkipPermissions" in settings first.',
        );
        return;
      }
    }

    if (mode === this.currentMode) {
      // No-op: already in this mode. Avoids redundant broadcast/log churn
      // when a mode-change message arrives twice for the same target mode
      // (e.g. a duplicate send from the webview, or the CLI confirming a
      // mode change that was already applied locally).
      return;
    }

    this.output.appendLine(`[PermissionHandler] Mode changed: ${this.currentMode} → ${mode}`);
    this.currentMode = mode;

    // Propagate the mode change to the CLI so its hasPermissionsToUseTool
    // respects the same mode (affects acceptEdits, dontAsk, bypassPermissions).
    // Without this, the CLI stays in 'default' mode and sends can_use_tool
    // for everything, bypassing its own fast-path auto-approvals.
    //
    // Remap: the CLI's 'dontAsk' converts 'ask' → 'deny' (headless safety mode),
    // while the extension's 'dontAsk' means "auto-approve everything". Forward
    // bypassPermissions instead so both sides agree on auto-approval.
    const cliMode = mode === 'dontAsk' ? 'bypassPermissions' : mode;
    this.writeToStdin?.({
      type: 'control_request',
      request: {
        subtype: 'set_permission_mode',
        mode: cliMode,
      },
    });
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

    // AskUserQuestion → route to clarification dialog (show_elicitation)
    if (tool_name === 'AskUserQuestion') {
      const questions = (request.input?.questions as unknown[]) ?? [];
      const fields = questions.map((q: unknown) => {
        const qObj = q as Record<string, unknown>;
        return {
          name: qObj.question as string,
          label: (qObj.label as string) ?? (qObj.question as string),
          required: true,
          type: {
            type: qObj.multiSelect ? 'multiselect' : 'select',
            options: ((qObj.options as Record<string, string>[]) ?? []).map(
              (o: Record<string, string>) => ({
                value: o.label,
                label: o.label,
                description: o.description ?? '',
              }),
            ),
          },
        };
      });

      this.elicitationRequests.set(requestId, {
        requestId,
        rawQuestions: questions as unknown[],
        toolUseId: request.tool_use_id,
      });

      this.webviewManager.broadcast({
        type: 'show_elicitation',
        requestId,
        message: 'GakrCLI needs your input',
        fields,
      });

      const { SELF_HANDLED } = await import('../process/controlRouter');
      return SELF_HANDLED;
    }

    // Check auto-approve conditions
    const autoResult = this.checkAutoApprove(request);
    if (autoResult) {
      this.output.appendLine(
        `[PermissionHandler] Auto-approved: ${tool_name} (mode=${this.currentMode})`,
      );
      return autoResult;
    }

    // Not auto-approved — forward to webview as permission_request
    this.output.appendLine(
      `[PermissionHandler] Requesting permission for: ${tool_name}`,
    );

    this.pendingRequests.set(requestId, { requestId, request, signal });

    // Listen for abort (control_cancel_request)
    signal.addEventListener('abort', () => {
      this.pendingRequests.delete(requestId);
      this.webviewManager.broadcast({
        type: 'cancel_request',
        requestId,
      });
    });

    // Broadcast permission_request to webview (webview UI may or may not render it)
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
    const { SELF_HANDLED } = await import('../process/controlRouter');
    return SELF_HANDLED;
  }

  /**
   * Handle a set_permission_mode control_request from the CLI.
   */
  handleSetPermissionMode(request: ControlRequestSetPermissionMode): Record<string, unknown> {
    this.setMode(request.mode);
    return { mode: request.mode };
  }

  /**
   * Handle an AskUserQuestion answer from the clarification dialog.
   * Builds and sends the control_response with the answers back to the CLI.
   */
  handleAskUserQuestionResponse(
    requestId: string,
    answers: Record<string, string[]>,
  ): boolean {
    const pending = this.elicitationRequests.get(requestId);
    if (!pending) return false;

    this.elicitationRequests.delete(requestId);

    // Convert answer arrays to comma-separated strings
    const flatAnswers: Record<string, string> = {};
    for (const [key, values] of Object.entries(answers)) {
      flatAnswers[key] = Array.isArray(values) ? values.join(', ') : String(values);
    }

    this.writeToStdin?.({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: {
          behavior: 'allow',
          updatedInput: {
            questions: pending.rawQuestions,
            answers: flatAnswers,
          },
          toolUseID: pending.toolUseId,
          decisionClassification: 'user_temporary',
        },
      },
    });

    return true;
  }

  /**
   * Handle a control_cancel_request — dismiss the permission dialog.
   */
  handleCancel(requestId: string): void {
    this.pendingRequests.delete(requestId);
    this.webviewManager.broadcast({
      type: 'cancel_request',
      requestId,
    });
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

  private handlePermissionResponse(
    requestId: string,
    allowed: boolean,
    alwaysAllow: boolean,
    reason?: string,
  ): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      this.output.appendLine(
        `[PermissionHandler] No pending request for ID: ${requestId}`,
      );
      return;
    }

    this.pendingRequests.delete(requestId);

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
        message: reason
          ? `User denied permission: ${reason}`
          : 'User denied permission',
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

  /** Retrieve a stored elicitation request (AskUserQuestion) by requestId */
  getPendingElicitation(requestId: string): { rawQuestions: unknown[]; toolUseId: string | undefined } | undefined {
    const pending = this.elicitationRequests.get(requestId);
    if (!pending) return undefined;
    return { rawQuestions: pending.rawQuestions, toolUseId: pending.toolUseId };
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    this.pendingRequests.clear();
  }
}
