export const providers = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI models through the OpenAI API. Set `OPENAI_API_KEY` before launching GakrCLI.',
    configExample: `"provider": "openai",
"openai": {
  "apiKey": "<YOUR_OPENAI_API_KEY>",
  "model": "gpt-4",
  "baseUrl": "https://api.openai.com/v1"
}`,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models through the Anthropic API. Set `ANTHROPIC_API_KEY` before launching GakrCLI.',
    configExample: `"provider": "anthropic",
"anthropic": {
  "apiKey": "<YOUR_ANTHROPIC_API_KEY>",
  "model": "claude-3-5-sonnet-20240620",
  "baseUrl": "https://api.anthropic.com/v1"
}`,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local models served by an Ollama daemon running on your machine.',
    configExample: `"provider": "ollama",
"ollama": {
  "baseUrl": "http://localhost:11434",
  "model": "gemma2:27b"
}`,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini models through the Google Generative Language API. Set `GEMINI_API_KEY` before launching GakrCLI.',
    configExample: `"provider": "gemini",
"gemini": {
  "apiKey": "<YOUR_GEMINI_API_KEY>",
  "model": "gemini-1.5-pro",
  "baseUrl": "https://generativelanguage.googleapis.com/v1beta"
}`,
  },
] as const
