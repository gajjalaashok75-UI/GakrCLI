/**
 * Open-build KAIROS gate.
 *
 * Private builds can replace this with entitlement-backed checks. In this
 * source mirror, enabling the KAIROS build flag means local assistant mode is
 * allowed whenever startup already requested it via settings or --assistant.
 */
export async function isKairosEnabled(): Promise<boolean> {
  return true
}
