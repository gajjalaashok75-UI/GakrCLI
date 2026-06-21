// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Use vi.hoisted to create mocks that can be referenced in vi.mock factories
const { mockListeners, mockPostMessage, mockToPermissionRequest, mockGetFromCliOutput, mockGetCancelId }
  = vi.hoisted(() => {
    const listeners = new Map<string, Set<(msg: Record<string, unknown>) => void>>();
    return {
      mockListeners: listeners,
      mockPostMessage: vi.fn(),
      mockToPermissionRequest: vi.fn((msg: Record<string, unknown>) => {
        if (msg.type === 'permission_request' && typeof msg.requestId === 'string') {
          return { requestId: msg.requestId, toolName: msg.toolName ?? 'Bash', toolInput: (msg.toolInput as Record<string, unknown>) ?? {} };
        }
        return null;
      }),
      mockGetFromCliOutput: vi.fn(() => null),
      mockGetCancelId: vi.fn(() => null),
    };
  });

// Mock vscode module: onMessage returns () => void (unsubscribe function)
vi.mock('../../webview/src/vscode', () => ({
  vscode: {
    onMessage: vi.fn((type: string, callback: (msg: Record<string, unknown>) => void) => {
      if (!mockListeners.has(type)) mockListeners.set(type, new Set());
      mockListeners.get(type)!.add(callback);
      return () => { mockListeners.get(type)?.delete(callback); };
    }),
    postMessage: mockPostMessage,
  },
  VSCodeAPIWrapper: vi.fn(),
}));

vi.mock('../../webview/src/utils/permissionRequests', () => ({
  toPermissionRequest: mockToPermissionRequest,
  getPermissionRequestFromCliOutput: mockGetFromCliOutput,
  getPermissionCancelRequestId: mockGetCancelId,
}));

import { usePermissions } from '../../webview/src/hooks/usePermissions';

function emitMessage(type: string, data: Record<string, unknown>) {
  const handlers = mockListeners.get(type);
  if (handlers) {
    for (const handler of handlers) {
      handler(data);
    }
  }
}

describe('usePermissions', () => {
  beforeEach(() => {
    mockListeners.clear();
    mockPostMessage.mockClear();
    mockGetFromCliOutput.mockReturnValue(null);
    mockGetCancelId.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts with no pending request', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.currentRequest).toBeNull();
    expect(result.current.pendingCount).toBe(0);
  });

  it('adds a permission request and exposes it as currentRequest', () => {
    const { result } = renderHook(() => usePermissions());

    act(() => {
      emitMessage('permission_request', {
        type: 'permission_request',
        requestId: 'req-1',
        toolName: 'Bash',
        toolInput: { command: 'ls -la' },
      });
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.currentRequest).not.toBeNull();
    expect(result.current.currentRequest!.requestId).toBe('req-1');
    expect(result.current.currentRequest!.toolName).toBe('Bash');
  });

  it('does not add duplicate requestIds', () => {
    const { result } = renderHook(() => usePermissions());

    act(() => {
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-1', toolName: 'Bash' });
    });
    act(() => {
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-1', toolName: 'Bash' });
    });

    expect(result.current.pendingCount).toBe(1);
  });

  it('shows the first request when multiple are queued', () => {
    const { result } = renderHook(() => usePermissions());

    act(() => {
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-1', toolName: 'Bash' });
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-2', toolName: 'Write' });
    });

    expect(result.current.pendingCount).toBe(2);
    expect(result.current.currentRequest!.requestId).toBe('req-1');
  });

  it('removes a cancelled request from the queue', () => {
    const { result } = renderHook(() => usePermissions());

    act(() => {
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-1', toolName: 'Bash' });
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-2', toolName: 'Write' });
    });

    expect(result.current.pendingCount).toBe(2);

    act(() => {
      emitMessage('cancel_request', { type: 'cancel_request', requestId: 'req-1' });
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.currentRequest!.requestId).toBe('req-2');
  });

  it('respond sends permission_response and removes the request', () => {
    const { result } = renderHook(() => usePermissions());

    act(() => {
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-1', toolName: 'Bash' });
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-2', toolName: 'Write' });
    });

    act(() => {
      result.current.respond('req-1', true, false);
    });

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'permission_response',
      requestId: 'req-1',
      allowed: true,
      alwaysAllow: false,
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.currentRequest!.requestId).toBe('req-2');
  });

  it('respond with alwaysAllow', () => {
    const { result } = renderHook(() => usePermissions());

    act(() => {
      result.current.respond('req-1', true, true);
    });

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'permission_response',
      requestId: 'req-1',
      allowed: true,
      alwaysAllow: true,
    });
  });

  it('dismissRequest sends a deny', () => {
    const { result } = renderHook(() => usePermissions());

    act(() => {
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-1', toolName: 'Bash' });
    });

    act(() => {
      result.current.dismissRequest('req-1');
    });

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'permission_response',
      requestId: 'req-1',
      allowed: false,
      alwaysAllow: false,
    });
  });

  it('handles cli_output messages that contain permission requests', () => {
    const { result } = renderHook(() => usePermissions());
    mockGetFromCliOutput.mockReturnValueOnce({
      requestId: 'cli-req-1',
      toolName: 'Bash',
      toolInput: { command: 'echo hi' },
    });

    act(() => {
      emitMessage('cli_output', {
        type: 'cli_output',
        data: { type: 'control_request', request_id: 'cli-req-1' },
      });
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.currentRequest!.requestId).toBe('cli-req-1');
  });

  it('handles process_state stopped by clearing the queue', () => {
    const { result } = renderHook(() => usePermissions());

    act(() => {
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-1', toolName: 'Bash' });
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-2', toolName: 'Write' });
    });

    expect(result.current.pendingCount).toBe(2);

    act(() => {
      emitMessage('process_state', { type: 'process_state', state: 'stopped' });
    });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.currentRequest).toBeNull();
  });

  it('handles permissions_cleared by emptying the queue', () => {
    const { result } = renderHook(() => usePermissions());

    act(() => {
      emitMessage('permission_request', { type: 'permission_request', requestId: 'req-1', toolName: 'Bash' });
    });

    expect(result.current.pendingCount).toBe(1);

    act(() => {
      emitMessage('permissions_cleared', { type: 'permissions_cleared' });
    });

    expect(result.current.pendingCount).toBe(0);
  });
});
