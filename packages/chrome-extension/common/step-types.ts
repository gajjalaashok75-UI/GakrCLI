// step-types.ts — re-export shared constants to keep single source of truth
export { STEP_TYPES } from '@gakr-gakr/mcp-chrome-shared';
export type StepTypeConst =
  (typeof import('@gakr-gakr/mcp-chrome-shared'))['STEP_TYPES'][keyof (typeof import('@gakr-gakr/mcp-chrome-shared'))['STEP_TYPES']];
