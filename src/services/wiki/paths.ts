import { join } from 'path'
import type { WikiPaths } from './types.js'

export const GAKRCLI_DIRNAME = '.gakrcli'
export const WIKI_DIRNAME = 'wiki'

export function getWikiPaths(cwd: string): WikiPaths {
  const root = join(cwd, GAKRCLI_DIRNAME, WIKI_DIRNAME)

  return {
    root,
    rawDir: join(root, 'raw'),
    pagesDir: join(root, 'pages'),
    sourcesDir: join(root, 'sources'),
    graphDir: join(root, 'graph'),
    graphJsonFile: join(root, 'graph', 'graph.json'),
    graphReportFile: join(root, 'graph', 'GRAPH_REPORT.md'),
    graphHtmlFile: join(root, 'graph', 'graph.html'),
    graphWikiDir: join(root, 'graph', 'wiki'),
    graphWikiIndexFile: join(root, 'graph', 'wiki', 'index.md'),
    graphManifestFile: join(root, 'graph', 'manifest.json'),
    schemaFile: join(root, 'schema.md'),
    indexFile: join(root, 'index.md'),
    logFile: join(root, 'log.md'),
  }
}
