import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'
import { WebSearchTool } from './WebSearchTool.js'
import type { SearchInput, ProviderOutput } from './providers/index.js'

// Mock the providers
const mockRunSearch = mock()
const mockGetProviderMode = mock()
const mockGetAvailableProviders = mock()

// Mock the provider system
mock.module('./providers/index.js', () => ({
  runSearch: mockRunSearch,
  getProviderMode: mockGetProviderMode,
  getAvailableProviders: mockGetAvailableProviders,
  type: {
    SearchInput: {} as SearchInput,
    ProviderOutput: {} as ProviderOutput,
  },
}))

// Mock other dependencies
mock.module('src/utils/model/providers.js', () => ({
  getAPIProvider: mock(() => 'openai'),
}))

mock.module('../../services/api/gakrcli.js', () => ({
  queryModelWithStreaming: mock(),
}))

mock.module('../../utils/model/model.js', () => ({
  getMainLoopModel: mock(() => 'gpt-4'),
  getSmallFastModel: mock(() => 'gpt-3.5-turbo'),
}))

mock.module('../../services/analytics/growthbook.js', () => ({
  getFeatureValue_CACHED_MAY_BE_STALE: mock(() => false),
}))

describe('WebSearchTool', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockRunSearch.mockReset()
    mockGetProviderMode.mockReset()
    mockGetAvailableProviders.mockReset()
  })

  afterEach(() => {
    // Clean up after each test
    delete process.env.WEB_SEARCH_PROVIDER
    delete process.env.FIRECRAWL_API_KEY
    delete process.env.TAVILY_API_KEY
    delete process.env.EXA_API_KEY
  })

  describe('Basic functionality', () => {
    test('should have correct tool properties', () => {
      expect(WebSearchTool.name).toBe('WebSearch')
      expect(WebSearchTool.userFacingName()).toBe('Web Search')
      expect(WebSearchTool.isReadOnly()).toBe(true)
      expect(WebSearchTool.isConcurrencySafe()).toBe(true)
    })

    test('should validate input correctly', async () => {
      // Valid input
      const validResult = await WebSearchTool.validateInput({
        query: 'test query',
      })
      expect(validResult.result).toBe(true)

      // Empty query
      const emptyQueryResult = await WebSearchTool.validateInput({
        query: '',
      })
      expect(emptyQueryResult.result).toBe(false)
      expect(emptyQueryResult.message).toBe('Error: Missing query')

      // Both allowed and blocked domains
      const conflictResult = await WebSearchTool.validateInput({
        query: 'test',
        allowed_domains: ['example.com'],
        blocked_domains: ['bad.com'],
      })
      expect(conflictResult.result).toBe(false)
      expect(conflictResult.message).toContain('Cannot specify both')
    })

    test('should generate correct description', async () => {
      const description = await WebSearchTool.description({
        query: 'test search',
      })
      expect(description).toBe('Gakr wants to search the web for: test search')
    })

    test('should generate correct activity description', () => {
      const activity = WebSearchTool.getActivityDescription({
        query: 'test search',
      })
      expect(activity).toBe('Searching for test search')
    })
  })

  describe('Provider system integration', () => {
    test('should use adapter providers when configured', async () => {
      mockGetProviderMode.mockReturnValue('tavily')
      mockGetAvailableProviders.mockReturnValue([
        { name: 'tavily', isConfigured: () => true },
      ])
      mockRunSearch.mockResolvedValue({
        hits: [
          {
            title: 'Test Result',
            url: 'https://example.com',
            description: 'Test description',
          },
        ],
        providerName: 'tavily',
        durationSeconds: 0.5,
      })

      const mockContext = {
        abortController: { signal: new AbortController().signal },
        getAppState: () => ({ toolPermissionContext: {} }),
        options: {
          thinkingConfig: { type: 'disabled' as const },
          mainLoopModel: 'gpt-4',
          isNonInteractiveSession: false,
          agentDefinitions: { activeAgents: [] },
        },
        agentId: 'test-agent',
      }

      const result = await WebSearchTool.call(
        { query: 'test search' },
        mockContext as any,
        () => true,
        null,
        null,
      )

      expect(mockRunSearch).toHaveBeenCalledWith(
        {
          query: 'test search',
          allowed_domains: undefined,
          blocked_domains: undefined,
        },
        mockContext.abortController.signal,
      )

      expect(result.data.query).toBe('test search')
      expect(result.data.results).toHaveLength(2) // snippets + search results
      expect(result.data.durationSeconds).toBe(0.5)
    })

    test('should handle provider failures in auto mode', async () => {
      mockGetProviderMode.mockReturnValue('auto')
      mockGetAvailableProviders.mockReturnValue([
        { name: 'tavily', isConfigured: () => true },
      ])
      mockRunSearch.mockRejectedValue(new Error('Network timeout'))

      // Mock that we have native fallback
      const mockGetAPIProvider = mock(() => 'firstParty')
      mock.module('src/utils/model/providers.js', () => ({
        getAPIProvider: mockGetAPIProvider,
      }))

      const mockQueryStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'web_search_tool_result',
                  tool_use_id: 'search-1',
                  content: [
                    { title: 'Fallback Result', url: 'https://fallback.com' },
                  ],
                },
              ],
            },
          }
        },
      }

      const mockQueryModelWithStreaming = mock(() => mockQueryStream)
      mock.module('../../services/api/gakrcli.js', () => ({
        queryModelWithStreaming: mockQueryModelWithStreaming,
      }))

      const mockContext = {
        abortController: { signal: new AbortController().signal },
        getAppState: () => ({ toolPermissionContext: {}, effortValue: 1 }),
        options: {
          thinkingConfig: { type: 'disabled' as const },
          mainLoopModel: 'gpt-4',
          isNonInteractiveSession: false,
          agentDefinitions: { activeAgents: [] },
          appendSystemPrompt: null,
        },
        agentId: 'test-agent',
      }

      const result = await WebSearchTool.call(
        { query: 'test search' },
        mockContext as any,
        () => true,
        null,
        null,
      )

      // Should fall back to native search
      expect(mockQueryModelWithStreaming).toHaveBeenCalled()
      expect(result.data.query).toBe('test search')
    })

    test('should fail fast in explicit provider mode', async () => {
      mockGetProviderMode.mockReturnValue('tavily')
      mockGetAvailableProviders.mockReturnValue([
        { name: 'tavily', isConfigured: () => true },
      ])
      mockRunSearch.mockRejectedValue(new Error('API key invalid'))

      const mockContext = {
        abortController: { signal: new AbortController().signal },
      }

      await expect(
        WebSearchTool.call(
          { query: 'test search' },
          mockContext as any,
          () => true,
          null,
          null,
        ),
      ).rejects.toThrow('API key invalid')
    })
  })

  describe('Tool enablement', () => {
    test('should be enabled when providers are available', () => {
      mockGetProviderMode.mockReturnValue('auto')
      mockGetAvailableProviders.mockReturnValue([
        { name: 'tavily', isConfigured: () => true },
      ])

      expect(WebSearchTool.isEnabled()).toBe(true)
    })

    test('should be enabled for specific provider modes', () => {
      mockGetProviderMode.mockReturnValue('tavily')
      mockGetAvailableProviders.mockReturnValue([
        { name: 'tavily', isConfigured: () => true },
      ])

      expect(WebSearchTool.isEnabled()).toBe(true)
    })

    test('should be disabled when no providers available', () => {
      mockGetProviderMode.mockReturnValue('auto')
      mockGetAvailableProviders.mockReturnValue([])

      const mockGetAPIProvider = mock(() => 'openai')
      mock.module('src/utils/model/providers.js', () => ({
        getAPIProvider: mockGetAPIProvider,
      }))

      expect(WebSearchTool.isEnabled()).toBe(false)
    })
  })

  describe('Input/Output schemas', () => {
    test('should validate input schema', () => {
      const schema = WebSearchTool.inputSchema
      
      // Valid input
      expect(() =>
        schema.parse({
          query: 'test query',
          allowed_domains: ['example.com'],
        }),
      ).not.toThrow()

      // Invalid input - missing query
      expect(() => schema.parse({})).toThrow()

      // Invalid input - empty query
      expect(() => schema.parse({ query: '' })).toThrow()
    })

    test('should validate output schema', () => {
      const schema = WebSearchTool.outputSchema

      // Valid output
      expect(() =>
        schema.parse({
          query: 'test',
          results: [
            'Some text result',
            {
              tool_use_id: 'search-1',
              content: [{ title: 'Test', url: 'https://example.com' }],
            },
          ],
          durationSeconds: 1.5,
        }),
      ).not.toThrow()

      // Invalid output - missing required fields
      expect(() => schema.parse({ query: 'test' })).toThrow()
    })
  })

  describe('Tool result formatting', () => {
    test('should format tool result correctly', () => {
      const output = {
        query: 'test search',
        results: [
          'This is a text summary of results.',
          {
            tool_use_id: 'search-1',
            content: [
              { title: 'Result 1', url: 'https://example1.com' },
              { title: 'Result 2', url: 'https://example2.com' },
            ],
          },
        ],
        durationSeconds: 1.2,
      }

      const formatted = WebSearchTool.mapToolResultToToolResultBlockParam(
        output,
        'test-tool-use-id',
      )

      expect(formatted.tool_use_id).toBe('test-tool-use-id')
      expect(formatted.type).toBe('tool_result')
      expect(formatted.content).toContain('Web search results for query: "test search"')
      expect(formatted.content).toContain('This is a text summary of results.')
      expect(formatted.content).toContain('Links:')
      expect(formatted.content).toContain('REMINDER: You MUST include the sources')
    })

    test('should handle null results gracefully', () => {
      const output = {
        query: 'test search',
        results: [null, 'Valid result', null],
        durationSeconds: 1.0,
      }

      const formatted = WebSearchTool.mapToolResultToToolResultBlockParam(
        output,
        'test-tool-use-id',
      )

      expect(formatted.content).toContain('Valid result')
      expect(formatted.content).not.toContain('null')
    })
  })

  describe('Environment variable handling', () => {
    test('should respect WEB_SEARCH_PROVIDER environment variable', () => {
      process.env.WEB_SEARCH_PROVIDER = 'tavily'
      mockGetProviderMode.mockReturnValue('tavily')
      mockGetAvailableProviders.mockReturnValue([
        { name: 'tavily', isConfigured: () => true },
      ])

      expect(WebSearchTool.isEnabled()).toBe(true)
    })

    test('should handle invalid WEB_SEARCH_PROVIDER gracefully', () => {
      process.env.WEB_SEARCH_PROVIDER = 'invalid-provider'
      mockGetProviderMode.mockReturnValue('auto') // Should fallback to auto
      mockGetAvailableProviders.mockReturnValue([])

      const mockGetAPIProvider = mock(() => 'openai')
      mock.module('src/utils/model/providers.js', () => ({
        getAPIProvider: mockGetAPIProvider,
      }))

      expect(WebSearchTool.isEnabled()).toBe(false)
    })
  })

  describe('Domain filtering', () => {
    test('should pass domain filters to providers', async () => {
      mockGetProviderMode.mockReturnValue('tavily')
      mockGetAvailableProviders.mockReturnValue([
        { name: 'tavily', isConfigured: () => true },
      ])
      mockRunSearch.mockResolvedValue({
        hits: [],
        providerName: 'tavily',
        durationSeconds: 0.1,
      })

      const mockContext = {
        abortController: { signal: new AbortController().signal },
      }

      await WebSearchTool.call(
        {
          query: 'test search',
          allowed_domains: ['example.com', 'test.org'],
          blocked_domains: ['spam.com'],
        },
        mockContext as any,
        () => true,
        null,
        null,
      )

      expect(mockRunSearch).toHaveBeenCalledWith(
        {
          query: 'test search',
          allowed_domains: ['example.com', 'test.org'],
          blocked_domains: ['spam.com'],
        },
        mockContext.abortController.signal,
      )
    })
  })

  describe('Error handling', () => {
    test('should handle abort signals correctly', async () => {
      mockGetProviderMode.mockReturnValue('tavily')
      mockGetAvailableProviders.mockReturnValue([
        { name: 'tavily', isConfigured: () => true },
      ])
      
      const abortError = new DOMException('Aborted', 'AbortError')
      mockRunSearch.mockRejectedValue(abortError)

      const mockContext = {
        abortController: { signal: new AbortController().signal },
      }

      await expect(
        WebSearchTool.call(
          { query: 'test search' },
          mockContext as any,
          () => true,
          null,
          null,
        ),
      ).rejects.toThrow('Aborted')
    })

    test('should surface configuration errors', async () => {
      mockGetProviderMode.mockReturnValue('tavily')
      mockGetAvailableProviders.mockReturnValue([])
      mockRunSearch.mockRejectedValue(
        new Error('Search provider "tavily" is not configured'),
      )

      const mockContext = {
        abortController: { signal: new AbortController().signal },
      }

      await expect(
        WebSearchTool.call(
          { query: 'test search' },
          mockContext as any,
          () => true,
          null,
          null,
        ),
      ).rejects.toThrow('not configured')
    })
  })
})

describe('WebSearchTool integration with all providers', () => {
  const providers = [
    'firecrawl',
    'tavily', 
    'exa',
    'you',
    'jina',
    'bing',
    'mojeek',
    'linkup',
    'ddg',
    'custom',
  ]

  providers.forEach(provider => {
    test(`should work with ${provider} provider`, async () => {
      mockGetProviderMode.mockReturnValue(provider)
      mockGetAvailableProviders.mockReturnValue([
        { name: provider, isConfigured: () => true },
      ])
      mockRunSearch.mockResolvedValue({
        hits: [
          {
            title: `${provider} result`,
            url: `https://${provider}.example.com`,
            description: `Result from ${provider}`,
          },
        ],
        providerName: provider,
        durationSeconds: 0.3,
      })

      const mockContext = {
        abortController: { signal: new AbortController().signal },
      }

      const result = await WebSearchTool.call(
        { query: 'test query' },
        mockContext as any,
        () => true,
        null,
        null,
      )

      expect(result.data.query).toBe('test query')
      expect(result.data.results[0]).toContain(`Result from ${provider}`)
      expect(result.data.results[1]).toEqual(
        expect.objectContaining({
          tool_use_id: `${provider}-search`,
        }),
      )
    })
  })
})
