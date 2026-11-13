#!/usr/bin/env node
/**
 * Tiny stdio MCP server used to prove that several headless CLI workers can
 * attach MCP servers concurrently (browser tools use the same transport).
 *
 * Newline-delimited JSON-RPC, tools capability only. Every handshake and tool
 * call is appended to the log file passed as argv[2] so tests can assert on it.
 */
import { appendFileSync } from 'node:fs';

const logPath = process.argv[2];

function log(entry) {
  if (!logPath) return;
  try {
    appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
  } catch {
    // Logging is best-effort.
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(message) {
  if (!message || typeof message !== 'object') return;

  if (message.method === 'initialize') {
    log({ event: 'initialize', params: message.params });
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'fake-panel-mcp', version: '1.0.0' },
      },
    });
    return;
  }

  if (message.method === 'tools/list') {
    log({ event: 'tools/list' });
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          {
            name: 'fake_panel_tool',
            description: 'Fake tool used by panel-agent tests',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
        ],
      },
    });
    return;
  }

  if (message.method === 'tools/call') {
    log({ event: 'tools/call', params: message.params });
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: { content: [{ type: 'text', text: 'fake-tool-ok' }] },
    });
    return;
  }

  if (message.method === 'ping') {
    send({ jsonrpc: '2.0', id: message.id, result: {} });
    return;
  }

  // Notifications carry no id and must not be answered.
  if (message.id !== undefined) {
    send({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: `Method not found: ${message.method}` },
    });
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  let newline = buffer.indexOf('\n');
  while (newline !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) {
      try {
        handle(JSON.parse(line));
      } catch {
        // Ignore malformed lines.
      }
    }
    newline = buffer.indexOf('\n');
  }
});
process.stdin.on('end', () => process.exit(0));
