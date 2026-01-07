// ===================================
// Sync Service - Handles all data synchronization
// ===================================
import { SupabaseService } from '../services/SupabaseService';
import { isSupabaseConfigured } from '../supabaseClient';
import { throttledPreferencesAndAnalyticsSync, throttledStreakSync } from '../utils/syncHelpers';
import type { AppData } from '../types';

export interface SyncStatus {
  status: 'syncing' | 'synced' | 'error' | 'local' | 'offline';
  lastSync?: Date;
  error?: string;
}

export class SyncService {
  private subscribers: Set<(status: SyncStatus) => void> = new Set();
  private currentStatus: SyncStatus = { status: 'local' };

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback: (status: SyncStatus) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify subscribers of status changes
   */
  private notify(): void {
    this.subscribers.forEach(callback => callback(this.currentStatus));
  }

  /**
   * Update sync status
   */
  private setStatus(status: SyncStatus['status'], error?: string): void {
    this.currentStatus = {
      status,
      lastSync: status === 'synced' ? new Date() : this.currentStatus.lastSync,
      error
    };
    this.notify();
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.currentStatus };
  }

  /**
   * Load data from cloud with fallback to local
   */
  async loadData(): Promise<AppData | null> {
    if (!isSupabaseConfigured) {
      console.log('[SyncService] Supabase not configured, using local mode');
      this.setStatus('local');
      return this.loadLocalData();
    }

    try {
      this.setStatus('syncing');
      console.log('[SyncService] Loading data from cloud...');

      const user = await SupabaseService.getUser();
      if (!user) {
        console.log('[SyncService] No user found, loading local data');
        this.setStatus('local');
        return this.loadLocalData();
      }

      const cloudData = await SupabaseService.loadAllData();
      if (cloudData) {
        console.log('[SyncService] ✓ Data loaded from cloud');
        this.setStatus('synced');
        return cloudData;
      } else {
        console.log('[SyncService] No cloud data found, checking local...');
        const localData = this.loadLocalData();
        if (localData) {
          console.log('[SyncService] ✓ Data loaded from localStorage');
        }
        this.setStatus('local');
        return localData;
      }
    } catch (error) {
      console.error('[SyncService] Failed to load from cloud:', error);
      const localData = this.loadLocalData();
      this.setStatus('error', error instanceof Error ? error.message : 'Unknown error');
      return localData;
    }
  }

  /**
   * Save data to cloud and local
   */
  async saveData(data: AppData, options?: { 
    cloudOnly?: boolean; 
    localOnly?: boolean; 
    preferencesOnly?: boolean 
  }): Promise<void> {
    if (!isSupabaseConfigured) {
      console.log('[SyncService] Supabase not configured, saving locally only');
      if (!options?.cloudOnly) {
        this.saveLocalData(data);
      }
      this.setStatus('local');
      return;
    }

    try {
      this.setStatus('syncing');

      const user = await SupabaseService.getUser();
      if (!user) {
        console.log('[SyncService] No user found, saving locally only');
        if (!options?.cloudOnly) {
          this.saveLocalData(data);
        }
        this.setStatus('local');
        return;
      }

      if (options?.localOnly) {
        this.saveLocalData(data);
        this.setStatus('synced');
        return;
      }

      if (options?.preferencesOnly) {
        // Save preferences and analytics using throttled sync
        if (data.preferences) {
          throttledPreferencesAndAnalyticsSync(data.preferences, data.analytics);
        }
        if (data.streak) {
          throttledStreakSync(data.streak, data.analytics?.streakBest);
        }
        // Also save locally as backup
        if (!options?.cloudOnly) {
          this.saveLocalData(data);
        }
        this.setStatus('synced');
        return;
      }

      // Full cloud save
      await SupabaseService.saveAllData(data);
      
      // Also save locally as backup
      if (!options?.cloudOnly) {
        this.saveLocalData(data);
      }

      console.log('[SyncService] ✓ Data saved to cloud');
      this.setStatus('synced');
    } catch (error) {
      console.error('[SyncService] Failed to save to cloud:', error);
      
      // Always save locally as fallback
      if (!options?.cloudOnly) {
        this.saveLocalData(data);
      }
      
      this.setStatus('error', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Load data from localStorage
   */
  private loadLocalData(): AppData | null {
    try {
      const stored = localStorage.getItem('gardenFenceData');
      if (stored) {
        return JSON.parse(stored) as AppData;
      }
    } catch (error) {
      console.error('[SyncService] Failed to load local data:', error);
    }
    return null;
  }

  /**
   * Save data to localStorage
   */
  private saveLocalData(data: AppData): void {
    try {
      localStorage.setItem('gardenFenceData', JSON.stringify(data));
      console.log('[SyncService] ✓ Data saved to localStorage');
    } catch (error) {
      console.error('[SyncService] Failed to save local data:', error);
    }
  }

  /**
   * Force sync from cloud
   */
  async forceSync(): Promise<void> {
    if (!isSupabaseConfigured) {
      this.setStatus('local');
      return;
    }

    try {
      this.setStatus('syncing');
      const data = await this.loadData();
      if (data) {
        // Emit event for data reload
        window.dispatchEvent(new CustomEvent('sync:force-complete', { 
          detail: { data } 
        }));
      }
    } catch (error) {
      console.error('[SyncService] Force sync failed:', error);
      this.setStatus('error', error instanceof Error ? error.message : 'Force sync failed');
    }
  }

  /**
   * Clear all local data
   */
  clearLocalData(): void {
    try {
      localStorage.removeItem('gardenFenceData');
      console.log('[SyncService] ✓ Local data cleared');
    } catch (error) {
      console.error('[SyncService] Failed to clear local data:', error);
    }
  }

  /**
   * Check if cloud sync is available
   */
  isCloudSyncAvailable(): boolean {
    return isSupabaseConfigured;
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    isAvailable: boolean;
    status: SyncStatus['status'];
    lastSync?: Date;
    hasLocalData: boolean;
  } {
    return {
      isAvailable: this.isCloudSyncAvailable(),
      status: this.currentStatus.status,
      lastSync: this.currentStatus.lastSync,
      hasLocalData: !!this.loadLocalData()
    };
  }
}
