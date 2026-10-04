/**
 * @fileoverview Keepalive Manager
 * @description Global singleton service for managing Service Worker keepalive.
 *
 * Uses chrome.alarms API to keep the service worker alive.
 */

const LOG_PREFIX = '[KeepaliveManager]';
const ALARM_NAME = 'sw-keepalive';

const keepaliveTags = new Set<string>();

// Start the keepalive alarm
function ensureAlarm(): void {
  if (keepaliveTags.size === 0) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.45 });
    console.debug(`${LOG_PREFIX} Alarm started`);
  }
}

// Stop the keepalive alarm if no references held
function maybeStopAlarm(): void {
  if (keepaliveTags.size === 0) {
    chrome.alarms.clear(ALARM_NAME);
    console.debug(`${LOG_PREFIX} Alarm stopped`);
  }
}

/**
 * Acquire a keepalive reference with a tag.
 *
 * @param tag - Identifier for the reference (e.g., 'native-host')
 * @returns A release function to call when keepalive is no longer needed
 */
export function acquireKeepalive(tag: string): () => void {
  keepaliveTags.add(tag);
  ensureAlarm();
  console.debug(`${LOG_PREFIX} Acquired keepalive for tag: ${tag}`);
  return () => {
    keepaliveTags.delete(tag);
    maybeStopAlarm();
    console.debug(`${LOG_PREFIX} Released keepalive for tag: ${tag}`);
  };
}

/**
 * Check if keepalive is currently active (any references held).
 */
export function isKeepaliveActive(): boolean {
  return keepaliveTags.size > 0;
}

/**
 * Get the current keepalive reference count.
 */
export function getKeepaliveRefCount(): number {
  return keepaliveTags.size;
}
