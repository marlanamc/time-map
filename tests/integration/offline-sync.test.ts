/**
 * Integration tests for offline/online transitions and sync queue behavior
 */

import { Mutex } from '../../src/services/sync/Mutex';

describe('Offline/Online Sync', () => {
  describe('Mutex for preventing concurrent sync operations', () => {
    let mutex: Mutex;

    beforeEach(() => {
      mutex = new Mutex();
    });

    it('should allow acquiring lock when not locked', async () => {
      const release = await mutex.acquire();
      expect(mutex.isLocked()).toBe(true);
      release();
      expect(mutex.isLocked()).toBe(false);
    });

    it('should queue requests when lock is held', async () => {
      const release1 = await mutex.acquire();
      expect(mutex.isLocked()).toBe(true);
      expect(mutex.getQueueLength()).toBe(0);

      // Try to acquire again (will queue)
      let acquire2Released = false;
      mutex.acquire().then((release2) => {
        expect(mutex.isLocked()).toBe(true);
        release2();
        acquire2Released = true;
      });

      // Give it a moment to queue
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mutex.getQueueLength()).toBe(1);

      // Release first lock
      release1();

      // Wait for second acquire to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(acquire2Released).toBe(true);
    });

    it('should runExclusive with automatic acquire/release', async () => {
      let executed = false;
      const result = await mutex.runExclusive(async () => {
        expect(mutex.isLocked()).toBe(true);
        executed = true;
        return 'result';
      });

      expect(executed).toBe(true);
      expect(result).toBe('result');
      expect(mutex.isLocked()).toBe(false);
    });

    it('should release lock even if function throws', async () => {
      expect(mutex.isLocked()).toBe(false);

      try {
        await mutex.runExclusive(async () => {
          expect(mutex.isLocked()).toBe(true);
          throw new Error('Test error');
        });
      } catch (_error) {
        // Expected
      }

      expect(mutex.isLocked()).toBe(false);
    });

    it('should process queue in FIFO order', async () => {
      const callOrder: number[] = [];

      const release1 = await mutex.acquire();
      callOrder.push(1);

      // Queue three operations
      mutex.runExclusive(async () => {
        callOrder.push(2);
      });
      mutex.runExclusive(async () => {
        callOrder.push(3);
      });
      mutex.runExclusive(async () => {
        callOrder.push(4);
      });

      release1();

      // Wait for queue to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callOrder).toEqual([1, 2, 3, 4]);
    });

    it('tryAcquire should return null if locked', async () => {
      const release = await mutex.acquire();
      const tryResult = mutex.tryAcquire();
      expect(tryResult).toBeNull();
      release();

      const tryResult2 = mutex.tryAcquire();
      expect(tryResult2).not.toBeNull();
      tryResult2?.();
    });

    it('should handle multiple sequential transactions', async () => {
      const results = [];

      for (let i = 0; i < 5; i++) {
        const result = await mutex.runExclusive(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return i;
        });
        results.push(result);
      }

      expect(results).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('Concurrent operations with Mutex', () => {
    let mutex: Mutex;

    beforeEach(() => {
      mutex = new Mutex();
    });

    it('should prevent race conditions in concurrent saves', async () => {
      const state: { value: number } = { value: 0 };

      // Simulate two concurrent save operations
      const promises = [
        mutex.runExclusive(async () => {
          const current = state.value;
          await new Promise((resolve) => setTimeout(resolve, 10));
          state.value = current + 1;
        }),
        mutex.runExclusive(async () => {
          const current = state.value;
          await new Promise((resolve) => setTimeout(resolve, 10));
          state.value = current + 1;
        }),
      ];

      await Promise.all(promises);

      // Both operations should have completed without race condition
      expect(state.value).toBe(2);
    });

    it('should maintain data consistency during concurrent access', async () => {
      interface DataRecord {
        id: string;
        count: number;
      }

      const data: DataRecord = { id: 'record-1', count: 0 };

      const increment = async () => {
        await mutex.runExclusive(async () => {
          const current = data.count;
          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 5));
          data.count = current + 1;
        });
      };

      // Run 10 concurrent increments
      await Promise.all(Array.from({ length: 10 }, () => increment()));

      expect(data.count).toBe(10);
    });
  });

  describe('Offline/Online simulation', () => {
    it('should queue operations during offline state', async () => {
      const mutex = new Mutex();
      const operationLog: string[] = [];

      // Simulate offline - hold the lock
      const offlineLock = await mutex.acquire();
      operationLog.push('offline');

      // Queue operations that would happen while offline
      mutex.runExclusive(async () => {
        operationLog.push('sync-1');
      });
      mutex.runExclusive(async () => {
        operationLog.push('sync-2');
      });

      expect(mutex.getQueueLength()).toBe(2);

      // Simulate coming back online
      offlineLock();
      operationLog.push('online');

      // Wait for queued operations to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(operationLog).toEqual(['offline', 'online', 'sync-1', 'sync-2']);
    });

    it('should handle transition from offline to online gracefully', async () => {
      const mutex = new Mutex();
      const state: { synced: boolean; errors: string[] } = { synced: false, errors: [] };

      // Hold lock to simulate offline
      const release = await mutex.acquire();

      // Queue operations
      mutex.runExclusive(async () => {
        state.synced = true;
      }).catch((err) => {
        state.errors.push(err.message);
      });

      // Verify still offline
      expect(state.synced).toBe(false);

      // Simulate coming online
      release();

      // Wait for operation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(state.synced).toBe(true);
      expect(state.errors).toHaveLength(0);
    });
  });
});
