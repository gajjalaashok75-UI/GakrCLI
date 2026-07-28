const MODEL_EMAIL_MAP: Array<{ keywords: string[]; email: string }> = [
  { keywords: ['gakrcli'], email: 'noreply@gakrcli.com' },
  // Could not find their official emails/avatars, using our own emails for now.
  // GitHub orgs cannot be co-authors.
  {
    keywords: ['gpt', 'dall-e', 'o1-', 'o3-', 'o4-'],
    email: 'openai@gakrcli-code-best.win',
  },
  { keywords: ['gemini'], email: 'google-gemini@gakrcli.win' },
  { keywords: ['grok'], email: 'xai-org@gakrcli.win' },
  { keywords: ['glm'], email: 'zai-org@gakrcli.win' },
  { keywords: ['deepseek'], email: 'deepseek-ai@gakrcli.win' },
  { keywords: ['qwen'], email: 'QwenLM@gakrcli.win' },
  { keywords: ['minimax'], email: 'MiniMax-AI@gakrcli.win' },
  { keywords: ['mimo'], email: 'XiaomiMiMo@gakrcli.win' },
  { keywords: ['kimi'], email: 'MoonshotAI@gakrcli.win' },
]

export function getAttributionEmail(modelName: string): string {
  const lower = modelName.toLowerCase()
  for (const { keywords, email } of MODEL_EMAIL_MAP) {
    if (keywords.some(kw => lower.includes(kw))) {
      return email
    }
  }
  return 'noreply@gakrcli.com'
}
