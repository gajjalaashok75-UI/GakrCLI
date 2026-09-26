/**
 * Built-in MCP Server Registry
 *
 * Mirrors the built-in plugin registry (src/plugins/builtinPlugins.ts) and the
 * bundled skill registry (src/skills/bundledSkills.ts): a Map populated by
 * `register*` calls, so adding a built-in MCP server is one registration
 * instead of an edit to the MCP config layer.
 *
 * Registration is lazy on first read (see `ensureBuiltinMcpServersRegistered`)
 * rather than requiring explicit startup wiring. Two reasons:
 *
 *  - The reserved-name check in main.tsx runs *before* the startup block that
 *    calls initBuiltinPlugins()/initBundledSkills(), so a registry that needed
 *    explicit init would read empty there.
 *  - The MCP config layer is imported by entrypoints that never run main.tsx
 *    startup at all (print/headless, standalone MCP mode, sub-agent runs). The
 *    previous hardcoded `getBuiltinMcpServerConfigs()` resolved at read time
 *    and so worked on all of them; a registry requiring explicit init would
 *    silently drop built-ins on those paths.
 *
 * main.tsx still calls initBuiltinMcpServers() for deterministic ordering; the
 * lazy path is the safety net for every other caller.
 */

import { normalizeNameForMCP } from './normalization.js'
import type { ScopedMcpServerConfig } from './types.js'

export type BuiltinMcpServerDefinition = {
  name: string
  /**
   * Builds the server config on demand. Deferred rather than a value so a
   * built-in can keep heavy or vendored imports out of the eager module graph
   * of services/mcp/config.ts.
   */
  getConfig: () => ScopedMcpServerConfig
  /**
   * false → registered but opt-in. It still appears in /mcp while disabled and
   * is enabled via `enabledMcpServers` (rather than disabled via
   * `disabledMcpServers`, which is how user-authored servers work).
   * Defaults to true.
   */
  defaultEnabled?: boolean
  /**
   * Omit the built-in entirely when this returns false. Use for built-ins that
   * are only meaningful on some platforms or when a dependency is present.
   */
  isAvailable?: () => boolean
}

const BUILTIN_MCP_SERVERS: Map<string, BuiltinMcpServerDefinition> = new Map()

let initialized = false

/**
 * Register a built-in MCP server. Call this from initBuiltinMcpServers().
 * Re-registering a name replaces it (keeps tests and hot reloads idempotent).
 */
export function registerBuiltinMcpServer(
  definition: BuiltinMcpServerDefinition,
): void {
  BUILTIN_MCP_SERVERS.set(definition.name, definition)
}

/**
 * Populate the registry exactly once. Lazy so that any caller of the MCP
 * config layer — including entrypoints that never run main.tsx startup — sees
 * built-ins without having to wire up initialization.
 */
function ensureBuiltinMcpServersRegistered(): void {
  if (initialized) return
  // Set before the require so a re-entrant call can't loop.
  initialized = true
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initBuiltinMcpServers } = require('./bundled/index.js') as typeof import('./bundled/index.js')
  initBuiltinMcpServers()
}

function availableDefinitions(): BuiltinMcpServerDefinition[] {
  ensureBuiltinMcpServersRegistered()
  const out: BuiltinMcpServerDefinition[] = []
  for (const definition of BUILTIN_MCP_SERVERS.values()) {
    if (definition.isAvailable && !definition.isAvailable()) continue
    out.push(definition)
  }
  return out
}

/**
 * All registered built-in server configs, keyed by name. This is the
 * registry-backed replacement for the previously hardcoded function of the
 * same name.
 */
export function getBuiltinMcpServerConfigs(): Record<
  string,
  ScopedMcpServerConfig
> {
  const configs: Record<string, ScopedMcpServerConfig> = {}
  for (const definition of availableDefinitions()) {
    configs[definition.name] = definition.getConfig()
  }
  return configs
}

/** Look up a registered built-in by name (normalized). */
export function getBuiltinMcpServerDefinition(
  name: string,
): BuiltinMcpServerDefinition | undefined {
  const normalized = normalizeNameForMCP(name)
  return availableDefinitions().find(d => d.name === normalized)
}

/**
 * True when `name` is a registered built-in. Used to reserve built-in names
 * against user MCP config so a user entry can't shadow a built-in.
 */
export function isBuiltinMcpServerName(name: string): boolean {
  return getBuiltinMcpServerDefinition(name) !== undefined
}

/**
 * Canonical name of the first entry in `names` that is a reserved built-in.
 * Returns undefined when none match. Lets callers report the canonical name
 * even when the user supplied a differently-cased variant.
 */
export function findReservedBuiltinMcpServerName(
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const definition = getBuiltinMcpServerDefinition(name)
    if (definition) return definition.name
  }
  return undefined
}

/**
 * Built-ins that are opt-in: disabled until the user adds them to
 * `enabledMcpServers`. Drives the inverted enable/disable semantics in
 * isMcpServerDisabled()/setMcpServerEnabled().
 */
export function isDefaultDisabledBuiltinMcpServer(name: string): boolean {
  return getBuiltinMcpServerDefinition(name)?.defaultEnabled === false
}

/** Clear the registry (for testing). */
export function clearBuiltinMcpServers(): void {
  BUILTIN_MCP_SERVERS.clear()
  initialized = true
}
