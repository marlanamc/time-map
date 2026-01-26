// ===================================
// State Management
// ===================================
import type { AppState, AppData, ViewType, Goal } from "../types";
import { CONFIG, VIEWS } from "../config";
import { SupabaseService } from "../services/supabase";
import { AuthComponent } from "../components/Auth";
import { batchSaveService } from "../services/BatchSaveService";
import { cacheService } from "../services/CacheService";
import { warmCache } from "../services/cacheWarmup";
import { syncQueue } from "../services/SyncQueue";
import {
  throttledPreferencesAndAnalyticsSync,
  throttledStreakSync,
} from "../services/sync/syncHelpers";
import { eventBus } from "./EventBus";
import { isSupabaseConfigured } from "../supabaseClient";
import { BadgingService } from "../services/pwa/BadgingService";
import DB, { DB_STORES } from "../db";

const AUTH_MODAL_DONT_SHOW_KEY = "gardenFence.authModal.dontShow";

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
  updateAppBadge: () => void;
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
    // 1. Always load data first (handles cloud, local, and IDB fallbacks)
    await this.load();

    // 2. Check for user (avoid loading Supabase client if not configured)
    const user = isSupabaseConfigured ? await SupabaseService.getUser() : null;

    if (!user) {
      let suppressAuthModal = false;
      try {
        suppressAuthModal =
          localStorage.getItem(AUTH_MODAL_DONT_SHOW_KEY) === "1";
      } catch {
        suppressAuthModal = false;
      }

      if (!suppressAuthModal) {
        // Show Auth Modal if not logged in
        console.log("[State] No user found, showing auth modal...");
        const auth = new AuthComponent();
        auth.render();
        auth.show();
      }
    } else {
      // Start optimization services for logged-in users
      console.log("[State] User logged in, starting optimization services...");
      batchSaveService.start();
      await warmCache(user.id);
      console.log("✓ Performance optimization services started");
    }

    this.updateAppBadge();

    if (!this.data) {
      // Fallback to defaults if no cloud data (new user)
      this.data = this.getDefaultData();
      // Don't auto-save empty defaults to cloud yet to avoid overwriting anything race-condition style
      // But maybe we should? For now let's just keep it in memory.
    }

    this.migrateDataIfNeeded();
    const changed = this.ensureDataShape();
    // Only save if data shape was corrected or migrated
    if (changed) this.save();

    // Apply persisted preferences to runtime state
    this.focusMode = !!this.data?.preferences?.focusMode;

    // IGNORE user preferred default view to avoid random resets.
    // Always default to GARDEN unless URL overrides (which is handled in app.ts)
    // const preferredView = this.data?.preferences?.defaultView;
    // this.currentView = Object.values(VIEWS).includes(preferredView)
    //   ? preferredView
    //   : VIEWS.GARDEN;

    // We set it to GARDEN here. App.ts routing logic will override this if a URL slug is present.
    this.currentView = VIEWS.GARDEN;
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

    eventBus.emit("view:changed", { view, transition: true });
    eventBus.emit("view:sync-buttons");
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
      case VIEWS.GARDEN:
        d.setDate(d.getDate() + direction);
        this.goToDate(d);
        break;
    }
    eventBus.emit("view:changed", { view: this.currentView, transition: true });
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
          upcoming: true, // Expanded by default
          achievements: false, // Collapsed by default in medium energy
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
          customIntentions: [], // Cloud-synced intention templates
          checkInDay: 0, // Sunday
          checkInTime: "09:00",
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

    // Migrate custom intentions from legacy localStorage key to State if needed
    if (
      !this.data.preferences.nd.customIntentions ||
      this.data.preferences.nd.customIntentions.length === 0
    ) {
      const LEGACY_INTENTIONS_KEY = "gardenFence.customIntentions";
      try {
        const raw = localStorage.getItem(LEGACY_INTENTIONS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(
              "[State] Migrating custom intentions from legacy localStorage...",
            );
            this.data.preferences.nd.customIntentions = parsed;
            changed = true;
          }
        }
      } catch (e) {
        console.warn("[State] Failed to migrate legacy intentions:", e);
      }
    }

    if (changed) {
      this.save();
    }
  },

  ensureDataShape() {
    const defaults = this.getDefaultData();
    let changed = false;
    const isUuid = (value: unknown): value is string =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      );

    if (!this.data || typeof this.data !== "object") {
      this.data = defaults;
      return true;
    }

    if (!Array.isArray(this.data.goals)) {
      this.data.goals = [];
      changed = true;
    }
    if (Array.isArray(this.data.goals)) {
      this.data.goals.forEach((goal) => {
        if (!Object.prototype.hasOwnProperty.call(goal, "scheduledAt")) {
          goal.scheduledAt = null;
          changed = true;
        }
      });
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
        if (!entry || typeof entry !== "object") return;
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
      this.data.preferences = {
        ...defaults.preferences,
        ...this.data.preferences,
      };
    }

    if (
      !this.data.preferences.layout ||
      typeof this.data.preferences.layout !== "object"
    ) {
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

    if (
      !this.data.preferences.nd ||
      typeof this.data.preferences.nd !== "object"
    ) {
      this.data.preferences.nd = { ...defaults.preferences.nd };
      changed = true;
    } else {
      this.data.preferences.nd = {
        ...defaults.preferences.nd,
        ...this.data.preferences.nd,
      };

      if (!Array.isArray(this.data.preferences.nd.customIntentions)) {
        this.data.preferences.nd.customIntentions = [];
        changed = true;
      }

      if (this.data.preferences.nd.checkInDay === undefined) {
        this.data.preferences.nd.checkInDay =
          defaults.preferences.nd.checkInDay;
        changed = true;
      }
      if (this.data.preferences.nd.checkInTime === undefined) {
        this.data.preferences.nd.checkInTime =
          defaults.preferences.nd.checkInTime;
        changed = true;
      }
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
      console.log("[State] Starting data load...");
      const cloudData = await SupabaseService.loadAllData();

      if (cloudData) {
        // Option A: Cloud Data Success
        this.data = { ...this.getDefaultData(), ...cloudData } as AppData;
        console.log("[State] ✓ Data loaded from cloud:", {
          goals: this.data.goals.length,
          hasPreferences: !!this.data.preferences,
        });

        // Sync cloud goals to local IndexedDB for future offline resilience
        // Replace IndexedDB contents entirely to respect cloud deletions
        try {
          // Get existing local goals to find ones that were deleted in cloud
          const localGoals = (await DB.getAll(DB_STORES.GOALS)) as Goal[];
          const cloudGoalIds = new Set(this.data.goals.map((g) => g.id));
          const deletedIds = localGoals
            .filter((g) => g?.id && !cloudGoalIds.has(g.id))
            .map((g) => g.id);

          // Delete goals that no longer exist in cloud
          if (deletedIds.length > 0) {
            await DB.bulkDelete(DB_STORES.GOALS, deletedIds);
            console.log(
              `[State] ✓ Cleaned up ${deletedIds.length} deleted goal(s) from IndexedDB`,
            );
          }

          // Update/add cloud goals
          if (this.data.goals.length > 0) {
            await DB.bulkUpdate(DB_STORES.GOALS, this.data.goals);
            console.log("[State] ✓ Synced cloud goals to IndexedDB");
          }
        } catch (dbError) {
          console.warn(
            "[State] Failed to sync cloud goals to IndexedDB:",
            dbError,
          );
        }

        // Persist the cloud-loaded snapshot locally for offline fallback
        try {
          localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data));
        } catch (storageError) {
          console.error(
            "[State] Failed to persist cloud snapshot to localStorage:",
            storageError,
          );
        }
      } else {
        // Option B: No Cloud Data - Checking LocalStorage
        console.log(
          "[State] No cloud data available, checking localStorage...",
        );
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (stored) {
          try {
            this.data = JSON.parse(stored) as AppData;
            console.log("[State] ✓ Data loaded from localStorage");
          } catch (parseError) {
            console.error(
              "[State] Failed to parse localStorage data:",
              parseError,
            );
          }
        }
      }

      // Only merge IndexedDB goals if we failed to load cloud data (offline mode)
      // If cloud data loaded successfully, trust it as the source of truth for deletions
      if (this.data?.goals && !cloudData) {
        try {
          const localGoals = (await DB.getAll(DB_STORES.GOALS)) as Goal[];
          if (Array.isArray(localGoals) && localGoals.length > 0) {
            const mergedGoals = new Map<string, Goal>();
            this.data.goals.forEach((goal) => mergedGoals.set(goal.id, goal));
            let mergedCount = 0;
            localGoals.forEach((localGoal) => {
              if (!localGoal?.id) return;
              const existing = mergedGoals.get(localGoal.id);
              const localUpdated = localGoal.updatedAt
                ? new Date(localGoal.updatedAt).getTime()
                : 0;
              const remoteUpdated = existing?.updatedAt
                ? new Date(existing.updatedAt).getTime()
                : 0;
              if (!existing || localUpdated > remoteUpdated) {
                mergedGoals.set(localGoal.id, localGoal);
                mergedCount++;
              }
            });
            if (mergedCount > 0 && mergedGoals.size > 0) {
              this.data.goals = Array.from(mergedGoals.values());
              console.log(
                `[State] Merged ${mergedCount} local goal(s) from IndexedDB into cloud data`,
              );
              try {
                localStorage.setItem(
                  CONFIG.STORAGE_KEY,
                  JSON.stringify(this.data),
                );
              } catch (storageError) {
                console.warn(
                  "[State] Failed to persist merged goals to localStorage:",
                  storageError,
                );
              }
            }
          }
        } catch (mergeError) {
          console.warn(
            "[State] Failed to merge local IndexedDB goals:",
            mergeError,
          );
        }
      }

      // Option C: IndexedDB Recovery (Fallback if goals are missing)
      if (!this.data || !this.data.goals || this.data.goals.length === 0) {
        console.log(
          "[State] Data absent or empty, searching IndexedDB for goals...",
        );
        try {
          const localGoals = await DB.getAll(DB_STORES.GOALS);
          if (localGoals && localGoals.length > 0) {
            if (!this.data) this.data = this.getDefaultData();
            this.data.goals = localGoals;
            console.log("[State] ✓ Recovered goals from IndexedDB");

            // Save this recovered state to localStorage for faster future loading
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data));
          }
        } catch (dbError) {
          console.error("[State] Failed to load from IndexedDB:", dbError);
        }
      }

      if (!this.data) {
        console.log("[State] No data found in any source, will use defaults");
      }

      this.updateAppBadge();
    } catch (e) {
      console.error("[State] Critical error during data load:", e);
      if (!this.data) {
        console.log("[State] Load failed, falling back to empty defaults");
        this.data = this.getDefaultData();
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
          console.log("[State] ✓ Data saved to localStorage");
        } catch (storageError) {
          console.error(
            "[State] Failed to save to localStorage:",
            storageError,
          );
          // Continue with cloud save even if localStorage fails
        }

        // Cloud save - use throttled sync for preferences (max once per 5s)
        try {
          const user = await SupabaseService.getUser();
          if (user && this.data.preferences) {
            throttledPreferencesAndAnalyticsSync(
              this.data.preferences,
              this.data.analytics,
            );
            throttledStreakSync(
              this.data.streak,
              this.data.analytics?.streakBest,
            );
          } else if (!user) {
            console.log("[State] Not authenticated, skipping cloud save");
          }
        } catch (cloudError) {
          console.error(
            "[State] Failed to save preferences to cloud:",
            cloudError,
          );
          if (cloudError instanceof Error) {
            console.error("[State] Cloud save error details:", {
              message: cloudError.message,
              stack: cloudError.stack,
              name: cloudError.name,
            });
          }
          // Don't throw - local save succeeded, cloud save is best-effort
        }
      } else {
        console.warn("[State] Cannot save: data is null");
      }
    } catch (e) {
      console.error("[State] Failed to save data:", e);
      if (e instanceof Error) {
        console.error("[State] Save error details:", {
          message: e.message,
          stack: e.stack,
          name: e.name,
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
    console.log("Cleaning up State resources...");

    // Stop batch save service
    batchSaveService.stop();

    // Destroy sync queue and cleanup its resources
    syncQueue.destroy();

    // Clear cache
    cacheService.clear();

    console.log("✓ State resources cleaned up");
  },

  updateAppBadge() {
    if (!this.data?.goals) return;

    // Count pending intentions (not completed, level 'intention', and for today or past)
    // Actually, usually badges are for "today's tasks".
    // Let's count incomplete intentions for the current view date context, or just all incomplete intentions?
    // User request was "pending tasks". Let's stick to incomplete intentions for "today" if possible,
    // but State doesn't easily know "today" in terms of "what's relevant".
    // Let's just count ALL incomplete intentions for now as a simple metric.
    // Or better: Incomplete intentions that are active.

    // Let's filter for: level=intention AND !completed
    const pendingCount = this.data.goals.filter(
      (g) => g.level === "intention" && g.status !== "done",
    ).length;

    BadgingService.set(pendingCount);
  },
};
