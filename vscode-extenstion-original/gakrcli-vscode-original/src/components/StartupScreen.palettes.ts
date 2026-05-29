/**
 * Color palettes for the startup splash logo.
 * Selected via /logo, persisted in GlobalConfig.logoColor.
 */

import type { RGBColor } from '../ink/styles.js'

export type RGB = readonly [number, number, number]

export type LogoPalette = {
  gradient: readonly RGB[]
  accent: RGB
  cream: RGB
  dim: RGB
  border: RGB
}

export const LOGO_PALETTES = {
  sky: {
    gradient: [
      [170, 210, 235],
      [135, 185, 220],
      [114, 198, 237],
      [90, 160, 210],
      [70, 140, 185],
    ],
    accent: [114, 198, 237],
    cream: [180, 160, 140],
    dim: [135, 185, 220],
    border: [70, 140, 185],
  },
  sunset: {
    gradient: [
      [255, 180, 100],
      [240, 140, 80],
      [217, 119, 87],
      [193, 95, 60],
      [160, 75, 55],
      [130, 60, 50],
    ],
    accent: [240, 148, 100],
    cream: [220, 195, 170],
    dim: [120, 100, 82],
    border: [100, 80, 65],
  },
  forest: {
    gradient: [
      [180, 240, 170],
      [130, 215, 130],
      [85, 180, 95],
      [55, 145, 75],
      [40, 110, 60],
      [25, 80, 45],
    ],
    accent: [120, 200, 120],
    cream: [200, 220, 190],
    dim: [90, 120, 90],
    border: [70, 95, 70],
  },
  ocean: {
    gradient: [
      [170, 220, 255],
      [125, 185, 240],
      [80, 150, 220],
      [55, 115, 190],
      [40, 85, 150],
      [25, 55, 110],
    ],
    accent: [110, 180, 230],
    cream: [195, 215, 235],
    dim: [90, 115, 145],
    border: [70, 90, 115],
  },
  monochrome: {
    gradient: [
      [225, 225, 225],
      [195, 195, 195],
      [160, 160, 160],
      [125, 125, 125],
      [95, 95, 95],
      [70, 70, 70],
    ],
    accent: [200, 200, 200],
    cream: [210, 210, 210],
    dim: [120, 120, 120],
    border: [95, 95, 95],
  },
} as const satisfies Record<string, LogoPalette>

export type LogoPaletteName = keyof typeof LOGO_PALETTES

export const LOGO_PALETTE_NAMES = Object.keys(LOGO_PALETTES) as LogoPaletteName[]

export const DEFAULT_LOGO_PALETTE: LogoPaletteName = 'sky'

export const LOGO_PALETTE_LABELS: Record<LogoPaletteName, string> = {
  sky: 'Sky blue (default)',
  sunset: 'Sunset',
  forest: 'Forest green',
  ocean: 'Ocean blue',
  monochrome: 'Monochrome',
}

export function isLogoPaletteName(value: unknown): value is LogoPaletteName {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(LOGO_PALETTES, value)
  )
}

export function resolveLogoPalette(name: string | undefined): LogoPalette {
  return isLogoPaletteName(name)
    ? LOGO_PALETTES[name]
    : LOGO_PALETTES[DEFAULT_LOGO_PALETTE]
}

export type LogoSpinnerColors = {
  accent: RGBColor
  shimmer: RGBColor
}

export function rgbToInkColor([r, g, b]: RGB): RGBColor {
  return `rgb(${r},${g},${b})`
}

export function resolveLogoSpinnerColors(
  name: string | undefined,
): LogoSpinnerColors {
  const palette = resolveLogoPalette(name)
  return {
    accent: rgbToInkColor(palette.accent),
    shimmer: rgbToInkColor(palette.gradient[0] ?? palette.accent),
  }
}
