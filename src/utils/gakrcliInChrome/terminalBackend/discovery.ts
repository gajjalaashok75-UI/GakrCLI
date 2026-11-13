import fs from 'node:fs';
import path from 'node:path';
import { getGakrCLIConfigHomeDir } from '../../envUtils.js';
import type { DiscoveryInfo } from './types.js';

const DISCOVERY_DIR = 'terminal-backend';
const DISCOVERY_FILE = 'port.json';

function getDiscoveryDir(): string {
  return path.join(getGakrCLIConfigHomeDir(), 'chrome', DISCOVERY_DIR);
}

function getDiscoveryFilePath(): string {
  return path.join(getDiscoveryDir(), DISCOVERY_FILE);
}

export function publishDiscovery(info: DiscoveryInfo): void {
  try {
    const dir = getDiscoveryDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getDiscoveryFilePath(), JSON.stringify(info, null, 2), 'utf8');
  } catch (error) {
    console.warn('[TerminalBackend] Failed to publish discovery info', error);
  }
}

export function clearDiscovery(): void {
  try {
    fs.rmSync(getDiscoveryFilePath(), { force: true });
  } catch {
    // Ignore if file doesn't exist
  }
}

export function readDiscovery(): DiscoveryInfo | null {
  try {
    const filePath = getDiscoveryFilePath();
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as DiscoveryInfo;
  } catch (error) {
    console.warn('[TerminalBackend] Failed to read discovery info', error);
    return null;
  }
}

export function getDiscoveryDirPath(): string {
  return getDiscoveryDir();
}

/**
 * Read the port of a live terminal backend.
 *
 * Returns null when there is no backend, or when the file is stale — a port
 * file left behind by a crashed process must not make callers believe a backend
 * is listening. Liveness is checked with signal 0, which probes without
 * delivering anything.
 */
export function readDiscoveryPort(): number | null {
  const info = readDiscovery();
  if (!info) {
    return null;
  }
  if (!Number.isInteger(info.port) || info.port <= 0) {
    return null;
  }
  if (Number.isInteger(info.pid) && info.pid > 0) {
    try {
      process.kill(info.pid, 0);
    } catch {
      return null;
    }
  }
  return info.port;
}