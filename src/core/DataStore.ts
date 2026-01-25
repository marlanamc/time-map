// ===================================
// Data Store - Pure data management without side effects
// ===================================
import type { AppData } from '../types';
import { VIEWS } from '../config';
import {
  validateAppData,
  validateGoalsArray,
  formatValidationErrors,
} from './Validation';

export class DataStore {
  private data: AppData | null = null;
  private subscribers: Set<(data: AppData | null) => void> = new Set();

  /**
   * Subscribe to data changes
   */
  subscribe(callback: (data: AppData | null) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify subscribers of data changes
   */
  private notify(): void {
    this.subscribers.forEach(callback => callback(this.data));
  }

  /**
   * Get current data
   */
  getData(): AppData | null {
    return this.data;
  }

  /**
   * Set data and notify subscribers
   */
  setData(data: AppData | null): void {
    this.data = data;
    this.notify();
  }

  /**
   * Update specific data properties
   */
  updateData(updates: Partial<AppData>): void {
    if (!this.data) {
      this.data = this.createDefaultData();
    }
    this.data = { ...this.data, ...updates };
    this.notify();
  }

  /**
   * Create default data structure
   */
  createDefaultData(): AppData {
    return {
      goals: [],
      events: [],
      streak: { count: 0, lastDate: null },
      achievements: [],
      weeklyReviews: [],
      brainDump: [],
      bodyDoubleHistory: [],
      preferences: {
        focusMode: false,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day",
        defaultView: VIEWS.YEAR,
        layout: {
          showHeader: true,
          showControlBar: true,
          showSidebar: true,
          showNowPanel: true,
        },
        sidebar: {
          showAffirmation: false,
          showWhatsNext: false,
          showAchievements: false,
        },
        sidebarSections: {
          affirmation: false,
          upcoming: true,
          achievements: false,
        },
        nd: {
          accentTheme: "sage",
          breakReminder: "gentle",
          feedbackStyle: "moderate",
          maxVisibleTasks: "normal",
          showInitiationPrompts: true,
          fontChoice: "default",
          textSpacing: "normal",
          hideCompletedTasks: false,
          autoBodyDouble: false,
          transitionWarnings: true,
          simplifiedView: false,
          colorBlindMode: "none",
          showTimeInMultipleFormats: true,
          taskStartReminders: true,
          allowPartialProgress: true,
          reduceEmojis: false,
          contextBarCollapsed: false,
        },
      },
      analytics: {
        goalsCreated: 0,
        goalsCompleted: 0,
        totalTimeSpent: 0,
        streakBest: 0,
      },
      createdAt: new Date().toISOString(),
      version: 2,
    };
  }

  /**
   * Ensure data structure integrity
   */
  ensureDataShape(): boolean {
    const defaults = this.createDefaultData();
    let changed = false;

    if (!this.data || typeof this.data !== "object") {
      this.data = defaults;
      return true;
    }

    // Ensure all required properties exist
    const requiredKeys = Object.keys(defaults) as (keyof AppData)[];
    for (const key of requiredKeys) {
      if (!(key in this.data) || typeof this.data[key] !== typeof defaults[key]) {
        (this.data as any)[key] = defaults[key];
        changed = true;
      }
    }

    // Ensure preferences structure
    if (!this.data.preferences || typeof this.data.preferences !== "object") {
      this.data.preferences = defaults.preferences;
      changed = true;
    } else {
      this.data.preferences = { ...defaults.preferences, ...this.data.preferences };
    }

    // Ensure analytics structure
    if (!this.data.analytics || typeof this.data.analytics !== "object") {
      this.data.analytics = defaults.analytics;
      changed = true;
    } else {
      this.data.analytics = { ...defaults.analytics, ...this.data.analytics };
    }

    if (changed) {
      this.notify();
    }

    return changed;
  }

  /**
   * Migrate data if needed
   */
  migrateDataIfNeeded(): void {
    if (!this.data) return;
    let changed = false;

    if (!this.data.version || this.data.version < 2) {
      this.data.weeklyReviews = this.data.weeklyReviews || [];
      this.data.analytics = this.data.analytics || this.createDefaultData().analytics;
      this.data.version = 2;
      changed = true;
    }

    // Migrate violet accent theme to amber
    const accentTheme = this.data.preferences?.nd?.accentTheme;
    if (accentTheme === ("violet" as any)) {
      this.data.preferences!.nd!.accentTheme = "amber";
      changed = true;
    }

    if (changed) {
      this.notify();
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data = null;
    this.notify();
  }

  /**
   * Get data for backup/export
   */
  getExportData(): AppData & { exportedAt: string } {
    return {
      ...this.getData()!,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import data from backup with validation
   */
  importData(importData: AppData): { success: boolean; errors?: string } {
    // Remove export timestamp if present
    const dataToImport = { ...importData };
    if ('exportedAt' in dataToImport) {
      delete (dataToImport as any).exportedAt;
    }

    // Validate the imported data structure
    const validation = validateAppData(dataToImport);
    if (!validation.success) {
      const errorMsg = formatValidationErrors(validation.errors);
      console.warn('[DataStore] Import validation failed:', errorMsg);

      // Attempt to salvage valid data by merging with defaults
      const defaults = this.createDefaultData();
      const salvagedData = { ...defaults, ...dataToImport };
      salvagedData.createdAt = dataToImport.createdAt || new Date().toISOString();

      // Filter out invalid goals
      if (Array.isArray(dataToImport.goals)) {
        const { valid, invalid } = validateGoalsArray(dataToImport.goals);
        if (invalid.length > 0) {
          console.warn(`[DataStore] Filtered out ${invalid.length} invalid goals during import`);
        }
        salvagedData.goals = valid as AppData['goals'];
      }

      this.setData(salvagedData);
      return {
        success: true,
        errors: `Some data was invalid and filtered: ${errorMsg}`
      };
    }

    // Data is valid, import as-is with defaults for missing fields
    const defaults = this.createDefaultData();
    const validatedData = { ...defaults, ...validation.data } as AppData;
    validatedData.createdAt = validation.data.createdAt || new Date().toISOString();

    this.setData(validatedData);
    return { success: true };
  }

  /**
   * Validate current data and log any issues
   * @returns true if data is valid, false otherwise
   */
  validateCurrentData(): boolean {
    if (!this.data) {
      return true; // No data is technically valid (empty state)
    }

    const result = validateAppData(this.data);
    if (!result.success) {
      console.warn(
        '[DataStore] Current data validation failed:',
        formatValidationErrors(result.errors)
      );
      return false;
    }
    return true;
  }
}
