import { describe, expect, test } from 'bun:test';
import * as React from 'react';
import { AskUserQuestionTool } from './AskUserQuestionTool.js';

describe('AskUserQuestionTool.renderToolResultMessage', () => {
  test('does not throw when the persisted result is null (resumed sessions)', () => {
    // Regression: resuming a session deserializes toolUseResult as raw JSON
    // without validation. A null result previously threw
    // "Cannot destructure property 'answers' of 'object null'", taking down
    // the entire MessagesBoundary so no later messages rendered.
    expect(() =>
      AskUserQuestionTool.renderToolResultMessage(null, 'tool-use-1'),
    ).not.toThrow();
    const node = AskUserQuestionTool.renderToolResultMessage(null, 'tool-use-1');
    expect(React.isValidElement(node)).toBe(true);
  });

  test('does not throw when the result object has no answers field', () => {
    expect(() =>
      AskUserQuestionTool.renderToolResultMessage({}, 'tool-use-2'),
    ).not.toThrow();
  });

  test('renders provided answers without throwing', () => {
    expect(() =>
      AskUserQuestionTool.renderToolResultMessage(
        { answers: { 'Pick one?': 'A' } },
        'tool-use-3',
      ),
    ).not.toThrow();
    const node = AskUserQuestionTool.renderToolResultMessage(
      { answers: { 'Pick one?': 'A' } },
      'tool-use-3',
    );
    expect(React.isValidElement(node)).toBe(true);
  });
});
