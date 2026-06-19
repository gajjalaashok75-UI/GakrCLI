/**
 * GakrCLI brand identity — single source of truth for the product name,
 * tagline, accent color, and wordmark art used across the TUI.
 *
 * The accent is the gakr-gakr orange. Theme entries derived from it MUST stay
 * in `rgb(r,g,b)` form (never hex): the spinner's shimmer/stall interpolation
 * parses theme values with `parseRGB`, which only matches `rgb(...)` strings.
 */

export const BRAND_NAME = 'GakrCLI'

export const BRAND_TAGLINE = 'Open terminal for any LLM'

/** gakr-gakr orange (#ff7a1a) in the rgb() form required by theme consumers. */
export const BRAND_ACCENT_RGB = 'rgb(255,122,26)'

/**
 * Two-row Unicode half-block wordmark, split so the two halves can be
 * rendered in different accent shades. Block characters (█ ▀ ▄) render
 * correctly in Apple Terminal. Rendered side by side with a 1-col gap:
 *
 *   █▀█ █▀█ █▀▀ █▄ █ █▀▀ █   ▄▀█ █ █ █▀▄ █▀▀
 *   █▄█ █▀▀ ██▄ █ ▀█ █▄▄ █▄▄ █▀█ █▄█ █▄▀ ██▄
 */
export const WORDMARK_OPEN = [
  '█▀█ █▀█ █▀▀ █▄ █',
  '█▄█ █▀▀ ██▄ █ ▀█',
] as const

export const WORDMARK_GAKRCLI = [
  '█▀▀ █   ▄▀█ █ █ █▀▄ █▀▀',
  '█▄▄ █▄▄ █▀█ █▄█ █▄▀ ██▄',
] as const

/** Rendered width of the full wordmark: open half + 1-col gap + gakrcli half. */
export const WORDMARK_WIDTH =
  WORDMARK_OPEN[0].length + 1 + WORDMARK_GAKRCLI[0].length
