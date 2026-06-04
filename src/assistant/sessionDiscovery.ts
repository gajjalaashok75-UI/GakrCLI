/**
 * Open-build assistant session discovery.
 *
 * The cloud assistant daemon/session discovery backend is not included in this
 * source mirror. Keep the export shape intact so KAIROS builds can start and
 * local assistant mode can run without a missing-module stub.
 */
export type AssistantSession = {
  id: string
  name?: string
  cwd?: string
  updatedAt?: string
}

export async function discoverAssistantSessions(): Promise<AssistantSession[]> {
  throw new Error(
    'Assistant session discovery is not available in this open build. Local assistant mode can still start from settings.assistant or --assistant.',
  )
}
