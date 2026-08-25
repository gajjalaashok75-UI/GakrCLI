import {
  type ExecSyncOptions,
  type ExecSyncOptionsWithBufferEncoding,
  type ExecSyncOptionsWithStringEncoding,
  execSync as nodeExecSync,
} from 'child_process'
import { slowLogging } from './slowOperations.js'

/**
 * @deprecated Use async alternatives when possible. Sync exec calls block the event loop.
 *
 * Wrapped execSync with slow operation logging.
 * Use this instead of child_process execSync directly to detect performance issues.
 *
 * @example
 * import { execSync_DEPRECATED } from './execSyncWrapper.js'
 * const result = execSync_DEPRECATED('git status', { encoding: 'utf8' })
 */
export function execSync_DEPRECATED(command: string): Buffer
export function execSync_DEPRECATED(
  command: string,
  options: ExecSyncOptionsWithStringEncoding,
): string
export function execSync_DEPRECATED(
  command: string,
  options: ExecSyncOptionsWithBufferEncoding,
): Buffer
export function execSync_DEPRECATED(
  command: string,
  options?: ExecSyncOptions,
): Buffer | string
export function execSync_DEPRECATED(
  command: string,
  options?: ExecSyncOptions,
): Buffer | string {
  using _ = slowLogging`execSync: ${command.slice(0, 100)}`
  // windowsHide defaults to true: execSync runs via cmd.exe, and a console-less
  // parent (e.g. the detached `--bg` child) would otherwise make Windows
  // allocate a brand-new visible console window for every call. Callers may
  // still override it explicitly.
  return nodeExecSync(command, { windowsHide: true, ...options })
}
