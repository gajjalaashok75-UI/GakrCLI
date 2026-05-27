import { describe, it, expect, beforeEach } from 'vitest';
import { DiffContentProvider } from '../../src/diff/diffContentProvider';

describe('DiffContentProvider', () => {
  let provider: DiffContentProvider;

  beforeEach(() => {
    provider = new DiffContentProvider();
    provider.scheme = 'gakrcli-diff-original';
  });

  it('should return empty string for unknown paths', () => {
    const uri = { path: '/some/unknown/file.ts' } as { path: string };
    expect(provider.provideTextDocumentContent(uri as never)).toBe('');
  });

  it('should return stored content for known paths', () => {
    provider.setContent('/test/file.ts', 'hello world');
    const uri = { path: '/test/file.ts' } as { path: string };
    expect(provider.provideTextDocumentContent(uri as never)).toBe(
      'hello world',
    );
  });

  it('should update content when setContent is called again', () => {
    provider.setContent('/test/file.ts', 'version 1');
    provider.setContent('/test/file.ts', 'version 2');
    const uri = { path: '/test/file.ts' } as { path: string };
    expect(provider.provideTextDocumentContent(uri as never)).toBe(
      'version 2',
    );
  });

  it('should remove content', () => {
    provider.setContent('/test/file.ts', 'hello');
    provider.removeContent('/test/file.ts');
    const uri = { path: '/test/file.ts' } as { path: string };
    expect(provider.provideTextDocumentContent(uri as never)).toBe('');
  });

  it('should store multiple files independently', () => {
    provider.setContent('/a.ts', 'content a');
    provider.setContent('/b.ts', 'content b');
    expect(
      provider.provideTextDocumentContent({ path: '/a.ts' } as never),
    ).toBe('content a');
    expect(
      provider.provideTextDocumentContent({ path: '/b.ts' } as never),
    ).toBe('content b');
  });

  it('should clear all content', () => {
    provider.setContent('/a.ts', 'a');
    provider.setContent('/b.ts', 'b');
    provider.clear();
    expect(
      provider.provideTextDocumentContent({ path: '/a.ts' } as never),
    ).toBe('');
    expect(
      provider.provideTextDocumentContent({ path: '/b.ts' } as never),
    ).toBe('');
  });
});
