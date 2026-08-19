/**
 * Minimal async mutex — TS equivalent of Python's `asyncio.Lock` /
 * `threading.Lock`. Shared by recording.ts (event buffer) and
 * browserEngine.ts (shared-executor creation lock, instance close lock).
 */
export class AsyncMutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.locked = true;
  }

  release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.locked = false;
  }

  async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
