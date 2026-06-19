// Content for the gakrcli-api bundled skill.
// Each .md file is inlined as a string at build time via Bun's text loader.

import csharpGakrCLIApi from './gakrcli-api/csharp/gakrcli-api.md'
import curlExamples from './gakrcli-api/curl/examples.md'
import goGakrCLIApi from './gakrcli-api/go/gakrcli-api.md'
import javaGakrCLIApi from './gakrcli-api/java/gakrcli-api.md'
import phpGakrCLIApi from './gakrcli-api/php/gakrcli-api.md'
import pythonAgentSdkPatterns from './gakrcli-api/python/agent-sdk/patterns.md'
import pythonAgentSdkReadme from './gakrcli-api/python/agent-sdk/README.md'
import pythonGakrCLIApiBatches from './gakrcli-api/python/gakrcli-api/batches.md'
import pythonGakrCLIApiFilesApi from './gakrcli-api/python/gakrcli-api/files-api.md'
import pythonGakrCLIApiReadme from './gakrcli-api/python/gakrcli-api/README.md'
import pythonGakrCLIApiStreaming from './gakrcli-api/python/gakrcli-api/streaming.md'
import pythonGakrCLIApiToolUse from './gakrcli-api/python/gakrcli-api/tool-use.md'
import rubyGakrCLIApi from './gakrcli-api/ruby/gakrcli-api.md'
import skillPrompt from './gakrcli-api/SKILL.md'
import sharedErrorCodes from './gakrcli-api/shared/error-codes.md'
import sharedLiveSources from './gakrcli-api/shared/live-sources.md'
import sharedModels from './gakrcli-api/shared/models.md'
import sharedPromptCaching from './gakrcli-api/shared/prompt-caching.md'
import sharedToolUseConcepts from './gakrcli-api/shared/tool-use-concepts.md'
import typescriptAgentSdkPatterns from './gakrcli-api/typescript/agent-sdk/patterns.md'
import typescriptAgentSdkReadme from './gakrcli-api/typescript/agent-sdk/README.md'
import typescriptGakrCLIApiBatches from './gakrcli-api/typescript/gakrcli-api/batches.md'
import typescriptGakrCLIApiFilesApi from './gakrcli-api/typescript/gakrcli-api/files-api.md'
import typescriptGakrCLIApiReadme from './gakrcli-api/typescript/gakrcli-api/README.md'
import typescriptGakrCLIApiStreaming from './gakrcli-api/typescript/gakrcli-api/streaming.md'
import typescriptGakrCLIApiToolUse from './gakrcli-api/typescript/gakrcli-api/tool-use.md'

// @[MODEL LAUNCH]: Update the model IDs/names below. These are substituted into {{VAR}}
// placeholders in the .md files at runtime before the skill prompt is sent.
// After updating these constants, manually update the two files that still hardcode models:
//   - gakrcli-api/SKILL.md (Current Models pricing table)
//   - gakrcli-api/shared/models.md (full model catalog with legacy versions and alias mappings)
export const SKILL_MODEL_VARS = {
  OPUS_ID: 'claude-opus-4-6',
  OPUS_NAME: 'claude opus 4.6',
  SONNET_ID: 'claude-sonnet-4-6',
  SONNET_NAME: 'claude sonnet 4.6',
  HAIKU_ID: 'claude-haiku-4-5',
  HAIKU_NAME: 'claude haiku 4.5',
  // Previous Sonnet ID — used in "do not append date suffixes" example in SKILL.md.
  PREV_SONNET_ID: 'claude-sonnet-4-5',
} satisfies Record<string, string>

export const SKILL_PROMPT: string = skillPrompt

export const SKILL_FILES: Record<string, string> = {
  'csharp/gakrcli-api.md': csharpGakrCLIApi,
  'curl/examples.md': curlExamples,
  'go/gakrcli-api.md': goGakrCLIApi,
  'java/gakrcli-api.md': javaGakrCLIApi,
  'php/gakrcli-api.md': phpGakrCLIApi,
  'python/agent-sdk/README.md': pythonAgentSdkReadme,
  'python/agent-sdk/patterns.md': pythonAgentSdkPatterns,
  'python/gakrcli-api/README.md': pythonGakrCLIApiReadme,
  'python/gakrcli-api/batches.md': pythonGakrCLIApiBatches,
  'python/gakrcli-api/files-api.md': pythonGakrCLIApiFilesApi,
  'python/gakrcli-api/streaming.md': pythonGakrCLIApiStreaming,
  'python/gakrcli-api/tool-use.md': pythonGakrCLIApiToolUse,
  'ruby/gakrcli-api.md': rubyGakrCLIApi,
  'shared/error-codes.md': sharedErrorCodes,
  'shared/live-sources.md': sharedLiveSources,
  'shared/models.md': sharedModels,
  'shared/prompt-caching.md': sharedPromptCaching,
  'shared/tool-use-concepts.md': sharedToolUseConcepts,
  'typescript/agent-sdk/README.md': typescriptAgentSdkReadme,
  'typescript/agent-sdk/patterns.md': typescriptAgentSdkPatterns,
  'typescript/gakrcli-api/README.md': typescriptGakrCLIApiReadme,
  'typescript/gakrcli-api/batches.md': typescriptGakrCLIApiBatches,
  'typescript/gakrcli-api/files-api.md': typescriptGakrCLIApiFilesApi,
  'typescript/gakrcli-api/streaming.md': typescriptGakrCLIApiStreaming,
  'typescript/gakrcli-api/tool-use.md': typescriptGakrCLIApiToolUse,
}
