/**
 * Tests for attachment handling on the agent server.
 *
 * These pin the three things the side panel needs from an attachment: the image
 * content block that actually reaches the model, the saved copy the panel
 * renders its thumbnail from, and the urlPath it fetches that copy from.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AgentAttachment } from './contract.js'
import { prepareAttachments, resolveAttachmentPath } from './attachments.js'
import { getProjectAttachmentsDir } from './store.js'

let tmpRoot: string

function base64(text: string): string {
  return Buffer.from(text).toString('base64')
}

function attachment(overrides: Partial<AgentAttachment>): AgentAttachment {
  return {
    type: 'file',
    name: 'file.txt',
    mimeType: 'text/plain',
    dataBase64: base64('content'),
    ...overrides,
  }
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'chrome-attachments-test-'))
  process.env.GAKR_CONFIG_DIR = tmpRoot
})

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true })
  delete process.env.GAKR_CONFIG_DIR
})

describe('prepareAttachments', () => {
  it('sends an image inline and saves a copy for the panel', async () => {
    const prepared = await prepareAttachments(
      [
        attachment({
          type: 'image',
          name: 'shot.png',
          mimeType: 'image/png',
          dataBase64: base64('png-bytes'),
        }),
      ],
      'p1',
      'm1',
    )

    expect(prepared.blocks).toEqual([
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: base64('png-bytes'),
        },
      },
    ])

    const meta = prepared.metadata[0]
    expect(meta).toMatchObject({
      version: 1,
      kind: 'image',
      projectId: 'p1',
      messageId: 'm1',
      index: 0,
      mimeType: 'image/png',
      sizeBytes: 9,
      originalName: 'shot.png',
    })
    expect(meta.urlPath.startsWith('/agent/attachments/p1/')).toBe(true)
    expect(
      await readFile(
        join(getProjectAttachmentsDir('p1'), meta.filename),
        'utf-8',
      ),
    ).toBe('png-bytes')

    // Inline images are already visible to the model, so they are not also
    // handed over as a path to read.
    expect(prepared.files).toEqual([])
  })

  it('saves a non-image file and hands the model its path', async () => {
    const prepared = await prepareAttachments(
      [
        attachment({
          name: 'notes.md',
          mimeType: 'text/markdown',
          dataBase64: base64('# hi'),
        }),
      ],
      'p1',
      'm1',
    )

    expect(prepared.blocks).toEqual([])
    expect(prepared.files).toHaveLength(1)
    expect(prepared.files[0].name).toBe('notes.md')
    expect(await readFile(prepared.files[0].path, 'utf-8')).toBe('# hi')
    expect(prepared.metadata[0].kind).toBe('file')
  })

  it('does not send an image type the model cannot take inline', async () => {
    const prepared = await prepareAttachments(
      [
        attachment({
          type: 'image',
          name: 'scan.tiff',
          mimeType: 'image/tiff',
        }),
      ],
      'p1',
      'm1',
    )

    expect(prepared.blocks).toEqual([])
    expect(prepared.files[0].path).toContain('scan.tiff')
  })

  it('keeps same-named attachments from overwriting each other', async () => {
    const prepared = await prepareAttachments(
      [
        attachment({ dataBase64: base64('first') }),
        attachment({ dataBase64: base64('second') }),
      ],
      'p1',
      'm1',
    )

    expect(prepared.files[0].path).not.toBe(prepared.files[1].path)
    expect(await readFile(prepared.files[1].path, 'utf-8')).toBe('second')
    expect(prepared.metadata.map(m => m.index)).toEqual([0, 1])
  })

  it('skips an attachment with no data instead of failing the turn', async () => {
    const prepared = await prepareAttachments(
      [attachment({ dataBase64: '' })],
      'p1',
      'm1',
    )

    expect(prepared.blocks).toEqual([])
    expect(prepared.files).toEqual([])
    expect(prepared.metadata).toEqual([])
  })

  it('is a no-op when the panel sent nothing', async () => {
    expect(await prepareAttachments([], 'p1', 'm1')).toEqual({
      blocks: [],
      files: [],
      metadata: [],
    })
  })
})

describe('resolveAttachmentPath', () => {
  it('rejects paths that escape the project directory', () => {
    expect(resolveAttachmentPath('p1', '../state.json')).toBeUndefined()
    expect(resolveAttachmentPath('p1', 'nested/a.png')).toBeUndefined()
    expect(resolveAttachmentPath('..', 'a.png')).toBeUndefined()
    expect(resolveAttachmentPath('p1', '')).toBeUndefined()
  })

  it('resolves a plain filename inside the project directory', () => {
    expect(resolveAttachmentPath('p1', 'a.png')).toBe(
      join(getProjectAttachmentsDir('p1'), 'a.png'),
    )
  })
})
