/**
 * Persistent storage for browser recording events.
 *
 * LAYER 1 — GakrCLI-AGNOSTIC. Ported exactly from event_storage.py (68 lines).
 */

import fs from 'node:fs';
import path from 'node:path';

/** Matches Python's `datetime.now(UTC).strftime("%Y%m%d-%H%M%S-%f")` (microsecond precision). */
function utcTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const y = now.getUTCFullYear();
  const mo = pad(now.getUTCMonth() + 1);
  const d = pad(now.getUTCDate());
  const h = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());
  const s = pad(now.getUTCSeconds());
  // JS Date only has millisecond resolution; pad to 6 digits ("microseconds")
  // by appending 3 zeros, mirroring the Python format's width.
  const micro = pad(now.getUTCMilliseconds(), 3) + '000';
  return `${y}${mo}${d}-${h}${mi}${s}-${micro}`;
}

export class EventStorage {
  outputDir: string | null;
  private _sessionDir: string | null = null;
  private _filesWritten = 0;
  private _totalEvents = 0;

  constructor(outputDir: string | null = null) {
    this.outputDir = outputDir;
  }

  get sessionDir(): string | null {
    return this._sessionDir;
  }

  get fileCount(): number {
    return this._filesWritten;
  }

  get totalEvents(): number {
    return this._totalEvents;
  }

  /** Create a timestamped subfolder for this recording session. */
  createSessionSubfolder(): string | null {
    if (!this.outputDir) return null;
    const timestamp = utcTimestamp();
    const subfolder = path.join(this.outputDir, `recording-${timestamp}`);
    fs.mkdirSync(subfolder, { recursive: true });
    this._sessionDir = subfolder;
    return subfolder;
  }

  /** Save events to a timestamped JSON file. Returns the filepath, or null if nothing to save. */
  saveEvents(events: unknown[]): string | null {
    if (!this._sessionDir || !events.length) return null;

    fs.mkdirSync(this._sessionDir, { recursive: true });
    const timestamp = utcTimestamp();
    const filepath = path.join(this._sessionDir, `${timestamp}.json`);

    fs.writeFileSync(filepath, JSON.stringify(events));

    this._filesWritten += 1;
    this._totalEvents += events.length;
    return filepath;
  }

  /** Reset storage state for a new session. */
  reset(): void {
    this._sessionDir = null;
    this._filesWritten = 0;
    this._totalEvents = 0;
  }
}
