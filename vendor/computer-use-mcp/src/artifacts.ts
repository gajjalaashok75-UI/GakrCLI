/**
 * On-disk artifacts for Computer Use (screenshots the caller asks to keep).
 *
 * Mirrors the browser tool's `.agent_tmp` convention so transient captures
 * stay session-scoped scratch data and are never committed.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const COMPUTER_USE_OUTPUT_DIR = path.join('.agent_tmp', 'computer_use')

const MAX_ARTIFACT_NAME_LENGTH = 120

let ensured = false

function ensureOutputDir(): void {
  if (ensured) return
  mkdirSync(COMPUTER_USE_OUTPUT_DIR, { recursive: true })
  ensured = true
}

/** Sanitize a caller-supplied name and force a .png extension. */
function sanitizeFileName(input: string): string {
  // Strip path segments up front so ".." can't survive as ".._.._evil" and
  // "/" can't fold subdirs into the path. We still run the character filter
  // after to handle shell metacharacters and whitespace.
  const basenameOnly = path.basename(String(input ?? '').trim())
  const safe = basenameOnly
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, MAX_ARTIFACT_NAME_LENGTH)
  const stripped = safe.replace(/\.png$/i, '')
  return `${stripped}.png`
}

/**
 * Write a base64 PNG/JPEG screenshot to the output directory.
 * Returns the absolute-ish path so it can be reported back to the caller.
 */
export function saveScreenshotArtifact(
  base64: string,
  requestedName?: string,
): string {
  ensureOutputDir()
  const name = sanitizeFileName(
    requestedName?.trim() || `screenshot-${Date.now()}`,
  )
  const filePath = path.join(COMPUTER_USE_OUTPUT_DIR, name)
  writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return filePath
}
