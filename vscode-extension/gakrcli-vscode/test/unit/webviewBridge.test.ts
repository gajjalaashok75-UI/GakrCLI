import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockWebview } from '../__mocks__/vscode';
import { WebviewBridge } from '../../src/webview/webviewBridge';

describe('WebviewBridge', () => {
  let mockWebview: ReturnType<typeof createMockWebview>;
  let bridge: WebviewBridge;

  beforeEach(() => {
    mockWebview = createMockWebview();
    bridge = new WebviewBridge(mockWebview as never, 'test-panel-1', 'editor-tab');
  });

  describe('message receiving (webview -> host)', () => {
    it('dispatches messages to registered handlers', () => {
      const handler = vi.fn();
      bridge.onMessage('send_prompt', handler);

      mockWebview.simulateMessage({ type: 'send_prompt', text: 'hello' });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        { type: 'send_prompt', text: 'hello' },
        'test-panel-1',
      );
    });

    it('supports multiple handlers for the same message type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bridge.onMessage('ready', handler1);
      bridge.onMessage('ready', handler2);

      mockWebview.simulateMessage({ type: 'ready' });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('does not dispatch to unregistered handlers', () => {
      const handler = vi.fn();
      bridge.onMessage('send_prompt', handler);

      mockWebview.simulateMessage({ type: 'interrupt' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports unsubscribing handlers', () => {
      const handler = vi.fn();
      const disposable = bridge.onMessage('ready', handler);

      disposable.dispose();
      mockWebview.simulateMessage({ type: 'ready' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('catches errors in handlers without breaking other handlers', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler1 = vi.fn(() => {
        throw new Error('handler1 error');
      });
      const handler2 = vi.fn();

      bridge.onMessage('ready', handler1);
      bridge.onMessage('ready', handler2);

      mockWebview.simulateMessage({ type: 'ready' });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('message sending (host -> webview)', () => {
    it('queues messages until webview sends ready', () => {
      bridge.postMessage({ type: 'init_state' } as never);
      bridge.postMessage({ type: 'theme_changed', theme: 'dark' } as never);

      // Messages should be queued, not sent
      expect(mockWebview.getPostedMessages()).toHaveLength(0);

      // Send ready
      mockWebview.simulateMessage({ type: 'ready' });

      // Queued messages should now be flushed
      expect(mockWebview.getPostedMessages()).toHaveLength(2);
      expect(mockWebview.getPostedMessages()[0]).toEqual({ type: 'init_state' });
      expect(mockWebview.getPostedMessages()[1]).toEqual({ type: 'theme_changed', theme: 'dark' });
    });

    it('sends messages immediately after ready', () => {
      mockWebview.simulateMessage({ type: 'ready' });
      mockWebview.clearPostedMessages();

      bridge.postMessage({ type: 'theme_changed', theme: 'light' } as never);

      expect(mockWebview.getPostedMessages()).toHaveLength(1);
      expect(mockWebview.getPostedMessages()[0]).toEqual({ type: 'theme_changed', theme: 'light' });
    });
  });

  describe('getPanelInfo', () => {
    it('returns correct panel info', () => {
      const info = bridge.getPanelInfo(true, 'session-123');

      expect(info).toEqual({
        id: 'test-panel-1',
        location: 'editor-tab',
        sessionId: 'session-123',
        isVisible: true,
      });
    });
  });

  describe('dispose', () => {
    it('cleans up handlers and pending messages', () => {
      const handler = vi.fn();
      bridge.onMessage('ready', handler);
      bridge.postMessage({ type: 'init_state' } as never);

      bridge.dispose();

      // Handler should no longer fire
      mockWebview.simulateMessage({ type: 'ready' });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
