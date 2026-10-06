/**
 * Tests for the `chrome_*` tool bridge.
 *
 * The critical property is that the agent is offered exactly the tools the
 * extension implements — a name mismatch here means the model calls a tool that
 * does not exist and the turn silently fails.
 */

import { describe, expect, it } from 'bun:test'
import { TOOL_SCHEMAS } from '@gakr-gakr/mcp-chrome-shared'
import {
  buildChromeToolDefinitions,
  CHROME_MCP_SERVER_NAME,
} from './chromeTools.js'

describe('buildChromeToolDefinitions', () => {
  it('exposes every tool the extension declares', () => {
    const tools = buildChromeToolDefinitions(async () => ({ ok: true }))
    expect(tools.length).toBe(TOOL_SCHEMAS.length)
    expect(tools.length).toBeGreaterThan(20)
  })

  it('uses the extension-side tool names, not the legacy MCP names', () => {
    const names = buildChromeToolDefinitions(async () => ({})).map(t => t.name)
    // 23 of 27 are chrome_-prefixed; get_windows_and_tabs and the three
    // performance tools are deliberately unprefixed in the shared contract.
    expect(names).toContain('chrome_navigate')
    expect(names).toContain('chrome_read_page')
    expect(names).toContain('chrome_click_element')
    expect(names).toContain('get_windows_and_tabs')
    // The 18-name surface in @gakr-gakr/gakrcli-for-chrome-mcp must not leak in.
    expect(names).not.toContain('read_page')
    expect(names).not.toContain('navigate')
    expect(names).not.toContain('find')
  })

  it('matches the extension registry exactly', () => {
    const names = buildChromeToolDefinitions(async () => ({})).map(t => t.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.sort()).toEqual([...TOOL_SCHEMAS.map(t => t.name)].sort())
  })

  it('gives every tool a description and an object schema', () => {
    for (const t of buildChromeToolDefinitions(async () => ({}))) {
      expect(typeof t.description).toBe('string')
      expect(t.description.length).toBeGreaterThan(0)
      expect((t.inputSchema as { type?: string }).type).toBe('object')
    }
  })

  it('routes a call to the executor with the tool name and args', async () => {
    const seen: Array<{ name: string; args: unknown }> = []
    const tools = buildChromeToolDefinitions(async (name, args) => {
      seen.push({ name, args })
      return { url: 'https://example.com', title: 'Example' }
    })

    const nav = tools.find(t => t.name === 'chrome_navigate')!
    const result = await nav.handler({ url: 'https://example.com' }, {})

    expect(seen[0].name).toBe('chrome_navigate')
    expect(seen[0].args).toEqual({ url: 'https://example.com' })
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('example.com')
  })

  it('returns an error result instead of throwing when the extension is down', async () => {
    const tools = buildChromeToolDefinitions(async () => {
      throw new Error('Native host connection closed')
    })
    const tabs = tools.find(t => t.name === 'get_windows_and_tabs')!
    const result = await tabs.handler({}, {})

    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ text: string }>)[0].text
    expect(text).toContain('Native host connection closed')
  })

  it('truncates very large results so a page dump cannot exhaust context', async () => {
    const tools = buildChromeToolDefinitions(
      async () => 'x'.repeat(500_000),
    )
    const tabs = tools.find(t => t.name === 'get_windows_and_tabs')!
    const result = await tabs.handler({}, {})
    const text = (result.content as Array<{ text: string }>)[0].text

    expect(text.length).toBeLessThan(120_000)
    expect(text).toContain('truncated')
  })

  it('registers under a stable server name', () => {
    expect(CHROME_MCP_SERVER_NAME).toBe('chrome')
  })
})