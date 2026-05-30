import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __setSdkModuleForTests,
  discoverOpenAICompatibleModelOptions,
} from '../../src/settings/providerModelDiscovery';

describe('providerModelDiscovery', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __setSdkModuleForTests(undefined);
    vi.restoreAllMocks();
  });

  function mockSdkModels(models: string[] | (() => string[])) {
    const close = vi.fn();
    const query = vi.fn((params) => ({
      close,
      supportedModels: typeof models === 'function' ? vi.fn(models) : vi.fn(() => models),
      params,
    }));

    __setSdkModuleForTests({ query } as never);
    return { query, close };
  }

  it('prefers fresh models from the GakrCLI SDK query surface', async () => {
    const { query, close } = mockSdkModels([' model-a ', 'model-b', 'model-a']);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(discoverOpenAICompatibleModelOptions({
      OPENAI_BASE_URL: 'https://provider.example.com/v1',
      OPENAI_API_KEY: 'provider-key',
      GAKR_CODE_USE_OPENAI: '1',
    })).resolves.toEqual([
      { value: 'model-a', displayName: 'model-a' },
      { value: 'model-b', displayName: 'model-b' },
    ]);

    expect(query).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        env: expect.objectContaining({
          OPENAI_BASE_URL: 'https://provider.example.com/v1',
          OPENAI_API_KEY: 'provider-key',
          GAKR_CODE_USE_OPENAI: '1',
        }),
      }),
    }));
    expect(close).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to live discovery when the SDK cannot read supported models', async () => {
    mockSdkModels(() => {
      throw new TypeError("Cannot read properties of null (reading 'map')");
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ id: 'fresh-model' }] }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(discoverOpenAICompatibleModelOptions({
      OPENAI_BASE_URL: 'https://provider.example.com/v1',
      OPENAI_API_KEY: 'provider-key',
    })).resolves.toEqual([{ value: 'fresh-model', displayName: 'fresh-model' }]);

    expect(fetchMock).toHaveBeenCalled();
  });

  it('fetches full model ids from an OpenAI-compatible /v1/models endpoint', async () => {
    mockSdkModels([]);
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
    mockSdkModels([]);
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
    mockSdkModels([]);
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
