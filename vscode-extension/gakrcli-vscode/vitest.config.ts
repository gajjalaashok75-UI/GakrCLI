import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globals: true,
    environment: 'node',
    // Mock vscode module since it's not available outside VS Code
    alias: {
      vscode: new URL('./test/__mocks__/vscode.ts', import.meta.url).pathname,
    },
  },
});
