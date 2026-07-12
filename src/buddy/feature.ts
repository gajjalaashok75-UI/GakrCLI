import { feature } from 'bun:bundle'

export function isBuddyEnabled(): boolean {
  if (feature('BUDDY')) return true
  return false
}
