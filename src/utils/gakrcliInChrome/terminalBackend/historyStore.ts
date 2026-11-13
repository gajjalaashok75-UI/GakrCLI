import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getGakrCLIConfigHomeDir } from '../../envUtils.js';
import type { TerminalHistoryChunk, TerminalHistoryReplay } from './types.js';

const HISTORY_FORMAT_VERSION = 1;
const HISTORY_ROTATE_BYTES = 2 * 1024 * 1024;
const HISTORY_TAIL_KEEP_BYTES = 1 * 1024 * 1024;
const DEFAULT_TTL_HOURS = 168;
const HISTORY_MAX_FILES = 200;

export interface TerminalHistoryStoreOptions {
  directory: string;
  now?: () => number;
  fsOverride?: typeof fs;
  ttlHours?: number;
}

export class TerminalHistoryStore {
  private readonly directory: string;
  private readonly now: () => number;
  private readonly fs: typeof fs;
  private readonly ttlHours: number;

  constructor(options: TerminalHistoryStoreOptions) {
    this.directory = options.directory;
    this.now = options.now ?? Date.now;
    this.fs = options.fsOverride ?? fs;
    this.ttlHours = options.ttlHours ?? DEFAULT_TTL_HOURS;
  }

  get directoryPath(): string {
    return this.directory;
  }

  private filePathFor(sessionId: string): string {
    return path.join(this.directory, this.historyFileName(sessionId));
  }

  private historyFileName(sessionId: string): string {
    return `${createHash('sha1').update(sessionId).digest('hex')}.ndjson`;
  }

  startSession(sessionId: string): void {
    try {
      this.fs.mkdirSync(this.directory, { recursive: true });
      const header = {
        v: HISTORY_FORMAT_VERSION,
        kind: 'header',
        createdAt: this.now(),
      };
      this.fs.writeFileSync(this.filePathFor(sessionId), `${JSON.stringify(header)}\n`, 'utf8');
    } catch (error) {
      console.warn('[TerminalHistoryStore] Cannot start session file', error);
    }
  }

  appendChunk(sessionId: string, data: string): void {
    try {
      const line = `${JSON.stringify({ kind: 'chunk', ts: this.now(), data })}\n`;
      const filePath = this.filePathFor(sessionId);
      const stats = this.fs.existsSync(filePath) ? this.fs.statSync(filePath) : null;

      if (stats && stats.size >= HISTORY_ROTATE_BYTES) {
        this.rotateFile(filePath);
      }

      this.fs.appendFileSync(filePath, line, 'utf8');
    } catch (error) {
      console.warn('[TerminalHistoryStore] Chunk not persisted', error);
    }
  }

  private rotateFile(filePath: string): void {
    const fd = this.fs.openSync(filePath, 'r+');
    try {
      const stats = this.fs.fstatSync(fd);
      if (stats.size <= HISTORY_TAIL_KEEP_BYTES) {
        return;
      }
      const tail = Buffer.alloc(HISTORY_TAIL_KEEP_BYTES);
      this.fs.readSync(fd, tail, 0, tail.length, stats.size - tail.length);
      this.fs.ftruncateSync(fd, 0);
      this.fs.writeSync(fd, tail, 0, tail.length, 0);
      this.fs.ftruncateSync(fd, tail.length);
    } finally {
      this.fs.closeSync(fd);
    }
  }

  readSession(sessionId: string): TerminalHistoryReplay {
    try {
      const filePath = this.filePathFor(sessionId);
      if (!this.fs.existsSync(filePath)) {
        return { hadContent: false, chunks: [] };
      }

      const content = this.fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);
      if (lines.length <= 1) {
        return { hadContent: false, chunks: [] };
      }

      const chunks: TerminalHistoryChunk[] = [];
      for (const line of lines.slice(1)) {
        try {
          const parsed = JSON.parse(line) as { kind?: string; ts?: number; data?: string };
          if (parsed.kind === 'chunk' && typeof parsed.data === 'string') {
            chunks.push({ ts: typeof parsed.ts === 'number' ? parsed.ts : 0, data: parsed.data });
          }
        } catch {
          // Torn final line from crash mid-write - skip
        }
      }
      return { hadContent: true, chunks };
    } catch (error) {
      console.warn('[TerminalHistoryStore] Cannot read session history', error);
      return { hadContent: false, chunks: [] };
    }
  }

  deleteSession(sessionId: string): void {
    try {
      this.fs.rmSync(this.filePathFor(sessionId), { force: true });
    } catch (error) {
      console.warn('[TerminalHistoryStore] Cannot delete session file', error);
    }
  }

  sweepExpired(): void {
    try {
      if (!this.fs.existsSync(this.directory)) {
        return;
      }

      const cutoffMs = this.now() - this.ttlHours * 60 * 60 * 1000;
      const entries: { file: string; mtimeMs: number }[] = [];
      for (const entry of this.fs.readdirSync(this.directory)) {
        if (!entry.endsWith('.ndjson')) {
          continue;
        }
        try {
          const stats = this.fs.statSync(path.join(this.directory, entry));
          if (stats.mtimeMs < cutoffMs) {
            this.fs.rmSync(path.join(this.directory, entry), { force: true });
            continue;
          }
          entries.push({ file: entry, mtimeMs: stats.mtimeMs });
        } catch {
          // File vanishing mid-sweep is not fatal
        }
      }

      if (entries.length <= HISTORY_MAX_FILES) {
        return;
      }
      entries
        .sort((a, b) => a.mtimeMs - b.mtimeMs)
        .slice(0, entries.length - HISTORY_MAX_FILES)
        .forEach((entry) => {
          try {
            this.fs.rmSync(path.join(this.directory, entry.file), { force: true });
          } catch {
            // Best-effort LRU trim
          }
        });
    } catch (error) {
      console.warn('[TerminalHistoryStore] Sweep failed', error);
    }
  }
}

export function createTerminalHistoryStore(): TerminalHistoryStore {
  const chromeDir = path.join(getGakrCLIConfigHomeDir(), 'chrome', 'terminal-backend', 'history');
  return new TerminalHistoryStore({ directory: chromeDir });
}