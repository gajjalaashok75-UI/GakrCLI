import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverOpenAICompatibleModelOptions } from '../../src/settings/providerModelDiscovery';

describe('providerModelDiscovery', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetches full model ids from an OpenAI-compatible /v1/models endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [
          { id: 'openai/gpt-oss-120b' },
          { id: 'openrouter/free' },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(discoverOpenAICompatibleModelOptions({
      OPENAI_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      OPENAI_API_KEY: 'nvapi-test',
    })).resolves.toEqual([
      { value: 'openai/gpt-oss-120b', displayName: 'openai/gpt-oss-120b' },
      { value: 'openrouter/free', displayName: 'openrouter/free' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer nvapi-test' },
      }),
    );
  });

  it('tries /v1/models before /models when the base URL has no v1 suffix', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: vi.fn() })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [{ id: 'model-b' }] }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(discoverOpenAICompatibleModelOptions({
      OPENAI_BASE_URL: 'https://provider.example.com/api',
    })).resolves.toEqual([{ value: 'model-b', displayName: 'model-b' }]);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://provider.example.com/api/v1/models');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://provider.example.com/api/models');
  });

  it('uses the OpenAI default model endpoint when only OpenAI routing is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4.1' }] }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(discoverOpenAICompatibleModelOptions({
      GAKR_CODE_USE_OPENAI: '1',
      OPENAI_API_KEY: 'sk-test',
    })).resolves.toEqual([{ value: 'gpt-4.1', displayName: 'gpt-4.1' }]);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/models');
  });
});
