import * as React from 'react';
import { Box, Text } from '../../ink.js';
import { env } from '../../utils/env.js';
import { getGlobalConfig } from '../../utils/config.js';
import {
  resolveLogoPalette,
  rgbToInkColor,
  type LogoPalette,
} from '../StartupScreen.palettes.js';

/**
 * Row colors for the mascot, sampled top→bottom from the /logo palette
 * gradient — the same flow the startup splash uses. The socket (eye/body
 * background) uses the palette's dark `border` color instead of fixed black.
 */
function mascotColors(): { head: string; body: string; feet: string; socket: string } {
  const palette: LogoPalette = resolveLogoPalette(getGlobalConfig().logoColor);
  const { gradient, border } = palette;
  return {
    head: rgbToInkColor(gradient[0]),
    body: rgbToInkColor(gradient[2] ?? gradient[0]),
    feet: rgbToInkColor(gradient[gradient.length - 1]),
    socket: rgbToInkColor(border),
  };
}

export type ClawdPose =
  | 'default'
  | 'arms-up' // both arms raised (used during jump)
  | 'look-left' // both pupils shifted left
  | 'look-right'; // both pupils shifted right

type Props = {
  pose?: ClawdPose;
};

// Standard-terminal pose fragments. Each row is split into segments so we can
// vary only the parts that change (eyes, arms) while keeping the body/bg spans
// stable. All poses end up 9 cols wide.
//
// arms-up: the row-2 arm shapes (▝▜ / ▛▘) move to row 1 as their
// bottom-heavy mirrors (▗▟ / ▙▖) — same silhouette, one row higher.
//
// look-* use top-quadrant eye chars (▙/▟) so both eyes change from the
// default (▛/▜, bottom pupils) — otherwise only one eye would appear to move.
type Segments = {
  /** row 1 left (no bg): optional raised arm + side */
  r1L: string;
  /** row 1 eyes (with bg): left-eye, forehead, right-eye */
  r1E: string;
  /** row 1 right (no bg): side + optional raised arm */
  r1R: string;
  /** row 2 left (no bg): arm + body curve */
  r2L: string;
  /** row 2 right (no bg): body curve + arm */
  r2R: string;
};

const POSES: Record<ClawdPose, Segments> = {
  default: {
    r1L: ' ╭',
    r1E: '◌ ◌ ',
    r1R: '╮',
    r2L: ' ┆',
    r2R: '┆ '
  },
  'look-left': {
    r1L: ' ╭',
    r1E: '◔ ◌ ',
    r1R: '╮',
    r2L: ' ┆',
    r2R: '┆ '
  },
  'look-right': {
    r1L: ' ╭',
    r1E: '◌ ◔ ',
    r1R: '╮',
    r2L: ' ┆',
    r2R: '┆ '
  },
  'arms-up': {
    r1L: '\\╭',
    r1E: '◌ ◌ ',
    r1R: '╮/',
    r2L: ' ┆',
    r2R: '┆ '
  }
};

// Apple Terminal uses a bg-fill trick (see below), so only eye poses make
// sense. Arm poses fall back to default.
const APPLE_EYES: Record<ClawdPose, string> = {
  default: ' ◌ ◌  ',
  'look-left': ' ◔ ◌  ',
  'look-right': ' ◌ ◔  ',
  'arms-up': ' ◌ ◌  '
};

export function Clawd({ pose = 'default' }: Props = {}): React.ReactNode {
  if (env.terminal === 'Apple_Terminal') {
    return <AppleTerminalClawd pose={pose} />;
  }
  const p = POSES[pose];
  const colors = mascotColors();
  return (
    <Box flexDirection="column">
      <Text>
        <Text color={colors.head}>{p.r1L}</Text>
        <Text color={colors.head} backgroundColor={colors.socket}>
          {p.r1E}
        </Text>
        <Text color={colors.head}>{p.r1R}</Text>
      </Text>
      <Text>
        <Text color={colors.body}>{p.r2L}</Text>
        <Text color={colors.body} backgroundColor={colors.socket}>
          █████
        </Text>
        <Text color={colors.body}>{p.r2R}</Text>
      </Text>
      <Text color={colors.feet}>
        {'  '}▘▘ ▝▝{'  '}
      </Text>
    </Box>
  );
}

function AppleTerminalClawd({ pose }: { pose: ClawdPose }): React.ReactNode {
  // Apple's Terminal renders vertical space between chars by default.
  // It does NOT render vertical space between background colors
  // so we use background color to draw the main shape.
  const colors = mascotColors();
  return (
    <Box flexDirection="column" alignItems="center">
      <Text>
        <Text color={colors.head}>▗</Text>
        <Text color={colors.socket} backgroundColor={colors.head}>
          {APPLE_EYES[pose]}
        </Text>
        <Text color={colors.head}>▖</Text>
      </Text>
      <Text backgroundColor={colors.body}>{' '.repeat(7)}</Text>
      <Text color={colors.feet}>▘▘ ▝▝</Text>
    </Box>
  );
}
