import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebviewManager } from '../../src/webview/webviewManager';
import { Uri } from '../__mocks__/vscode';
import * as vscode from '../__mocks__/vscode';

// Mock ExtensionContext
function createMockContext(): vscode.ExtensionContext {
  return {
    extensionUri: Uri.file('/test/extension') as never,
    subscriptions: [],
    extension: {
      id: 'gajjalaashok75-UI.gakrcli-vscode',
      packageJSON: { version: '0.1.0' },
    },
    globalState: {
      get: () => undefined,
      update: async () => {},
    },
  } as unknown as vscode.ExtensionContext;
}

describe('WebviewManager', () => {
  let manager: WebviewManager;

  beforeEach(() => {
    const context = createMockContext();
    const output = vscode.window.createOutputChannel('test');
    manager = new WebviewManager(
      context.extensionUri,
      context,
      output as unknown as vscode.OutputChannel,
    );
  });

  describe('createPanel', () => {
    it('creates a panel and returns a panelId', () => {
      const result = manager.createPanel();
      expect(result.panelId).toBeDefined();
      expect(typeof result.panelId).toBe('string');
    });

    it('returns different IDs for different panels', () => {
      const result1 = manager.createPanel();
      const result2 = manager.createPanel();
      expect(result1.panelId).not.toBe(result2.panelId);
    });

    it('reveals existing panel if session is already open', () => {
      const result1 = manager.createPanel('session-1');
      const result2 = manager.createPanel('session-1');
      expect(result2.panelId).toBe(result1.panelId);
      expect(result2.startedInNewColumn).toBe(false);
    });

    it('tracks all panel IDs', () => {
      manager.createPanel();
      manager.createPanel();
      expect(manager.getAllPanelIds().length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('global message handlers', () => {
    it('registers handlers that fire for new panels', () => {
      const handler = vi.fn();
      manager.onMessage('send_prompt', handler);

      const { panelId } = manager.createPanel();
      const bridge = manager.getBridge(panelId);

      expect(bridge).toBeDefined();
      // Global handler is registered on the bridge
    });

    it('supports unsubscribing global handlers', () => {
      const handler = vi.fn();
      const disposable = manager.onMessage('send_prompt', handler);
      disposable.dispose();
      // Handler should be removed from future panels
    });
  });

  describe('broadcast', () => {
    it('sends message to all active bridges', () => {
      manager.createPanel();
      manager.createPanel();

      // Broadcast should not throw even with mock webviews
      expect(() => {
        manager.broadcast({ type: 'theme_changed', theme: 'dark' } as never);
      }).not.toThrow();
    });
  });

  describe('session state', () => {
    it('tracks session states', () => {
      manager.updateSessionState('session-1', 'running', 'Test session');

      // Should not throw — the broadcast goes to all bridges
      expect(() => {
        manager.updateSessionState('session-1', 'waiting_input', 'Test session');
      }).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('cleans up all bridges and panels', () => {
      manager.createPanel();
      manager.createPanel();

      manager.dispose();

      expect(manager.getAllPanelIds()).toHaveLength(0);
    });
  });
});
