/**
 * GAKRCLI brand identity — single source of truth for the product name,
 * tagline, accent color, and wordmark art used across the TUI.
 */

export const BRAND_NAME = 'GAKRCLI'

export const BRAND_TAGLINE = 'Open terminal for any LLM'

/**
 * GAKRCLI sky-blue accent (#72C6ED) in rgb() form.
 * Keep this in rgb(r,g,b) format for theme compatibility.
 */
export const BRAND_ACCENT_RGB = 'rgb(114,198,237)'

/**
 * GAKRCLI terminal wordmark.
 */
export const WORDMARK_GAKRCLI = [
  ' ██████╗  █████╗ ██╗  ██╗██████╗  ██████╗██╗     ██╗',
  '██╔════╝ ██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║     ██║',
  '██║  ███╗███████║█████╔╝ ██████╔╝██║     ██║     ██║',
  '██║   ██║██╔══██║██╔═██╗ ██╔══██╗██║     ██║     ██║',
  '╚██████╔╝██║  ██║██║  ██╗██║  ██║╚██████╗███████╗██║',
  ' ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝',
] as const

/** Rendered width of the full wordmark. */
export const WORDMARK_WIDTH = WORDMARK_GAKRCLI[0].length