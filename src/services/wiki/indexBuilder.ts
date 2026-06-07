import { readdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, relative } from 'path'
import { getWikiPaths } from './paths.js'

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

async function getPageTitle(path: string): Promise<string> {
  const content = await readFile(path, 'utf8')
  const titleLine = content
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith('# '))

  return titleLine ? titleLine.replace(/^#\s+/, '') : basename(path, '.md')
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function rebuildWikiIndex(cwd: string): Promise<void> {
  const paths = getWikiPaths(cwd)
  const pageFiles = await listMarkdownFiles(paths.pagesDir)
  const sourceFiles = await listMarkdownFiles(paths.sourcesDir)
  const graphLinks = [
    {
      path: paths.graphReportFile,
      link: './graph/GRAPH_REPORT.md',
      title: 'Graph Report',
    },
    {
      path: paths.graphWikiIndexFile,
      link: './graph/wiki/index.md',
      title: 'Graph Wiki Index',
    },
    {
      path: paths.graphHtmlFile,
      link: './graph/graph.html',
      title: 'Interactive Graph Data View',
    },
    {
      path: paths.graphJsonFile,
      link: './graph/graph.json',
      title: 'Machine Graph JSON',
    },
  ]

  const pageLinks = await Promise.all(
    pageFiles.map(async file => {
      const rel = relative(paths.root, file)
      const title = await getPageTitle(file)
      return `- [${title}](./${rel.replace(/\\/g, '/')})`
    }),
  )

  const sourceLinks = await Promise.all(sourceFiles.map(async file => {
    const rel = relative(paths.root, file).replace(/\\/g, '/')
    const title = await getPageTitle(file)
    return `- [${title}](./${rel})`
  }))

  const presentGraphLinks = (
    await Promise.all(
      graphLinks.map(async item => ((await pathExists(item.path)) ? item : null)),
    )
  ).filter((item): item is (typeof graphLinks)[number] => item !== null)

  const content = `# ${basename(cwd)} Wiki

This wiki is maintained by GakrCLI as a durable project knowledge layer.
Read this file first, then drill into the linked pages and source notes.

## Graph Knowledge

${presentGraphLinks.length > 0 ? presentGraphLinks.map(item => `- [${item.title}](${item.link})`).join('\n') : '- Run `/wiki init` to build the graph knowledge base.'}

## Core Pages

${pageLinks.length > 0 ? pageLinks.join('\n') : '- No pages yet'}

## Sources

${sourceLinks.length > 0 ? sourceLinks.join('\n') : '- No sources yet'}

## Recent Updates

- See [log.md](./log.md)
`

  await writeFile(paths.indexFile, content, 'utf8')
}
