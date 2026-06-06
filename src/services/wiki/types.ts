export type WikiPaths = {
  root: string
  rawDir: string
  pagesDir: string
  sourcesDir: string
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

export type WikiStatus = {
  initialized: boolean
  root: string
  rawSourceCount: number
  pageCount: number
  sourceCount: number
  hasSchema: boolean
  hasIndex: boolean
  hasLog: boolean
  lastUpdatedAt: string | null
}

export type WikiIngestResult = {
  sourceFile: string
  sourceNote: string
  summary: string
  title: string
}
