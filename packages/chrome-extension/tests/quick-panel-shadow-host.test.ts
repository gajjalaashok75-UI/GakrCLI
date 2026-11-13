/**
 * Integration test for the Quick Panel shadow-DOM host retained for
 * chrome_request_element_selection. Exercises the real module (no mocks of
 * the module under test): mounting, isolation, and disposal.
 */

import { afterEach, describe, expect, test } from 'vitest';
import { mountQuickPanelShadowHost } from '@/shared/quick-panel/ui';

const mounted: Array<{ dispose: () => void }> = [];

afterEach(() => {
  for (const host of mounted.splice(0)) host.dispose();
});

describe('mountQuickPanelShadowHost (chrome_request_element_selection dependency)', () => {
  test('mounts a shadow host with an isolated root for panel UI', () => {
    const host = mountQuickPanelShadowHost({ hostId: '__test_qp_host__' });
    mounted.push(host);

    const elements = host.getElements();
    expect(elements).not.toBeNull();

    // Host is attached to the document with a real shadow root.
    const hostEl = document.getElementById('__test_qp_host__');
    expect(hostEl).not.toBeNull();
    expect(elements!.shadowRoot).toBe(hostEl!.shadowRoot);

    // Styles are injected into the shadow root.
    expect(elements!.shadowRoot.querySelector('style')).not.toBeNull();

    // The theme root is where callers mount UI.
    expect(elements!.root.className).toContain('qp-root');
    expect(elements!.root.isConnected).toBe(true);
  });

  test('reports overlay membership for elements inside the shadow host', () => {
    const host = mountQuickPanelShadowHost({ hostId: '__test_qp_host_2__' });
    mounted.push(host);

    const elements = host.getElements()!;
    const child = document.createElement('div');
    elements.root.append(child);

    expect(host.isOverlayElement(elements.host)).toBe(true);
    expect(host.isOverlayElement(child)).toBe(true);
    expect(host.isOverlayElement(document.body)).toBe(false);
  });

  test('removes the host from the document on dispose', () => {
    const host = mountQuickPanelShadowHost({ hostId: '__test_qp_host_3__' });
    host.dispose();

    expect(document.getElementById('__test_qp_host_3__')).toBeNull();
    expect(host.getElements()).toBeNull();
  });
});
