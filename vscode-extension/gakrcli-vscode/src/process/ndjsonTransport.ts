// src/process/ndjsonTransport.ts
// Line-buffered NDJSON transport for communication with the GakrCLI CLI.
// Reads line-delimited JSON from a readable stream (CLI stdout).
// Writes JSON + newline to a writable stream (CLI stdin).

import * as readline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

type MessageCallback = (message: unknown) => void;
type ErrorCallback = (error: Error) => void;
type CloseCallback = () => void;

export class NdjsonTransport {
  private readonly rl: readline.Interface;
  private readonly stdinStream: Writable | undefined;
  private messageCallbacks: MessageCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private closeCallbacks: CloseCallback[] = [];
  private disposed = false;

  constructor(stdout: Readable, stdin?: Writable) {
    this.stdinStream = stdin;

    // Use readline to get line-buffered parsing.
    // This handles partial chunks automatically — readline only emits
    // complete lines (delimited by \n).
    this.rl = readline.createInterface({
      input: stdout,
      crlfDelay: Infinity, // Treat \r\n as single line break
    });

    this.rl.on('line', (line: string) => {
      this.handleLine(line);
    });

    this.rl.on('close', () => {
      for (const cb of this.closeCallbacks) {
        cb();
      }
    });

    this.rl.on('error', (err: Error) => {
      for (const cb of this.errorCallbacks) {
        cb(err);
      }
    });
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return; // Skip empty/whitespace-only lines
    }

    try {
      const parsed = JSON.parse(trimmed);
      for (const cb of this.messageCallbacks) {
        cb(parsed);
      }
    } catch (err) {
      const error = new Error(
        `Failed to parse NDJSON line: ${trimmed.substring(0, 200)}${trimmed.length > 200 ? '...' : ''}`,
      );
      for (const cb of this.errorCallbacks) {
        cb(error);
      }
    }
  }

  /**
   * Register a callback for parsed messages from stdout.
   */
  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Register a callback for parse errors.
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Register a callback for when the stdout stream closes.
   */
  onClose(callback: CloseCallback): void {
    this.closeCallbacks.push(callback);
  }

  /**
   * Write a JSON message to stdin, followed by a newline.
   */
  write(message: unknown): void {
    if (this.disposed || !this.stdinStream) {
      return;
    }

    const serialized = JSON.stringify(message) + '\n';
    this.stdinStream.write(serialized);
  }

  /**
   * End the stdin stream (signals CLI to exit gracefully).
   */
  endInput(): void {
    if (this.stdinStream) {
      this.stdinStream.end();
    }
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    this.disposed = true;
    this.rl.close();
    this.messageCallbacks = [];
    this.errorCallbacks = [];
    this.closeCallbacks = [];
  }
}
