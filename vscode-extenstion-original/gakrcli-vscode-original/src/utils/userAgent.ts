/**
 * User-Agent string helpers.
 *
 * Kept dependency-free so SDK-bundled code (bridge, cli/transports) can
 * import without pulling in auth.ts and its transitive dependency tree.
 */

export function getgakrcliCodeUserAgent(): string {
  const macroValue = (globalThis as { MACRO?: { VERSION?: string } }).MACRO
  const version = macroValue?.VERSION ?? 'unknown'
  return `gakrcli-code/${version}`
}
