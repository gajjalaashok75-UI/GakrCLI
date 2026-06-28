import { type DOMElement, useAnimationFrame } from '../../ink.js'

const RIPPLE_INTERVAL_MS = 60

/**
 * Ultracode ripple animation hook.
 *
 * Design:
 * - Subscribes to the clock only when enabled=true (cursor === 'ultracode' or fade-out not complete);
 *   when passed null, useAnimationFrame does not subscribe to ClockContext, setInterval won't fire.
 * - Returns [ref, time]: ref attaches to the ripple container (drives viewport-pause),
 *   time is used by computeRippleLine to calculate ripple phases per row.
 *
 * When enabled=false, returns time=0 (downstream skips rendering the ripple layer based on enabled;
 * 0 is still a valid value, preventing accidental NaN phase output).
 *
 * Note: Callers should pass showingRipple (on ultracode || fade > 0), not rippleActive,
 * so the clock keeps ticking during exit animation for the fade useEffect to trigger.
 */
export function useRippleFrame(
  enabled: boolean,
): [ref: (element: DOMElement | null) => void, time: number] {
  const [ref, time] = useAnimationFrame(enabled ? RIPPLE_INTERVAL_MS : null)
  return [ref, enabled ? time : 0]
}
