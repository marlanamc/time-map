/**
 * Mutex - Simple async mutex for preventing concurrent operations
 *
 * Ensures only one async operation runs at a time, preventing race conditions
 * during sync operations.
 */

export class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];

  /**
   * Acquire the lock. Returns a release function.
   * If already locked, waits until the lock is available.
   */
  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true;
          resolve(() => this.release());
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }

  /**
   * Release the lock and process next in queue
   */
  private release(): void {
    this.locked = false;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  /**
   * Check if currently locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get queue length (useful for debugging)
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Run an async function with the lock held
   * Automatically acquires and releases the lock
   */
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Try to acquire the lock without waiting
   * Returns release function if acquired, null if already locked
   */
  tryAcquire(): (() => void) | null {
    if (this.locked) {
      return null;
    }
    this.locked = true;
    return () => this.release();
  }
}

// Shared mutex instances for sync operations
export const syncMutex = new Mutex();
export const batchSaveMutex = new Mutex();

export default Mutex;
