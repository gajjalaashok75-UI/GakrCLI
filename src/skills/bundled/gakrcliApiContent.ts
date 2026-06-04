// Content for the gakrcli-api bundled skill.
// Each .md file is inlined as a string at build time via Bun's text loader.

import csharpgakrcliApi from './gakrcli-api/csharp/gakrcli-api.md'
import curlExamples from './gakrcli-api/curl/examples.md'
import gogakrcliApi from './gakrcli-api/go/gakrcli-api.md'
import javagakrcliApi from './gakrcli-api/java/gakrcli-api.md'
import phpgakrcliApi from './gakrcli-api/php/gakrcli-api.md'
import pythonAgentSdkPatterns from './gakrcli-api/python/agent-sdk/patterns.md'
import pythonAgentSdkReadme from './gakrcli-api/python/agent-sdk/README.md'
import pythongakrcliApiBatches from './gakrcli-api/python/gakrcli-api/batches.md'
import pythongakrcliApiFilesApi from './gakrcli-api/python/gakrcli-api/files-api.md'
import pythongakrcliApiReadme from './gakrcli-api/python/gakrcli-api/README.md'
import pythongakrcliApiStreaming from './gakrcli-api/python/gakrcli-api/streaming.md'
import pythongakrcliApiToolUse from './gakrcli-api/python/gakrcli-api/tool-use.md'
import rubygakrcliApi from './gakrcli-api/ruby/gakrcli-api.md'
import skillPrompt from './gakrcli-api/SKILL.md'
import sharedErrorCodes from './gakrcli-api/shared/error-codes.md'
import sharedLiveSources from './gakrcli-api/shared/live-sources.md'
import sharedModels from './gakrcli-api/shared/models.md'
import sharedPromptCaching from './gakrcli-api/shared/prompt-caching.md'
import sharedToolUseConcepts from './gakrcli-api/shared/tool-use-concepts.md'
import typescriptAgentSdkPatterns from './gakrcli-api/typescript/agent-sdk/patterns.md'
import typescriptAgentSdkReadme from './gakrcli-api/typescript/agent-sdk/README.md'
import typescriptgakrcliApiBatches from './gakrcli-api/typescript/gakrcli-api/batches.md'
import typescriptgakrcliApiFilesApi from './gakrcli-api/typescript/gakrcli-api/files-api.md'
import typescriptgakrcliApiReadme from './gakrcli-api/typescript/gakrcli-api/README.md'
import typescriptgakrcliApiStreaming from './gakrcli-api/typescript/gakrcli-api/streaming.md'
import typescriptgakrcliApiToolUse from './gakrcli-api/typescript/gakrcli-api/tool-use.md'

// @[MODEL LAUNCH]: Update the model IDs/names below. These are substituted into {{VAR}}
// placeholders in the .md files at runtime before the skill prompt is sent.
// After updating these constants, manually update the two files that still hardcode models:
//   - gakrcli-api/SKILL.md (Current Models pricing table)
//   - gakrcli-api/shared/models.md (full model catalog with legacy versions and alias mappings)
export const SKILL_MODEL_VARS = {
  OPUS_ID: 'gakrcli-opus-4-6',
  OPUS_NAME: 'GakrCLI Opus 4.6',
  SONNET_ID: 'gakrcli-sonnet-4-6',
  SONNET_NAME: 'GakrCLI Sonnet 4.6',
  HAIKU_ID: 'gakrcli-haiku-4-5',
  HAIKU_NAME: 'GakrCLI Haiku 4.5',
  // Previous Sonnet ID — used in "do not append date suffixes" example in SKILL.md.
  PREV_SONNET_ID: 'gakrcli-sonnet-4-5',
} satisfies Record<string, string>

export const SKILL_PROMPT: string = skillPrompt

export const SKILL_FILES: Record<string, string> = {
  'csharp/gakrcli-api.md': csharpgakrcliApi,
  'curl/examples.md': curlExamples,
  'go/gakrcli-api.md': gogakrcliApi,
  'java/gakrcli-api.md': javagakrcliApi,
  'php/gakrcli-api.md': phpgakrcliApi,
  'python/agent-sdk/README.md': pythonAgentSdkReadme,
  'python/agent-sdk/patterns.md': pythonAgentSdkPatterns,
  'python/gakrcli-api/README.md': pythongakrcliApiReadme,
  'python/gakrcli-api/batches.md': pythongakrcliApiBatches,
  'python/gakrcli-api/files-api.md': pythongakrcliApiFilesApi,
  'python/gakrcli-api/streaming.md': pythongakrcliApiStreaming,
  'python/gakrcli-api/tool-use.md': pythongakrcliApiToolUse,
  'ruby/gakrcli-api.md': rubygakrcliApi,
  'shared/error-codes.md': sharedErrorCodes,
  'shared/live-sources.md': sharedLiveSources,
  'shared/models.md': sharedModels,
  'shared/prompt-caching.md': sharedPromptCaching,
  'shared/tool-use-concepts.md': sharedToolUseConcepts,
  'typescript/agent-sdk/README.md': typescriptAgentSdkReadme,
  'typescript/agent-sdk/patterns.md': typescriptAgentSdkPatterns,
  'typescript/gakrcli-api/README.md': typescriptgakrcliApiReadme,
  'typescript/gakrcli-api/batches.md': typescriptgakrcliApiBatches,
  'typescript/gakrcli-api/files-api.md': typescriptgakrcliApiFilesApi,
  'typescript/gakrcli-api/streaming.md': typescriptgakrcliApiStreaming,
  'typescript/gakrcli-api/tool-use.md': typescriptgakrcliApiToolUse,
}
