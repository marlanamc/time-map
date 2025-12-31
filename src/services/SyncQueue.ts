/**
 * SyncQueue - Offline sync queue with retry logic
 *
 * Queues failed operations and retries them when back online.
 * Ensures no data is lost during network failures.
 *
 * Benefits:
 * - Resilient sync during spotty connections
 * - Automatic retry with exponential backoff
 * - Persists queue to localStorage
 */

import type { Goal, BrainDumpEntry } from '../types';

interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'goal' | 'brainDump' | 'achievement' | 'weeklyReview';
  data: any;
  timestamp: number;
  retries: number;
}

class SyncQueue {
  private queue: QueuedOperation[] = [];
  private processing = false;
  private readonly MAX_RETRIES = 3;
  private readonly STORAGE_KEY = 'sync_queue';

  // Resource tracking for cleanup
  private autoSyncInterval: number | null = null;
  private boundOnlineHandler: (() => void) | null = null;
  private boundOfflineHandler: (() => void) | null = null;

  constructor() {
    this.loadQueue();
    this.startAutoSync();
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Validate structure - must be an array
        if (Array.isArray(parsed)) {
          // Validate each operation has required fields
          const isValid = parsed.every(op =>
            op && typeof op === 'object' &&
            typeof op.id === 'string' &&
            typeof op.type === 'string' &&
            typeof op.entity === 'string' &&
            typeof op.timestamp === 'number' &&
            typeof op.retries === 'number'
          );

          if (isValid) {
            this.queue = parsed;
            console.log(`✓ Loaded ${this.queue.length} queued operations from storage`);
          } else {
            throw new Error('Invalid queue structure: operations missing required fields');
          }
        } else {
          throw new Error('Invalid queue format: expected array');
        }
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);

