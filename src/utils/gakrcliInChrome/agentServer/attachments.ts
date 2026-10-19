/**
 * Attachment handling for the side panel's agent server.
 *
 * The panel sends attachments inline as base64. Images are handed to the model
 * as image content blocks so it can actually look at them, and every file is
 * also written into the project's attachment cache — the panel renders its
 * thumbnails from the saved copy, and non-image files reach the model as a path
 * its own file tools can open.
 */

import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { isAbsolute, join, relative, resolve } from 'path'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { AgentAttachment, AttachmentMetadata } from './contract.js'
import {
  getAttachmentsRootDir,
  getProjectAttachmentsDir,
} from './store.js'

/** Image media types the model accepts inline. Anything else is saved instead. */
const INLINE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

type InlineImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'

export type PreparedAttachments = {
  /** Image blocks for the turn's prompt. */
  blocks: ContentBlockParam[]
  /** Saved non-image attachments, as a name/path pair for the prompt text. */
  files: Array<{ name: string; path: string }>
  /** Metadata for the user message; the panel renders `kind: 'image'` entries. */
  metadata: AttachmentMetadata[]
}

/** Where the panel fetches a saved attachment; also the server's GET route. */
export function attachmentUrlPath(
  projectId: string,
  filename: string,
): string {
  return `/agent/attachments/${encodeURIComponent(projectId)}/${encodeURIComponent(filename)}`
}

/**
 * Filesystem-safe name for a saved attachment.
 *
 * Prefixed with a random id because two turns in the same project routinely
 * attach files with the same original name and index.
 */
function safeFilename(originalName: string, index: number): string {
  const base = originalName.split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[._]+/, '')
  return `${index}-${randomUUID().slice(0, 8)}-${cleaned.slice(0, 80) || 'attachment'}`
}

/** Decoded byte length of a base64 payload, without copying it. */
function base64ByteLength(data: string): number {
  const unpadded = data.replace(/=+$/, '').length
  return Math.floor((unpadded * 3) / 4)
}

/**
 * Persist the panel's attachments and translate them for the model.
 *
 * Best-effort per attachment: a file that cannot be written is skipped rather
 * than failing the turn, and an image that cannot be written still reaches the
 * model inline (only its thumbnail is lost).
 */
export async function prepareAttachments(
  attachments: AgentAttachment[],
  projectId: string,
  messageId: string,
): Promise<PreparedAttachments> {
  const prepared: PreparedAttachments = { blocks: [], files: [], metadata: [] }
  if (!attachments.length) {
    return prepared
  }

  const dir = getProjectAttachmentsDir(projectId)
  let dirReady = false
  const createdAt = new Date().toISOString()

  for (let index = 0; index < attachments.length; index++) {
    const attachment = attachments[index]
    const data = attachment.dataBase64
    if (!data) {
      continue
    }

    const inlineImage =
      attachment.type === 'image' && INLINE_IMAGE_TYPES.has(attachment.mimeType)
    if (inlineImage) {
      prepared.blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: attachment.mimeType as InlineImageMediaType,
          data,
        },
      })
    }

    const filename = safeFilename(attachment.name, index)
    const filePath = join(dir, filename)
    let saved = false
    try {
      if (!dirReady) {
        await mkdir(dir, { recursive: true })
        dirReady = true
      }
      await writeFile(filePath, Buffer.from(data, 'base64'))
      saved = true
    } catch {
      // Keep the inline image above; only the saved copy is missing.
    }

    if (saved) {
      prepared.metadata.push({
        version: 1,
        kind: attachment.type,
        projectId,
        messageId,
        index,
        filename,
        urlPath: attachmentUrlPath(projectId, filename),
        mimeType: attachment.mimeType,
        sizeBytes: base64ByteLength(data),
        originalName: attachment.name,
        createdAt,
      })
    }

    if (!inlineImage && saved) {
      prepared.files.push({ name: attachment.name, path: filePath })
    }
  }

  return prepared
}

/** A single path segment: no separators, and not a directory alias. */
function isPlainSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment !== '.' &&
    segment !== '..' &&
    !segment.includes('/') &&
    !segment.includes('\\')
  )
}

/**
 * Resolve a served attachment to an absolute path.
 *
 * Returns undefined unless both segments are plain names *and* the result stays
 * inside the attachment cache, so a crafted `urlPath` cannot read any other
 * file on the machine.
 */
export function resolveAttachmentPath(
  projectId: string,
  filename: string,
): string | undefined {
  if (!isPlainSegment(projectId) || !isPlainSegment(filename)) {
    return undefined
  }
  const root = resolve(getAttachmentsRootDir())
  const target = resolve(join(getProjectAttachmentsDir(projectId), filename))
  const relativeToRoot = relative(root, target)
  if (
    !relativeToRoot ||
    relativeToRoot.startsWith('..') ||
    isAbsolute(relativeToRoot)
  ) {
    return undefined
  }
  return join(getProjectAttachmentsDir(projectId), filename)
}

/** Content type used when serving a saved attachment. */
export function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain'
  return 'application/octet-stream'
}
