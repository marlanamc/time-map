// ===================================
// State Controller - Coordinates data store and sync service
// ===================================
import { DataStore } from './DataStore';
import { SyncService, type SyncStatus } from './SyncService';
import { VIEWS } from '../config';
import { SupabaseService } from '../services/SupabaseService';
import { batchSaveService } from '../services/BatchSaveService';
import { cacheService } from '../services/CacheService';
import { warmCache } from '../services/cacheWarmup';
import { syncQueue } from '../services/SyncQueue';
import { eventBus } from './EventBus';
import { isSupabaseConfigured } from '../supabaseClient';
import type { AppData, ViewType } from '../types';

export class StateController {
  private dataStore: DataStore;
  private syncService: SyncService;
  
  // UI State (not persisted)
  private currentView: ViewType = VIEWS.YEAR;
  private selectedMonth: number | null = null;
  private selectedGoal: string | null = null;
  private zoom: number = 100;
  private focusMode: boolean = false;
  private activeCategory: string = "all";
  private viewingYear: number = new Date().getFullYear();
  private viewingMonth: number = new Date().getMonth();
  private viewingWeek: number | null = null;
  private viewingDate: Date = new Date();

  constructor() {
    this.dataStore = new DataStore();
    this.syncService = new SyncService();
    this.setupEventListeners();
  }

  /**
   * Initialize the state system
   */
  async init(): Promise<void> {
    console.log('[StateController] Initializing state system...');

    try {
      // Check for authenticated user
      const user = isSupabaseConfigured ? await SupabaseService.getUser() : null;

      if (user) {
        console.log('[StateController] User authenticated, loading cloud data...');
        await this.loadData();
        
        // Start optimization services
        batchSaveService.start();
        await warmCache(user.id);
        console.log('✓ Performance optimization services started');
      } else {
        console.log('[StateController] No user found, loading local data...');
        await this.loadData();
      }

      // Ensure data structure integrity
      const data = this.dataStore.getData();
      if (!data) {
        this.dataStore.setData(this.dataStore.createDefaultData());
      } else {
        this.dataStore.migrateDataIfNeeded();
        const changed = this.dataStore.ensureDataShape();
        if (changed && user) {
          await this.saveData({ preferencesOnly: true });
        }
      }

      // Apply preferences to UI state
      this.applyPreferencesToUI();

      // Initialize viewing week
      this.viewingWeek = this.getWeekNumber(new Date());

      console.log('[StateController] ✓ State system initialized');
    } catch (error) {
      console.error('[StateController] Failed to initialize:', error);
      // Fallback to defaults
      this.dataStore.setData(this.dataStore.createDefaultData());
    }
  }

  /**
   * Load data from sync service
   */
  private async loadData(): Promise<void> {
    const data = await this.syncService.loadData();
    if (data) {
      this.dataStore.setData(data);
    }
  }

  /**
   * Save data through sync service
   */
  private async saveData(options?: { 
    cloudOnly?: boolean; 
    localOnly?: boolean; 
    preferencesOnly?: boolean 
  }): Promise<void> {
    const data = this.dataStore.getData();
    if (data) {
      await this.syncService.saveData(data, options);
    }
  }

  /**
   * Apply preferences to UI state
   */
  private applyPreferencesToUI(): void {
    const data = this.dataStore.getData();
    if (!data?.preferences) return;

    this.focusMode = !!data.preferences.focusMode;
    const preferredView = data.preferences.defaultView;
    this.currentView = Object.values(VIEWS).includes(preferredView) ? preferredView : VIEWS.YEAR;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to sync status changes
    this.syncService.subscribe((status: SyncStatus) => {
      eventBus.emit('sync:status-changed', status);
    });

    // Listen to data changes
    this.dataStore.subscribe((data) => {
      eventBus.emit('data:changed', data);
    });

    // Listen to force sync requests
    window.addEventListener('sync:force-complete', async (e: CustomEvent) => {
      if (e.detail?.data) {
        this.dataStore.setData(e.detail.data);
      }
    });
  }

