import { describe, expect, mock, test } from 'bun:test'

// Self-contained mocks so this test is not affected by mock.module leaks from
// other test files that run in the same process.
const noop = () => {}

mock.module('bun:bundle', () => ({
  feature: (_name: string) => true,
}))

mock.module('src/utils/messages.ts', () => ({
  createUserMessage: noop,
  filterOrphanedThinkingOnlyMessages: (m: any[]) => m,
  filterUnresolvedToolUses: (m: any[]) => m,
  filterWhitespaceOnlyAssistantMessages: (m: any[]) => m,
  isCompactBoundaryMessage: () => false,
  extractTag: () => null,
  extractTextContent: (c: any[]) => c?.filter?.((b: any) => b.type === 'text')?.map?.((b: any) => b.text)?.join('') ?? '',
  getLastAssistantMessage: () => null,
  SYNTHETIC_MESSAGES: new Set(),
  INTERRUPT_MESSAGE: '',
  INTERRUPT_MESSAGE_FOR_TOOL_USE: '',
  CANCEL_MESSAGE: '',
  REJECT_MESSAGE: '',
  REJECT_MESSAGE_WITH_REASON_PREFIX: '',
  SUBAGENT_REJECT_MESSAGE: '',
  SUBAGENT_REJECT_MESSAGE_WITH_REASON_PREFIX: '',
  PLAN_REJECTION_PREFIX: '',
  DENIAL_WORKAROUND_GUIDANCE: '',
  NO_RESPONSE_REQUESTED: '',
  SYNTHETIC_TOOL_RESULT_PLACEHOLDER: '',
  SYNTHETIC_MODEL: '',
  AUTO_REJECT_MESSAGE: noop,
  DONT_ASK_REJECT_MESSAGE: noop,
  withMemoryCorrectionHint: (s: string) => s,
  deriveShortMessageId: () => '',
  isClassifierDenial: () => false,
  buildYoloRejectionMessage: () => '',
  buildClassifierUnavailableMessage: () => '',
  isEmptyMessageText: () => true,
  createAssistantMessage: noop,
  createAssistantAPIErrorMessage: noop,
  prepareUserContent: noop,
  createUserInterruptionMessage: noop,
  createSyntheticUserCaveatMessage: noop,
  formatCommandInputTags: noop,
  createSystemAPIErrorMessage: noop,
  normalizeMessagesForAPI: (m: any[]) => m,
}))

describe.skip('resumeAgent', () => {
  test('module exports resumeAgentBackground', async () => {
    const mod = await import('../resumeAgent.js')
    expect(typeof mod.resumeAgentBackground).toBe('function')
  })

  test('module exports ResumeAgentResult type (compile-time)', async () => {
    const mod = await import('../resumeAgent.js')
    expect(mod).toBeDefined()
  })
})
