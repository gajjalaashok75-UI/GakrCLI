import { describe, expect, it } from 'vitest';
import {
  getPermissionCancelRequestId,
  getPermissionRequestFromCliOutput,
  toPermissionRequest,
} from '../../webview/src/utils/permissionRequests';

describe('webview permission request normalization', () => {
  it('normalizes host-confirmed permission requests', () => {
    expect(toPermissionRequest({
      type: 'permission_request',
      requestId: 'req-1',
      toolName: 'WebFetch',
      toolInput: { url: 'https://example.com' },
      riskLevel: 'low',
    })).toMatchObject({
      requestId: 'req-1',
      toolName: 'WebFetch',
      toolInput: { url: 'https://example.com' },
      riskLevel: 'low',
    });
  });

  it('does not turn raw CLI control_request envelopes into clickable permission prompts', () => {
    expect(toPermissionRequest({
      type: 'cli_output',
      data: {
        type: 'control_request',
        request_id: 'req-raw',
        request: {
          subtype: 'can_use_tool',
          tool_name: 'WebSearch',
        },
      },
    })).toBeNull();
  });

  it('does not treat AskUserQuestion control requests as permission prompts', () => {
    expect(getPermissionRequestFromCliOutput({
      type: 'cli_output',
      data: {
        type: 'control_request',
        request_id: 'req-question',
        request: {
          subtype: 'can_use_tool',
          tool_name: 'AskUserQuestion',
          input: {
            questions: [
              {
                question: 'Choose features?',
                options: [
                  { label: 'Gradients', description: 'Color fills' },
                  { label: 'Logo', description: 'Center logo' },
                ],
              },
            ],
          },
        },
      },
    })).toBeNull();
  });

  it('extracts permission cancellation ids from CLI output', () => {
    expect(getPermissionCancelRequestId({
      type: 'cli_output',
      data: {
        type: 'control_cancel_request',
        request_id: 'req-1',
      },
    })).toBe('req-1');
    expect(getPermissionCancelRequestId({ type: 'cli_output', data: { type: 'control_request' } })).toBeNull();
  });
});
