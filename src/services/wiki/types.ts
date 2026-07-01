export type WikiPaths = {
  root: string
  pagesDir: string
  sourcesDir: string
  schemaFile: string
  indexFile: string
  logFile: string
  conventionsFile: string
  conventionsCacheFile: string
}

export type WikiInitResult = {
  root: string
  createdFiles: string[]
  createdDirectories: string[]
  alreadyExisted: boolean
}

export type WikiStatus = {
  initialized: boolean
  root: string
  pageCount: number
  sourceCount: number
  hasSchema: boolean
  hasIndex: boolean
  hasLog: boolean
  hasConventions: boolean
  conventionsScannedAt: string | null
  lastUpdatedAt: string | null
}

export type WikiIngestResult = {
  sourceFile: string
  sourceNote: string
  summary: string
  title: string
}
