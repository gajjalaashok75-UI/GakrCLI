import { describe, expect, test } from 'bun:test';
import { isCliSessionId, toCliSessionId } from './cliSessionId.js';

describe('toCliSessionId', () => {
  test('passes uuids through unchanged', () => {
    const id = '550E8400-E29B-41D4-A716-446655440000';
    expect(toCliSessionId(id)).toBe(id.toLowerCase());
    expect(isCliSessionId(id)).toBe(true);
  });

  test('maps a web-editor id to a stable uuid', () => {
    const mapped = toCliSessionId('web-editor-1234');
    expect(isCliSessionId(mapped)).toBe(true);
    expect(mapped).toBe('cfda0bb3-a32c-5807-9fa6-74fdf09c8afb');
    expect(toCliSessionId('web-editor-1234')).toBe(mapped);
  });

  test('different panel ids map to different uuids', () => {
    expect(toCliSessionId('web-editor-1')).not.toBe(toCliSessionId('web-editor-2'));
  });

  test('rejects an empty id', () => {
    expect(() => toCliSessionId('  ')).toThrow('panel session id is required');
  });
});
