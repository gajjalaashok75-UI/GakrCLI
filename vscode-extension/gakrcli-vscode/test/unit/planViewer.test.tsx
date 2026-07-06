// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';

// PlanViewer depends on usePlanComments hook
vi.mock('../../webview/src/hooks/usePlanComments', () => ({
  usePlanComments: vi.fn(() => ({
    sections: [],
    comments: [],
    selection: { isVisible: false, top: 0, left: 0, selectedText: '', startOffset: 0, endOffset: 0 },
    activeCommentId: null,
    setActiveCommentId: vi.fn(),
    planContainerRef: { current: null },
    addComment: vi.fn(),
    updateComment: vi.fn(),
    removeComment: vi.fn(),
  })),
}));

import { PlanViewer } from '../../webview/src/components/dialogs/PlanViewer';

describe('PlanViewer', () => {
  const defaultProps = {
    planMarkdown: '# Test Plan\n\nStep 1: Do something\nStep 2: Do another thing',
    onSubmit: vi.fn(),
    onApprove: vi.fn(),
    onRequestRevision: vi.fn(),
    onDismiss: vi.fn(),
  };

  it('renders plan content', () => {
    const { container } = render(<PlanViewer {...defaultProps} />);
    expect(container.textContent).toContain('Test Plan');
  });

  it('renders buttons in the dialog', () => {
    const { container } = render(<PlanViewer {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders without planContent as fallback', () => {
    const { container } = render(
      <PlanViewer
        planMarkdown="# Minimal"
        onSubmit={vi.fn()}
        onApprove={vi.fn()}
        onRequestRevision={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.textContent).toContain('Minimal');
  });

  it('renders with showClearContextOnPlanAccept', () => {
    const { container } = render(
      <PlanViewer
        planMarkdown="# Plan"
        showClearContextOnPlanAccept={true}
        onSubmit={vi.fn()}
        onApprove={vi.fn()}
        onRequestRevision={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.textContent).toBeTruthy();
  });
});
