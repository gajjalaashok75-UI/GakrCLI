// test/unit/mcpIdeServer.test.ts
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, vi } from 'vitest';

// We test the pure helper functions and server behavior
// The actual VS Code API calls are mocked

describe('McpIdeServer', () => {
  describe('lockfile generation', () => {
    it('should generate a lockfile with required fields', async () => {
      const { generateLockfile } = await import('../../src/mcp/mcpIdeServer');

      const lockfile = generateLockfile(12345, 8080, '/workspace/project');

      expect(lockfile.pid).toBe(12345);
      expect(lockfile.port).toBe(8080);
      expect(lockfile.workspaceFolder).toBe('/workspace/project');
      expect(lockfile.workspaceFolders).toEqual(['/workspace/project']);
      expect(lockfile.ideName).toBe('VS Code');
      expect(lockfile.transport).toBe('sse');
      expect(lockfile.token).toMatch(/^[a-f0-9]{64}$/); // 32 bytes hex
      expect(lockfile.authToken).toBe(lockfile.token);
      expect(lockfile.createdAt).toBeDefined();
    });

    it('should generate unique tokens on each call', async () => {
      const { generateLockfile } = await import('../../src/mcp/mcpIdeServer');

      const a = generateLockfile(1, 80, '/a');
      const b = generateLockfile(1, 80, '/a');

      expect(a.token).not.toBe(b.token);
    });
  });

  describe('auth validation', () => {
    it('should reject requests without Authorization header', async () => {
      const { validateAuth } = await import('../../src/mcp/mcpIdeServer');

      expect(validateAuth(undefined, 'valid-token')).toBe(false);
      expect(validateAuth('', 'valid-token')).toBe(false);
    });

    it('should reject requests with wrong token', async () => {
      const { validateAuth } = await import('../../src/mcp/mcpIdeServer');

      expect(validateAuth('Bearer wrong-token', 'valid-token')).toBe(false);
    });

    it('should accept requests with correct Bearer token', async () => {
      const { validateAuth } = await import('../../src/mcp/mcpIdeServer');

      expect(validateAuth('Bearer valid-token', 'valid-token')).toBe(true);
    });
  });

  describe('JSON-RPC routing', () => {
    it('should handle tools/list method', async () => {
      const { routeRequest } = await import('../../src/mcp/mcpIdeServer');

      const result = await routeRequest(
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        { getDiagnostics: vi.fn(), executeCode: vi.fn() },
      );

      expect(result.result).toBeDefined();
      const tools = (result.result as { tools: Array<{ name: string }> }).tools;
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('getDiagnostics');
      expect(tools[1].name).toBe('executeCode');
    });

    it('should handle tools/call for getDiagnostics', async () => {
      const mockGetDiagnostics = vi.fn().mockResolvedValue([
        { file: 'test.ts', line: 10, message: 'Type error', severity: 'error' },
      ]);

      const { routeRequest } = await import('../../src/mcp/mcpIdeServer');

      const result = await routeRequest(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'getDiagnostics', arguments: {} },
        },
        { getDiagnostics: mockGetDiagnostics, executeCode: vi.fn() },
      );

      expect(mockGetDiagnostics).toHaveBeenCalled();
      expect(result.error).toBeUndefined();
    });

    it('should return error for unknown tool', async () => {
      const { routeRequest } = await import('../../src/mcp/mcpIdeServer');

      const result = await routeRequest(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'nonexistent', arguments: {} },
        },
        { getDiagnostics: vi.fn(), executeCode: vi.fn() },
      );

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(-32601);
    });

    it('should return error for unknown method', async () => {
      const { routeRequest } = await import('../../src/mcp/mcpIdeServer');

      const result = await routeRequest(
        { jsonrpc: '2.0', id: 4, method: 'unknown/method' },
        { getDiagnostics: vi.fn(), executeCode: vi.fn() },
      );

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(-32601);
    });

    it('should not respond to initialized notifications', async () => {
      const { routeRequest } = await import('../../src/mcp/mcpIdeServer');

      const result = await routeRequest(
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { getDiagnostics: vi.fn(), executeCode: vi.fn() },
      );

      expect(result).toBeNull();
    });
  });

  describe('SSE formatting', () => {
    it('should format endpoint and message events for MCP SSE clients', async () => {
      const { formatSseEvent } = await import('../../src/mcp/mcpIdeServer');

      expect(formatSseEvent('endpoint', '/message?sessionId=abc')).toBe(
        'event: endpoint\ndata: /message?sessionId=abc\n\n',
      );
      expect(formatSseEvent('message', '{"ok":true}')).toBe(
        'event: message\ndata: {"ok":true}\n\n',
      );
    });
  });

  describe('SSE server transport', () => {
    it('should expose an MCP-compatible SSE endpoint and message POST endpoint', async () => {
      const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gakrcli-vscode-mcp-'));
      const oldConfigDir = process.env.GAKR_CONFIG_DIR;
      process.env.GAKR_CONFIG_DIR = configDir;

      const { McpIdeServer } = await import('../../src/mcp/mcpIdeServer');
      const server = new McpIdeServer('/workspace/project');

      try {
        const { port } = await server.start();
        const response = await fetch(`http://127.0.0.1:${port}/sse`);
        expect(response.ok).toBe(true);
        expect(response.headers.get('content-type')).toContain('text/event-stream');

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        const first = await reader.read();
        const endpointEvent = decoder.decode(first.value);
        expect(endpointEvent).toContain('event: endpoint');
        const sessionId = endpointEvent.match(/sessionId=([a-f0-9]+)/)?.[1];
        expect(sessionId).toBeTruthy();

        const postResponse = await fetch(`http://127.0.0.1:${port}/message?sessionId=${sessionId}`, {
          method: 'POST',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
        });
        expect(postResponse.status).toBe(202);

        const second = await reader.read();
        const messageEvent = decoder.decode(second.value);
        expect(messageEvent).toContain('event: message');
        expect(messageEvent).toContain('"serverInfo":{"name":"gakrcli-ide"');

        await reader.cancel();
      } finally {
        server.dispose();
        if (oldConfigDir === undefined) {
          delete process.env.GAKR_CONFIG_DIR;
        } else {
          process.env.GAKR_CONFIG_DIR = oldConfigDir;
        }
        await fs.rm(configDir, { recursive: true, force: true });
      }
    });
  });
});
