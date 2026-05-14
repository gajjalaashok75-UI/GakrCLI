import { c as _c } from "react-compiler-runtime";
import * as React from 'react';
import { Text, useTheme } from '../../ink.js';
import type { Color } from '../../ink/styles.js';
import { getTheme, type Theme } from '../../utils/theme.js';
import { interpolateColor, parseRGB, toRGBColor } from './utils.js';
type Props = {
  char: string;
  flashOpacity: number;
  messageColor: keyof Theme | Color;
  shimmerColor: keyof Theme | Color;
};
function resolveColorValue(color: keyof Theme | Color, theme: Theme): string | undefined {
  if (color.startsWith('rgb(') || color.startsWith('#') || color.startsWith('ansi256(') || color.startsWith('ansi:')) {
    return color;
  }
  return theme[color as keyof Theme];
}
export function FlashingChar(t0) {
  const $ = _c(9);
  const {
    char,
    flashOpacity,
    messageColor,
    shimmerColor
  } = t0;
  const [themeName] = useTheme();
  let t1;
  if ($[0] !== char || $[1] !== flashOpacity || $[2] !== messageColor || $[3] !== shimmerColor || $[4] !== themeName) {
    t1 = Symbol.for("react.early_return_sentinel");
    bb0: {
      const theme = getTheme(themeName);
      const baseColorStr = resolveColorValue(messageColor, theme);
      const shimmerColorStr = resolveColorValue(shimmerColor, theme);
      const baseRGB = baseColorStr ? parseRGB(baseColorStr) : null;
      const shimmerRGB = shimmerColorStr ? parseRGB(shimmerColorStr) : null;
      if (baseRGB && shimmerRGB) {
        const interpolated = interpolateColor(baseRGB, shimmerRGB, flashOpacity);
        t1 = <Text color={toRGBColor(interpolated)}>{char}</Text>;
        break bb0;
      }
    }
    $[0] = char;
    $[1] = flashOpacity;
    $[2] = messageColor;
    $[3] = shimmerColor;
    $[4] = themeName;
    $[5] = t1;
  } else {
    t1 = $[5];
  }
  if (t1 !== Symbol.for("react.early_return_sentinel")) {
    return t1;
  }
  const shouldUseShimmer = flashOpacity > 0.5;
  const t2 = shouldUseShimmer ? shimmerColor : messageColor;
  let t3;
  if ($[6] !== char || $[7] !== t2) {
    t3 = <Text color={t2}>{char}</Text>;
    $[6] = char;
    $[7] = t2;
    $[8] = t3;
  } else {
    t3 = $[8];
  }
  return t3;
}
