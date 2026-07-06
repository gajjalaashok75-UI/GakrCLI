import { AgentAdapterRegistry } from './engine/index.js'
import { gakrcliCodeBackend } from './backends/gakrcliBackend.js'

/**
 * Build a multi-backend registry. v1 (depth B) only registers a single
 * gakrcli-code adapter as default, without prefilling routing rules — add
 * .route(...) when extending with a second provider adapter.
 */
export function buildRegistry(): AgentAdapterRegistry {
  const reg = new AgentAdapterRegistry()
  reg.register(gakrcliCodeBackend).default('gakrcli-code')
  return reg
}
