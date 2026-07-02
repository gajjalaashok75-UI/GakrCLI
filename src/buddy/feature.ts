import { feature } from 'bun:bundle'

export function isBuddyEnabled(): boolean {
  return feature('BUDDY')
}