  /**
   * Get current data
   */
  getData(): AppData | null {
    return this.dataStore.getData();
  }

  /**
   * Update data
   */
  updateData(updates: Partial<AppData>): void {
    this.dataStore.updateData(updates);
    // Auto-save preferences and analytics
    if (updates.preferences || updates.analytics || updates.streak) {
      void this.saveData({ preferencesOnly: true });
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    return this.syncService.getStatus();
  }

  /**
   * Subscribe to data changes
   */
  subscribeToData(callback: (data: AppData | null) => void): () => void {
    return this.dataStore.subscribe(callback);
  }

  /**
   * Subscribe to sync status changes
   */
  subscribeToSync(callback: (status: SyncStatus) => void): () => void {
    return this.syncService.subscribe(callback);
  }

  // UI State Getters
  getCurrentView(): ViewType {
    return this.currentView;
  }

  getSelectedMonth(): number | null {
    return this.selectedMonth;
  }

  getSelectedGoal(): string | null {
    return this.selectedGoal;
  }

  getZoom(): number {
    return this.zoom;
  }

  getFocusMode(): boolean {
    return this.focusMode;
  }

  getActiveCategory(): string {
    return this.activeCategory;
  }

  getViewingYear(): number {
    return this.viewingYear;
  }

  getViewingMonth(): number {
    return this.viewingMonth;
  }

  getViewingWeek(): number | null {
    return this.viewingWeek;
  }

  getViewingDate(): Date {
    return this.viewingDate;
  }

  // UI State Setters
  setView(view: ViewType): void {
    this.currentView = view;
    eventBus.emit('view:changed', { view, transition: true });
    eventBus.emit('view:sync-buttons');
  }

  setSelectedMonth(month: number | null): void {
    this.selectedMonth = month;
  }

  setSelectedGoal(goalId: string | null): void {
    this.selectedGoal = goalId;
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
  }

  setFocusMode(enabled: boolean): void {
    this.focusMode = enabled;
    // Update preferences
    const data = this.getData();
    if (data) {
      this.updateData({
        preferences: {
          ...data.preferences,
          focusMode: enabled
        }
      });
    }
  }

  setActiveCategory(category: string): void {
    this.activeCategory = category;
  }

  goToDate(date: Date | string): void {
    this.viewingDate = new Date(date);
    this.viewingYear = this.viewingDate.getFullYear();
    this.viewingMonth = this.viewingDate.getMonth();
    this.viewingWeek = this.getWeekNumber(this.viewingDate);
  }

  navigate(direction: number): void {
    const d = new Date(this.viewingDate);
    switch (this.currentView) {
      case VIEWS.YEAR:
        this.viewingYear += direction;
        break;
      case VIEWS.MONTH:
        d.setMonth(d.getMonth() + direction);
        this.goToDate(d);
        break;
      case VIEWS.WEEK:
        d.setDate(d.getDate() + direction * 7);
        this.goToDate(d);
        break;
      case VIEWS.DAY:
        d.setDate(d.getDate() + direction);
        this.goToDate(d);
        break;
    }
    eventBus.emit('view:changed', { transition: true });
  }

  // Utility methods
  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  getWeekStart(year: number, weekNum: number): Date {
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const week1Start = new Date(jan4);
    week1Start.setDate(jan4.getDate() - (jan4Day - 1));
    const targetWeekStart = new Date(week1Start);
    targetWeekStart.setDate(week1Start.getDate() + (weekNum - 1) * 7);
    return targetWeekStart;
  }

  /**
   * Force sync from cloud
   */
  async forceSync(): Promise<void> {
    await this.syncService.forceSync();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('[StateController] Cleaning up resources...');
    
    // Stop services
    batchSaveService.stop();
    syncQueue.destroy();
    cacheService.clear();
    
    console.log('✓ StateController cleanup completed');
  }
}
