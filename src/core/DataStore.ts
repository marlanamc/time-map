// ===================================
// Data Store - Pure data management without side effects
// ===================================
import type { AppData } from '../types';
import { VIEWS } from '../config';

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
   * Import data from backup
   */
  importData(importData: AppData): void {
    // Validate imported data structure
    const defaults = this.createDefaultData();
    const validatedData = { ...defaults, ...importData };
    validatedData.createdAt = importData.createdAt || new Date().toISOString();
    
    // Remove export timestamp if present
    if ('exportedAt' in validatedData) {
      delete (validatedData as any).exportedAt;
    }
    
    this.setData(validatedData);
  }
}