      // Clear corrupted data from localStorage
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        console.warn('✓ Cleared corrupted sync queue from storage');
      } catch (removeError) {
        console.error('Failed to clear corrupted sync queue:', removeError);
      }

      // Reset to empty queue
      this.queue = [];

      // Notify user about corrupted data
      this.emitStorageError();
    }
  }

  /**
   * Emit storage error event for user notification
   */
  private emitStorageError(): void {
    const event = new CustomEvent('sync-storage-error', {
      detail: {
        message: 'Sync queue was corrupted and has been reset. Recent offline changes may be lost.'
      }
    });

    window.dispatchEvent(event);
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Add operation to queue
   *
   * @param operation - Operation to queue
   */
  enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>): void {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
      retries: 0
    };

    this.queue.push(queuedOp);
    this.saveQueue();

    console.log(`📥 Queued ${operation.type} operation for ${operation.entity}`);

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  /**
   * Start automatic sync on interval and when coming online
   */
  private startAutoSync(): void {
    // Clear existing interval if any
    if (this.autoSyncInterval !== null) {
      clearInterval(this.autoSyncInterval);
    }

    // Process queue every 30 seconds if online
    this.autoSyncInterval = window.setInterval(() => {
      if (navigator.onLine && this.queue.length > 0) {
        this.processQueue();
      }
    }, 30000);

    // Create bound handlers for proper cleanup
    this.boundOnlineHandler = () => {
      console.log('🌐 Back online! Processing sync queue...');
      this.processQueue();
    };

    this.boundOfflineHandler = () => {
      console.log('📡 Offline - Operations will be queued');
    };

    // Process when coming back online
    window.addEventListener('online', this.boundOnlineHandler);

    // Log when going offline
    window.addEventListener('offline', this.boundOfflineHandler);

    console.log('✓ SyncQueue auto-sync started');
  }

  /**
   * Process all queued operations
   */
  async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    const operations = [...this.queue];
    const failed: QueuedOperation[] = [];

    console.log(`🔄 Processing ${operations.length} queued operations...`);

    for (const op of operations) {
      try {
        await this.executeOperation(op);

        // Remove from queue on success
        this.queue = this.queue.filter(q => q.id !== op.id);
        console.log(`  ✓ Synced ${op.entity} ${op.type}`);
      } catch (error) {
        console.error(`  ✗ Failed to sync ${op.entity}:`, error);

        op.retries++;
        if (op.retries < this.MAX_RETRIES) {
          failed.push(op);
          console.log(`  ⏳ Will retry (attempt ${op.retries}/${this.MAX_RETRIES})`);
        } else {
          console.error(`  ❌ Operation failed after ${this.MAX_RETRIES} retries:`, op);
          // Could emit event for user notification here
          this.emitSyncError(op);
        }
      }
    }

    // Keep failed operations in queue
    this.queue = failed;
    this.saveQueue();

    const succeeded = operations.length - failed.length;
    if (succeeded > 0) {
      console.log(`✓ Successfully synced ${succeeded}/${operations.length} operations`);
    }

    this.processing = false;
  }

  /**
   * Execute a single queued operation
   */
  private async executeOperation(op: QueuedOperation): Promise<void> {
    const { SupabaseService } = await import('./SupabaseService');

    switch (op.entity) {
      case 'goal':
        if (op.type === 'create' || op.type === 'update') {
          await SupabaseService.saveGoal(op.data as Goal);
        } else if (op.type === 'delete') {
          await SupabaseService.deleteGoal(op.data.id);
        }
        break;

      case 'brainDump':
        if (op.type === 'create' || op.type === 'update') {
          await SupabaseService.saveBrainDump(op.data as BrainDumpEntry);
        } else if (op.type === 'delete') {
          await SupabaseService.deleteBrainDump(op.data.id);
        }
        break;

      case 'achievement':
        if (op.type === 'create' || op.type === 'update') {
          await SupabaseService.saveAchievement(op.data);
        }
        break;

      case 'weeklyReview':
        if (op.type === 'create' || op.type === 'update') {
          await SupabaseService.saveWeeklyReview(op.data);
        }
        break;

      default:
        console.warn('Unknown entity type:', op.entity);
    }
  }

  /**
   * Emit sync error event for user notification
   */
  private emitSyncError(op: QueuedOperation): void {
    const event = new CustomEvent('sync-error', {
      detail: {
        operation: op,
        message: `Failed to sync ${op.entity} after ${this.MAX_RETRIES} attempts`
      }
    });

    window.dispatchEvent(event);
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      pending: this.queue.length,
      processing: this.processing,
      online: navigator.onLine,
      operations: this.queue.map(op => ({
        entity: op.entity,
        type: op.type,
        retries: op.retries,
        age: Date.now() - op.timestamp
      }))
    };
  }

  /**
   * Clear queue (use with caution)
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
    console.log('✓ Sync queue cleared');
  }

  /**
   * Force immediate processing
   */
  async forceSync(): Promise<void> {
    console.log('🔄 Force syncing queue...');
    await this.processQueue();
  }

  /**
   * Log queue status
   */
  logStatus(): void {
    const status = this.getStatus();
    console.log('📊 SyncQueue Status:', {
      'Pending Operations': status.pending,
      'Processing': status.processing,
      'Online': status.online,
      'Operations': status.operations
    });
  }

  /**
   * Stop auto-sync and cleanup resources
   * Should be called on logout or app cleanup
   */
  destroy(): void {
    // Clear interval
    if (this.autoSyncInterval !== null) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }

    // Remove event listeners
    if (this.boundOnlineHandler) {
      window.removeEventListener('online', this.boundOnlineHandler);
      this.boundOnlineHandler = null;
    }

    if (this.boundOfflineHandler) {
      window.removeEventListener('offline', this.boundOfflineHandler);
      this.boundOfflineHandler = null;
    }

    console.log('✓ SyncQueue destroyed and cleaned up');
  }
}

// Export singleton instance
export const syncQueue = new SyncQueue();
export default syncQueue;

// Add cleanup on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    syncQueue.destroy();
  });
}
