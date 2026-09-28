import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'bun:test'
import {
  COMPUTER_USE_OUTPUT_DIR,
  saveScreenshotArtifact,
} from '@ant/computer-use-mcp/artifacts';

// 1x1 transparent PNG.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

afterAll(() => {
  rmSync(COMPUTER_USE_OUTPUT_DIR, { recursive: true, force: true })
})

describe('computer-use screenshot artifacts', () => {
  it('writes a decodable PNG under .agent_tmp/computer_use', () => {
    const filePath = saveScreenshotArtifact(PNG_B64, 'unit-test-shot')

    expect(filePath).toContain(path.join('.agent_tmp', 'computer_use'))
    expect(filePath.endsWith('.png')).toBe(true)
    expect(existsSync(filePath)).toBe(true)

    // Round-trips to the exact bytes of the source image.
    const written = readFileSync(filePath)
    expect(written.equals(Buffer.from(PNG_B64, 'base64'))).toBe(true)
  })

  it('sanitizes a caller-supplied name and forces .png', () => {
    // Path traversal and shell metacharacters must not reach the filesystem.
    const filePath = saveScreenshotArtifact(PNG_B64, '../../evil name?.png')

    expect(path.basename(filePath)).toBe('evil_name_.png')
    expect(filePath).not.toContain('..')
    expect(existsSync(filePath)).toBe(true)
  })

  it('generates a timestamped name when none is supplied', () => {
    const filePath = saveScreenshotArtifact(PNG_B64)

    expect(path.basename(filePath)).toMatch(/^screenshot-\d+\.png$/)
    expect(existsSync(filePath)).toBe(true)
  })
})
