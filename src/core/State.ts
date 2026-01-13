// ===================================
// State Management
// ===================================
import type { AppState, AppData, ViewType } from '../types';
import { CONFIG, VIEWS } from '../config';
import { SupabaseService } from '../services/supabase';
import { AuthComponent } from '../components/Auth';
import { batchSaveService } from '../services/BatchSaveService';
import { cacheService } from '../services/CacheService';
import { warmCache } from '../services/cacheWarmup';
import { syncQueue } from '../services/SyncQueue';
import { throttledPreferencesAndAnalyticsSync, throttledStreakSync } from '../services/sync/syncHelpers';
import { eventBus } from './EventBus';
import { isSupabaseConfigured } from '../supabaseClient';

const AUTH_MODAL_DONT_SHOW_KEY = 'gardenFence.authModal.dontShow';

export const State: AppState & {
  init: () => void;
  getWeekNumber: (date: Date) => number;
  getWeekYear: (date: Date) => number;
  getWeekStart: (year: number, weekNum: number) => Date;
  setView: (view: ViewType) => void;
  goToDate: (date: Date | string) => void;
  navigate: (direction: number) => void;
  getDefaultData: () => AppData;
  migrateDataIfNeeded: () => void;
  ensureDataShape: () => boolean;
  load: () => void;
  save: () => void;
  cleanup: () => Promise<void>;
} = {
  data: null,
  currentView: VIEWS.YEAR as ViewType,
  selectedMonth: null,
  selectedGoal: null,
  zoom: 100,
  focusMode: false,
  activeCategory: "all",
  viewingYear: new Date().getFullYear(),
  viewingMonth: new Date().getMonth(),
  viewingWeek: null, // Will be set to current week
  viewingDate: new Date(),

  async init() {
    // Check for user (avoid loading Supabase client if not configured)
    const user = isSupabaseConfigured ? await SupabaseService.getUser() : null;

    if (!user) {
      let suppressAuthModal = false;
      try {
        suppressAuthModal = localStorage.getItem(AUTH_MODAL_DONT_SHOW_KEY) === '1';
      } catch {
        suppressAuthModal = false;
      }

      if (!suppressAuthModal) {
        // Show Auth Modal if not logged in
        console.log('No user found, showing auth modal...');
        const auth = new AuthComponent();
        auth.render();
        // Ensure modal is visible
        auth.show();
      }
    } else {
      // Load cloud data
      console.log('User logged in, loading cloud data...');
      await this.load();

      // Start optimization services
      batchSaveService.start();
      await warmCache(user.id);
      console.log('✓ Performance optimization services started');
    }

    if (!this.data) {
      // Fallback to defaults if no cloud data (new user)
      this.data = this.getDefaultData();
      // Don't auto-save empty defaults to cloud yet to avoid overwriting anything race-condition style
      // But maybe we should? For now let's just keep it in memory.
    }

    this.migrateDataIfNeeded();
    const changed = this.ensureDataShape();
    // Only save if we have data and user is logged in
    if (changed && user) this.save();

    // Apply persisted preferences to runtime state
    this.focusMode = !!this.data?.preferences?.focusMode;
    const preferredView = this.data?.preferences?.defaultView;
    this.currentView = Object.values(VIEWS).includes(preferredView)
      ? preferredView
      : VIEWS.YEAR;
    // Initialize viewing week to current week
    this.viewingWeek = this.getWeekNumber(new Date());
  },

  // Get ISO week number
  getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  },

  // Get ISO week year (might differ from calendar year for dates in late Dec/early Jan)
  getWeekYear(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thursday of the week
    return d.getUTCFullYear(); // The year containing that Thursday
  },

  // Get the start date of a week (ISO week date system)
  getWeekStart(year: number, weekNum: number): Date {
    // ISO week 1 is the week containing the first Thursday of the year
    const jan4 = new Date(year, 0, 4); // Jan 4 is always in week 1
    const jan4Day = jan4.getDay() || 7; // Sunday = 7 in ISO
    const week1Start = new Date(jan4);
    week1Start.setDate(jan4.getDate() - (jan4Day - 1)); // Monday of week 1

    // Add weeks to get to the target week
    const targetWeekStart = new Date(week1Start);
    targetWeekStart.setDate(week1Start.getDate() + (weekNum - 1) * 7);

    return targetWeekStart;
  },

  // Navigate views
  setView(view: ViewType) {
    this.currentView = view;
    eventBus.emit('view:changed', { view, transition: true });
    eventBus.emit('view:sync-buttons');
  },

  // Navigate to specific date
  goToDate(date: Date | string) {
    this.viewingDate = new Date(date);
    this.viewingYear = this.viewingDate.getFullYear();
    this.viewingMonth = this.viewingDate.getMonth();
    this.viewingWeek = this.getWeekNumber(this.viewingDate);
  },

  // Navigate forward/back in current view
  navigate(direction: number) {
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
  },

  getDefaultData(): AppData {
    return {
      goals: [],
      events: [],
      streak: { count: 0, lastDate: null },
      achievements: [],
      weeklyReviews: [],
      brainDump: [], // Parking lot for intrusive thoughts/ideas
      bodyDoubleHistory: [], // Track body double sessions
      preferences: {
        focusMode: false,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches,
        theme: window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "night"
          : "day",
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
          affirmation: false, // Collapsed by default in medium energy
          upcoming: true,     // Expanded by default
          achievements: false // Collapsed by default in medium energy
        },
        // Neurodivergent accessibility preferences
        nd: {
          accentTheme: "sage", // teal, coral, sage, amber, mint, sky, rose, indigo, violet
          breakReminder: "gentle", // pomodoro, gentle, hyperfocus, off
          feedbackStyle: "moderate", // subtle, moderate, celebration, minimal
          maxVisibleTasks: "normal", // overwhelmed, low_energy, normal, high_energy
          showInitiationPrompts: true,
          fontChoice: "default", // default, dyslexia, mono, readable
          textSpacing: "normal", // compact, normal, relaxed, dyslexia
          hideCompletedTasks: false,
          autoBodyDouble: false,
          transitionWarnings: true,
          simplifiedView: false, // Hides extra info, shows only essentials
          colorBlindMode: "none", // none, deuteranopia, protanopia, tritanopia
          showTimeInMultipleFormats: true, // Show days AND weeks AND months
          taskStartReminders: true, // "Ready to start?" prompts
          allowPartialProgress: true, // Can mark tasks as 10%, 20%, etc.
          reduceEmojis: false, // Minimize emoji usage for less visual noise
          contextBarCollapsed: false, // Level context bar expanded by default
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
  },

  migrateDataIfNeeded(): void {
    // Migrate old data structures if needed
    if (!this.data) return;
    let changed = false;

    if (!this.data.version || this.data.version < 2) {
      this.data.weeklyReviews = this.data.weeklyReviews || [];
      this.data.analytics =
        this.data.analytics || this.getDefaultData().analytics;
      this.data.version = 2;
      changed = true;
    }

    // Migrate violet accent theme to amber (golden hour theme)
    // Check as string since violet is no longer in the type
    const accentTheme = this.data.preferences?.nd?.accentTheme;
    if (accentTheme === ("violet" as any)) {
      this.data.preferences.nd.accentTheme = "amber";
      changed = true;
    }

    if (changed) {
      this.save();
    }
  },

  ensureDataShape() {
    const defaults = this.getDefaultData();
    let changed = false;
    const isUuid = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    if (!this.data || typeof this.data !== "object") {
      this.data = defaults;
      return true;
    }

    if (!Array.isArray(this.data.goals)) {
      this.data.goals = [];
      changed = true;
    }
    if (!Array.isArray(this.data.events)) {
      this.data.events = [];
      changed = true;
    }
    if (!Array.isArray(this.data.achievements)) {
      this.data.achievements = [];
      changed = true;
    }
    if (!Array.isArray(this.data.weeklyReviews)) {
      this.data.weeklyReviews = [];
      changed = true;
    }
    if (!Array.isArray(this.data.brainDump)) {
      this.data.brainDump = [];
      changed = true;
    } else {
      // Ensure IDs are UUIDs for Supabase compatibility (brain_dump.id is UUID)
      this.data.brainDump.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const id = (entry as { id?: unknown }).id;
        if (!isUuid(id)) {
          (entry as { id: string }).id = crypto.randomUUID();
          changed = true;
        }
      });
    }
    if (!Array.isArray(this.data.bodyDoubleHistory)) {
      this.data.bodyDoubleHistory = [];
      changed = true;
    }
    if (!this.data.streak || typeof this.data.streak !== "object") {
      this.data.streak = { ...defaults.streak };
      changed = true;
    } else {
      this.data.streak = { ...defaults.streak, ...this.data.streak };
    }

    if (!this.data.preferences || typeof this.data.preferences !== "object") {
      this.data.preferences = { ...defaults.preferences };
      changed = true;
    } else {
      this.data.preferences = { ...defaults.preferences, ...this.data.preferences };
    }

    if (!this.data.preferences.layout || typeof this.data.preferences.layout !== "object") {
      this.data.preferences.layout = { ...defaults.preferences.layout };
      changed = true;
    } else {
      this.data.preferences.layout = {
        ...defaults.preferences.layout,
        ...this.data.preferences.layout,
      };
    }

    if (
      !this.data.preferences.sidebar ||
      typeof this.data.preferences.sidebar !== "object"
    ) {
      this.data.preferences.sidebar = { ...defaults.preferences.sidebar };
      changed = true;
    } else {
      this.data.preferences.sidebar = {
        ...defaults.preferences.sidebar,
        ...this.data.preferences.sidebar,
      };
    }

    if (!this.data.preferences.nd || typeof this.data.preferences.nd !== "object") {
      this.data.preferences.nd = { ...defaults.preferences.nd };
      changed = true;
    } else {
      this.data.preferences.nd = {
        ...defaults.preferences.nd,
        ...this.data.preferences.nd,
      };
    }

    if (!this.data.analytics || typeof this.data.analytics !== "object") {
      this.data.analytics = { ...defaults.analytics };
      changed = true;
    } else {
      this.data.analytics = { ...defaults.analytics, ...this.data.analytics };
    }

    if (!this.data.version || typeof this.data.version !== "number") {
      this.data.version = defaults.version;
      changed = true;
    }

    return changed;
  },

  async load(): Promise<void> {
    try {
      console.log('[State] Loading data from cloud...');
      const cloudData = await SupabaseService.loadAllData();
      if (cloudData) {
        // Merge cloud data with defaults to ensure complete state
        this.data = { ...this.getDefaultData(), ...cloudData } as AppData;
        console.log('[State] ✓ Data loaded from cloud:', {
          goals: this.data.goals.length,
          brainDump: this.data.brainDump.length,
          achievements: this.data.achievements.length,
          weeklyReviews: this.data.weeklyReviews.length,
          hasPreferences: !!this.data.preferences
        });
      } else {
        // Fallback to local or default
        console.log('[State] No cloud data found, checking localStorage...');
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (stored) {
          try {
            this.data = JSON.parse(stored) as AppData;
            console.log('[State] ✓ Data loaded from localStorage');
          } catch (parseError) {
            console.error('[State] Failed to parse localStorage data:', parseError);
            this.data = null;
          }
        } else {
          console.log('[State] No local data found, will use defaults');
          this.data = null;
        }
      }
    } catch (e) {
      console.error("[State] Failed to load data:", e);
      if (e instanceof Error) {
        console.error("[State] Error details:", {
          message: e.message,
          stack: e.stack,
          name: e.name
        });
      }
      // Try to fallback to localStorage on error
      try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (stored) {
          this.data = JSON.parse(stored) as AppData;
          console.log('[State] ✓ Fallback: Data loaded from localStorage after error');
        } else {
          this.data = null;
        }
      } catch (fallbackError) {
        console.error("[State] Fallback to localStorage also failed:", fallbackError);
        this.data = null;
      }
    }
  },

  async save(): Promise<void> {
    // We don't save the entire state blob anymore, we save individual entities
    // But for backward compatibility or easy porting, we might want to still do something here.
    // Actually, in a real app, 'save()' usually saves *changes*.
    // For this refactor, we should probably update specific save calls throughout the app.
    // BUT, to keep it simple, we can try to save preferences here.
    // Real data (goals, etc) should be saved when they change.

    try {
      if (this.data) {
        // Local backup always
        try {
          localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data));
          console.log('[State] ✓ Data saved to localStorage');
        } catch (storageError) {
          console.error("[State] Failed to save to localStorage:", storageError);
          // Continue with cloud save even if localStorage fails
        }

        // Cloud save - use throttled sync for preferences (max once per 5s)
        try {
          const user = await SupabaseService.getUser();
          if (user && this.data.preferences) {
            throttledPreferencesAndAnalyticsSync(this.data.preferences, this.data.analytics);
            throttledStreakSync(this.data.streak, this.data.analytics?.streakBest);
          } else if (!user) {
            console.log('[State] Not authenticated, skipping cloud save');
          }
        } catch (cloudError) {
          console.error("[State] Failed to save preferences to cloud:", cloudError);
          if (cloudError instanceof Error) {
            console.error("[State] Cloud save error details:", {
              message: cloudError.message,
              stack: cloudError.stack,
              name: cloudError.name
            });
          }
          // Don't throw - local save succeeded, cloud save is best-effort
        }
      } else {
        console.warn('[State] Cannot save: data is null');
      }
    } catch (e) {
      console.error("[State] Failed to save data:", e);
      if (e instanceof Error) {
        console.error("[State] Save error details:", {
          message: e.message,
          stack: e.stack,
          name: e.name
        });
      }
      // Don't throw - this is a best-effort save operation
    }
  },

  /**
   * Cleanup resources on logout or app shutdown
   * Should be called before signing out to properly cleanup services
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up State resources...');

    // Stop batch save service
    batchSaveService.stop();

    // Destroy sync queue and cleanup its resources
    syncQueue.destroy();

    // Clear cache
    cacheService.clear();

    console.log('✓ State resources cleaned up');
  },
};
