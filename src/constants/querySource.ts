/**
 * Identifies the business source of a model/API request.
 * Used for telemetry segmentation, cache control, and 529 retry policies.
 *
 * Since the set of values expands as features grow (including prefixes such as
 * `repl_main_thread:*`, `agent:*`, and others), this type is defined as `string`.
 *
 * Common literal values can be found at the respective call sites and in
 * `FOREGROUND_529_RETRY_SOURCES` within `withRetry.ts`.
 */
export type QuerySource = string; // Free-form source label aligned with the `source` field used in logs and analytics.