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
    // pending > starting > completed-hidden
    expect(manager.getState()).toBe('pending');

    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('starting');

    manager.setStarting(false);
    expect(manager.getState()).toBe('completed-hidden');

    manager.setCompletedWhileHidden(false);
    expect(manager.getState()).toBe('idle');
  });
});
