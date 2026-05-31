import { describe, expect, it, vi } from 'vitest';
import { PermissionHandler } from '../../src/permissions/permissionHandler';
import { SELF_HANDLED } from '../../src/process/controlRouter';
import type { ControlRequestPermission } from '../../src/types/messages';

function createHarness() {
  const messages: Record<string, unknown>[] = [];
  const webviewManager = {
    onMessage: vi.fn(() => ({ dispose: vi.fn() })),
    broadcast: vi.fn((message: Record<string, unknown>) => {
      messages.push(message);
    }),
  };
  const rules = {
    has: vi.fn(() => false),
    add: vi.fn(),
  };
  const output = {
    appendLine: vi.fn(),
  };
  const writes: unknown[] = [];
  const handler = new PermissionHandler(
    webviewManager as never,
    rules as never,
    output as never,
  );
  handler.setWriteToStdin((message) => {
    writes.push(message);
  });

  return { handler, messages, writes, webviewManager, rules };
}

describe('PermissionHandler AskUserQuestion routing', () => {
  it('routes AskUserQuestion to the clarification dialog instead of permission_request', async () => {
    const { handler, messages } = createHarness();
    const request: ControlRequestPermission = {
      subtype: 'can_use_tool',
      tool_name: 'AskUserQuestion',
      tool_use_id: 'tool-1',
      input: {
        questions: [
          {
            question: 'Choose features?',
            header: 'Features',
            multiSelect: true,
            options: [
              { label: 'Gradients', description: 'Color fills' },
              { label: 'Logo', description: 'Center logo' },
            ],
          },
        ],
      },
    };

    const result = await handler.handleToolRequest(
      request,
      new AbortController().signal,
      'req-1',
    );

    expect(result).toBe(SELF_HANDLED);
    expect(messages).toContainEqual({
      type: 'show_elicitation',
      requestId: 'req-1',
      message: 'GakrCLI needs your input',
      fields: [
        {
          name: 'Choose features?',
          label: 'Choose features?',
          required: true,
          type: {
            type: 'multiselect',
            options: [
              { value: 'Gradients', label: 'Gradients', description: 'Color fills' },
              { value: 'Logo', label: 'Logo', description: 'Center logo' },
            ],
          },
        },
      ],
    });
    expect(messages.some((message) => message.type === 'permission_request')).toBe(false);
  });

  it('returns AskUserQuestion answers as updatedInput answers', async () => {
    const { handler, writes } = createHarness();
    const request: ControlRequestPermission = {
      subtype: 'can_use_tool',
      tool_name: 'AskUserQuestion',
      tool_use_id: 'tool-2',
      input: {
        questions: [
          {
            question: 'Choose features?',
            header: 'Features',
            multiSelect: true,
            options: [
              { label: 'Gradients', description: 'Color fills' },
              { label: 'Logo', description: 'Center logo' },
            ],
          },
        ],
      },
    };

    await handler.handleToolRequest(request, new AbortController().signal, 'req-2');
    const handled = handler.handleAskUserQuestionResponse('req-2', {
      'Choose features?': ['Gradients', 'Logo'],
    });

    expect(handled).toBe(true);
    expect(writes).toEqual([
      {
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: 'req-2',
          response: {
            behavior: 'allow',
            updatedInput: {
              questions: request.input.questions,
              answers: {
                'Choose features?': 'Gradients, Logo',
              },
            },
            toolUseID: 'tool-2',
            decisionClassification: 'user_temporary',
          },
        },
      },
    ]);
  });

  it('keeps normal tools on the permission dialog path', async () => {
    const { handler, messages } = createHarness();
    const request: ControlRequestPermission = {
      subtype: 'can_use_tool',
      tool_name: 'WebSearch',
      tool_use_id: 'tool-3',
      input: { query: 'GakrCLI' },
    };

    const result = await handler.handleToolRequest(
      request,
      new AbortController().signal,
      'req-3',
    );

    expect(result).toBe(SELF_HANDLED);
    expect(messages).toContainEqual(expect.objectContaining({
      type: 'permission_request',
      requestId: 'req-3',
      toolName: 'WebSearch',
      toolInput: { query: 'GakrCLI' },
    }));
    expect(messages.some((message) => message.type === 'show_elicitation')).toBe(false);
  });
});
