/**
 * Assistant mode (KAIROS-gated) entry points.
 *
 * The closed-source implementation latches assistant mode, pre-seeds an
 * in-process team, and contributes a system-prompt addendum. This
 * open-source build ships inert no-ops: the KAIROS feature flag is
 * disabled, isAssistantMode() always reports false, and the remaining
 * functions return honest empty values.
 */

import type { AppState } from '../state/AppStateStore.js'

let assistantForced = false
let activationPath: string | undefined

/** Whether this process is running as an assistant-mode session. */
export function isAssistantMode(): boolean {
  return assistantForced
}

/**
 * --assistant (Agent SDK daemon mode): force the assistant latch without
 * re-checking entitlement.
 */
export function markAssistantForced(): void {
  assistantForced = true
  if (!activationPath) activationPath = '--assistant'
}

/** Whether the assistant latch was forced via --assistant. */
export function isAssistantForced(): boolean {
  return assistantForced
}

/**
 * Pre-seed an in-process team so Agent(name) spawns teammates without
 * TeamCreate. Returns no team context in this build.
 */
export async function initializeAssistantTeam(): Promise<
  AppState['teamContext'] | undefined
> {
  return undefined
}

/** System-prompt addendum for assistant-mode sessions. */
export function getAssistantSystemPromptAddendum(): string {
  return `# Assistant Mode

This is an open build of GakrCLI. Cloud assistant backend features may be unavailable.

Local assistant features:
- Discover and connect to assistant sessions in your workspace
- Use Agent(name) for spawning teammate agents
- Manual tool-use flows with human-in-the-loop approval`
}

/**
 * How assistant mode was activated for this session (telemetry label,
 * e.g. forced via --assistant vs. entitlement gate). Undefined in this
 * build — assistant mode never activates.
 */
export function getAssistantActivationPath(): string | undefined {
  return activationPath
}

/**
 * Whether this build supports remote assistant sessions (cloud backend).
 * Always false in the open build.
 */
export function supportsRemoteAssistantSessions(): boolean {
  return false
}
