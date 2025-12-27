/**
 * DirtyTracker - Tracks which entities need syncing to cloud storage
 *
 * This service enables instant UI feedback by tracking local changes
 * separately from cloud sync status. Items are marked "dirty" when
 * edited locally and "clean" after successful cloud sync.
 *
 * Benefits:
 * - UI updates instantly without waiting for cloud
 * - Batch sync only dirty items
 * - Prevent unnecessary sync operations
 */

class DirtyTracker {
  private dirtyFlags: Map<string, Set<string>> = new Map(); // entity -> Set of IDs
  private lastSaveTimestamp: Map<string, number> = new Map(); // entity:id -> timestamp

  /**
   * Mark an entity as dirty (needs syncing)
   */
  markDirty(entity: string, id: string): void {
    if (!this.dirtyFlags.has(entity)) {
      this.dirtyFlags.set(entity, new Set());
    }
    this.dirtyFlags.get(entity)!.add(id);
  }

  /**
   * Mark an entity as clean (synced successfully)
   */
  markClean(entity: string, id: string): void {
    this.dirtyFlags.get(entity)?.delete(id);
    this.lastSaveTimestamp.set(`${entity}:${id}`, Date.now());
  }

  /**
   * Check if an entity is dirty
   */
  isDirty(entity: string, id: string): boolean {
    return this.dirtyFlags.get(entity)?.has(id) || false;
  }

  /**
   * Get all dirty IDs for an entity type
   */
  getDirty(entity: string): string[] {
    return Array.from(this.dirtyFlags.get(entity) || []);
  }

  /**
   * Clear all dirty flags (use with caution)
   */
  clearAll(): void {
    this.dirtyFlags.clear();
  }

  /**
   * Clear dirty flags for a specific entity type
   */
  clearEntity(entity: string): void {
    this.dirtyFlags.delete(entity);
  }

  /**
   * Get timestamp of last successful save
   */
  getLastSave(entity: string, id: string): number | null {
    return this.lastSaveTimestamp.get(`${entity}:${id}`) || null;
  }

  /**
   * Get items that need saving (dirty and not recently saved)
   *
   * @param entity - Entity type (e.g., 'goal', 'brainDump')
   * @param minInterval - Minimum time since last save in ms (default: 5000ms)
   * @returns Array of IDs that need saving
   */
  getItemsNeedingSave(entity: string, minInterval = 5000): string[] {
    const dirty = this.getDirty(entity);
    const now = Date.now();

    return dirty.filter(id => {
      const lastSave = this.getLastSave(entity, id);
      return !lastSave || (now - lastSave) >= minInterval;
    });
  }

  /**
   * Get statistics about dirty state
   */
  getStats() {
    const stats: Record<string, number> = {};

    for (const [entity, ids] of this.dirtyFlags.entries()) {
      stats[entity] = ids.size;
    }

    return {
      entities: stats,
      totalDirty: Array.from(this.dirtyFlags.values())
        .reduce((sum, set) => sum + set.size, 0)
    };
  }
}

// Export singleton instance
export const dirtyTracker = new DirtyTracker();
export default dirtyTracker;
