/**
 * ConflictDetector - Detects and handles sync conflicts
 *
 * Compares local and remote timestamps to detect when data has been
 * modified on another device. Uses last-write-wins with user notification.
 */

export interface ConflictInfo {
  entityType: 'goal' | 'event' | 'brainDump' | 'weeklyReview';
  entityId: string;
  entityTitle?: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  resolution: 'local_wins' | 'remote_wins';
}

type ConflictCallback = (conflict: ConflictInfo) => void;

class ConflictDetector {
  private callbacks: Set<ConflictCallback> = new Set();
  private recentConflicts: ConflictInfo[] = [];
  private readonly MAX_STORED_CONFLICTS = 50;

  /**
   * Subscribe to conflict notifications
   */
  onConflict(callback: ConflictCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Check if there's a conflict between local and remote data
   * Returns true if the remote was updated more recently than our local copy
   */
  hasConflict(
    localUpdatedAt: string | null | undefined,
    remoteUpdatedAt: string | null | undefined
  ): boolean {
    if (!localUpdatedAt || !remoteUpdatedAt) {
      return false;
    }

    const localTime = new Date(localUpdatedAt).getTime();
    const remoteTime = new Date(remoteUpdatedAt).getTime();

    // If times are within 1 second, consider them the same (clock skew tolerance)
    if (Math.abs(localTime - remoteTime) < 1000) {
      return false;
    }

    // Conflict exists if remote is newer than what we have locally
    return remoteTime > localTime;
  }

  /**
   * Detect and record a conflict, notify subscribers
   * Uses last-write-wins strategy but notifies user
   */
  detectConflict(
    entityType: ConflictInfo['entityType'],
    entityId: string,
    localUpdatedAt: string,
    remoteUpdatedAt: string,
    entityTitle?: string
  ): ConflictInfo | null {
    if (!this.hasConflict(localUpdatedAt, remoteUpdatedAt)) {
      return null;
    }

    const localTime = new Date(localUpdatedAt).getTime();
    const remoteTime = new Date(remoteUpdatedAt).getTime();

    // Last-write-wins: whoever has the newer timestamp wins
    const resolution: ConflictInfo['resolution'] =
      localTime > remoteTime ? 'local_wins' : 'remote_wins';

    const conflict: ConflictInfo = {
      entityType,
      entityId,
      entityTitle,
      localUpdatedAt,
      remoteUpdatedAt,
      resolution,
    };

    this.recordConflict(conflict);
    this.notifyConflict(conflict);

    return conflict;
  }

  /**
   * Record a conflict for history/debugging
   */
  private recordConflict(conflict: ConflictInfo): void {
    this.recentConflicts.unshift(conflict);
    if (this.recentConflicts.length > this.MAX_STORED_CONFLICTS) {
      this.recentConflicts = this.recentConflicts.slice(0, this.MAX_STORED_CONFLICTS);
    }
  }

  /**
   * Notify all subscribers of a conflict
   */
  private notifyConflict(conflict: ConflictInfo): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(conflict);
      } catch (error) {
        console.error('[ConflictDetector] Callback error:', error);
      }
    });

    // Also emit a custom event for global handling
    window.dispatchEvent(
      new CustomEvent('sync-conflict', {
        detail: conflict,
      })
    );
  }

  /**
   * Get recent conflicts for debugging/display
   */
  getRecentConflicts(): ConflictInfo[] {
    return [...this.recentConflicts];
  }

  /**
   * Clear conflict history
   */
  clearConflicts(): void {
    this.recentConflicts = [];
  }

  /**
   * Format a conflict for user display
   */
  formatConflictMessage(conflict: ConflictInfo): string {
    const title = conflict.entityTitle || conflict.entityId;
    const entityLabel =
      conflict.entityType === 'goal'
        ? 'goal'
        : conflict.entityType === 'event'
          ? 'event'
          : conflict.entityType === 'brainDump'
            ? 'note'
            : 'review';

    if (conflict.resolution === 'remote_wins') {
      return `"${title}" was updated on another device. Your local changes were overwritten.`;
    } else {
      return `"${title}" ${entityLabel} synced (your version kept).`;
    }
  }
}

// Export singleton
export const conflictDetector = new ConflictDetector();
export default conflictDetector;
