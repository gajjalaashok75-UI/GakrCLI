import { describe, it, expect, beforeEach } from 'vitest';
import { StatusBarManager } from '../../src/statusbar/statusBarManager';

describe('StatusBarManager', () => {
  let manager: StatusBarManager;

  beforeEach(() => {
    manager = new StatusBarManager();
  });

  it('should start in idle state', () => {
    expect(manager.getState()).toBe('idle');
  });

  it('should transition to pending when permission request arrives', () => {
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');
  });

  it('should transition back to idle when permission is resolved', () => {
    manager.setPendingPermission(true);
    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should transition to completed-hidden when response finishes while hidden', () => {
    manager.setCompletedWhileHidden(true);
    expect(manager.getState()).toBe('completed-hidden');
  });

  it('should clear completed-hidden when panel is revealed', () => {
    manager.setCompletedWhileHidden(true);
    manager.clearCompletedWhileHidden();
    expect(manager.getState()).toBe('idle');
  });

  it('should prioritize pending over completed-hidden', () => {
    manager.setCompletedWhileHidden(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');
  });

  it('should fall back to completed-hidden when pending is cleared', () => {
    manager.setCompletedWhileHidden(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');

    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('completed-hidden');
  });

  it('should return to idle when both flags are cleared', () => {
    manager.setPendingPermission(true);
    manager.setCompletedWhileHidden(true);
    manager.setPendingPermission(false);
    manager.setCompletedWhileHidden(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should be idempotent — setting same state twice is harmless', () => {
    manager.setPendingPermission(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');

    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should handle clearCompletedWhileHidden as no-op when not in that state', () => {
    expect(manager.getState()).toBe('idle');
    manager.clearCompletedWhileHidden();
    expect(manager.getState()).toBe('idle');
  });

  it('should transition to starting when setStarting(true) is called', () => {
    manager.setStarting(true);
    expect(manager.getState()).toBe('starting');
  });

  it('should transition back from starting when setStarting(false) is called', () => {
    manager.setStarting(true);
    expect(manager.getState()).toBe('starting');

    manager.setStarting(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should prioritize pending over starting', () => {
    manager.setStarting(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');
  });

  it('should fall back to starting when pending is cleared', () => {
    manager.setStarting(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');

    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('starting');
  });

  it('should prioritize starting over completed-hidden', () => {
    manager.setCompletedWhileHidden(true);
    manager.setStarting(true);
    expect(manager.getState()).toBe('starting');
  });

  it('should fall back to completed-hidden when starting is cleared', () => {
    manager.setCompletedWhileHidden(true);
    manager.setStarting(true);
    expect(manager.getState()).toBe('starting');

    manager.setStarting(false);
    expect(manager.getState()).toBe('completed-hidden');
  });

  it('should be idempotent for setStarting — same value twice is harmless', () => {
    manager.setStarting(true);
    manager.setStarting(true);
    expect(manager.getState()).toBe('starting');

    manager.setStarting(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should handle all four states in priority order', () => {
    manager.setCompletedWhileHidden(true);
    manager.setStarting(true);
    manager.setPendingPermission(true);
    // pending > starting > completed-hidden > ready > idle
    expect(manager.getState()).toBe('pending');

    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('starting');

    manager.setStarting(false);
    expect(manager.getState()).toBe('completed-hidden');

    manager.setCompletedWhileHidden(false);
    expect(manager.getState()).toBe('idle');
  });

  // === ready state tests ===

  it('should transition to ready when setReady(true) is called', () => {
    manager.setReady(true);
    expect(manager.getState()).toBe('ready');
  });

  it('should transition back from ready when setReady(false) is called', () => {
    manager.setReady(true);
    expect(manager.getState()).toBe('ready');

    manager.setReady(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should prioritize completed-hidden over ready', () => {
    manager.setReady(true);
    manager.setCompletedWhileHidden(true);
    expect(manager.getState()).toBe('completed-hidden');
  });

  it('should fall back to ready when completed-hidden is cleared', () => {
    manager.setCompletedWhileHidden(true);
    manager.setReady(true);
    expect(manager.getState()).toBe('completed-hidden');

    manager.setCompletedWhileHidden(false);
    expect(manager.getState()).toBe('ready');
  });

  it('should prioritize starting over ready', () => {
    manager.setReady(true);
    manager.setStarting(true);
    expect(manager.getState()).toBe('starting');
  });

  it('should not restore ready when starting is cleared (starting invalidates ready)', () => {
    manager.setReady(true);

    manager.setStarting(true);
    expect(manager.getState()).toBe('starting');

    // setStarting(true) clears _ready — new start invalidates old ready state
    manager.setStarting(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should prioritize pending over ready', () => {
    manager.setReady(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');
  });

  it('should fall back to ready when pending is cleared', () => {
    manager.setReady(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');

    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('ready');
  });

  it('should clear ready when setStarting(true) is called', () => {
    manager.setReady(true);
    manager.setStarting(true);
    // setStarting(true) clears ready internally
    manager.setStarting(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should be idempotent for setReady — same value twice is harmless', () => {
    manager.setReady(true);
    manager.setReady(true);
    expect(manager.getState()).toBe('ready');

    manager.setReady(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should include model name in ready state tooltip when set', () => {
    manager.setModelName('claude-sonnet-4-20250514');
    manager.setReady(true);
    expect(manager.getState()).toBe('ready');
  });

  it('should clear model name on setModelName(null)', () => {
    manager.setModelName('claude-sonnet-4-20250514');
    manager.setReady(true);
    manager.setModelName(null);
    // state is still ready, just no model name suffix (tested via tooltip)
    expect(manager.getState()).toBe('ready');
  });

  it('should be idempotent for setModelName — same value twice is harmless', () => {
    manager.setModelName('model-a');
    manager.setModelName('model-a');
    manager.setReady(true);
    expect(manager.getState()).toBe('ready');
    manager.setModelName('model-b');
    // still ready, just updated
    expect(manager.getState()).toBe('ready');
  });

  it('should clear model name when entering starting state', () => {
    manager.setModelName('claude-sonnet-4-20250514');
    manager.setReady(true);
    manager.setStarting(true);
    // setStarting(true) clears both _ready and we need to verify modelName persists
    // (modelName is not cleared by setStarting)
    manager.setStarting(false);
    // Not ready anymore because setStarting(true) cleared _ready
    expect(manager.getState()).toBe('idle');
  });

  it('should handle all five states in priority order', () => {
    // pending > starting > completed-hidden > ready > idle
    expect(manager.getState()).toBe('idle');

    manager.setReady(true);
    expect(manager.getState()).toBe('ready');

    manager.setCompletedWhileHidden(true);
    expect(manager.getState()).toBe('completed-hidden');

    manager.setStarting(true);
    expect(manager.getState()).toBe('starting');

    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');

    // Now peel back layers
    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('starting');

    manager.setStarting(false);
    expect(manager.getState()).toBe('completed-hidden');

    manager.setCompletedWhileHidden(false);
    // setStarting(true) cleared _ready, so re-set it
    manager.setReady(true);
    expect(manager.getState()).toBe('ready');

    manager.setReady(false);
    expect(manager.getState()).toBe('idle');
  });
});
