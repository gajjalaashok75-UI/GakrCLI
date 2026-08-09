// Stub — skillSearch not included in source snapshot (feature-gated).
// Only the DiscoverySignal type is consumed (in the skill_discovery
// attachment); it is erased at compile time.

/**
 * A skill-discovery pass signal attached to `skill_discovery` attachments.
 * The trigger is an open string union — known members are listed for
 * readability, but the field is telemetry-only.
 */
export type DiscoverySignal = {
  /** What triggered the discovery pass. */
  trigger:
    | 'user_input'
    | 'assistant_turn'
    | 'write_pivot'
    | 'subagent_spawn'
    | (string & {})
  queryText: string
  startedAt: number
  durationMs: number
  indexSize: number
  method: string
}
