import { feature } from 'bun:bundle'

export const MEMORY_TYPE_VALUES = [
  'User',
  'Project',
  'Local',
  'Managed',
  'AutoMem',
  ...(feature('TEAMMEM') ? (['TeamMem'] as const) : []),
] as const

export type MemoryType =
  | (typeof MEMORY_TYPE_VALUES)[number]
  // Workspace context files (gakrcli.md, soul.md, ...) are loaded by
  // gakrclimd.ts but are not part of the persisted memory dir layout.
  | 'Workspace'
