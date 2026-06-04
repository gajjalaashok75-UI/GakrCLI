// Assistant module entry point for the open build.
//
// The private cloud assistant backend is not mirrored here, but the KAIROS
// build flag can still enable local assistant-mode behavior. Keep this shim
// deliberately small: it provides the exports that KAIROS-gated startup paths
// expect, while leaving remote assistant/session discovery to the modules that
// actually exist in this checkout.

import { getInitialSettings } from '../utils/settings/settings.js'
export { default as AssistantSessionChooser } from './AssistantSessionChooser.js'

let assistantForced = false

export function markAssistantForced(): void {
  assistantForced = true
}

export function isAssistantForced(): boolean {
  return assistantForced
}

export function isAssistantMode(): boolean {
  return assistantForced || getInitialSettings().assistant === true
}

export async function initializeAssistantTeam(): Promise<undefined> {
  return undefined
}

export function getAssistantSystemPromptAddendum(): string {
  return [
    '# Assistant Mode',
    '',
    'You are running in GakrCLI assistant mode. Stay responsive, use brief user-facing updates when available, and keep long-running shell work in the background instead of blocking the main conversation.',
    '',
    'This open build provides local assistant-mode behavior. Cloud assistant backend features may be unavailable unless the corresponding private backend modules are present.',
  ].join('\n')
}

export function getAssistantActivationPath(): string {
  return assistantForced ? '--assistant' : 'settings.assistant'
}

export function supportsRemoteAssistantSessions(): boolean {
  return false
}
