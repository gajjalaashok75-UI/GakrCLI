import type { ComponentProps } from 'react'
/**
 * Returns the relative path for a memory file
 * Stub for compatibility with memory command
 */
export function getRelativeMemoryPath(path: string): string {
  return path
}

/**
 * Dummy component - not used in Gakrcli
 */
export function MemoryUpdateNotification(props: ComponentProps<'div'>) {
  return null
}
