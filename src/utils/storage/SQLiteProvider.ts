import { join } from 'path'
import { existsSync, mkdirSync, unlinkSync, statSync } from 'fs'
import { createRequire } from 'module'
import type { Entity, Relation, SemanticSummary, KnowledgeGraph } from '../knowledgeGraph.js'
import { registerCleanup } from '../cleanupRegistry.js'

const require = createRequire(import.meta.url)

/**
 * SQLite Storage Provider for Knowledge Graph.
 * Provides ACID-compliant, high-performance relational storage.
 * Runtime-safe: uses Bun's SQLite driver in Bun and Node's built-in
 * node:sqlite driver when available.
 */
export class SQLiteProvider {
  private db: any = null
  private dbPath: string
  private isInitialized = false

  public static isRuntimeAvailable(): boolean {
    try {
      if (typeof Bun !== 'undefined') {
        require('bun:sqlite')
        return true
      }
      require('node:sqlite')
      return true
    } catch {
      return false
    }
  }

  constructor(projectDir: string) {
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true })
    }
    this.dbPath = join(projectDir, 'knowledge.db')
    
    // Ensure connection is closed on process exit
    registerCleanup(() => this.close())
  }

  public get isReady(): boolean {
    return this.isInitialized && this.db !== null
  }

  public async init(): Promise<void> {
    if (this.isInitialized && this.db) return

    try {
      if (existsSync(this.dbPath) && statSync(this.dbPath).size === 0) {
        unlinkSync(this.dbPath)
      }

      this.db = await this.openDatabase()
      this.db.exec('PRAGMA journal_mode = WAL;')
      this.db.exec('PRAGMA foreign_keys = ON;')
      this.createTables()
      this.isInitialized = true
    } catch (e) {
      if (!String(e).includes('disk I/O error')) {
        console.error(`Failed to initialize SQLite database at ${this.dbPath}:`, e)
      }
      await this.selfHeal()
    }
  }

  private async selfHeal(): Promise<void> {
    try {
      this.close()
      // Clean up main DB and side-car files to prevent reattaching to stale WAL/SHM
      const sidecars = [this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`]
      for (const file of sidecars) {
        if (existsSync(file)) {
          try { unlinkSync(file) } catch {}
        }
      }

      this.db = await this.openDatabase()
      this.db.exec('PRAGMA journal_mode = WAL;')
      this.db.exec('PRAGMA foreign_keys = ON;')
      this.createTables()
      this.isInitialized = true
    } catch (e) {
      console.warn(`Critical SQLite failure during self-heal at ${this.dbPath}. Falling back to JSON:`, e)
      this.isInitialized = true
      this.db = null
    }
  }

  private async openDatabase(): Promise<any> {
    if (typeof Bun !== 'undefined') {
      const { Database } = await import('bun:sqlite')
      return new Database(this.dbPath)
    }

    const { DatabaseSync } = await import('node:sqlite')
    return new DatabaseSync(this.dbPath)
  }

  private openDatabaseSync(): any {
    if (typeof Bun !== 'undefined') {
      const { Database } = require('bun:sqlite')
      return new Database(this.dbPath)
    }

    const { DatabaseSync } = require('node:sqlite')
    return new DatabaseSync(this.dbPath)
  }

  private runTransaction(fn: () => void): void {
    if (!this.db) return

    if (typeof this.db.transaction === 'function') {
      this.db.transaction(fn)()
      return
    }

    this.db.exec('BEGIN')
    try {
      fn()
      this.db.exec('COMMIT')
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {}
      throw error
    }
  }

  private createTables(): void {
    if (!this.db) return

    const statements = [
      `CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT,
        name TEXT,
        attributes TEXT,
        last_updated INTEGER
      );`,
      `CREATE TABLE IF NOT EXISTS relations (
        source_id TEXT,
        target_id TEXT,
        type TEXT,
        PRIMARY KEY (source_id, target_id, type),
        FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS summaries (
        id TEXT PRIMARY KEY,
        content TEXT,
        keywords TEXT,
        timestamp INTEGER
      );`,
      `CREATE TABLE IF NOT EXISTS rules (
        content TEXT PRIMARY KEY,
        timestamp INTEGER
      );`,
      `CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );`
    ]

    for (const stmt of statements) {
      this.db.exec(stmt)
    }
  }

  /**
   * Persists the Knowledge Graph using an incremental merge strategy for all tables.
   */
  public saveGraph(graph: KnowledgeGraph): void {
    // Note: init() must be called and awaited before saveGraph
    if (!this.db) return

    try {
      this.runTransaction(() => {
        const statements: any[] = []
        const prepare = (sql: string) => {
          const statement = this.db!.prepare(sql)
          statements.push(statement)
          return statement
        }

        try {
        const upsertEntity = prepare(`
          INSERT INTO entities (id, type, name, attributes, last_updated) 
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
            type=excluded.type, 
            name=excluded.name, 
            attributes=excluded.attributes, 
            last_updated=excluded.last_updated
        `)
        
        const upsertSummary = prepare(`
          INSERT INTO summaries (id, content, keywords, timestamp) 
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
            content=excluded.content, 
            keywords=excluded.keywords, 
            timestamp=excluded.timestamp
        `)

        const upsertRelation = prepare(`
          INSERT INTO relations (source_id, target_id, type) 
          VALUES (?, ?, ?)
          ON CONFLICT(source_id, target_id, type) DO NOTHING
        `)

        const upsertRule = prepare(`
          INSERT INTO rules (content, timestamp) 
          VALUES (?, ?)
          ON CONFLICT(content) DO UPDATE SET 
            timestamp=excluded.timestamp
        `)

        for (const entity of Object.values(graph.entities)) {
          upsertEntity.run(
            entity.id,
            entity.type,
            entity.name,
            JSON.stringify(entity.attributes),
            graph.lastUpdateTime,
          )
        }

        for (const rel of graph.relations) {
          upsertRelation.run(rel.sourceId, rel.targetId, rel.type)
        }

        for (const summary of graph.summaries) {
          upsertSummary.run(
            summary.id,
            summary.content,
            JSON.stringify(summary.keywords),
            summary.timestamp,
          )
        }

        for (const rule of graph.rules) {
          upsertRule.run(rule, Date.now())
        }

        prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)')
          .run('last_update_time', graph.lastUpdateTime.toString())
        } finally {
          for (const statement of statements) {
            try {
              statement.finalize?.()
            } catch {}
          }
        }
      })
    } catch (e) {
      console.error('Failed to save graph to SQLite:', e)
    }
  }

  public loadGraph(): KnowledgeGraph | null {
    // Note: init() must be called and awaited before loadGraph
    if (!this.db) return null

    try {
      const statements: any[] = []
      const prepare = (sql: string) => {
        const statement = this.db!.prepare(sql)
        statements.push(statement)
        return statement
      }

      try {
      const entitiesRaw = prepare('SELECT * FROM entities').all() as any[]
      const summariesRaw = prepare('SELECT * FROM summaries').all() as any[]
      
      if (entitiesRaw.length === 0 && summariesRaw.length === 0) {
        return null
      }

      const relationsRaw = prepare('SELECT * FROM relations').all() as any[]
      const rulesRaw = prepare('SELECT * FROM rules').all() as any[]
      const meta = prepare('SELECT value FROM sync_meta WHERE key = "last_update_time"').get() as any

      const entities: Record<string, Entity> = {}
      for (const row of entitiesRaw) {
        entities[row.id] = {
          id: row.id,
          type: row.type,
          name: row.name,
          attributes: JSON.parse(row.attributes)
        }
      }

      const relations: Relation[] = relationsRaw.map((row: any) => ({
        sourceId: row.source_id,
        targetId: row.target_id,
        type: row.type
      }))

      const summaries: SemanticSummary[] = summariesRaw.map((row: any) => ({
        id: row.id,
        content: row.content,
        keywords: JSON.parse(row.keywords),
        timestamp: row.timestamp
      }))

      const rules: string[] = rulesRaw.map((row: any) => row.content)

      return {
        entities,
        relations,
        summaries,
        rules,
        lastUpdateTime: meta ? parseInt(meta.value) : Date.now()
      }
      } finally {
        for (const statement of statements) {
          try {
            statement.finalize?.()
          } catch {}
        }
      }
    } catch (e) {
      return null
    }
  }

  public clear(): boolean {
    if (!this.db) {
      if (!existsSync(this.dbPath)) {
        return true
      }

      try {
        this.db = this.openDatabaseSync()
        this.db.exec('PRAGMA journal_mode = WAL;')
        this.db.exec('PRAGMA foreign_keys = ON;')
        this.createTables()
        return this.clear()
      } catch (e) {
        console.error('Failed to open SQLite knowledge graph for clearing:', e)
        return false
      } finally {
        this.close()
      }
    }

    try {
      this.runTransaction(() => {
        this.db!.exec('DELETE FROM relations')
        this.db!.exec('DELETE FROM entities')
        this.db!.exec('DELETE FROM summaries')
        this.db!.exec('DELETE FROM rules')
        this.db!.exec('DELETE FROM sync_meta')
      })
      return true
    } catch (e) {
      console.error('Failed to clear SQLite knowledge graph:', e)
      return false
    }
  }

  public close(): void {
    if (this.db) {
      try {
        this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);')
      } catch {}
      try {
        this.db.close()
      } catch {}
      this.db = null
    }
    this.isInitialized = false
  }
}
