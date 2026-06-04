// Loads the real VS Code API in-extension, with a test fallback for Bun's
// root-level test runner where Vitest aliases are not applied.
import type * as VSCode from 'vscode';

export const vscode: typeof VSCode = (() => {
  try {
    return require('vscode') as typeof VSCode;
  } catch {
    return require('../test/__mocks__/vscode.ts') as typeof VSCode;
  }
})();
