// src/diff/diffContentProvider.ts
// TextDocumentContentProvider for original and proposed file content.
// Serves virtual documents via gakrcli-diff-original:// and
// gakrcli-diff-proposed:// URI schemes for the native diff editor.

import type * as VSCode from 'vscode';
import { vscode } from '../vscodeCompat';

export class DiffContentProvider implements VSCode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<VSCode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  // Key: normalized file path, Value: content string
  private readonly contentMap = new Map<string, string>();

  /**
   * Store content for a virtual document.
   * @param filePath The absolute file path (used as the URI path component)
   * @param content The text content to serve
   */
  setContent(filePath: string, content: string): void {
    this.contentMap.set(filePath, content);
    // Fire change event so VS Code re-reads the virtual document
    const uri = vscode.Uri.parse(`${this.scheme}:${filePath}`);
    this._onDidChange.fire(uri);
  }

  /**
   * Remove content for a virtual document (cleanup after accept/reject).
   */
  removeContent(filePath: string): void {
    this.contentMap.delete(filePath);
  }

  /**
   * VS Code calls this to get the text content for a URI with our scheme.
   */
  provideTextDocumentContent(uri: VSCode.Uri): string {
    const filePath = uri.path;
    return this.contentMap.get(filePath) ?? '';
  }

  /**
   * The URI scheme this provider is registered for.
   * Set externally by the factory that creates the two providers.
   */
  scheme = '';

  /**
   * Clear all stored content (e.g., on extension deactivation).
   */
  clear(): void {
    this.contentMap.clear();
  }

  dispose(): void {
    this._onDidChange.dispose();
    this.contentMap.clear();
  }
}

/**
 * Create a pair of DiffContentProviders: one for original content,
 * one for proposed content. Registers both with VS Code.
 */
export function createDiffContentProviders(): {
  original: DiffContentProvider;
  proposed: DiffContentProvider;
  disposables: VSCode.Disposable[];
} {
  const original = new DiffContentProvider();
  original.scheme = 'gakrcli-diff-original';

  const proposed = new DiffContentProvider();
  proposed.scheme = 'gakrcli-diff-proposed';

  const disposables = [
    vscode.workspace.registerTextDocumentContentProvider(
      'gakrcli-diff-original',
      original,
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      'gakrcli-diff-proposed',
      proposed,
    ),
    original,
    proposed,
  ];

  return { original, proposed, disposables };
}
