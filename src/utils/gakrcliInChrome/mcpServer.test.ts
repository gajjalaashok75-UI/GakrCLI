import { describe, expect, mock, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { TOOL_SCHEMAS } from '@gakr-gakr/mcp-chrome-shared'
import { createLinkedTransportPair } from '../../services/mcp/InProcessTransport.js'
import {
  type ChromeToolExecutor,
  createChromeMcpServer,
} from './mcpServer.js'

type CallToolResult = {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}

/**
 * Connect a real MCP client to the server over the same linked transport pair
 * services/mcp/client.ts uses for the in-process `--chrome` server.
 */
async function connectWith(execute: ChromeToolExecutor): Promise<Client> {
  const server = createChromeMcpServer({ execute })
  const [clientTransport, serverTransport] = createLinkedTransportPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'gakrcli-test', version: '0.0.0' })
  await client.connect(clientTransport)
  return client
}

function textOf(result: CallToolResult): string {
  return result.content.map(block => block.text ?? '').join('\n')
}

describe('createChromeMcpServer', () => {
  test('advertises exactly the tools the extension implements', async () => {
    const client = await connectWith(async () => 'ok')
    const { tools } = await client.listTools()

    // Same registry the extension names its own tools from, so every
    // advertised tool has an implementation on the other end.
    expect(tools.map(tool => tool.name)).toEqual(
      TOOL_SCHEMAS.map(tool => tool.name),
    )
    expect(tools.map(tool => tool.name)).toContain('chrome_navigate')
    expect(tools.map(tool => tool.name)).toContain('get_windows_and_tabs')
  })

  test('does not advertise the package surface the extension cannot dispatch', async () => {
    const client = await connectWith(async () => 'ok')
    const { tools } = await client.listTools()
    const names = tools.map(tool => tool.name)

    for (const name of [
      'tabs_context_mcp',
      'tabs_create_mcp',
      'read_page',
      'navigate',
      'resize_window',
      'update_plan',
      'shortcuts_execute',
    ]) {
      expect(names).not.toContain(name)
    }
  })

  test('executes the call through the executor with the extension tool name', async () => {
    const execute = mock(async () => ({ tabs: [{ id: 7 }] }))
    const client = await connectWith(execute)

    const result = (await client.callTool({
      name: 'get_windows_and_tabs',
      arguments: {},
    })) as CallToolResult

    expect(execute).toHaveBeenCalledWith('get_windows_and_tabs', {})
    expect(result.isError).toBeFalsy()
    expect(textOf(result)).toContain('"id": 7')
  })

  test('passes tool arguments straight through to the extension', async () => {
    const execute = mock(async () => 'navigated')
    const client = await connectWith(execute)

    await client.callTool({
      name: 'chrome_navigate',
      arguments: { url: 'https://example.com', background: true },
    })

    expect(execute).toHaveBeenCalledWith('chrome_navigate', {
      url: 'https://example.com',
      background: true,
    })
  })

  test('reports an executor failure as an error result naming the tool', async () => {
    const client = await connectWith(async () => {
      throw new Error('native host connection closed')
    })

    const result = (await client.callTool({
      name: 'chrome_read_page',
      arguments: {},
    })) as CallToolResult

    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe(
      'chrome tool chrome_read_page failed: native host connection closed',
    )
  })

  test('lets the extension report unknown tools rather than filtering them out', async () => {
    // The extension owns dispatch and answers `Tool x not found`; rejecting
    // here would replace that message with a less specific one.
    const execute = mock(async () => ({
      content: [{ type: 'text', text: 'Tool nope not found' }],
      isError: true,
    }))
    const client = await connectWith(execute)

    const result = (await client.callTool({
      name: 'nope',
      arguments: {},
    })) as CallToolResult

    expect(execute).toHaveBeenCalledWith('nope', {})
    expect(textOf(result)).toBe('Tool nope not found')
    expect(result.isError).toBe(true)
  })

  test('forwards a successful extension envelope without re-wrapping it', async () => {
    // The extension answers in MCP shape; stringifying that envelope made the
    // client parse `{"content":[{"type":"text","text":"…"}]}` as the result.
    const client = await connectWith(async () => ({
      content: [{ type: 'text', text: 'Window count: 0' }],
      isError: false,
    }))

    const result = (await client.callTool({
      name: 'get_windows_and_tabs',
      arguments: {},
    })) as CallToolResult

    expect(textOf(result)).toBe('Window count: 0')
    expect(result.isError).toBeFalsy()
  })

  test('preserves an error the extension reported inside the envelope', async () => {
    const client = await connectWith(async () => ({
      content: [{ type: 'text', text: 'Tab 7 does not exist' }],
      isError: true,
    }))

    const result = (await client.callTool({
      name: 'chrome_read_page',
      arguments: { tabId: 7 },
    })) as CallToolResult

    expect(textOf(result)).toBe('Tab 7 does not exist')
    expect(result.isError).toBe(true)
  })

  test('bounds oversized results', async () => {
    const client = await connectWith(async () => 'x'.repeat(200_000))

    const result = (await client.callTool({
      name: 'chrome_read_page',
      arguments: {},
    })) as CallToolResult

    const text = textOf(result)
    expect(text.length).toBeLessThanOrEqual(100_020)
    expect(text).toContain('[truncated]')
  })
})
