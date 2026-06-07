export type WikiPaths = {
  root: string
  rawDir: string
  pagesDir: string
  sourcesDir: string
  graphDir: string
  graphJsonFile: string
  graphReportFile: string
  graphHtmlFile: string
  graphWikiDir: string
  graphWikiIndexFile: string
  graphManifestFile: string
  schemaFile: string
  indexFile: string
  logFile: string
}

export type WikiInitResult = {
  root: string
  createdFiles: string[]
  createdDirectories: string[]
  alreadyExisted: boolean
}

export type WikiKnowledgeInitResult = WikiInitResult & {
  graphRoot: string
  indexedFiles: number
  nodeCount: number
  edgeCount: number
  communityCount: number
  graphFiles: string[]
  skipped?: boolean
}

export type WikiKnowledgeUpdateResult = WikiKnowledgeInitResult & {
  changed: boolean
  updatedTarget: string
}

export type WikiStatus = {
  initialized: boolean
  root: string
  rawSourceCount: number
  pageCount: number
  sourceCount: number
  graphInitialized: boolean
  graphNodeCount: number | null
  graphEdgeCount: number | null
  graphCommunityCount: number | null
  hasGraphReport: boolean
  hasGraphHtml: boolean
  hasGraphWikiIndex: boolean
  hasSchema: boolean
  hasIndex: boolean
  hasLog: boolean
  lastUpdatedAt: string | null
  graphFreshness: 'up_to_date' | 'stale' | 'unknown'
  graphFreshnessMessage: string | null
}

export type WikiIngestResult = {
  sourceFile: string
  sourceNote: string
  summary: string
  title: string
}
