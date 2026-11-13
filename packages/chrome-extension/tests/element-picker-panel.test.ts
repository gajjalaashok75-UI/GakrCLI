/**
 * Integration test for the Element Picker panel retained for
 * chrome_request_element_selection. Exercises the real controller (no mocks of
 * the module under test): it mounts into the retained shadow host, renders
 * request state, and wires cancel/confirm/select actions.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { createElementPickerController } from '@/shared/element-picker';
import type { PickedElement } from '@gakr-gakr/mcp-chrome-shared';

const controllers: Array<{ dispose: () => void }> = [];

afterEach(() => {
  for (const c of controllers.splice(0)) c.dispose();
});

const picked: PickedElement = {
  ref: 'ref_1',
  selector: '#login',
  selectorType: 'css',
  rect: { x: 10, y: 20, width: 100, height: 40 },
  center: { x: 60, y: 40 },
  tagName: 'BUTTON',
  frameId: 0,
};

function makeController() {
  const c = createElementPickerController({ hostId: '__test_ep_host__' });
  controllers.push(c);
  return c;
}

function shadow(): ShadowRoot {
  const hostEl = document.getElementById('__test_ep_host__');
  if (!hostEl?.shadowRoot) throw new Error('picker shadow host not mounted');
  return hostEl.shadowRoot;
}

describe('createElementPickerController (chrome_request_element_selection dependency)', () => {
  test('renders the request list into the retained shadow host', () => {
    const c = makeController();
    c.show({
      sessionId: 'ep_1',
      requests: [
        { id: 'a', name: 'Username field' },
        { id: 'b', name: 'Submit button' },
      ],
      activeRequestId: 'a',
      selections: {},
      deadlineTs: Date.now() + 60_000,
      errorMessage: null,
    });

    expect(c.isVisible()).toBe(true);
    const root = shadow();
    expect(root.textContent).toContain('Username field');
    expect(root.textContent).toContain('Submit button');
    // Active request shows the picking state.
    expect(root.querySelector('.ep-badge--picking')?.textContent).toBe('Picking...');
    expect(root.textContent).toContain('0/2 selected');
  });

  test('reflects selection state and enables Confirm when complete', () => {
    const c = makeController();
    c.show({
      sessionId: 'ep_2',
      requests: [{ id: 'a', name: 'Field' }],
      activeRequestId: 'a',
      selections: {},
      deadlineTs: Date.now() + 60_000,
      errorMessage: null,
    });

    c.update({ sessionId: 'ep_2', selections: { a: picked } });

    const root = shadow();
    expect(root.textContent).toContain('1/1 selected');
    expect(root.querySelector('.ep-badge--selected')?.textContent).toBe('Selected');
    const confirmBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.startsWith('Confirm'),
    ) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  test('wires cancel and confirm actions to the provided callbacks', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const c = createElementPickerController({
      hostId: '__test_ep_host__',
      onCancel,
      onConfirm,
    });
    controllers.push(c);
    c.show({
      sessionId: 'ep_3',
      requests: [{ id: 'a', name: 'Field' }],
      activeRequestId: 'a',
      selections: { a: picked },
      deadlineTs: Date.now() + 60_000,
      errorMessage: null,
    });

    const buttons = Array.from(shadow().querySelectorAll('button'));
    const confirmBtn = buttons.find((b) => b.textContent?.startsWith('Confirm'))!;
    const cancelBtn = buttons.find((b) => b.textContent === 'Cancel')!;

    confirmBtn.click();
    cancelBtn.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('wires per-request Pick and Clear actions', () => {
    const onSetActiveRequest = vi.fn();
    const onClearSelection = vi.fn();
    const c = createElementPickerController({
      hostId: '__test_ep_host__',
      onSetActiveRequest,
      onClearSelection,
    });
    controllers.push(c);
    c.show({
      sessionId: 'ep_4',
      requests: [{ id: 'a', name: 'Field' }],
      activeRequestId: 'a',
      selections: { a: picked },
      deadlineTs: Date.now() + 60_000,
      errorMessage: null,
    });

    const clearBtn = Array.from(shadow().querySelectorAll('button')).find(
      (b) => b.textContent === 'Clear',
    )!;
    expect(clearBtn.disabled).toBe(false);
    clearBtn.click();
    expect(onClearSelection).toHaveBeenCalledWith('a');
  });

  test('hides and removes the host on dispose', () => {
    const c = makeController();
    c.show({
      sessionId: 'ep_5',
      requests: [{ id: 'a', name: 'Field' }],
      activeRequestId: 'a',
      selections: {},
      deadlineTs: Date.now() + 60_000,
      errorMessage: null,
    });
    expect(document.getElementById('__test_ep_host__')).not.toBeNull();

    c.dispose();
    expect(document.getElementById('__test_ep_host__')).toBeNull();
    expect(c.isVisible()).toBe(false);
  });
});
