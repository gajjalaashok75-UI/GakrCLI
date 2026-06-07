import React from 'react'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'
import { ingestLocalWikiSource } from '../../services/wiki/ingest.js'
import { initializeWikiKnowledge, updateWikiKnowledge } from '../../services/wiki/knowledgeGraph.js'
import { getWikiStatus } from '../../services/wiki/status.js'
import type {
  LocalJSXCommandCall,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import { getCwd } from '../../utils/cwd.js'
import { logError } from '../../utils/log.js'

function renderHelp(): string {
  return `Usage: /wiki [init [--force] [path]|update [path]|status|ingest <path>]

Manage the GakrCLI project wiki stored in .gakrcli/wiki.

Commands:
  /wiki init          Create the wiki graph knowledge base if missing
  /wiki init --force  Reinitialize and rebuild the wiki graph
  /wiki update        Refresh the existing wiki graph for . or a target path
  /wiki status        Show wiki status, source counts, and graph counts
  /wiki ingest        Ingest a local file into generated source notes

Examples:
  /wiki init
  /wiki init --force
  /wiki update .
  /wiki update src
  /wiki status
  /wiki ingest README.md`
}

function formatInitResult(result: Awaited<ReturnType<typeof initializeWikiKnowledge>>): string {
  if (result.skipped) {
    return [
      `GakrCLI wiki is already initialized at \`${result.root}\`.`,
      '',
      'Nothing was rebuilt.',
      'Run `/wiki update` to refresh changed files, or `/wiki init --force` to reinitialize and rebuild the wiki graph.',
      '',
      `Graph root: \`${result.graphRoot}\``,
      `Indexed files: ${result.indexedFiles}`,
      `Graph nodes: ${result.nodeCount}`,
      `Graph edges: ${result.edgeCount}`,
      `Communities: ${result.communityCount}`,
    ].join('\n')
  }

  const lines = [
    `Initialized GakrCLI wiki at \`${result.root}\``,
    '',
    `Graph root: \`${result.graphRoot}\``,
    `Indexed files: ${result.indexedFiles}`,
    `Graph nodes: ${result.nodeCount}`,
    `Graph edges: ${result.edgeCount}`,
    `Communities: ${result.communityCount}`,
  ]

  if (result.alreadyExisted) {
    lines.push('', 'Wiki scaffold already existed. Graph artifacts were rebuilt.')
  } else if (result.createdFiles.length > 0) {
    lines.push('', 'Created scaffold files:')
    for (const file of result.createdFiles) {
      lines.push(`- ${file}`)
    }
  }

  if (result.graphFiles.length > 0) {
    lines.push('', 'Graph files:')
    for (const file of result.graphFiles) {
      lines.push(`- ${file}`)
    }
  }

  return lines.join('\n')
}

function formatStatus(status: Awaited<ReturnType<typeof getWikiStatus>>): string {
  if (!status.initialized) {
    return `GakrCLI wiki is not initialized in this project.\n\nRun /wiki init to create \`${status.root}\`.`
  }

  return [
    'GakrCLI wiki status',
    '',
    `Root: \`${status.root}\``,
    `Raw files: ${status.rawSourceCount}`,
    `Pages: ${status.pageCount}`,
    `Source notes: ${status.sourceCount}`,
    `Graph: ${status.graphInitialized ? 'present' : 'missing'}`,
    `Graph nodes: ${status.graphNodeCount ?? 'unknown'}`,
    `Graph edges: ${status.graphEdgeCount ?? 'unknown'}`,
    `Graph communities: ${status.graphCommunityCount ?? 'unknown'}`,
    `Graph report: ${status.hasGraphReport ? 'present' : 'missing'}`,
    `Graph wiki index: ${status.hasGraphWikiIndex ? 'present' : 'missing'}`,
    `Graph HTML: ${status.hasGraphHtml ? 'present' : 'missing'}`,
    `Schema: ${status.hasSchema ? 'present' : 'missing'}`,
    `Index: ${status.hasIndex ? 'present' : 'missing'}`,
    `Log: ${status.hasLog ? 'present' : 'missing'}`,
    `Last updated: ${status.lastUpdatedAt ?? 'unknown'}`,
  ].join('\n')
}

function formatIngestResult(
  result: Awaited<ReturnType<typeof ingestLocalWikiSource>>,
): string {
  return [
    `Ingested ${result.sourceFile} into the GakrCLI wiki.`,
    '',
    `Title: ${result.title}`,
    `Source note: ${result.sourceNote}`,
    `Summary: ${result.summary}`,
  ].join('\n')
}

function formatUpdateResult(result: Awaited<ReturnType<typeof updateWikiKnowledge>>): string {
  const title = result.changed
    ? `Updated GakrCLI wiki graph at \`${result.root}\``
    : `No wiki graph changes detected at \`${result.root}\``
  return [
    title,
    '',
    `Target: ${result.updatedTarget}`,
    `Graph root: \`${result.graphRoot}\``,
    `Indexed files: ${result.indexedFiles}`,
    `Graph nodes: ${result.nodeCount}`,
    `Graph edges: ${result.edgeCount}`,
    `Communities: ${result.communityCount}`,
    `Changed: ${result.changed ? 'yes' : 'no'}`,
    '',
    'Graph files:',
    ...result.graphFiles.map(file => `- ${file}`),
  ].join('\n')
}

async function runWikiCommand(
  onDone: LocalJSXCommandOnDone,
  args: string,
): Promise<void> {
  const cwd = getCwd()
  const trimmedArgs = args.trim()
  const [rawSubcommand = '', ...rest] = trimmedArgs.split(/\s+/)
  const normalized = rawSubcommand.toLowerCase()

  if (COMMON_HELP_ARGS.includes(normalized)) {
    onDone(renderHelp(), { display: 'system' })
    return
  }

  if (!normalized || normalized === 'status' || COMMON_INFO_ARGS.includes(normalized)) {
    onDone(formatStatus(await getWikiStatus(cwd)), { display: 'system' })
    return
  }

  if (normalized === 'init') {
    const force = rest.includes('--force')
    const target = rest.filter(arg => arg !== '--force').join(' ').trim() || '.'
    onDone(formatInitResult(await initializeWikiKnowledge(cwd, target, { force })), { display: 'system' })
    return
  }

  if (normalized === 'update') {
    const target = rest.join(' ').trim() || '.'
    onDone(formatUpdateResult(await updateWikiKnowledge(cwd, target)), { display: 'system' })
    return
  }

  if (normalized === 'ingest') {
    const pathArg = rest.join(' ').trim()
    if (!pathArg) {
      onDone('Usage: /wiki ingest <local-file-path>', { display: 'system' })
      return
    }

    onDone(formatIngestResult(await ingestLocalWikiSource(cwd, pathArg)), {
      display: 'system',
    })
    return
  }

  onDone(`Unknown wiki subcommand: ${trimmedArgs}\n\n${renderHelp()}`, {
    display: 'system',
  })
}

export const call: LocalJSXCommandCall = async (
  onDone,
  _context,
  args,
): Promise<React.ReactNode> => {
  try {
    await runWikiCommand(onDone, args ?? '')
  } catch (error: unknown) {
    logError(error)
    const message = error instanceof Error ? error.message : 'Unexpected wiki command error'
    onDone(`Wiki command failed: ${message}`, { display: 'system' })
  }
  return null
}
