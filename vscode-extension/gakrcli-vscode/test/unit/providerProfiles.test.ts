import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildEnvForProviderProfile,
  getGlobalProviderConfigPath,
  loadActiveProviderProfile,
  parseGlobalProviderProfileConfig,
  updateActiveProviderProfileModel,
} from '../../src/settings/providerProfiles';

describe('providerProfiles', () => {
  it('reads the active provider profile from ~/.gakrcli.json', () => {
    const raw = JSON.stringify({
      activeProviderProfileId: 'nvidia_prof',
      providerProfiles: [
        {
          id: 'openai_prof',
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o',
        },
        {
          id: 'nvidia_prof',
          name: 'NVIDIA NIM',
          provider: 'nvidia-nim',
          baseUrl: 'https://integrate.api.nvidia.com/v1',
          model: 'nvidia/llama-3.1-nemotron-70b-instruct, stepfun-ai/step-3.5-flash',
          apiKey: 'nvapi-live',
        },
      ],
    });

    const config = parseGlobalProviderProfileConfig(raw);
    expect(config.providerProfiles?.[1].provider).toBe('nvidia-nim');
    expect(config.providerProfiles?.[1].model).toContain('stepfun-ai/step-3.5-flash');
  });

  it('builds NVIDIA-compatible CLI environment from an active profile', () => {
    const env = buildEnvForProviderProfile({
      id: 'nvidia_prof',
      name: 'NVIDIA NIM',
      provider: 'nvidia-nim',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'nvidia/llama-3.1-nemotron-70b-instruct',
      apiKey: 'nvapi-live',
    });

    expect(env).toMatchObject({
      GAKR_CODE_USE_OPENAI: '1',
      OPENAI_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      OPENAI_MODEL: 'nvidia/llama-3.1-nemotron-70b-instruct',
      OPENAI_API_KEY: 'nvapi-live',
      NVIDIA_API_KEY: 'nvapi-live',
      NVIDIA_NIM: '1',
    });
  });

  it('loads model options and promotes selected model in the active profile', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gakrcli-vscode-provider-'));
    const filePath = path.join(tempDir, '.gakrcli.json');
    fs.writeFileSync(filePath, JSON.stringify({
      activeProviderProfileId: 'nvidia_prof',
      providerProfiles: [
        {
          id: 'nvidia_prof',
          name: 'NVIDIA NIM',
          provider: 'nvidia-nim',
          baseUrl: 'https://integrate.api.nvidia.com/v1',
          model: 'model-a, model-b',
        },
      ],
      openaiAdditionalModelOptionsCacheByProfile: {
        nvidia_prof: [{ value: 'model-c', label: 'Model C' }],
      },
    }, null, 2));

    try {
      const loaded = loadActiveProviderProfile({ filePath });
      expect(loaded?.modelOptions.map((option) => option.value)).toEqual(['model-a', 'model-b', 'model-c']);

      expect(updateActiveProviderProfileModel('model-b', { filePath })).toBe(true);
      const updated = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
        providerProfiles: Array<{ model: string }>;
      };
      expect(updated.providerProfiles[0].model).toBe('model-b, model-a');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves ~/.gakrcli.json using GAKR_CONFIG_DIR when present', () => {
    expect(getGlobalProviderConfigPath({ configDir: 'C:\\Users\\test' })).toBe('C:\\Users\\test\\.gakrcli.json');
  });
});
