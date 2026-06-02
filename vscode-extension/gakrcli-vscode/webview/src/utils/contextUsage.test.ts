import { describe, expect, test } from 'bun:test';
import {
  buildContextUsageTooltip,
  formatContextTokens,
  normalizeContextUsage,
} from './contextUsage';

describe('context usage display data', () => {
  test('normalizes SDK context usage and clamps percentages', () => {
    expect(normalizeContextUsage({
      totalTokens: 25_000,
      rawMaxTokens: 100_000,
      percentage: 123,
      model: 'stepfun-ai/step-3.7-flash',
      isAutoCompactEnabled: true,
      autoCompactThreshold: 80_000,
    })).toEqual({
      totalTokens: 25_000,
      maxTokens: 0,
      rawMaxTokens: 100_000,
      percentage: 100,
      model: 'stepfun-ai/step-3.7-flash',
      autoCompactThreshold: 80_000,
      isAutoCompactEnabled: true,
      isKnown: true,
    });
  });

  test('derives percentage when the SDK omits it', () => {
    const usage = normalizeContextUsage({
      totalTokens: 12_500,
      rawMaxTokens: 50_000,
      isAutoCompactEnabled: false,
    });

    expect(usage?.percentage).toBe(25);
  });

  test('keeps unavailable capacity visible as a pending live state', () => {
    expect(normalizeContextUsage({ totalTokens: 100, rawMaxTokens: 0 })).toEqual({
      totalTokens: 100,
      maxTokens: 0,
      rawMaxTokens: 0,
      percentage: 0,
      model: null,
      autoCompactThreshold: null,
      isAutoCompactEnabled: false,
      isKnown: false,
    });
    expect(normalizeContextUsage(null).isKnown).toBe(false);
  });

  test('preserves the last known context when a refresh returns empty capacity', () => {
    const previous = normalizeContextUsage({
      totalTokens: 40_000,
      rawMaxTokens: 128_000,
      percentage: 31,
      model: 'stepfun-ai/step-3.7-flash',
    });

    expect(normalizeContextUsage({
      totalTokens: 0,
      rawMaxTokens: 0,
      percentage: 0,
      model: 'stepfun-ai/step-3.7-flash',
    }, previous)).toBe(previous);
  });

  test('formats token counts compactly', () => {
    expect(formatContextTokens(999)).toBe('999');
    expect(formatContextTokens(12_500)).toBe('13K');
    expect(formatContextTokens(1_250_000)).toBe('1.3M');
  });

  test('builds a tooltip with capacity and autocompact details', () => {
    const usage = normalizeContextUsage({
      totalTokens: 45_000,
      rawMaxTokens: 100_000,
      autoCompactThreshold: 80_000,
      isAutoCompactEnabled: true,
      model: 'test-model',
    });

    expect(usage).not.toBeNull();
    const tooltip = buildContextUsageTooltip(usage);
    expect(tooltip).toContain('Context: 45% used');
    expect(tooltip).toContain('Tokens: 45K / 100K');
    expect(tooltip).toContain('Autocompact starts around 80K tokens (80%).');
    expect(tooltip).toContain('Model: test-model');
  });
});
