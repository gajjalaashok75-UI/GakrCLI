import pty, { type IPty } from 'node-pty';
import { resolveCurrentCliEntrypoint } from '../../cliEntrypoint.js';
import { getPlatform } from '../../platform.js';
import type { PtySessionEntry } from './types.js';
import { createTerminalHistoryStore } from './historyStore.js';

export interface PtySpawnOptions {
  sessionId: string;
  launchDir: string;
  cols: number;
  rows: number;
}

export function spawnGakrCliChrome(options: PtySpawnOptions): IPty {
  const { sessionId, launchDir, cols, rows } = options;
  const entrypoint = resolveCurrentCliEntrypoint({ argv1: process.argv[1] });
  const platform = getPlatform();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
  };

  // Delete NODE_OPTIONS to avoid inheriting parent's loader hooks
  delete env.NODE_OPTIONS;

  const ptyProcess = pty.spawn(process.execPath, [entrypoint, '--chrome'], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: launchDir,
    env,
  });

  return ptyProcess;
}

export interface PtySessionHandlers {
  onData: (data: string) => void;
  onExit: (exitCode: { exitCode: number; signal?: number }) => void;
}

export function createPtySession(
  options: PtySpawnOptions,
  handlers: PtySessionHandlers
): PtySessionEntry {
  const ptyProcess = spawnGakrCliChrome(options);
  const historyStore = createTerminalHistoryStore();

  const sessionEntry: PtySessionEntry = {
    pty: ptyProcess,
    clients: new Map(),
    buffer: [],
    timeoutId: null,
    sessionId: options.sessionId,
  };

  ptyProcess.onData((chunk: string) => {
    handlers.onData(chunk);
  });

  ptyProcess.onExit((exitCode: { exitCode: number; signal?: number }) => {
    handlers.onExit(exitCode);
  });

  return sessionEntry;
}

export function destroyPtySession(session: PtySessionEntry): void {
  if (session.timeoutId) {
    clearTimeout(session.timeoutId);
    session.timeoutId = null;
  }
  try {
    session.pty.kill();
  } catch {
    // Ignore kill errors
  }
}

export function resizePtySession(session: PtySessionEntry, cols: number, rows: number): void {
  try {
    session.pty.resize(cols, rows);
  } catch (error) {
    console.warn('[PtySession] Resize failed', error);
  }
}

export function writeToPtySession(session: PtySessionEntry, data: string): void {
  try {
    session.pty.write(data);
  } catch (error) {
    console.warn('[PtySession] Write failed', error);
  }
}