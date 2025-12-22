// ============================================
// The Garden Fence - Boundaries & Blooms
// ADHD-Friendly Focus & Boundary Setting
// ============================================

import type {
  TimeBreakdownResult,
  ViewType,
  Goal,
  GoalData,
  GoalStatus,
  Priority,
  Category,
  AppData,
  AppState,
  GoalLevel,
  Subtask,
  Note,
  TimeLogEntry,
  WeeklyReview,
  BrainDumpEntry,
  BodyDoubleSession,
  TextSpacing,
  AccentTheme,
  BreakReminder,
  FeedbackStyle,
  MaxVisibleTasks,
  FontChoice,
  ColorBlindMode,
} from './types';
import { SupabaseService } from './services/SupabaseService';
import { AuthComponent } from './components/Auth';

// UI Elements interface for proper typing
interface UIElements {
  calendarGrid: HTMLElement | null;
  canvas: HTMLCanvasElement | null;
  canvasContainer: HTMLElement | null;
  categoryFilters: HTMLElement | null;
  upcomingGoals: HTMLElement | null;
  goalModal: HTMLElement | null;
  goalForm: HTMLFormElement | null;
  goalMonth: HTMLInputElement | null;
  nowDate: HTMLElement | null;
  nowContext: HTMLElement | null;
  daysLeft: HTMLElement | null;
  weeksLeft: HTMLElement | null;
  timeProgress: HTMLElement | null;
  yearProgressFill: HTMLElement | null;
  gardenBloom: HTMLElement | null;
  flowerPetals: SVGElement | null;
  yearProgressLabel: HTMLElement | null;
  yearProgressValue: HTMLElement | null;
  zoomLevel: HTMLElement | null;
  affirmationText: HTMLElement | null;
  yearDisplay: HTMLElement | null;
  streakCount: HTMLElement | null;
  achievementsGrid: HTMLElement | null;
  achievementsPanel: HTMLElement | null;
  affirmationPanel: HTMLElement | null;
  whatsNextPanel: HTMLElement | null;
  toast: HTMLElement | null;
  toastMessage: HTMLElement | null;
  toastIcon: HTMLElement | null;
  celebrationModal: HTMLElement | null;
  celebrationEmoji: HTMLElement | null;
  celebrationTitle: HTMLElement | null;
  celebrationText: HTMLElement | null;
  confettiContainer: HTMLElement | null;
  brainDumpBtn: HTMLElement | null;
  bodyDoubleBtn: HTMLElement | null;
  ndSettingsBtn: HTMLElement | null;
  dopamineMenuBtn: HTMLElement | null;
  appearanceBtn: HTMLElement | null;
  appSettingsBtn: HTMLElement | null;
}

// Filter document listeners interface
interface FilterDocListeners {
  onDocClick: (e: MouseEvent) => void;
  onDocKeydown: (e: KeyboardEvent) => void;
}

// ============================================
// Time Breakdown Calculator (for time blindness)
// ============================================
const TimeBreakdown = {
  // Calculate all time metrics between now and a target date
  calculate(targetMonth: number, targetYear: number): TimeBreakdownResult {
    const now = new Date();
    const isCurrentMonth = targetMonth === now.getMonth() && targetYear === now.getFullYear();

    // For current month, calculate to end of month. For future months, calculate to start of month.
    const target = isCurrentMonth
      ? new Date(targetYear, targetMonth + 1, 0) // Last day of current month
      : new Date(targetYear, targetMonth, 1); // First day of future month

    const msPerDay = 1000 * 60 * 60 * 24;

    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / msPerDay));
    const diffWeeks = Math.max(0, Math.floor(diffDays / 7));

    // Calculate weekends
    let weekends = 0;
    const tempDate = new Date(now);
    while (tempDate <= target) {
      if (tempDate.getDay() === 0 || tempDate.getDay() === 6) {
        weekends++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
    weekends = Math.floor(weekends / 2); // Count weekend pairs

    // Calculate work sessions (assuming 3x per week)
    const workSessions3x = diffWeeks * 3;
    const workSessions5x = diffWeeks * 5;

    // Calculate months
    let months = (targetYear - now.getFullYear()) * 12;
    months += targetMonth - now.getMonth();
    months = Math.max(0, months);

    // Hours available (rough estimates)
    const focusHours1hDay = diffDays; // 1 hour per day
    const focusHours2hDay = diffDays * 2; // 2 hours per day

    return {
      days: diffDays,
      weeks: diffWeeks,
      months: months,
      weekends: weekends,
      workSessions3x: workSessions3x,
      workSessions5x: workSessions5x,
      focusHours1hDay: focusHours1hDay,
      focusHours2hDay: focusHours2hDay,
      isPast: diffMs < 0,
      isCurrentMonth:
        targetMonth === now.getMonth() && targetYear === now.getFullYear(),
    };
  },

  // Generate human-readable breakdown HTML
  generateHTML(targetMonth: number, targetYear: number, compact: boolean = false): string {
    const breakdown = this.calculate(targetMonth, targetYear);
    const monthName = CONFIG.MONTHS[targetMonth];

    if (breakdown.isPast) {
      return `<div class="time-breakdown past">
          <div class="time-breakdown-header">⏰ This anchor is in the past</div>
        </div>`;
    }

    if (breakdown.isCurrentMonth) {
      return `<div class="time-breakdown current">
          <div class="time-breakdown-header">🔥 This is NOW - ${breakdown.days} days left this month!</div>
          <div class="time-breakdown-grid">
            <div class="time-unit">
              <span class="time-value">${breakdown.days}</span>
              <span class="time-label">days</span>
            </div>
            <div class="time-unit">
              <span class="time-value">${breakdown.weekends}</span>
              <span class="time-label">weekends</span>
            </div>
            <div class="time-unit">
              <span class="time-value">${breakdown.workSessions3x}</span>
              <span class="time-label">sessions @3x/wk</span>
            </div>
          </div>
        </div>`;
    }

    if (compact) {
      return `<div class="time-breakdown compact">
          <span class="time-compact-item">📅 ${breakdown.days} days</span>
          <span class="time-compact-item">📆 ${breakdown.weeks} weeks</span>
          <span class="time-compact-item">🗓️ ${breakdown.months} months</span>
        </div>`;
    }

    return `<div class="time-breakdown">
        <div class="time-breakdown-header">
          ⏰ Time until ${monthName} ${targetYear}
        </div>
        <div class="time-breakdown-grid">
          <div class="time-unit highlight">
            <span class="time-value">${breakdown.days}</span>
            <span class="time-label">days</span>
          </div>
          <div class="time-unit">
            <span class="time-value">${breakdown.weeks}</span>
            <span class="time-label">weeks</span>
          </div>
          <div class="time-unit">
            <span class="time-value">${breakdown.months}</span>
            <span class="time-label">months</span>
          </div>
        </div>
        <div class="time-breakdown-details">
          <div class="time-detail">
            <span class="time-detail-icon">🌴</span>
            <span class="time-detail-text"><strong>${breakdown.weekends}</strong> weekends to work on this</span>
          </div>
          <div class="time-detail">
            <span class="time-detail-icon">💪</span>
            <span class="time-detail-text"><strong>${breakdown.workSessions3x}</strong> sessions if you work 3x/week</span>
          </div>
          <div class="time-detail">
            <span class="time-detail-icon">🚀</span>
            <span class="time-detail-text"><strong>${breakdown.workSessions5x}</strong> sessions if you work 5x/week</span>
          </div>
          <div class="time-detail">
            <span class="time-detail-icon">⏱️</span>
            <span class="time-detail-text"><strong>${breakdown.focusHours1hDay}h</strong> total if 1h/day, <strong>${breakdown.focusHours2hDay}h</strong> if 2h/day</span>
          </div>
        </div>
        <div class="time-breakdown-tip">
          💡 <em>Break this anchor into ${Math.max(1, Math.ceil(breakdown.weeks / 2))} small steps — one every ~2 weeks</em>
        </div>
      </div>`;
  },

  // Get a simple "time left" string
  getSimpleTimeLeft(targetMonth: number, targetYear: number): string {
    const breakdown = this.calculate(targetMonth, targetYear);

    if (breakdown.isPast) return "In the past";
    if (breakdown.isCurrentMonth) return `${breakdown.days} days left`;
    if (breakdown.days <= 7) return `${breakdown.days} days`;
    if (breakdown.weeks <= 4) return `${breakdown.weeks} weeks`;
    if (breakdown.months <= 2) return `${breakdown.weeks} weeks`;
    return `${breakdown.months} months`;
  },
};

// ============================================
// Configuration & Constants
// ============================================
// ===================================
// Neurodivergent Accessibility Config
// ===================================
const ND_CONFIG = {
  // Accent color themes
  ACCENT_THEMES: {
    teal: { label: "Sky Blue", emoji: "☁️", color: "#8CB7D9" },
    coral: { label: "Terracotta", emoji: "🏺", color: "#C86B4A" },
    sage: { label: "Sage Green", emoji: "🌿", color: "#6F9B86" },
    amber: { label: "Golden Hour", emoji: "🌅", color: "#E09A60" },
    clay: { label: "Earth Clay", emoji: "🧱", color: "#B46A4A" },
    violet: { label: "Petal Pink", emoji: "🌸", color: "#E59AA0" },
  },

  // Body doubling / coworking timer options
  BODY_DOUBLE_DURATIONS: [15, 25, 45, 60, 90],

  // Break reminder intervals (minutes)
  BREAK_INTERVALS: {
    pomodoro: 25,
    gentle: 45,
    hyperfocus: 90,
    off: null,
  },

  // Task initiation prompts - helps with executive dysfunction
  INITIATION_PROMPTS: [
    "Just open the file/app. That's it.",
    "Set a 2-minute timer. You only have to try for 2 minutes.",
    "What's the tiniest first step? Do only that.",
    "Text a friend you're starting. Accountability helps!",
    "Put on your 'work' playlist first. Transition ritual.",
    "Can you do the easiest part first? Skip the hard stuff.",
    "Pretend you're showing someone else how to start.",
    "What would make this feel like play instead of work?",
  ],

  // Text spacing options for accessibility
  TEXT_SPACING: {
    compact: { lineHeight: "1.4", letterSpacing: "-0.01em", wordSpacing: "0" },
    normal: { lineHeight: "1.6", letterSpacing: "0", wordSpacing: "0" },
    relaxed: {
      lineHeight: "1.8",
      letterSpacing: "0.02em",
      wordSpacing: "0.05em",
    },
    dyslexia: {
      lineHeight: "2",
      letterSpacing: "0.05em",
      wordSpacing: "0.1em",
    },
  },

  // "What's blocking you?" prompts for stuck moments
  BLOCKER_PROMPTS: [
    { label: "I don't know where to start", action: "break_down" },
    { label: "It feels too big", action: "simplify" },
    { label: "I'm waiting on something", action: "mark_blocked" },
    { label: "I don't have energy", action: "defer" },
    { label: "I keep getting distracted", action: "focus_mode" },
    { label: "I'm not sure it matters", action: "clarify_why" },
    { label: "I'm scared to mess up", action: "permission_slip" },
    { label: "Something else is on my mind", action: "brain_dump" },
  ],

  // Permission slips for perfectionism paralysis
  PERMISSION_SLIPS: [
    "You have permission to do this badly.",
    "Done is better than perfect. Ship it ugly.",
    "This is a draft. Drafts are supposed to be messy.",
    "You can always fix it later. Future you is capable.",
    "Good enough IS good enough.",
    "Progress over perfection. Always.",
    "Your first pancake is allowed to be weird.",
    "Mistakes are data, not disasters.",
  ],

  // Dopamine menu - quick wins when motivation is low
  DOPAMINE_MENU: [
    { icon: "check", label: "Check off a tiny task", time: "2 min" },
    { icon: "target", label: "Pick one anchor for today", time: "1 min" },
    { icon: "cloud", label: "Brain dump for 5 minutes", time: "5 min" },
    { icon: "refresh", label: "Update progress on something", time: "2 min" },
    { icon: "edit", label: "Add a note to any anchor", time: "1 min" },
    { icon: "award", label: "Celebrate a past win", time: "1 min" },
    { icon: "shuffle", label: "Let the app pick a task", time: "0 min" },
    {
      icon: "clock",
      label: "Set a 15-min body double timer",
      time: "15 min",
    },
  ],

  // Sensory feedback options
  FEEDBACK_STYLES: {
    subtle: { confetti: false, sound: false, shake: false, glow: true },
    moderate: { confetti: true, sound: false, shake: false, glow: true },
    celebration: { confetti: true, sound: true, shake: true, glow: true },
    minimal: { confetti: false, sound: false, shake: false, glow: false },
  },

  // Overwhelm thresholds
  MAX_VISIBLE_TASKS: {
    overwhelmed: 1,
    low_energy: 3,
    normal: 10,
    high_energy: 999,
  },

  // Transition warning times (minutes before deadline)
  TRANSITION_WARNINGS: [60, 30, 15, 5],

  // Font options for dyslexia/reading preferences
  FONT_OPTIONS: {
    default: "'Inter', sans-serif",
    dyslexia: "'OpenDyslexic', 'Comic Sans MS', sans-serif",
    mono: "'JetBrains Mono', monospace",
    large: "'Inter', sans-serif", // Same font, larger size
  },
};

const CONFIG = {
  STORAGE_KEY: "visionboard_data",
  MONTHS: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  CATEGORIES: {
    career: { emoji: "💼", symbol: "◆", label: "Career", color: "#6366f1" },
    health: { emoji: "💪", symbol: "●", label: "Health", color: "#10b981" },
    finance: { emoji: "💰", symbol: "◇", label: "Finance", color: "#f59e0b" },
    personal: {
      emoji: "💖",
      symbol: "♥",
      label: "Personal",
      color: "#ec4899",
    },
    creative: {
      emoji: "🎨",
      symbol: "✦",
      label: "Creative",
      color: "#8b5cf6",
    },
  },
  PRIORITIES: {
    urgent: { emoji: "🔴", symbol: "!!!", label: "Urgent", color: "#ef4444" },
    high: { emoji: "🟠", symbol: "!!", label: "High", color: "#f97316" },
    medium: { emoji: "🟡", symbol: "!", label: "Medium", color: "#eab308" },
    low: { emoji: "🟢", symbol: "—", label: "Low", color: "#22c55e" },
  },
  STATUSES: {
    "not-started": {
      emoji: "⏳",
      symbol: "○",
      label: "Not Started",
      color: "#6b7280",
    },
    "in-progress": {
      emoji: "🔄",
      symbol: "◐",
      label: "In Progress",
      color: "#3b82f6",
    },
    blocked: { emoji: "🚫", symbol: "✕", label: "Blocked", color: "#ef4444" },
    done: { emoji: "✅", symbol: "✓", label: "Done", color: "#10b981" },
  },
  AFFIRMATIONS: [
    "You're doing better than you think.",
    "Progress, not perfection.",
    "One step at a time is still moving forward.",
    "Your potential is limitless.",
    "Today is full of possibilities.",
    "You've overcome hard things before.",
    "Be patient with yourself.",
    "Small wins add up to big victories.",
    "You are capable of amazing things.",
    "Every expert was once a beginner.",
    "Focus on what you can control.",
    "Your journey is unique and valid.",
    "Rest is productive too.",
    "You don't have to be perfect to be worthy.",
    "Celebrate how far you've come.",
  ],
  LEVELS: {
    vision: { emoji: "✨", symbol: "✱", label: "Vision", color: "#8b5cf6" },
    milestone: { emoji: "🎯", symbol: "⬡", label: "Milestone", color: "#3b82f6" },
    focus: { emoji: "🔎", symbol: "⬢", label: "Focus", color: "#f59e0b" },
    intention: { emoji: "🌱", symbol: "•", label: "Intention", color: "#10b981" },
  },
  ACHIEVEMENTS: {
    firstGoal: {
      emoji: "🌱",
      symbol: "①",
      label: "First Steps",
      desc: "Created your first vision",
    },
    fiveGoals: {
      emoji: "⭐",
      symbol: "★",
      label: "Dreamer",
      desc: "Defined 5 milestones",
    },
    tenGoals: {
      emoji: "🌟",
      symbol: "✶",
      label: "Visionary",
      desc: "Cast 10 visions",
    },
    firstComplete: {
      emoji: "🎯",
      symbol: "◎",
      label: "Achiever",
      desc: "Accomplished your first milestone",
    },
    fiveComplete: {
      emoji: "🏆",
      symbol: "▲",
      label: "Champion",
      desc: "Accomplished 5 milestones",
    },
    weekStreak: {
      emoji: "🔥",
      symbol: "⚡",
      label: "Returning",
      desc: "Returned 7 days in a row",
    },
    monthStreak: {
      emoji: "💎",
      symbol: "◈",
      label: "Steady",
      desc: "Returned 30 days in a row",
    },
    planner: {
      emoji: "📋",
      symbol: "☰",
      label: "Planner",
      desc: "Completed a weekly review",
    },
    organizer: {
      emoji: "🗂️",
      symbol: "▤",
      label: "Organizer",
      desc: "Added subtasks to an intention",
    },
    reflector: {
      emoji: "💭",
      symbol: "◌",
      label: "Reflector",
      desc: "Added notes to a focus",
    },
  },
};

// ============================================
// State Management
// ============================================
// View constants
const VIEWS = {
  YEAR: "year" as const,
  MONTH: "month" as const,
  WEEK: "week" as const,
  DAY: "day" as const,
} as const;

const State: AppState & {
  init: () => void;
  getWeekNumber: (date: Date) => number;
  getWeekStart: (year: number, weekNum: number) => Date;
  setView: (view: ViewType) => void;
  goToDate: (date: Date | string) => void;
  navigate: (direction: number) => void;
  getDefaultData: () => AppData;
  migrateDataIfNeeded: () => void;
  ensureDataShape: () => boolean;
  load: () => void;
  save: () => void;
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
    // Check for user
    const user = await SupabaseService.getUser();

    if (!user) {
      // Show Auth Modal if not logged in
      const auth = new AuthComponent();
      auth.render();
    } else {
      // Load cloud data
      console.log('User logged in, loading cloud data...');
      await this.load();
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

  // Get the start date of a week
  getWeekStart(year: number, weekNum: number): Date {
    const jan1 = new Date(year, 0, 1);
    const days = (weekNum - 1) * 7;
    const weekStart = new Date(jan1);
    weekStart.setDate(jan1.getDate() + days - jan1.getDay() + 1);
    return weekStart;
  },

  // Navigate views
  setView(view: ViewType) {
    this.currentView = view;
    UI.render();
    UI.syncViewButtons?.();
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
    UI.render();
  },

  getDefaultData(): AppData {
    return {
      goals: [],
      streak: { count: 0, lastDate: null },
      achievements: [],
      weeklyReviews: [],
      brainDump: [], // Parking lot for intrusive thoughts/ideas
      bodyDoubleHistory: [], // Track body double sessions
      preferences: {
        focusMode: false,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches,
        theme: "day",
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
          accentTheme: "sage", // teal, coral, sage, amber, clay, violet
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
    if (!this.data.version || this.data.version < 2) {
      this.data.weeklyReviews = this.data.weeklyReviews || [];
      this.data.analytics =
        this.data.analytics || this.getDefaultData().analytics;
      this.data.version = 2;
      this.save();
    }
  },

  ensureDataShape() {
    const defaults = this.getDefaultData();
    let changed = false;

    if (!this.data || typeof this.data !== "object") {
      this.data = defaults;
      return true;
    }

    if (!Array.isArray(this.data.goals)) {
      this.data.goals = [];
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
      const cloudData = await SupabaseService.loadAllData();
      if (cloudData) {
        // Merge cloud data with defaults to ensure complete state
        this.data = { ...this.getDefaultData(), ...cloudData } as AppData;
      } else {
        // Fallback to local or default
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        this.data = stored ? (JSON.parse(stored) as AppData) : null;
      }
    } catch (e) {
      console.error("Failed to load data:", e);
      this.data = null;
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
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data));

        // Cloud save - simplified for now, ideally should be granular
        const user = await SupabaseService.getUser();
        if (user) {
          // We can't save everything at once easily without a huge payload.
          // We should rely on granular updates.
          // So this save() might just be for preferences?
          if (this.data.preferences) {
            await SupabaseService.savePreferences(this.data.preferences);
          }
        }
      }
    } catch (e) {
      console.error("Failed to save data:", e);
    }
  },
};

// ============================================
// Goal Management
// ============================================
const Goals = {
  create(goalData: GoalData): Goal {
    const goal: Goal = {
      id: this.generateId(),
      title: goalData.title,
      level: goalData.level,
      description: goalData.description || "",
      month: goalData.month,
      year: goalData.year || new Date().getFullYear(),
      category: goalData.category || null,
      priority: (goalData.priority || "medium") as Priority,
      status: "not-started" as GoalStatus,
      progress: 0,
      subtasks: [],
      notes: [],
      timeLog: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      lastWorkedOn: null,
      dueDate: goalData.dueDate || null,
      startTime: goalData.startTime || null,
      endTime: goalData.endTime || null,
      tags: goalData.tags || [],
    };

    if (!State.data) {
      State.init();
      if (!State.data) return goal;
    }
    State.data.goals.push(goal);
    State.data.analytics.goalsCreated++;
    State.save();

    // Cloud Save
    UI.updateSyncStatus('syncing');
    SupabaseService.saveGoal(goal)
      .then(() => UI.updateSyncStatus('synced'))
      .catch(err => {
        console.error('Failed to save goal to cloud', err);
        UI.updateSyncStatus('error');
      });

    this.checkAchievements();
    return goal;
  },

  update(goalId: string, updates: Partial<Goal>): Goal | null {
    const goal = this.getById(goalId);
    if (!goal) return null;

    Object.assign(goal, updates, { updatedAt: new Date().toISOString() });

    // Auto-calculate progress from subtasks
    if (goal.subtasks.length > 0) {
      const completed = goal.subtasks.filter((s) => s.done).length;
      goal.progress = Math.round((completed / goal.subtasks.length) * 100);
    }

    // Auto-complete if progress is 100%
    if (goal.progress === 100 && goal.status !== "done") {
      this.complete(goalId);
    }

    State.save();
    // Cloud Save
    SupabaseService.saveGoal(goal).catch(err => console.error('Failed to update goal to cloud', err));
    return goal;
  },

  delete(goalId: string): void {
    if (!State.data) return;
    State.data.goals = State.data.goals.filter((g) => g.id !== goalId);
    State.save();
    // Cloud Delete
    SupabaseService.deleteGoal(goalId).catch(err => console.error('Failed to delete goal from cloud', err));
  },

  getById(goalId: string): Goal | undefined {
    if (!State.data) return undefined;
    return State.data.goals.find((g) => g.id === goalId);
  },

  getByMonth(month: number, year: number): Goal[] {
    if (!State.data) return [];
    return State.data.goals.filter(
      (g) => g.month === month && g.year === year,
    );
  },

  getAll(): Goal[] {
    if (!State.data) return [];
    return State.data.goals;
  },

  getUpcoming(limit: number = 5): Goal[] {
    if (!State.data) return [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return State.data.goals
      .filter((g) => {
        if (g.status === "done") return false;
        if (g.year > currentYear) return true;
        if (g.year === currentYear && g.month >= currentMonth) return true;
        return false;
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, limit);
  },

  complete(goalId: string): void {
    const goal = this.getById(goalId);
    if (!goal || !State.data) return;

    goal.status = "done";
    goal.progress = 100;
    goal.completedAt = new Date().toISOString();
    State.data.analytics.goalsCompleted++;

    State.save();
    // Cloud Save
    SupabaseService.saveGoal(goal).catch(err => console.error('Failed to complete goal to cloud', err));
    this.checkAchievements();

    // Trigger celebration
    UI.celebrate("✨", "Anchor updated", `"${goal.title}" marked done.`);
  },

  addSubtask(goalId: string, subtaskTitle: string): Subtask | null {
    const goal = this.getById(goalId);
    if (!goal) return null;

    const subtask: Subtask = {
      id: this.generateId(),
      title: subtaskTitle,
      done: false,
      createdAt: new Date().toISOString(),
    };

    goal.subtasks.push(subtask);
    goal.updatedAt = new Date().toISOString();
    State.save();
    // Cloud Save
    SupabaseService.saveGoal(goal).catch(err => console.error('Failed to add subtask to cloud', err));

    this.checkAchievements();
    return subtask;
  },

  toggleSubtask(goalId: string, subtaskId: string): void {
    const goal = this.getById(goalId);
    if (!goal) return;

    const subtask = goal.subtasks.find((s) => s.id === subtaskId);
    if (subtask) {
      subtask.done = !subtask.done;
      this.update(goalId, {}); // Recalculate progress and save
    }
  },

  deleteSubtask(goalId: string, subtaskId: string): void {
    const goal = this.getById(goalId);
    if (!goal) return;

    goal.subtasks = goal.subtasks.filter((s) => s.id !== subtaskId);
    this.update(goalId, {}); // Recalculate progress and save
  },

  addNote(goalId: string, noteText: string): Note | null {
    const goal = this.getById(goalId);
    if (!goal) return null;

    const note: Note = {
      id: this.generateId(),
      text: noteText,
      createdAt: new Date().toISOString(),
    };

    goal.notes.push(note);
    goal.updatedAt = new Date().toISOString();
    State.save();
    // Cloud Save
    SupabaseService.saveGoal(goal).catch(err => console.error('Failed to add note to cloud', err));

    this.checkAchievements();
    return note;
  },

  logTime(goalId: string, minutes: number, description: string = ""): void {
    const goal = this.getById(goalId);
    if (!goal || !State.data) return;

    const timeEntry: TimeLogEntry = {
      minutes,
      description,
      date: new Date().toISOString(),
    };

    goal.timeLog.push(timeEntry);

    goal.lastWorkedOn = new Date().toISOString();
    State.data.analytics.totalTimeSpent += minutes;
    State.save();
    // Cloud Save
    SupabaseService.saveGoal(goal).catch(err => console.error('Failed to log time to cloud', err));
  },

  getTotalTime(goalId: string): number {
    const goal = this.getById(goalId);
    if (!goal) return 0;
    return goal.timeLog.reduce((sum, log) => sum + log.minutes, 0);
  },

  generateId(): string {
    return crypto.randomUUID();
  },

  checkAchievements(): void {
    if (!State.data) return;
    const totalGoals = State.data.goals.length;
    const completedGoals = State.data.goals.filter(
      (g) => g.status === "done",
    ).length;
    const hasSubtasks = State.data.goals.some((g) => g.subtasks.length > 0);
    const hasNotes = State.data.goals.some((g) => g.notes.length > 0);

    const achievements = State.data.achievements;

    if (!State.data) return;

    if (totalGoals >= 1 && !achievements.includes("firstGoal")) {
      this.unlockAchievement("firstGoal");
    }
    if (totalGoals >= 5 && !achievements.includes("fiveGoals")) {
      this.unlockAchievement("fiveGoals");
    }
    if (totalGoals >= 10 && !achievements.includes("tenGoals")) {
      this.unlockAchievement("tenGoals");
    }
    if (completedGoals >= 1 && !achievements.includes("firstComplete")) {
      this.unlockAchievement("firstComplete");
    }
    if (completedGoals >= 5 && !achievements.includes("fiveComplete")) {
      this.unlockAchievement("fiveComplete");
    }
    if (hasSubtasks && !achievements.includes("organizer")) {
      this.unlockAchievement("organizer");
    }
    if (hasNotes && !achievements.includes("reflector")) {
      this.unlockAchievement("reflector");
    }
  },

  unlockAchievement(achievementId: string): void {
    if (!State.data) return;
    if (State.data.achievements.includes(achievementId)) return;

    State.data.achievements.push(achievementId);
    State.save();

    const achievement = (CONFIG.ACHIEVEMENTS as Record<string, { emoji: string; symbol: string; label: string; desc: string }>)[achievementId];
    UI.celebrate(
      achievement.emoji,
      "Achievement Unlocked!",
      achievement.label,
    );
  },
};

// ============================================
// Planning & Reviews
// ============================================
const Planning = {
  createWeeklyReview(reviewData: Partial<WeeklyReview> & { weekStart: string; weekEnd: string }): WeeklyReview {
    if (!State.data) {
      State.init();
      if (!State.data) throw new Error("State not initialized");
    }
    const review: WeeklyReview = {
      id: Goals.generateId(),
      weekStart: reviewData.weekStart,
      weekEnd: reviewData.weekEnd,
      goalsCompleted: reviewData.goalsCompleted || 0,
      timeSpent: reviewData.timeSpent || 0,
      notes: reviewData.notes || "",
      createdAt: new Date().toISOString(),
    };

    State.data.weeklyReviews.push(review);
    State.save();

    // Check for planner achievement
    if (!State.data.achievements.includes("planner")) {
      Goals.unlockAchievement("planner");
    }

    return review;
  },

  getWeeklyReviews(): WeeklyReview[] {
    if (!State.data) return [];
    return State.data.weeklyReviews.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  getLastReview(): WeeklyReview | null {
    const reviews = this.getWeeklyReviews();
    return reviews[0] || null;
  },

  shouldPromptReview(): boolean {
    const lastReview = this.getLastReview();
    if (!lastReview) return true;

    const lastDate = new Date(lastReview.createdAt);
    const daysSince = Math.floor(
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSince >= 7;
  },

  getWeekGoals(): Goal[] {
    if (!State.data) return [];
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return State.data.goals.filter((g) => {
      if (g.dueDate) {
        const due = new Date(g.dueDate);
        return due >= weekStart && due <= weekEnd;
      }
      return g.month === now.getMonth() && g.year === now.getFullYear();
    });
  },

  getPriorityMatrix(): {
    urgentImportant: Goal[];
    importantNotUrgent: Goal[];
    urgentNotImportant: Goal[];
    neitherUrgentNorImportant: Goal[];
  } {
    if (!State.data) {
      return {
        urgentImportant: [],
        importantNotUrgent: [],
        urgentNotImportant: [],
        neitherUrgentNorImportant: [],
      };
    }
    const active = State.data.goals.filter((g) => g.status !== "done");
    return {
      urgentImportant: active.filter((g) => g.priority === "urgent"),
      importantNotUrgent: active.filter((g) => g.priority === "high"),
      urgentNotImportant: active.filter((g) => g.priority === "medium"),
      neitherUrgentNorImportant: active.filter((g) => g.priority === "low"),
    };
  },
};

// ============================================
// Analytics
// ============================================
const Analytics = {
  getOverview() {
    if (!State.data) {
      return {
        totalGoals: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        blocked: 0,
        completionRate: 0,
        totalTimeSpent: 0,
        currentStreak: 0,
        bestStreak: 0,
      };
    }
    const goals = State.data.goals;

    return {
      totalGoals: goals.length,
      completed: goals.filter((g) => g.status === "done").length,
      inProgress: goals.filter((g) => g.status === "in-progress").length,
      notStarted: goals.filter((g) => g.status === "not-started").length,
      blocked: goals.filter((g) => g.status === "blocked").length,
      completionRate:
        goals.length > 0
          ? Math.round(
            (goals.filter((g) => g.status === "done").length /
              goals.length) *
            100,
          )
          : 0,
      totalTimeSpent: State.data.analytics.totalTimeSpent,
      currentStreak: State.data.streak.count,
      bestStreak: State.data.analytics.streakBest,
    };
  },

  getByCategory(): Record<string, { total: number; completed: number; progress: number }> {
    if (!State.data) return {};
    const stats: Record<string, { total: number; completed: number; progress: number }> = {};
    Object.keys(CONFIG.CATEGORIES).forEach((cat) => {
      if (!State.data) return;
      const catGoals = State.data.goals.filter((g) => g.category === cat);
      stats[cat] = {
        total: catGoals.length,
        completed: catGoals.filter((g) => g.status === "done").length,
        progress:
          catGoals.length > 0
            ? Math.round(
              catGoals.reduce((sum, g) => sum + g.progress, 0) /
              catGoals.length,
            )
            : 0,
      };
    });
    return stats;
  },

  getByMonth(): Record<number, { total: number; completed: number }> {
    if (!State.data) return {};
    const stats: Record<number, { total: number; completed: number }> = {};
    const year = new Date().getFullYear();

    CONFIG.MONTHS.forEach((_, idx) => {
      if (!State.data) return;
      const monthGoals = State.data.goals.filter(
        (g) => g.month === idx && g.year === year,
      );
      stats[idx] = {
        total: monthGoals.length,
        completed: monthGoals.filter((g) => g.status === "done").length,
      };
    });
    return stats;
  },

  getProductivityTrend(): Array<{ date: string; goalsCompleted: number; timeLogged: number }> {
    if (!State.data) return [];
    const last30Days: Array<{ date: string; goalsCompleted: number; timeLogged: number }> = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      // Count activities on this day
      const goalsCompleted = State.data.goals.filter(
        (g) => g.completedAt && g.completedAt.startsWith(dateStr),
      ).length;

      const timeLogged = State.data.goals.reduce((sum, g) => {
        return (
          sum +
          g.timeLog
            .filter((log) => log.date.startsWith(dateStr))
            .reduce((s, log) => s + log.minutes, 0)
        );
      }, 0);

      last30Days.push({ date: dateStr, goalsCompleted, timeLogged });
    }

    return last30Days;
  },
};

// ============================================
// Streak Management
// ============================================
// ============================================
// Neurodivergent Support Module
// ============================================
const NDSupport = {
  breakTimer: null as ReturnType<typeof setInterval> | null,
  bodyDoubleTimer: null as ReturnType<typeof setInterval> | null,
  bodyDoubleEndTime: null as number | null,

  // Initialize ND features
  init() {
    this.applyAccessibilityPreferences();
    this.startBreakReminder();
    this.checkTransitionWarnings();
  },

  // Apply visual accessibility preferences
  applyAccessibilityPreferences(): void {
    if (!State.data) return;
    const prefs = State.data.preferences.nd;
    const root = document.documentElement;

    // Apply night garden mode (dark theme)
    document.body.classList.toggle(
      "night-garden",
      State.data.preferences.theme === "night" ||
      State.data.preferences.theme === "dark",
    );

    // Apply accent theme
    if (prefs.accentTheme) {
      // Remove all theme classes first
      document.body.classList.remove(
        "theme-teal",
        "theme-coral",
        "theme-sage",
        "theme-amber",
        "theme-clay",
        "theme-violet",
      );
      document.body.classList.add(`theme-${prefs.accentTheme}`);
    }

    // Apply font choice
    const fontOptions = ND_CONFIG.FONT_OPTIONS as Record<string, string>;
    if (prefs.fontChoice && fontOptions[prefs.fontChoice]) {
      root.style.setProperty(
        "--font-sans",
        fontOptions[prefs.fontChoice],
      );
    }

    // Apply text spacing
    const textSpacing = (ND_CONFIG as any).TEXT_SPACING as Record<TextSpacing, { lineHeight: string; letterSpacing: string; wordSpacing: string }> | undefined;
    if (prefs.textSpacing && textSpacing && textSpacing[prefs.textSpacing]) {
      const spacing = textSpacing[prefs.textSpacing];
      root.style.setProperty("--line-height-base", spacing.lineHeight);
      root.style.setProperty("--letter-spacing", spacing.letterSpacing);
      root.style.setProperty("--word-spacing", spacing.wordSpacing);
    }

    // Apply color blind mode
    if (prefs.colorBlindMode && prefs.colorBlindMode !== "none") {
      document.body.classList.add(`colorblind-${prefs.colorBlindMode}`);
    }

    // Apply simplified view
    if (prefs.simplifiedView) {
      document.body.classList.add("simplified-view");
    }

    // Apply reduced emojis mode
    if (prefs.reduceEmojis) {
      document.body.classList.add("reduce-emojis");
    } else {
      document.body.classList.remove("reduce-emojis");
    }
  },

  // Brain dump - parking lot for intrusive thoughts
  addToBrainDump(thought: string): BrainDumpEntry {
    if (!State.data) {
      State.init();
      if (!State.data) throw new Error("State not initialized");
    }
    const entry: BrainDumpEntry = {
      id: Date.now().toString(36),
      text: thought,
      createdAt: new Date().toISOString(),
      processed: false,
    };
    State.data.brainDump.unshift(entry);
    State.save();
    return entry;
  },

  getBrainDump(): BrainDumpEntry[] {
    if (!State.data) return [];
    return State.data.brainDump || [];
  },

  processBrainDumpItem(id: string, action: string): void {
    if (!State.data) return;
    const item = State.data.brainDump.find((i) => i.id === id);
    if (item) {
      item.processed = true;
      item.processedAction = action;
      item.processedAt = new Date().toISOString();
      State.save();
    }
  },

  clearProcessedBrainDump(): void {
    if (!State.data) return;
    State.data.brainDump = State.data.brainDump.filter((i) => !i.processed);
    State.save();
  },

  // Body doubling timer
  startBodyDouble(minutes: number): BodyDoubleSession {
    if (!State.data) {
      State.init();
      if (!State.data) throw new Error("State not initialized");
    }
    if (this.bodyDoubleTimer) {
      clearInterval(this.bodyDoubleTimer);
      this.bodyDoubleTimer = null;
    }

    this.bodyDoubleEndTime = Date.now() + minutes * 60 * 1000;

    const session: BodyDoubleSession = {
      id: Date.now().toString(36),
      startedAt: new Date().toISOString(),
      duration: minutes,
      completedAt: null,
      goalId: null,
      completed: false,
    };
    State.data.bodyDoubleHistory.push(session);
    State.save();

    this.bodyDoubleTimer = setInterval(() => {
      if (this.bodyDoubleEndTime) {
        const remaining = this.bodyDoubleEndTime - Date.now();
        if (remaining <= 0) {
          this.endBodyDouble(session.id, true);
        }
      }
    }, 1000) as ReturnType<typeof setInterval>;

    return session;
  },

  getBodyDoubleRemaining(): number | null {
    if (!this.bodyDoubleEndTime) return null;
    const remaining = this.bodyDoubleEndTime - Date.now();
    if (remaining <= 0) return null;
    return Math.ceil(remaining / 1000);
  },

  endBodyDouble(sessionId: string, completed: boolean = false): void {
    if (this.bodyDoubleTimer) {
      clearInterval(this.bodyDoubleTimer);
      this.bodyDoubleTimer = null;
    }
    this.bodyDoubleEndTime = null;

    if (!State.data) return;
    const session = State.data.bodyDoubleHistory.find(
      (s) => s.id === sessionId,
    );
    if (session) {
      session.completed = completed;
      session.completedAt = completed ? new Date().toISOString() : null;
      session.endedAt = new Date().toISOString();
      State.save();
    }

    if (completed) {
      UI.showToast(
        "Body double session complete! Great focus! 🎉",
        "success",
      );
    }
  },

  // Break reminders for hyperfocus protection
  startBreakReminder(): void {
    if (!State.data) return;
    const interval =
      ND_CONFIG.BREAK_INTERVALS[State.data.preferences.nd.breakReminder];
    if (!interval) return;

    if (this.breakTimer) {
      clearInterval(this.breakTimer);
      this.breakTimer = null;
    }

    this.breakTimer = setInterval(
      () => {
        this.showBreakReminder();
      },
      interval * 60 * 1000,
    ) as ReturnType<typeof setInterval>;
  },

  showBreakReminder(): void {
    const messages = [
      "Time for a break! Stretch, hydrate, or look at something far away.",
      "Break time! Your brain needs a reset. Step away for 5 minutes.",
      "Pause check: Have you moved your body recently?",
      "Hydration check! Grab some water.",
      "Screen break time. Rest your eyes for a moment.",
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];
    UI.showToast(message, "info");
  },

  // Get a random initiation prompt
  getInitiationPrompt(): string {
    const prompts = ND_CONFIG.INITIATION_PROMPTS;
    return prompts[Math.floor(Math.random() * prompts.length)];
  },

  // Get a permission slip for perfectionism
  getPermissionSlip(): string {
    const slips = ND_CONFIG.PERMISSION_SLIPS;
    return slips[Math.floor(Math.random() * slips.length)];
  },

  // Handle blocker selection
  handleBlocker(action: string, goalId?: string): void {
    switch (action) {
      case "break_down":
        UI.showToast(
          "Let's break this into tiny steps. What's the smallest first action?",
          "info",
        );
        break;
      case "simplify":
        UI.showToast(
          "What's the 'good enough' version? Do that instead.",
          "info",
        );
        break;
      case "mark_blocked":
        if (goalId) Goals.update(goalId, { status: "blocked" });
        UI.showToast(
          "Marked as blocked. What can you work on instead?",
          "info",
        );
        break;
      case "defer":
        UI.showToast(
          "It's okay to rest. This will still be here when you're ready.",
          "info",
        );
        break;
      case "focus_mode":
        UI.setFocusMode(true);
        break;
      case "clarify_why":
        UI.showToast(
          "Why did you place this anchor? Reconnect with what you want from it.",
          "info",
        );
        break;
      case "permission_slip":
        UI.showToast(this.getPermissionSlip(), "success");
        break;
      case "brain_dump":
        this.showBrainDumpModal();
        break;
    }
  },

  // Helper to conditionally show emoji or symbol based on user preference
  icon(emojiChar: string, symbolChar: string = ""): string {
    if (State.data?.preferences?.nd?.reduceEmojis) {
      return symbolChar;
    }
    return emojiChar;
  },

  // Get category display (emoji or symbol based on preference)
  getCategoryIcon(categoryKey: string): string {
    const categories = CONFIG.CATEGORIES as Record<string, { emoji: string; symbol: string; label: string; color: string }>;
    const cat = categories[categoryKey];
    if (!cat) return "";
    return this.icon(cat.emoji, cat.symbol);
  },

  // Get status display (emoji or symbol based on preference)
  getStatusIcon(statusKey: string): string {
    const statuses = CONFIG.STATUSES as Record<string, { emoji: string; symbol: string; label: string; color: string }>;
    const status = statuses[statusKey];
    if (!status) return "";
    return this.icon(status.emoji, status.symbol);
  },

  // Get priority display (emoji or symbol based on preference)
  getPriorityIcon(priorityKey: string): string {
    const priorities = CONFIG.PRIORITIES as Record<string, { emoji: string; symbol: string; label: string; color: string }>;
    const priority = priorities[priorityKey];
    if (!priority) return "";
    return this.icon(priority.emoji, priority.symbol);
  },

  // Get achievement display (emoji or symbol based on preference)
  getAchievementIcon(achievementKey: string): string {
    const achievements = CONFIG.ACHIEVEMENTS as Record<string, { emoji: string; symbol: string; label: string; desc: string }>;
    const achievement = achievements[achievementKey];
    if (!achievement) return "";
    return this.icon(achievement.emoji, achievement.symbol);
  },

  // Check for upcoming deadline transitions
  checkTransitionWarnings(): void {
    if (!State.data || !State.data.preferences.nd.transitionWarnings) return;

    const goals = Goals.getAll();
    const now = new Date();

    goals.forEach((goal) => {
      if (goal.dueDate && goal.status !== "done") {
        const due = new Date(goal.dueDate);
        const hoursUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntil <= 24 && hoursUntil > 0) {
          UI.showToast(
            `⏰ "${goal.title}" is coming up in less than 24 hours.`,
            "warning",
          );
        }
      }
    });
  },

  // Get filtered goals based on overwhelm settings
  getFilteredGoals(goals: Goal[]): Goal[] {
    if (!State.data) return goals;
    const prefs = State.data.preferences.nd;
    const maxVisible =
      ND_CONFIG.MAX_VISIBLE_TASKS[prefs.maxVisibleTasks] || 10;

    let filtered = goals;

    // Hide completed if preference set
    if (prefs.hideCompletedTasks) {
      filtered = filtered.filter((g) => g.status !== "done");
    }

    // Limit visible tasks based on overwhelm setting
    if (filtered.length > maxVisible) {
      // Prioritize by priority, then by due date
      filtered.sort((a: Goal, b: Goal) => {
        const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (
          (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
        );
      });
      filtered = filtered.slice(0, maxVisible);
    }

    return filtered;
  },

  // Show brain dump modal
  showBrainDumpModal() {
    const existingModal = document.querySelector(".brain-dump-modal");
    if (existingModal) existingModal.remove();

    const brainDump = this.getBrainDump();
    const unprocessed = brainDump.filter((i) => !i.processed);

    const modal = document.createElement("div");
    modal.className = "modal-overlay active brain-dump-modal";
    modal.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title">Brain Dump</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p class="brain-dump-intro">Got thoughts bouncing around? Dump them here. Get them out of your head so you can focus.</p>
            <div class="add-thought">
              <textarea id="brainDumpInput" placeholder="What's on your mind? Type it out and let it go..." rows="3"></textarea>
              <button class="btn btn-primary" id="addThoughtBtn">Dump it</button>
            </div>
            <div class="brain-dump-list">
              <h3>Parked thoughts (${unprocessed.length})</h3>
              ${unprocessed.length === 0 ? '<p class="empty-state">Your mind is clear!</p>' : ""}
              ${unprocessed
        .map(
          (item) => `
                <div class="brain-dump-item" data-id="${item.id}">
                  <p class="thought-text">${UI.escapeHtml(item.text)}</p>
                  <div class="thought-actions">
                      <button class="btn btn-sm btn-ghost" data-action="convert">Make anchor</button>
                    <button class="btn btn-sm btn-ghost" data-action="dismiss">Dismiss</button>
                  </div>
                </div>
              `,
        )
        .join("")}
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    // Event listeners
    const addBtn = document.getElementById("addThoughtBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const input = document.getElementById("brainDumpInput") as HTMLInputElement | null;
        if (input) {
          const text = input.value.trim();
          if (text) {
            this.addToBrainDump(text);
            input.value = "";
            this.showBrainDumpModal(); // Refresh
            UI.showToast("Thought parked!", "success");
          }
        }
      });
    }

    modal.querySelectorAll(".thought-actions button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest(".brain-dump-item") as HTMLElement | null;
        if (!item) return;
        const id = item.dataset.id;
        const action = target.dataset.action;

        if (action === "convert" && id) {
          const thought = brainDump.find((i) => i.id === id);
          if (thought) {
            this.processBrainDumpItem(id, "converted");
            UI.openGoalModal("milestone", State.viewingMonth, State.viewingYear);
            setTimeout(() => {
              const titleInput = document.getElementById("goalTitle") as HTMLInputElement | null;
              if (titleInput) {
                titleInput.value = thought.text;
              }
            }, 100);
          }
        } else if (action === "dismiss" && id) {
          this.processBrainDumpItem(id, "dismissed");
          this.showBrainDumpModal(); // Refresh
        }

        modal.remove();
      });
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  // Show dopamine menu for low motivation
  showDopamineMenu() {
    const menu = ND_CONFIG.DOPAMINE_MENU;
    const modal = document.createElement("div");
    modal.className = "modal-overlay active dopamine-menu-modal";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Quick Wins</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p class="dopamine-intro">Low on motivation? Pick something small to get a quick win:</p>
            <div class="dopamine-options">
              ${menu
        .map(
          (item, i) => `
                <button class="dopamine-option" data-index="${i}">
                  <span class="dopamine-icon" data-icon="${item.icon}"></span>
                  <span class="dopamine-label">${item.label}</span>
                  <span class="dopamine-time">${item.time}</span>
                </button>
              `,
        )
        .join("")}
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal.querySelectorAll(".dopamine-option").forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        if (!target) return;
        const index = parseInt(target.dataset.index || '0');
        modal.remove();
        this.handleDopamineChoice(index);
      });
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  handleDopamineChoice(index: number) {
    const actions = [
      () => UI.showToast("Find your easiest task and check it off!", "info"),
      () => UI.showToast("Pick one anchor to return to today.", "info"),
      () => this.showBrainDumpModal(),
      () => UI.showToast("Pick any anchor and adjust it a little.", "info"),
      () =>
        UI.showToast(
          "Add a note to any anchor — even just “thinking about this”",
          "info",
        ),
      () =>
        UI.showToast(
          "Look at your achievements. You've done great things!",
          "success",
        ),
      () => UI.pickRandomGoal(),
      () => {
        this.startBodyDouble(15);
        UI.showToast(
          "Body double started! 15 minutes of focus time.",
          "success",
        );
      },
    ];

    if (actions[index]) actions[index]();
  },

  // Show ND settings panel
  showSettingsPanel() {
    if (!State.data) return;
    const prefs = State.data.preferences.nd;
    const modal = document.createElement("div");
    modal.className = "modal-overlay active nd-settings-modal";
    modal.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title">🧩 Accessibility & Overwhelm Support</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body nd-settings-body">
            <div class="settings-section">
              <h3>Appearance</h3>
              <div class="setting-row">
                <label>Accent Color</label>
                <div class="theme-picker" role="radiogroup" aria-label="Choose accent color">
                  ${Object.entries(ND_CONFIG.ACCENT_THEMES)
        .map(
          ([key, theme]) => `
                    <button
                      class="theme-swatch ${prefs.accentTheme === key ? "active" : ""}"
                      data-theme="${key}"
                      title="${theme.label}"
                      aria-label="${theme.label}"
                      style="--swatch-color: ${theme.color}"
                    >
                      <span class="swatch-color"></span>
                      <span class="swatch-emoji">${theme.emoji}</span>
                    </button>
                  `,
        )
        .join("")}
                </div>
              </div>
            </div>

            <div class="settings-section">
              <h3>Overwhelm Support</h3>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndSimplified" ${prefs.simplifiedView ? "checked" : ""}>
                  Simplified view (less visual clutter)
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndReduceEmojis" ${prefs.reduceEmojis ? "checked" : ""}>
                  Reduce emojis (less visual noise)
                </label>
              </div>
              <div class="setting-row">
                <label>Anchor visibility</label>
                <select id="ndMaxTasks">
                  <option value="overwhelmed" ${prefs.maxVisibleTasks === "overwhelmed" ? "selected" : ""}>Minimal (1 anchor)</option>
                  <option value="low_energy" ${prefs.maxVisibleTasks === "low_energy" ? "selected" : ""}>Low energy (3 anchors)</option>
                  <option value="normal" ${prefs.maxVisibleTasks === "normal" ? "selected" : ""}>Normal (10 anchors)</option>
                  <option value="high_energy" ${prefs.maxVisibleTasks === "high_energy" ? "selected" : ""}>Show all</option>
                </select>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndHideCompleted" ${prefs.hideCompletedTasks ? "checked" : ""}>
                  Hide done anchors
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Visual Preferences</h3>
              <div class="setting-row">
                <label>Font Style</label>
                <select id="ndFontChoice">
                  <option value="default" ${prefs.fontChoice === "default" ? "selected" : ""}>Default (Inter)</option>
                  <option value="dyslexia" ${prefs.fontChoice === "dyslexia" ? "selected" : ""}>Dyslexia-friendly</option>
                  <option value="mono" ${prefs.fontChoice === "mono" ? "selected" : ""}>Monospace</option>
                  <option value="readable" ${prefs.fontChoice === "readable" ? "selected" : ""}>High readability</option>
                </select>
              </div>
              <div class="setting-row">
                <label>Text Spacing</label>
                <select id="ndTextSpacing">
                  <option value="compact" ${prefs.textSpacing === "compact" ? "selected" : ""}>Compact</option>
                  <option value="normal" ${prefs.textSpacing === "normal" ? "selected" : ""}>Normal</option>
                  <option value="relaxed" ${prefs.textSpacing === "relaxed" ? "selected" : ""}>Relaxed</option>
                  <option value="dyslexia" ${prefs.textSpacing === "dyslexia" ? "selected" : ""}>Dyslexia-optimized</option>
                </select>
              </div>
              <div class="setting-row">
                <label>Color Vision</label>
                <select id="ndColorBlind">
                  <option value="none" ${prefs.colorBlindMode === "none" ? "selected" : ""}>Standard</option>
                  <option value="deuteranopia" ${prefs.colorBlindMode === "deuteranopia" ? "selected" : ""}>Deuteranopia (green-blind)</option>
                  <option value="protanopia" ${prefs.colorBlindMode === "protanopia" ? "selected" : ""}>Protanopia (red-blind)</option>
                  <option value="tritanopia" ${prefs.colorBlindMode === "tritanopia" ? "selected" : ""}>Tritanopia (blue-blind)</option>
                </select>
              </div>
            </div>

            <div class="settings-section">
              <h3>Focus & Attention</h3>
              <div class="setting-row">
                <label>Break Reminders</label>
                <select id="ndBreakReminder">
                  <option value="pomodoro" ${prefs.breakReminder === "pomodoro" ? "selected" : ""}>Every 25 min (Pomodoro)</option>
                  <option value="gentle" ${prefs.breakReminder === "gentle" ? "selected" : ""}>Every 45 min (Gentle)</option>
                  <option value="hyperfocus" ${prefs.breakReminder === "hyperfocus" ? "selected" : ""}>Every 90 min (Hyperfocus)</option>
                  <option value="off" ${prefs.breakReminder === "off" ? "selected" : ""}>Off</option>
                </select>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndInitiationPrompts" ${prefs.showInitiationPrompts ? "checked" : ""}>
                  Show "how to start" prompts
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="ndTransitionWarnings" ${prefs.transitionWarnings ? "checked" : ""}>
                  Warn me before deadlines
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Feedback & Rewards</h3>
              <div class="setting-row">
                <label>Celebration Style</label>
                <select id="ndFeedbackStyle">
                  <option value="minimal" ${prefs.feedbackStyle === "minimal" ? "selected" : ""}>Minimal (quiet)</option>
                  <option value="subtle" ${prefs.feedbackStyle === "subtle" ? "selected" : ""}>Subtle (glow only)</option>
                  <option value="moderate" ${prefs.feedbackStyle === "moderate" ? "selected" : ""}>Moderate (confetti)</option>
                  <option value="celebration" ${prefs.feedbackStyle === "celebration" ? "selected" : ""}>Full celebration! 🎉</option>
                </select>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-primary" id="saveNdSettings">Save Preferences</button>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    // Theme swatch click handlers
    modal.querySelectorAll(".theme-swatch").forEach((swatch) => {
      swatch.addEventListener("click", (e) => {
        modal
          .querySelectorAll(".theme-swatch")
          .forEach((s) => s.classList.remove("active"));
        const target = e.currentTarget as HTMLElement;
        if (target) target.classList.add("active");
      });
    });

    document
      .getElementById("saveNdSettings")
      ?.addEventListener("click", () => {
        if (!State.data) return;
        // Get selected theme
        const activeTheme = modal.querySelector(".theme-swatch.active") as HTMLElement | null;
        const selectedTheme = activeTheme
          ? activeTheme.dataset.theme
          : "teal";

        // Save all preferences
        State.data.preferences.nd = {
          ...State.data.preferences.nd,
          accentTheme: selectedTheme as AccentTheme,
          fontChoice: (document.getElementById("ndFontChoice") as HTMLSelectElement).value as FontChoice,
          textSpacing: (document.getElementById("ndTextSpacing") as HTMLSelectElement).value as TextSpacing,
          colorBlindMode: (document.getElementById("ndColorBlind") as HTMLSelectElement).value as ColorBlindMode,
          simplifiedView: (document.getElementById("ndSimplified") as HTMLInputElement).checked,
          reduceEmojis: (document.getElementById("ndReduceEmojis") as HTMLInputElement).checked,
          breakReminder: (document.getElementById("ndBreakReminder") as HTMLSelectElement).value as BreakReminder,
          maxVisibleTasks: (document.getElementById("ndMaxTasks") as HTMLSelectElement).value as MaxVisibleTasks,
          showInitiationPrompts: (document.getElementById(
            "ndInitiationPrompts",
          ) as HTMLInputElement).checked,
          transitionWarnings: (document.getElementById("ndTransitionWarnings") as HTMLInputElement)
            .checked,
          feedbackStyle: (document.getElementById("ndFeedbackStyle") as HTMLSelectElement).value as FeedbackStyle,
          hideCompletedTasks:
            (document.getElementById("ndHideCompleted") as HTMLInputElement).checked,
        };
        State.save();
        this.applyAccessibilityPreferences();
        this.startBreakReminder();
        modal.remove();
        UI.showToast("Settings saved! ✨", "success");
        UI.render();
      });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  // Appearance (theme + accent)
  showAppearancePanel() {
    if (!State.data) return;
    const prefs = State.data.preferences;
    const nd = prefs.nd;

    const modal = document.createElement("div");
    modal.className = "modal-overlay active appearance-modal";
    modal.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title">🎨 Appearance</h2>
            <button class="modal-close" aria-label="Close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body nd-settings-body">
            <div class="settings-section">
              <h3>Theme</h3>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="appearanceNightGarden" ${prefs.theme === "night" || prefs.theme === "dark" ? "checked" : ""}>
                  Night garden mode (moonlight + starlight)
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Accent</h3>
              <div class="setting-row">
                <label>Accent Color</label>
                <div class="theme-picker" role="radiogroup" aria-label="Choose accent color">
                  ${Object.entries(ND_CONFIG.ACCENT_THEMES)
      .map(
        ([key, theme]) => `
                      <button
                        class="theme-swatch ${nd.accentTheme === key ? "active" : ""}"
                        data-theme="${key}"
                        title="${theme.label}"
                        aria-label="${theme.label}"
                        style="--swatch-color: ${theme.color}"
                        type="button"
                      >
                        <span class="swatch-color"></span>
                        <span class="swatch-emoji">${theme.emoji}</span>
                      </button>
                    `,
      )
      .join("")}
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-primary" id="saveAppearance">Save</button>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal.querySelectorAll(".theme-swatch").forEach((swatch) => {
      swatch.addEventListener("click", (e) => {
        modal
          .querySelectorAll(".theme-swatch")
          .forEach((s) => s.classList.remove("active"));
        const target = e.currentTarget as HTMLElement;
        target.classList.add("active");
      });
    });

    modal.querySelector("#saveAppearance")?.addEventListener("click", () => {
      if (!State.data) return;
      const nightGarden = !!(modal.querySelector("#appearanceNightGarden") as HTMLInputElement)
        ?.checked;
      const activeTheme = modal.querySelector(".theme-swatch.active") as HTMLElement | null;
      const selectedTheme = activeTheme
        ? activeTheme.dataset.theme
        : (State.data.preferences.nd.accentTheme || "sage");

      State.data.preferences.theme = nightGarden ? "night" : "day";
      State.data.preferences.nd = {
        ...State.data.preferences.nd,
        accentTheme: selectedTheme as AccentTheme,
      };
      State.save();

      this.applyAccessibilityPreferences();
      UI.applyThemePreference();
      UI.render();
      modal.remove();
      UI.showToast("✨", "Appearance saved");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  // Show body double timer modal
  showBodyDoubleModal() {
    const remaining = this.getBodyDoubleRemaining();

    if (remaining) {
      // Show active timer
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      UI.showToast(
        `Body double active: ${mins}:${secs.toString().padStart(2, "0")} remaining`,
        "info",
      );
      return;
    }

    const modal = document.createElement("div");
    modal.className = "modal-overlay active body-double-modal";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Body Double Timer</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p class="body-double-intro">Body doubling helps with focus! Pick a duration and work alongside the timer.</p>
            <div class="body-double-options">
              ${ND_CONFIG.BODY_DOUBLE_DURATIONS.map(
      (mins) => `
                <button class="body-double-option" data-minutes="${mins}">
                  <span class="bd-time">${mins}</span>
                  <span class="bd-label">minutes</span>
                </button>
              `,
    ).join("")}
            </div>
            <div class="body-double-tip">
              <p><strong>Tip:</strong> Tell someone you're starting, or imagine a supportive friend working beside you.</p>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal.querySelectorAll(".body-double-option").forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        if (!target) return;
        const minutes = parseInt(target.dataset.minutes || '0');
        this.startBodyDouble(minutes);
        modal.remove();
        UI.showToast(
          `Body double started! ${minutes} minutes of focus time.`,
          "success",
        );
      });
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  // Show "What's blocking you?" helper
  showBlockerHelper(goalId: string) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay active blocker-helper-modal";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">What's blocking you?</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p>It's okay to feel stuck. Let's figure out what's going on:</p>
            <div class="blocker-options">
              ${ND_CONFIG.BLOCKER_PROMPTS.map(
      (prompt) => `
                <button class="blocker-option" data-action="${prompt.action}">
                  ${prompt.label}
                </button>
              `,
    ).join("")}
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal.querySelectorAll(".blocker-option").forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        if (!target) return;
        const action = target.dataset.action || '';
        modal.remove();
        this.handleBlocker(action, goalId);
      });
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  // Show initiation prompt for starting a task
  showInitiationPrompt(goalTitle: string) {
    const prompt = this.getInitiationPrompt();
    const modal = document.createElement("div");
    modal.className = "modal-overlay active initiation-modal";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Ready to start?</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p class="initiation-goal">Starting: <strong>${UI.escapeHtml(goalTitle)}</strong></p>
            <div class="initiation-prompt">
              <p class="prompt-text">${prompt}</p>
            </div>
            <div class="initiation-actions">
              <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Not yet</button>
              <button class="btn btn-primary" id="startNowBtn">Let's go</button>
              <button class="btn btn-ghost" id="newPromptBtn">Different tip</button>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    document.getElementById("newPromptBtn")?.addEventListener("click", () => {
      const promptText = modal.querySelector(".prompt-text") as HTMLElement | null;
      if (promptText) promptText.textContent = this.getInitiationPrompt();
    });

    document.getElementById("startNowBtn")?.addEventListener("click", () => {
      modal.remove();
      UI.showToast(
        "You're doing it! Remember: progress over perfection.",
        "success",
      );
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },
};


// ============================================
// Streak Management
// ============================================
const Streaks = {
  check() {
    if (!State.data) return;
    const today = new Date().toISOString().split("T")[0];
    const lastDate = State.data.streak.lastDate;

    if (lastDate === today) {
      return; // Already checked in today
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (lastDate === yesterdayStr) {
      // Continuing streak
      State.data.streak.count++;
    } else if (lastDate !== today) {
      // Streak broken or first time
      State.data.streak.count = 1;
    }

    State.data.streak.lastDate = today;

    // Update best streak
    if (State.data.streak.count > State.data.analytics.streakBest) {
      State.data.analytics.streakBest = State.data.streak.count;
    }

    // Check streak achievements
    if (
      State.data.streak.count >= 7 &&
      !State.data.achievements.includes("weekStreak")
    ) {
      Goals.unlockAchievement("weekStreak");
    }
    if (
      State.data.streak.count >= 30 &&
      !State.data.achievements.includes("monthStreak")
    ) {
      Goals.unlockAchievement("monthStreak");
    }

    State.save();
  },

  getCount() {
    return State.data?.streak.count ?? 0;
  },
};

// ============================================
// App Settings Panel (General + Data)
// ============================================
const AppSettings = {
  showPanel() {
    if (!State.data) return;
    const modal = document.createElement("div");
    modal.className = "modal-overlay active app-settings-modal";

    const prefs = State.data.preferences;
    const sidebarPrefs = prefs.sidebar || {};
    const ndPrefs = prefs.nd || {};

    modal.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2 class="modal-title">Settings</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body nd-settings-body">
            <div class="settings-section">
              <h3>General</h3>
              <div class="setting-row">
                <label for="settingsDefaultView">Default view</label>
                <select id="settingsDefaultView">
                  <option value="year" ${prefs.defaultView === VIEWS.YEAR ? "selected" : ""}>Year</option>
                  <option value="month" ${prefs.defaultView === VIEWS.MONTH ? "selected" : ""}>Month</option>
                  <option value="week" ${prefs.defaultView === VIEWS.WEEK ? "selected" : ""}>Week</option>
                  <option value="day" ${prefs.defaultView === VIEWS.DAY ? "selected" : ""}>Day</option>
                </select>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsFocusMode" ${prefs.focusMode ? "checked" : ""}>
                  Start in Focus (reduce visual noise)
                </label>
              </div>
              <div class="setting-row">
                <label>Help</label>
                <button class="btn btn-ghost" id="settingsShortcutsBtn">Keyboard shortcuts</button>
              </div>
            </div>

            <div class="settings-section">
              <h3>Visibility</h3>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsShowHeader" ${prefs.layout?.showHeader !== false ? "checked" : ""}>
                  Show header
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsShowControlBar" ${prefs.layout?.showControlBar !== false ? "checked" : ""}>
                  Show top controls
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsShowSidebar" ${prefs.layout?.showSidebar !== false ? "checked" : ""}>
                  Show sidebar
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsShowNowPanel" ${prefs.layout?.showNowPanel !== false ? "checked" : ""}>
                  Show "You Are Here"
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Accessibility & Overwhelm Support</h3>
              <div class="setting-row">
                <label>Support settings</label>
                <button class="btn btn-ghost" id="openNdSettingsBtn">Open</button>
              </div>
            </div>

            <div class="settings-section">
              <h3>Sidebar</h3>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsShowAffirmation" ${sidebarPrefs.showAffirmation ? "checked" : ""}>
                  Show affirmation
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsShowWhatsNext" ${sidebarPrefs.showWhatsNext ? "checked" : ""}>
                  Show Coming Up
                </label>
              </div>
              <div class="setting-row checkbox-row">
                <label>
                  <input type="checkbox" id="settingsShowAchievements" ${sidebarPrefs.showAchievements ? "checked" : ""}>
                  Show achievements
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Data</h3>
              <div class="setting-row">
                <label>Backup</label>
                <button class="btn btn-ghost" id="downloadBackupBtn">Download JSON</button>
              </div>
              <div class="setting-row">
                <label>Restore</label>
                <button class="btn btn-ghost" id="importBackupBtn">Import JSON</button>
                <input type="file" id="importBackupFile" accept="application/json,.json" hidden />
              </div>
              <div class="setting-row">
                <label>Reset</label>
                <button class="btn btn-ghost" id="resetPrefsBtn">Reset preferences</button>
                <button class="btn btn-ghost" id="resetAllBtn">Reset all data</button>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-primary" id="saveAppSettings">Save Settings</button>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal
      .querySelector("#settingsShortcutsBtn")
      ?.addEventListener("click", () => {
        UI.showKeyboardShortcuts();
      });

    modal.querySelector("#openNdSettingsBtn")?.addEventListener("click", () => {
      modal.remove();
      NDSupport.showSettingsPanel();
    });

    modal
      .querySelector("#downloadBackupBtn")
      ?.addEventListener("click", () => {
        this.downloadBackup();
        UI.showToast("⬇️", "Backup downloaded");
      });

    const importFile = modal.querySelector("#importBackupFile") as HTMLInputElement | null;
    modal.querySelector("#importBackupBtn")?.addEventListener("click", () => {
      importFile?.click();
    });

    importFile?.addEventListener("change", async () => {
      const file = importFile.files?.[0];
      if (importFile) importFile.value = "";
      if (!file) return;
      try {
        await this.importBackup(file);
      } catch (e) {
        console.error(e);
        UI.showToast("⚠️", "Import failed");
      }
    });

    modal.querySelector("#resetPrefsBtn")?.addEventListener("click", () => {
      if (
        !confirm(
          "Reset preferences back to defaults? Your anchors and history will stay.",
        )
      )
        return;
      this.resetPreferences();
    });

    modal.querySelector("#resetAllBtn")?.addEventListener("click", () => {
      if (!confirm("This will permanently delete ALL data on this device. Continue?"))
        return;
      if (!confirm("Last check: delete everything?")) return;
      this.resetAllData();
    });

    modal.querySelector("#saveAppSettings")?.addEventListener("click", () => {
      const defaultView = (modal.querySelector("#settingsDefaultView") as HTMLSelectElement | null)?.value;
      const startFocusMode = !!(modal.querySelector("#settingsFocusMode") as HTMLInputElement)?.checked;
      const showHeader = !!(modal.querySelector("#settingsShowHeader") as HTMLInputElement)?.checked;
      const showControlBar = !!(modal.querySelector("#settingsShowControlBar") as HTMLInputElement)
        ?.checked;
      const showSidebar = !!(modal.querySelector("#settingsShowSidebar") as HTMLInputElement)?.checked;
      const showNowPanel = !!(modal.querySelector("#settingsShowNowPanel") as HTMLInputElement)?.checked;
      const showAffirmation = !!(modal.querySelector("#settingsShowAffirmation") as HTMLInputElement)
        ?.checked;
      const showWhatsNext = !!(modal.querySelector("#settingsShowWhatsNext") as HTMLInputElement)
        ?.checked;
      const showAchievements = !!(modal.querySelector("#settingsShowAchievements") as HTMLInputElement)
        ?.checked;

      if (
        State.data &&
        defaultView &&
        (Object.values(VIEWS) as ViewType[]).includes(defaultView as ViewType)
      ) {
        const view = defaultView as ViewType;
        State.data.preferences.defaultView = view;
        State.currentView = view;
      }

      if (State.data) {
        State.data.preferences.focusMode = startFocusMode;
        UI.setFocusMode(startFocusMode, { silent: true });

        State.data.preferences.layout = {
          ...(State.data.preferences.layout || {}),
          showHeader,
          showControlBar,
          showSidebar,
          showNowPanel,
        };

        State.data.preferences.sidebar = {
          ...State.data.preferences.sidebar,
          showAffirmation,
          showWhatsNext,
          showAchievements,
        };

        State.save();
      }
      NDSupport.applyAccessibilityPreferences();
      UI.applyLayoutVisibility?.();
      UI.applySidebarVisibility?.();
      UI.syncViewButtons();
      UI.render();
      modal.remove();
      UI.showToast("✅", "Settings saved");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  downloadBackup() {
    const date = new Date().toISOString().split("T")[0];
    const filename = `visionboard-backup-${date}.json`;

    const payload = {
      exportedAt: new Date().toISOString(),
      storageKey: CONFIG.STORAGE_KEY,
      data: State.data,
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async importBackup(file: File) {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON");
    }

    const candidate = parsed?.data ?? parsed;
    const normalized = this.normalizeImportedData(candidate);

    if (!confirm("Import will replace your current data. Continue?")) return;

    State.data = normalized;
    State.save();
    location.reload();
  },

  normalizeImportedData(candidate: unknown) {
    const defaults = State.getDefaultData();
    if (!candidate || typeof candidate !== "object") {
      throw new Error("Invalid data");
    }

    const data = candidate as Record<string, unknown>;
    const normalized = defaults as AppData & { intentions?: Record<string, unknown> };
    normalized.goals = Array.isArray(data.goals) ? data.goals as Goal[] : [];
    // Legacy: intentions no longer used; preserve only if present.
    normalized.intentions =
      data.intentions && typeof data.intentions === "object"
        ? data.intentions as Record<string, unknown>
        : {};
    normalized.streak =
      data.streak && typeof data.streak === "object"
        ? data.streak as typeof defaults.streak
        : defaults.streak;
    normalized.achievements = Array.isArray(data.achievements)
      ? data.achievements as string[]
      : [];
    normalized.weeklyReviews = Array.isArray(data.weeklyReviews)
      ? data.weeklyReviews as WeeklyReview[]
      : [];
    normalized.brainDump = Array.isArray(data.brainDump)
      ? data.brainDump as BrainDumpEntry[]
      : [];
    normalized.bodyDoubleHistory = Array.isArray(data.bodyDoubleHistory)
      ? data.bodyDoubleHistory as BodyDoubleSession[]
      : [];

    normalized.preferences = {
      ...defaults.preferences,
      ...(data.preferences && typeof data.preferences === "object"
        ? data.preferences as typeof defaults.preferences
        : {}),
      nd: {
        ...defaults.preferences.nd,
        ...(data.preferences &&
          typeof data.preferences === "object" &&
          (data.preferences as any).nd &&
          typeof (data.preferences as any).nd === "object"
          ? (data.preferences as any).nd
          : {}),
      },
    };

    normalized.analytics =
      data.analytics && typeof data.analytics === "object"
        ? { ...defaults.analytics, ...(data.analytics as typeof defaults.analytics) }
        : defaults.analytics;

    normalized.createdAt =
      typeof (candidate as any).createdAt === "string"
        ? (candidate as any).createdAt
        : defaults.createdAt;
    normalized.version = defaults.version;

    return normalized;
  },

  resetPreferences() {
    if (!State.data) return;
    const defaults = State.getDefaultData();
    State.data.preferences = defaults.preferences;
    State.save();
    location.reload();
  },

  resetAllData() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    location.reload();
  },
};

// ============================================
// UI Rendering
// ============================================
const UI = {
  els: {}, // Shortcut reference for elements
  elements: {} as UIElements, // Will be populated by cacheElements
  _filterDocListeners: null as FilterDocListeners | null, // For managing document event listeners
  _focusRevealSetup: false, // Whether focus reveal has been initialized
  _focusRevealHideTimer: null as ReturnType<typeof setTimeout> | null, // Timer for hiding focus reveal
  goalModalYear: null as number | null, // Year selected in goal modal
  goalModalLevel: "milestone" as GoalLevel, // Level of goal being created in goal modal
  getCurrentLevel(): GoalLevel {
    switch (State.currentView) {
      case "year": return "vision";
      case "month": return "milestone";
      case "week": return "focus";
      case "day": return "intention";
      default: return "milestone";
    }
  },

  showQuickAdd(forDate: Date = new Date()) {
    const overlay = document.createElement("div");
    overlay.className = "quick-add-overlay";
    overlay.innerHTML = `
      <div class="quick-add-container">
        <div class="quick-add-header">
          <span class="quick-add-emoji">🌱</span>
          <span class="quick-add-label">Quick Intention</span>
        </div>
        <input type="text" id="quickAddInput" placeholder="What's one small thing for today?" autofocus>
        <div class="quick-add-tip">Press Enter to save • Esc to cancel</div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector("#quickAddInput") as HTMLInputElement;
    input.focus();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        this.saveQuickAdd(input.value.trim(), forDate);
        overlay.remove();
      }
      if (e.key === "Escape") {
        overlay.remove();
      }
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  },

  saveQuickAdd(title: string, forDate: Date = new Date()) {
    const due = new Date(forDate);
    // Stable "day" anchor time for consistent filtering/grouping.
    due.setHours(12, 0, 0, 0);
    Goals.create({
      title,
      level: "intention",
      category: "personal",
      month: due.getMonth(),
      year: due.getFullYear(),
      dueDate: due.toISOString(),
      priority: "medium"
    });

    this.render();
    this.showToast("🌱", "Intention captured. Go for it!");
    this.celebrate("✨", "Captured!", "Focus on this one thing.");
  },

  openZenFocus(goalId: string) {
    const goal = Goals.getById(goalId);
    if (!goal) return;

    const overlay = document.createElement("div");
    overlay.className = "zen-focus-overlay";

    const cat = goal.category ? CONFIG.CATEGORIES[goal.category] : null;
    const levelInfo = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.intention;

	    overlay.innerHTML = `
	      <div class="zen-focus-container">
	        <button class="zen-close-btn">×</button>

	        <div class="zen-header">
	          <div class="zen-level-badge">
	            <span class="zen-emoji">${levelInfo.emoji}</span>
	            <span class="zen-label">${levelInfo.label}</span>
          </div>
          ${cat ? `<div class="zen-category" style="color: ${cat.color}">${cat.emoji} ${cat.label}</div>` : ""}
        </div>

        <h1 class="zen-title">${this.escapeHtml(goal.title)}</h1>
        ${goal.description ? `<p class="zen-desc">${this.escapeHtml(goal.description)}</p>` : ""}

        <div class="zen-subtasks">
          ${goal.subtasks.length > 0 ? `
            <h3>Action Steps</h3>
            <div class="zen-subtask-list">
              ${goal.subtasks.map((s, idx) => `
                <div class="zen-subtask-item ${s.done ? 'done' : ''}" data-idx="${idx}">
                  <div class="zen-subtask-checkbox ${s.done ? 'checked' : ''}"></div>
                  <span>${this.escapeHtml(s.title)}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="zen-empty-subtasks">Focus on the big picture.</div>
          `}
        </div>

        <div class="zen-footer">
          <button class="zen-complete-btn ${goal.status === 'done' ? 'completed' : ''}">
            ${goal.status === 'done' ? '✅ Completed' : '✨ Mark as Done'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event handlers
    overlay.querySelector(".zen-close-btn")?.addEventListener("click", () => overlay.remove());
    overlay.querySelectorAll(".zen-subtask-item").forEach(item => {
      item.addEventListener("click", () => {
        const idx = parseInt((item as HTMLElement).dataset.idx || "0");
        goal.subtasks[idx].done = !goal.subtasks[idx].done;
        State.save();
        this.render();
        this.openZenFocus(goalId); // Re-render zen view
        overlay.remove();
        this.showToast("💎", "Step completed!");
      });
    });

    overlay.querySelector(".zen-complete-btn")?.addEventListener("click", () => {
      goal.status = goal.status === 'done' ? 'in-progress' : 'done';
      State.save();
      this.render();
      overlay.remove();
      if (goal.status === 'done') {
        this.celebrate("🏆", "Level Up!", `Finished: ${goal.title}`);
      }
    });
  },

  updateSyncStatus(status: 'syncing' | 'synced' | 'error' | 'local'): void {
    const el = document.getElementById("syncStatus");
    if (!el) return;

    const icon = el.querySelector(".sync-icon");
    const text = el.querySelector(".sync-text");

    el.classList.remove("syncing", "synced", "error");

    if (status === 'syncing') {
      el.classList.add("syncing");
      if (icon) icon.textContent = "⏳";
      if (text) text.textContent = "Syncing...";
    } else if (status === 'synced') {
      el.classList.add("synced");
      if (icon) icon.textContent = "✅";
      if (text) text.textContent = "Cloud Saved";
      // Revert to subtle synced look after 3s
      setTimeout(() => {
        if (icon && el.classList.contains("synced")) icon.textContent = "☁️";
        if (text && el.classList.contains("synced")) text.textContent = "Synced";
      }, 3000);
    } else if (status === 'error') {
      el.classList.add("error");
      if (icon) icon.textContent = "❌";
      if (text) text.textContent = "Sync Error";
    } else {
      if (icon) icon.textContent = "☁️";
      if (text) text.textContent = "Local Only";
    }
  },

  init() {
    this.cacheElements();
    this.els = this.elements; // Alias for convenience
    this.bindEvents();
    this.applySavedUIState();
    this.render();
    this.updateTimeDisplay();
    this.updateYearProgress();
    this.renderAchievements();

    // Initialize ND Support features
    NDSupport.init();

    // Set up periodic updates
    setInterval(() => this.updateTimeDisplay(), 60000);

    // Update body double timer display
    setInterval(() => this.updateBodyDoubleDisplay(), 1000);

    // Check for weekly review prompt
    if (Planning.shouldPromptReview()) {
      setTimeout(() => this.showReviewPrompt(), 3000);
    }
  },

  // Update body double timer display
  updateBodyDoubleDisplay() {
    const remaining = NDSupport.getBodyDoubleRemaining();
    const display = document.getElementById("bodyDoubleDisplay");
    const timer = document.getElementById("bdTimer");

    if (remaining && display && timer) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      timer.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
      display.removeAttribute("hidden");
    } else if (display) {
      display.setAttribute("hidden", "");
    }
  },

  cacheElements() {
    this.elements = {
      calendarGrid: document.getElementById("calendarGrid") as HTMLElement | null,
      canvas: document.getElementById("canvas") as HTMLCanvasElement | null,
      canvasContainer: document.getElementById("canvasContainer") as HTMLElement | null,
      categoryFilters: document.getElementById("categoryFilters") as HTMLElement | null,
      upcomingGoals: document.getElementById("upcomingGoals") as HTMLElement | null,
      goalModal: document.getElementById("goalModal") as HTMLElement | null,
      goalForm: document.getElementById("goalForm") as HTMLFormElement | null,
      goalMonth: document.getElementById("goalMonth") as HTMLInputElement | null,
      nowDate: document.getElementById("nowDate") as HTMLElement | null,
      nowContext: document.getElementById("nowContext") as HTMLElement | null,
      daysLeft: document.getElementById("daysLeft") as HTMLElement | null,
      weeksLeft: document.getElementById("weeksLeft") as HTMLElement | null,
      timeProgress: document.getElementById("timeProgress") as HTMLElement | null,
      yearProgressFill: document.getElementById("yearProgressFill") as HTMLElement | null,
      gardenBloom: document.getElementById("gardenBloom") as HTMLElement | null,
      flowerPetals: document.getElementById("flowerPetals") as unknown as SVGElement | null,
      yearProgressLabel: document.getElementById("yearProgressLabel") as HTMLElement | null,
      yearProgressValue: document.getElementById("yearProgressValue") as HTMLElement | null,
      zoomLevel: document.getElementById("zoomLevel") as HTMLElement | null,
      affirmationText: document.getElementById("affirmationText") as HTMLElement | null,
      yearDisplay: document.getElementById("yearDisplay") as HTMLElement | null,
      streakCount: document.getElementById("streakCount") as HTMLElement | null,
      achievementsGrid: document.getElementById("achievementsGrid") as HTMLElement | null,
      achievementsPanel: document.querySelector(".achievements-panel") as HTMLElement | null,
      affirmationPanel: document.getElementById("affirmationPanel") as HTMLElement | null,
      whatsNextPanel: document.querySelector(".whats-next") as HTMLElement | null,
      toast: document.getElementById("toast") as HTMLElement | null,
      toastMessage: document.getElementById("toastMessage") as HTMLElement | null,
      toastIcon: document.getElementById("toastIcon") as HTMLElement | null,
      celebrationModal: document.getElementById("celebrationModal") as HTMLElement | null,
      celebrationEmoji: document.getElementById("celebrationEmoji") as HTMLElement | null,
      celebrationTitle: document.getElementById("celebrationTitle") as HTMLElement | null,
      celebrationText: document.getElementById("celebrationText") as HTMLElement | null,
      confettiContainer: document.getElementById("confettiContainer") as HTMLElement | null,
      // ND Support elements (may not exist yet)
      brainDumpBtn: document.getElementById("brainDumpBtn") as HTMLElement | null,
      bodyDoubleBtn: document.getElementById("bodyDoubleBtn") as HTMLElement | null,
      ndSettingsBtn: document.getElementById("ndSettingsBtn") as HTMLElement | null,
      dopamineMenuBtn: document.getElementById("dopamineMenuBtn") as HTMLElement | null,
      appearanceBtn: document.getElementById("appearanceBtn") as HTMLElement | null,
      appSettingsBtn: document.getElementById("appSettingsBtn") as HTMLElement | null,
    };
  },

  bindEvents() {
    // View switcher
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        State.setView((btn as HTMLElement).dataset.view as ViewType);
        this.syncViewButtons();
      });
    });

    // Date navigation
    document
      .getElementById("navPrev")
      ?.addEventListener("click", () => State.navigate(-1));
    document
      .getElementById("navNext")
      ?.addEventListener("click", () => State.navigate(1));
    document.getElementById("navToday")?.addEventListener("click", () => {
      State.goToDate(new Date());
      this.render();
    });

    // Legacy year navigation (fallback)
    document
      .getElementById("prevYear")
      ?.addEventListener("click", () => this.changeYear(-1));
    document
      .getElementById("nextYear")
      ?.addEventListener("click", () => this.changeYear(1));

    // Add Goal Button
    document
      .getElementById("addGoalBtn")
      ?.addEventListener("click", () =>
        this.openGoalModal(this.getCurrentLevel(), State.viewingMonth, State.viewingYear),
      );

    // Modal controls
    document
      .getElementById("closeModal")
      ?.addEventListener("click", () => this.closeGoalModal());
    document
      .getElementById("cancelModal")
      ?.addEventListener("click", () => this.closeGoalModal());
    document.getElementById("goalModal")?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement)?.id === "goalModal") this.closeGoalModal();
    });

    // Goal form submission
    this.elements.goalForm?.addEventListener("submit", (e) =>
      this.handleGoalSubmit(e),
    );

    // Zoom controls
    document
      .getElementById("zoomIn")
      ?.addEventListener("click", () => this.zoom(10));
    document
      .getElementById("zoomOut")
      ?.addEventListener("click", () => this.zoom(-10));

    // Focus mode
    document
      .getElementById("focusModeBtn")
      ?.addEventListener("click", () => this.toggleFocusMode());
    document
      .getElementById("focusToggle")
      ?.addEventListener("click", () => this.toggleFocusMode());

    // Layout visibility shortcuts
    document.getElementById("hideHeaderBtn")?.addEventListener("click", () => {
      if (!State.data) return;
      State.data.preferences.layout = {
        ...(State.data.preferences.layout || {}),
        showHeader: false,
      };
      State.save();
      this.applyLayoutVisibility();
    });

    document.getElementById("layoutHandle")?.addEventListener("click", () => {
      if (!State.data) return;
      State.data.preferences.layout = {
        ...(State.data.preferences.layout || {}),
        showHeader: true,
      };
      State.save();
      this.applyLayoutVisibility();
    });

    document.getElementById("hideSidebarBtn")?.addEventListener("click", () => {
      if (!State.data) return;
      State.data.preferences.layout = {
        ...(State.data.preferences.layout || {}),
        showSidebar: false,
      };
      State.save();
      this.applyLayoutVisibility();
    });

    document.getElementById("sidebarHandle")?.addEventListener("click", () => {
      if (!State.data) return;
      State.data.preferences.layout = {
        ...(State.data.preferences.layout || {}),
        showSidebar: true,
      };
      State.save();
      this.applyLayoutVisibility();
    });

    // Settings
    document
      .getElementById("appSettingsBtn")
      ?.addEventListener("click", () => AppSettings.showPanel());

    // Affirmation click
    document
      .getElementById("affirmationPanel")
      ?.addEventListener("click", () => this.showRandomAffirmation());

    // Pick random goal
    document
      .getElementById("pickOneBtn")
      ?.addEventListener("click", () => this.pickRandomGoal());

    // Celebration close
    document
      .getElementById("closeCelebration")
      ?.addEventListener("click", () => this.closeCelebration());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleKeyboard(e));

    // Canvas pan and zoom
    this.setupCanvasInteraction();

    // ND Support button bindings
    document
      .getElementById("brainDumpBtn")
      ?.addEventListener("click", () => NDSupport.showBrainDumpModal());
    document
      .getElementById("bodyDoubleBtn")
      ?.addEventListener("click", () => NDSupport.showBodyDoubleModal());
    document
      .getElementById("ndSettingsBtn")
      ?.addEventListener("click", () => NDSupport.showSettingsPanel());
    document
      .getElementById("appearanceBtn")
      ?.addEventListener("click", () => NDSupport.showAppearancePanel());
    document
      .getElementById("dopamineMenuBtn")
      ?.addEventListener("click", () => NDSupport.showDopamineMenu());

    // Body double stop button
    document.getElementById("bdStop")?.addEventListener("click", () => {
      if (!State.data) return;
      const sessions = State.data.bodyDoubleHistory;
      const active = sessions[sessions.length - 1];
      if (active && !active.endedAt) {
        NDSupport.endBodyDouble(active.id, false);
        document
          .getElementById("bodyDoubleDisplay")
          ?.setAttribute("hidden", "");
      }
    });

    // Affirmation panel keyboard accessibility
    document
      .getElementById("affirmationPanel")
      ?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.showRandomAffirmation();
        }
      });
  },

  setupCanvasInteraction() {
    let isDragging = false;
    let startX: number, startY: number, scrollLeft: number, scrollTop: number;

    const container = this.elements.canvasContainer;
    if (!container) return;

    container.addEventListener("mousedown", (e) => {
      if ((e.target as Element)?.closest(".month-card") || (e.target as Element)?.closest(".goal-item"))
        return;
      isDragging = true;
      container.classList.add("grabbing");
      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    });

    container.addEventListener("mouseleave", () => {
      isDragging = false;
      container.classList.remove("grabbing");
    });

    container.addEventListener("mouseup", () => {
      isDragging = false;
      container.classList.remove("grabbing");
    });

    container.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    });

    // Mouse wheel zoom
    container.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.zoom(e.deltaY < 0 ? 10 : -10);
      }
    });
  },

  render() {
    this.renderCurrentView();
    this.renderCategoryFilters();
    this.renderUpcomingGoals();
    this.updateDateDisplay();
    this.updateYearProgress();
    Streaks.check();
    this.updateStreakDisplay();
  },

  // Render based on current view
  renderCurrentView() {
    const container = this.elements.calendarGrid;
    if (!container) return;

    // Update view button states
    this.syncViewButtons();

    switch (State.currentView) {
      case VIEWS.YEAR:
        this.renderCalendar();
        break;
      case VIEWS.MONTH:
        this.renderMonthView();
        break;
      case VIEWS.WEEK:
        this.renderWeekView();
        break;
      case VIEWS.DAY:
        this.renderDayView();
        break;
      default:
        this.renderCalendar();
    }
  },

  // Update the date display based on current view
  updateDateDisplay() {
    const display = document.getElementById("dateDisplay");
    if (!display) return;

    const now = new Date();
    const isToday = State.viewingDate.toDateString() === now.toDateString();

    let text = "";
    switch (State.currentView) {
      case VIEWS.YEAR:
        text = State.viewingYear.toString();
        display.classList.toggle(
          "is-today",
          State.viewingYear === now.getFullYear(),
        );
        break;
      case VIEWS.MONTH:
        text = `${CONFIG.MONTHS[State.viewingMonth]} ${State.viewingYear}`;
        display.classList.toggle(
          "is-today",
          State.viewingMonth === now.getMonth() &&
          State.viewingYear === now.getFullYear(),
        );
        break;
      case VIEWS.WEEK:
        const weekStart = State.getWeekStart(
          State.viewingYear,
          State.viewingWeek || 1,
        );
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        text = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        display.classList.toggle(
          "is-today",
          now >= weekStart && now <= weekEnd,
        );
        break;
      case VIEWS.DAY:
        text = State.viewingDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        display.classList.toggle("is-today", isToday);
        break;
    }
    display.textContent = text;

    const isRedundant = true;
    display.classList.toggle("is-hidden", isRedundant);
    display.setAttribute("aria-hidden", isRedundant ? "true" : "false");
  },

  // Render Month View
  renderMonthView() {
    const container = this.elements.calendarGrid;
    if (!container) return;

    const year = State.viewingYear;
    const month = State.viewingMonth;
    const today = new Date();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const monthGoals = Goals.getByMonth(month, year);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Time context
    const breakdown = TimeBreakdown.calculate(month, year);

    let html = `
        <div class="month-view">
          <div class="month-view-header">
            <h2 class="month-view-title">${CONFIG.MONTHS[month]} ${year}</h2>
            <p class="month-view-subtitle">
              ${breakdown.isPast ? "This month has passed" : breakdown.isCurrentMonth ? `${breakdown.days} days remaining this month` : `${breakdown.days} days until this month`}
            </p>
          </div>
          <div class="month-calendar">
            ${dayNames.map((d) => `<div class="month-calendar-header">${d}</div>`).join("")}
      `;

    // Padding for first week
    for (let i = 0; i < startPadding; i++) {
      const prevDate = new Date(year, month, -startPadding + i + 1);
      html += `<div class="month-day other-month"><span class="month-day-number">${prevDate.getDate()}</span></div>`;
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = date.toDateString() === today.toDateString();
      const dayGoals = monthGoals.filter((g) => {
        if (g.dueDate) {
          const due = new Date(g.dueDate);
          return due.getDate() === day;
        }
        return false;
      });

      html += `
          <div class="month-day ${isToday ? "today" : ""}" data-date="${date.toISOString()}">
            <span class="month-day-number">${day}</span>
            <div class="month-day-goals">
              ${dayGoals
          .slice(0, 2)
          .map(
            (g) =>
              `<div class="month-day-goal">${this.escapeHtml(g.title)}</div>`,
          )
          .join("")}
              ${dayGoals.length > 2 ? `<div class="month-day-more">+${dayGoals.length - 2} more</div>` : ""}
            </div>
          </div>
        `;
    }

    // Padding for last week
    const endPadding = (7 - ((startPadding + daysInMonth) % 7)) % 7;
    for (let i = 1; i <= endPadding; i++) {
      html += `<div class="month-day other-month"><span class="month-day-number">${i}</span></div>`;
    }

    html += `</div>`;

    // Milestones list for the month
    html += `
        <div class="month-goals-list">
          <h3>Milestones for ${CONFIG.MONTHS[month]} (${monthGoals.length})</h3>
          ${this.renderGoalsList(monthGoals)}
        </div>
      </div>`;

    container.innerHTML = html;
    container.className = "month-view-container";

    // Click handlers for days
    container
      .querySelectorAll(".month-day:not(.other-month)")
      .forEach((day) => {
        day.addEventListener("click", () => {
          State.goToDate(new Date((day as HTMLElement).dataset.date!));
          State.setView(VIEWS.DAY);
        });
      });

    // Click handlers for goal items in the list
    container.querySelectorAll(".goal-item").forEach((item) => {
      item.addEventListener("click", () => {
        this.showGoalDetail((item as HTMLElement).dataset.goalId!);
      });
    });

    // Click handlers for goal checkboxes
    container.querySelectorAll(".goal-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        const goalItem = checkbox.closest(".goal-item") as HTMLElement | null;
        const goalId = goalItem?.dataset.goalId;
        if (!goalId) return;
        const goal = Goals.getById(goalId);
        if (goal) {
          const newStatus = goal.status === "done" ? "in-progress" : "done";
          Goals.update(goalId, { status: newStatus });
          if (newStatus === "done") {
            this.celebrate("🎉", "Nice work!", "You completed a task!");
          }
          this.render();
        }
      });
    });
  },

  // Render Week View
  renderWeekView() {
    const container = this.elements.calendarGrid;
    if (!container) return;

    const weekNum = State.viewingWeek ?? 1;
    const weekStart = State.getWeekStart(State.viewingYear, weekNum);
    const today = new Date();
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    let html = `<div class="week-view">
        <div class="week-view-header">
          <h2 class="week-view-title">Week ${weekNum}</h2>
          <p class="week-view-range">${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
        <div class="week-grid">
      `;

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();
      const dayGoals = Goals.getAll().filter((g) => {
        if (g.dueDate) {
          return new Date(g.dueDate).toDateString() === date.toDateString();
        }
        // Also show goals for the month
        return g.month === date.getMonth() && g.year === date.getFullYear();
      });

      html += `
          <div class="week-day-column ${isToday ? "today" : ""}" data-date="${date.toISOString()}">
            <div class="week-day-header">
              <div class="week-day-name">${dayNames[i]}</div>
              <div class="week-day-date">${date.getDate()}</div>
            </div>
            <div class="week-day-goals">
              ${dayGoals.length === 0 ? '<div class="week-day-empty">No tasks</div>' : ""}
              ${dayGoals
          .map(
            (g) => `
                <div class="week-goal-item ${g.status === "done" ? "completed" : ""}" data-goal-id="${g.id}">
                  <div class="week-goal-title">${this.escapeHtml(g.title)}</div>
                  <div class="week-goal-category">${g.category ? (CONFIG.CATEGORIES[g.category]?.emoji || "") : ""} ${g.category ? (CONFIG.CATEGORIES[g.category]?.label || "") : ""}</div>
                </div>
              `,
          )
          .join("")}
            </div>
          </div>
        `;
    }

    html += `</div></div>`;
    container.innerHTML = html;
    container.className = "week-view-container";

    // Click handlers
    container.querySelectorAll(".week-day-column").forEach((col) => {
      col.addEventListener("dblclick", () => {
        const dateIso = (col as HTMLElement).dataset.date;
        if (!dateIso) return;
        State.goToDate(new Date(dateIso));
        State.setView(VIEWS.DAY);
      });
    });

    container.querySelectorAll(".week-goal-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showGoalDetail((item as HTMLElement).dataset.goalId);
      });
    });
  },

  // Render Day View
  renderDayView() {
    const container = this.elements.calendarGrid;
    if (!container) return;

    const date = State.viewingDate;
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const parseTimeToMinutes = (time: string | null | undefined): number | null => {
      if (!time) return null;
      const [hRaw, mRaw] = time.split(":");
      const hours = Number.parseInt(hRaw ?? "", 10);
      const minutes = Number.parseInt(mRaw ?? "", 10);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      return hours * 60 + minutes;
    };

    const plotStartMin = 8 * 60;
    const plotEndMin = 22 * 60;
    const plotRangeMin = plotEndMin - plotStartMin;

    // Get goals for this day/month
    const dayGoals = Goals.getAll().filter((g) => {
      if (g.dueDate) {
        return new Date(g.dueDate).toDateString() === date.toDateString();
      }
      return g.month === date.getMonth() && g.year === date.getFullYear();
    });

    const activeGoals = dayGoals.filter((g) => g.status !== "done");
    const completedGoals = dayGoals.filter((g) => g.status === "done");

    const now = new Date();
    const currentHour = now.getHours();
    let timeMessage = "";
    let timeDetail = "";

    if (isToday) {
      if (currentHour >= 5 && currentHour < 12) {
        timeMessage = "Good morning! Let's help your day bloom.";
        timeDetail = "Set your boundaries and plant your intentions.";
      } else if (currentHour >= 12 && currentHour < 17) {
        timeMessage = "The sun is high. Tending to your garden?";
        timeDetail = "Respect your fences; focus on one petal at a time.";
      } else if (currentHour >= 17 && currentHour < 21) {
        timeMessage = "The golden hour. Gentle progress is blooming.";
        timeDetail = "Softly closing boundaries soon.";
      } else {
        timeMessage = "Quiet in the garden. Time to rest and restore.";
        timeDetail = "The fence is closed. Sweet dreams.";
      }
    } else if (date > today) {
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const daysUntil = Math.max(
        0,
        Math.round((dateStart.getTime() - todayStart.getTime()) / 86400000),
      );
      timeMessage = `Preparing for ${daysUntil} day${daysUntil === 1 ? "" : "s"} from now`;
      timeDetail = "Visualizing future blooms.";
    } else {
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const daysAgo = Math.max(
        0,
        Math.round((todayStart.getTime() - dateStart.getTime()) / 86400000),
      );
      timeMessage = `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
      timeDetail = "The garden has grown past this day.";
    }

    const seedGoals = activeGoals.filter((g) => parseTimeToMinutes(g.startTime) === null);

    const timedCandidates = activeGoals
      .map((goal) => {
        const startMinRaw = parseTimeToMinutes(goal.startTime);
        if (startMinRaw === null) return null;

        const endMinRaw = parseTimeToMinutes(goal.endTime);
        const startMin = Math.min(
          Math.max(startMinRaw, plotStartMin),
          plotEndMin - 15,
        );

        let endMin =
          endMinRaw !== null && endMinRaw > startMinRaw
            ? endMinRaw
            : startMinRaw + 60;
        endMin = Math.min(Math.max(endMin, startMin + 15), plotEndMin);

        return { goal, startMin, endMin };
      })
      .filter((v): v is { goal: Goal; startMin: number; endMin: number } => Boolean(v))
      .sort((a, b) => a.startMin - b.startMin);

    // Interval partitioning to create non-overlapping lanes.
    const laneEndTimes: number[] = [];
    const maxLanes = 4;
    const timedWithLane = timedCandidates.map((item) => {
      let lane = laneEndTimes.findIndex((end) => item.startMin >= end);
      if (lane === -1) {
        lane = laneEndTimes.length;
        laneEndTimes.push(item.endMin);
      } else {
        laneEndTimes[lane] = item.endMin;
      }
      const laneClamped = lane % maxLanes;

      const startPct = ((item.startMin - plotStartMin) / plotRangeMin) * 100;
      const durPct = ((item.endMin - item.startMin) / plotRangeMin) * 100;

      return {
        ...item,
        lane: laneClamped,
        style: `--start:${startPct.toFixed(4)};--dur:${durPct.toFixed(4)};--lane:${laneClamped};`,
      };
    });

    const laneCount = Math.max(
      1,
      Math.min(maxLanes, Math.max(...timedWithLane.map((t) => t.lane + 1), 1)),
    );

    const bedGrid = Array.from({ length: 15 }, (_, idx) => 8 + idx) // 8AM..10PM
      .map((h) => {
        const atPct = ((h * 60 - plotStartMin) / plotRangeMin) * 100;
        const label = `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
        return `
          <div class="bed-hour" style="--at:${atPct.toFixed(4)}">
            <span class="bed-hour-label">${label}</span>
            <div class="bed-hour-line"></div>
          </div>
        `;
      })
      .join("");

    let html = `
        <div class="day-view ${isToday ? "is-today" : ""}">
          <div class="day-view-header">
            <h2 class="day-view-title">${dayName}</h2>
            <p class="day-view-subtitle">${dateStr}</p>
          </div>

          <div class="day-time-context">
            <div class="day-time-message">${timeMessage}</div>
            <div class="day-time-detail">${timeDetail}</div>
          </div>

          ${activeGoals.length >= 6
        ? `
            <div class="garden-capacity-warning">
              <span class="warning-icon">🌸</span>
              <div class="warning-text">
                <strong>Your garden bed is full!</strong>
                <span>Refining your fences (boundaries) helps you focus. Consider moving some blooms to tomorrow.</span>
              </div>
            </div>
          `
        : ""
      }
          <div class="day-land">
            <div class="day-land-topbar">
              <div class="day-land-fence" role="status" aria-live="polite">
                <span class="fence-label">Fence</span>
                <span class="fence-value">${activeGoals.length} active</span>
                <span class="fence-hint">Aim for 3–5 planters</span>
              </div>
              <button class="btn btn-primary btn-sm day-plant-btn" id="dayPlantBtn" type="button">
                Plant something
              </button>
            </div>

            <div class="day-plot" style="--lanes:${laneCount}">
              <div class="day-seed-tray" role="region" aria-label="Seed tray (unscheduled)">
                <div class="seed-tray-header">
                  <span class="seed-tray-title">Seed tray</span>
                  <span class="seed-tray-subtitle">Small tasks without a start time</span>
                </div>
                <div class="seed-tray-grid" role="list">
                  ${seedGoals.length > 0
        ? seedGoals.map((g) => this.renderDayGoalCard(g, { variant: "seed" })).join("")
        : `
                        <div class="seed-tray-empty">
                          Leave this empty if you need breathing room.
                        </div>
                      `
      }
                </div>
              </div>

              <div class="day-bed" role="region" aria-label="Garden bed (your day)">
                <div class="day-bed-header">
                  <span class="day-bed-title">Your day</span>
                  <span class="day-bed-subtitle">Add a start time to place a planter</span>
                </div>
                <div class="day-bed-canvas" role="list" aria-label="Scheduled planters">
                  <div class="day-bed-grid" aria-hidden="true">
                    ${bedGrid}
                  </div>
                  ${timedWithLane.length > 0
        ? timedWithLane
          .map((t) =>
            this.renderDayGoalCard(t.goal, { variant: "planter", style: t.style }),
          )
          .join("")
        : `
                        <div class="bed-empty">
                          No planters placed yet. Add a start time to any task, or plant one small intention.
                        </div>
                      `
      }
                </div>
              </div>

              ${completedGoals.length > 0
        ? `
                    <div class="day-compost" role="region" aria-label="Compost (done)">
                      <div class="compost-header">
                        <span class="compost-title">Compost</span>
                        <span class="compost-subtitle">${completedGoals.length} done</span>
                      </div>
                      <div class="compost-grid" role="list">
                        ${completedGoals.map((g) => this.renderDayGoalCard(g, { variant: "compost" })).join("")}
                      </div>
                    </div>
                  `
        : ""
      }
            </div>
          </div>
        </div>`;

    container.innerHTML = html;
    container.className = "day-view-container";

    // Event handlers
    container.querySelectorAll(".day-goal-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.showGoalDetail((card as HTMLElement).dataset.goalId);
      });
      card.addEventListener("keydown", (e) => {
        if (!(e instanceof KeyboardEvent)) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        this.showGoalDetail((card as HTMLElement).dataset.goalId);
      });
    });

    container.querySelectorAll(".day-goal-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        const goalCard = checkbox.closest(".day-goal-card") as HTMLElement | null;
        const goalId = goalCard?.dataset.goalId;
        if (!goalId) return;
        const goal = Goals.getById(goalId);
        if (goal) {
          const newStatus = goal.status === "done" ? "in-progress" : "done";
          Goals.update(goalId, { status: newStatus });
          if (newStatus === "done") {
            this.celebrate("🎉", "Nice work!", "You completed a task!");
          }
          this.render();
        }
      });
    });

    container.querySelectorAll(".btn-zen-focus").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const goalId = (btn as HTMLElement).dataset.goalId;
        if (goalId) this.openZenFocus(goalId);
      });
    });

    const plantBtn = container.querySelector("#dayPlantBtn");
    plantBtn?.addEventListener("click", () => {
      this.showQuickAdd(State.viewingDate);
    });
  },

  // Render a single goal card for day view
  renderDayGoalCard(goal: Goal, opts?: { variant?: "planter" | "seed" | "compost"; style?: string }) {
    const cat = goal.category ? CONFIG.CATEGORIES[goal.category] : undefined;
    const isCompleted = goal.status === "done";
    const levelInfo = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.intention;
    const variant = opts?.variant ?? "seed";
    const variantClass =
      variant === "planter"
        ? "day-goal-variant-planter"
        : variant === "compost"
          ? "day-goal-variant-compost"
          : "day-goal-variant-seed";
    const styleAttr = opts?.style ? ` style="${opts.style}"` : "";

    return `
      <div class="day-goal-card ${variantClass} ${isCompleted ? "completed" : ""}" data-goal-id="${goal.id}" role="button" tabindex="0"${styleAttr}>
        <div class="day-goal-checkbox ${isCompleted ? "checked" : ""}"></div>
        <div class="day-goal-content">
          <div class="day-goal-level">
            <span class="day-goal-level-emoji">${levelInfo.emoji}</span>
            <span class="day-goal-level-label">${levelInfo.label}</span>
          </div>
          <div class="day-goal-title">${this.escapeHtml(goal.title)}</div>
          ${goal.description ? `<div class="day-goal-desc">${this.escapeHtml(goal.description)}</div>` : ""}
          <div class="day-goal-meta">
            ${goal.startTime ? `<span class="day-goal-time">🕒 ${goal.startTime}${goal.endTime ? ` - ${goal.endTime}` : ""}</span>` : ""}
            ${cat ? `<span class="day-goal-cat" style="color: ${cat.color}">${cat.emoji} ${cat.label}</span>` : ""}
            ${goal.priority !== "medium" ? `<span class="day-goal-priority priority-${goal.priority}">${goal.priority}</span>` : ""}
            <button class="btn-zen-focus" title="Zen Focus Mode" data-goal-id="${goal.id}">👁️ Focus</button>
          </div>
        </div>
        ${goal.progress > 0 && goal.progress < 100
        ? `
            <div class="day-goal-progress">
              <div class="progress-bar-lg">
                <div class="progress-fill-lg" style="width: ${goal.progress}%"></div>
              </div>
            </div>
          `
        : ""
      }
      </div>
    `;
  },

  // Helper to render a simple goals list
  renderGoalsList(goals: Goal[]) {
    if (goals.length === 0) {
      return "";
    }
    return goals
      .map((g) => {
        const cat = g.category ? CONFIG.CATEGORIES[g.category] : undefined;
        return `
          <div class="goal-item ${g.status === "done" ? "completed" : ""}" data-goal-id="${g.id}">
            <div class="goal-checkbox ${g.status === "done" ? "checked" : ""}"></div>
            <div class="goal-content">
              <div class="goal-title">${this.escapeHtml(g.title)}</div>
              <div class="goal-tags">
                <span class="goal-tag">${cat?.emoji ?? ""} ${cat?.label ?? ""}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  },

  changeYear(delta: number) {
    State.navigate(delta);
  },

  updateYearDisplay() {
    const currentYear = new Date().getFullYear();
    if (this.elements.yearDisplay) {
      this.elements.yearDisplay.textContent = String(State.viewingYear);
      this.elements.yearDisplay.classList.toggle(
        "current-year",
        State.viewingYear === currentYear,
      );
    }
  },

  renderCalendar() {
    const container = this.elements.calendarGrid;
    if (!container) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const viewingYear = State.viewingYear;

    // Update year display
    this.updateYearDisplay();

    // Render year header + grid
    container.className = "year-view-container";
    container.innerHTML = "";

    const yearView = document.createElement("div");
    yearView.className = "year-view";

    const header = document.createElement("div");
    header.className = "year-view-header";
    header.innerHTML = `
      <h2 class="year-view-title">${viewingYear}</h2>
      <p class="year-view-subtitle">Your year as a garden of months</p>
    `;

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    yearView.appendChild(header);
    yearView.appendChild(grid);
    container.appendChild(yearView);

    CONFIG.MONTHS.forEach((monthName, monthIndex) => {
      const card = this.createMonthCard(
        monthIndex,
        monthName,
        currentMonth,
        currentYear,
        viewingYear,
      );

      // Click handler to drill into month view
      card.addEventListener("click", (e) => {
        // Don't navigate if clicking on a goal item
        const target = e.target as Element | null;
        if (target?.closest(".goal-item")) return;
        State.viewingMonth = monthIndex;
        State.viewingYear = viewingYear;
        State.viewingDate = new Date(viewingYear, monthIndex, 1);
        State.setView(VIEWS.MONTH);
      });

      grid.appendChild(card);
    });
  },

  createMonthCard(
    monthIndex: number,
    monthName: string,
    currentMonth: number,
    currentYear: number,
    viewingYear: number,
  ) {
    const card = document.createElement("div");
    card.className = "month-card";
    card.dataset.month = String(monthIndex);
    card.dataset.year = String(viewingYear);

    // Determine card state based on viewing year vs current year
    const isCurrentYear = viewingYear === currentYear;
    const isPastYear = viewingYear < currentYear;
    const isFutureYear = viewingYear > currentYear;

    if (isCurrentYear && monthIndex === currentMonth) {
      card.classList.add("current");
    } else if (isPastYear || (isCurrentYear && monthIndex < currentMonth)) {
      card.classList.add("past");
    } else {
      card.classList.add("future");
    }

    // Get goals for this month
    const monthGoals = Goals.getByMonth(monthIndex, viewingYear);
    const completedCount = monthGoals.filter(
      (g) => g.status === "done",
    ).length;
    const progressPercent =
      monthGoals.length > 0
        ? Math.round((completedCount / monthGoals.length) * 100)
        : 0;

    // Time context with breakdown
    let timeContext = "";
    let timeDetail = "";
    const breakdown = TimeBreakdown.calculate(monthIndex, viewingYear);

    if (isPastYear) {
      timeContext = `${currentYear - viewingYear} year${currentYear - viewingYear > 1 ? "s" : ""} ago`;
      timeDetail = "";
    } else if (isFutureYear) {
      const monthsAway =
        (viewingYear - currentYear) * 12 + (monthIndex - currentMonth);
      timeContext = `In ${monthsAway} months`;
      timeDetail =
        breakdown.days > 0
          ? `${breakdown.days} days • ${breakdown.weeks} weeks`
          : "";
    } else if (monthIndex === currentMonth) {
      timeContext = "This month";
      timeDetail = `${breakdown.days} days left`;
    } else if (monthIndex === currentMonth + 1) {
      timeContext = "Next month";
      timeDetail = `${breakdown.days} days • ${breakdown.weeks} weeks`;
    } else if (monthIndex > currentMonth) {
      timeContext = `In ${monthIndex - currentMonth} months`;
      timeDetail = `${breakdown.days} days • ${breakdown.weekends} weekends`;
    } else {
      timeContext = `${currentMonth - monthIndex} months ago`;
      timeDetail = "";
    }

    card.innerHTML = `
      <div class="month-header">
        <div class="month-name">${monthName}</div>
        <div class="month-context">${timeContext}</div>
        ${timeDetail ? `<div class="month-time-detail">${timeDetail}</div>` : ""}
      </div>
      <div class="month-progress">
        <div class="month-progress-bar">
          <div class="month-progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="month-progress-label">${completedCount}/${monthGoals.length} milestones</div>
      </div>
      <div class="month-goals">
        ${this.renderMonthGoals(monthGoals)}
      </div>
      <div class="month-actions">
        <button class="btn btn-sm btn-ghost add-goal-btn" data-month="${monthIndex}">+ Add Milestone</button>
        <button class="btn btn-sm btn-ghost view-month-btn" data-month="${monthIndex}">View Details</button>
      </div>
    `;

    // Bind events
    card.querySelector(".add-goal-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openGoalModal("milestone", monthIndex, viewingYear);
    });

    card.querySelector(".view-month-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showMonthDetail(monthIndex, viewingYear);
    });

    card.addEventListener("click", () => {
      this.showMonthDetail(monthIndex, viewingYear);
    });

    return card;
  },

  renderMonthGoals(goals: Goal[]) {
    if (goals.length === 0) {
      return "";
    }

    // Filter by active category
    let filteredGoals = goals;
    if (State.activeCategory !== "all") {
      filteredGoals = goals.filter(
        (g) => g.category === State.activeCategory,
      );
    }

    return filteredGoals
      .slice(0, 5)
      .map((goal) => {
        const cat = goal.category ? (CONFIG.CATEGORIES[goal.category] ?? null) : null;
        const statusClass = goal.status === "done" ? "completed" : "";
        const priorityClass =
          goal.priority === "urgent" || goal.priority === "high"
            ? `priority - ${goal.priority} `
            : "";

        const level = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.milestone;
        return `
  < div class="goal-item ${statusClass} ${priorityClass}" data - goal - id="${goal.id}" >
    <div class="goal-checkbox ${goal.status === "done" ? "checked" : ""}"
data - goal - id="${goal.id}" > </div>
  < div class="goal-content" >
    <div class="goal-title" >
      <span class="goal-level-emoji" > ${level.emoji} </span>
                                ${this.escapeHtml(goal.title)}
</div>
  < div class="goal-meta" >
    ${cat ? `<span class="goal-category" style="color: ${cat.color}">${cat.emoji}</span>` : ""}
                                ${goal.subtasks.length > 0 ? `<span class="goal-subtasks">${goal.subtasks.filter((s: Subtask) => s.done).length}/${goal.subtasks.length}</span>` : ""}
                                ${goal.progress > 0 && goal.progress < 100 ? `<span class="goal-progress-text">${goal.progress}%</span>` : ""}
</div>
                            ${goal.progress > 0 ? `<div class="goal-progress-bar"><div class="goal-progress-fill" style="width: ${goal.progress}%"></div></div>` : ""}
</div>
  < button class="btn btn-icon btn-ghost goal-edit-btn" data - goal - id="${goal.id}" >⋮</button>
    </div>
      `;
      })
      .join("");
  },

  renderCategoryFilters() {
    const container = this.elements.categoryFilters;
    if (!container) return;

    const categories = [
      { id: "all", label: "All", emoji: "✨" },
      ...Object.entries(CONFIG.CATEGORIES).map(([id, cat]) => ({
        id,
        label: cat.label,
        emoji: cat.emoji,
      })),
    ];

    const activeId = State.activeCategory || "all";
    const active = categories.find((c) => c.id === activeId) || categories[0];

    container.innerHTML = `
      <div class="filter-dropdown">
        <button class="filter-trigger" type="button" aria-haspopup="menu" aria-expanded="false">
          <span class="filter-value">${active.emoji} ${active.label}</span>
          <span class="filter-caret" aria-hidden="true">▾</span>
        </button>
        <div class="filter-menu" role="menu" hidden>
          ${categories
        .map(
          (cat) => `
                <button
                  class="category-filter ${activeId === cat.id ? "active" : ""}"
                  type="button"
                  role="menuitemradio"
                  aria-checked="${activeId === cat.id}"
                  data-category="${cat.id}"
                >
                  ${cat.emoji} ${cat.label}
                </button>
              `,
        )
        .join("")}
        </div>
      </div>
    `;

    const dropdown = container.querySelector(".filter-dropdown") as HTMLElement | null;
    const trigger = container.querySelector(".filter-trigger") as HTMLElement | null;
    const menu = container.querySelector(".filter-menu") as HTMLElement | null;

    if (!dropdown || !trigger || !menu) return;

    const closeMenu = () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    };

    const openMenu = () => {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      const activeBtn = menu.querySelector(".category-filter.active") as HTMLElement | null;
      (activeBtn || menu.querySelector(".category-filter") as HTMLElement | null)?.focus?.();
    };

    if (this._filterDocListeners) {
      document.removeEventListener("click", this._filterDocListeners.onDocClick);
      document.removeEventListener(
        "keydown",
        this._filterDocListeners.onDocKeydown,
      );
      this._filterDocListeners = null;
    }

    trigger.addEventListener(
      "click",
      () => {
        if (menu.hidden) openMenu();
        else closeMenu();
      },
    );

    trigger.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openMenu();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeMenu();
        }
      },
    );

    const onDocClick = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node | null)) closeMenu();
    };

    const onDocKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onDocKeydown);
    this._filterDocListeners = { onDocClick, onDocKeydown };

    menu.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeMenu();
          trigger.focus();
        }
      },
    );

    // Bind filter events
    menu.querySelectorAll(".category-filter").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          State.activeCategory = (btn as HTMLElement).dataset.category ?? "all";
          closeMenu();
          this.renderCategoryFilters();
          this.renderCalendar();
          this.renderUpcomingGoals();
        },
      );
    });
  },

  renderUpcomingGoals() {
    const container = this.elements.upcomingGoals;
    if (!container) return;

    const upcoming = Goals.getUpcoming(5);

    if (upcoming.length === 0) {
      // Reduce visual clutter when empty
      this.elements.whatsNextPanel?.setAttribute("hidden", "");
      container.innerHTML = "";
      return;
    }

    this.elements.whatsNextPanel?.removeAttribute("hidden");

    container.innerHTML = upcoming
      .map((goal) => {
        const cat = goal.category ? (CONFIG.CATEGORIES[goal.category] ?? null) : null;
        const monthName = CONFIG.MONTHS[goal.month];

        const timeLeft = TimeBreakdown.getSimpleTimeLeft(
          goal.month,
          goal.year,
        );

        return `
  < div class="upcoming-goal" data - goal - id="${goal.id}" >
    <div class="upcoming-dot" style = "background: ${cat ? cat.color : "rgba(255, 255, 255, 0.18)"}" > </div>
      < div class="upcoming-content" >
        <div class="upcoming-title" > ${this.escapeHtml(goal.title)} </div>
          < div class="upcoming-meta" > ${monthName} • ${timeLeft} </div>
            </div>
            </div>
              `;
      })
      .join("");

    // Bind click events
    container.querySelectorAll(".upcoming-goal").forEach((el) => {
      el.addEventListener("click", () => {
        this.showGoalDetail((el as HTMLElement).dataset.goalId);
      });
    });
  },

  renderAchievements() {
    const container = this.elements.achievementsGrid;
    if (!container) return;
    if (!State.data) return;

    const unlocked = State.data.achievements;

    container.innerHTML = Object.entries(CONFIG.ACHIEVEMENTS)
      .map(
        ([id, ach]) => `
            < div class="achievement ${unlocked.includes(id) ? "unlocked" : ""}"
data - tooltip="${ach.desc}" >
  ${ach.emoji}
</div>
  `,
      )
      .join("");
  },

  // ============================================
  // Modal Handling
  // ============================================
  openGoalModal(level: GoalLevel = "milestone", preselectedMonth: number | null = null, preselectedYear: number | null = null): void {
    this.goalModalLevel = level;
    this.goalModalYear =
      preselectedYear ?? State.viewingYear ?? new Date().getFullYear();

    // Update modal titles based on level
    const title = document.getElementById("goal-modal-title");
    const label = document.querySelector('label[for="goalTitle"]');

    if (title) {
      if (level === "vision") title.textContent = "Create New Vision";
      else if (level === "milestone") title.textContent = "Set New Milestone";
      else if (level === "focus") title.textContent = "Define New Focus";
      else if (level === "intention") title.textContent = "Set New Intention";
    }

    if (label) {
      if (level === "vision") label.textContent = "What is your vision for this year?";
      else if (level === "milestone") label.textContent = "What is your milestone for this month?";
      else if (level === "focus") label.textContent = "What is your focus for this week?";
      else if (level === "intention") label.textContent = "What is your intention for today?";
    }

    this.populateMonthSelect(preselectedMonth, this.goalModalYear);
    this.elements.goalModal?.classList.add("active");
    document.getElementById("goalTitle")?.focus();
  },

  closeGoalModal() {
    this.elements.goalModal?.classList.remove("active");
    this.elements.goalForm?.reset();
    this.goalModalYear = null;
  },

  populateMonthSelect(
    preselectedMonth: number | null = null,
    year: number | null = null,
  ) {
    const select = this.elements.goalMonth;
    if (!select) return;

    const now = new Date();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();

    const currentMonth = preselectedMonth ?? State.viewingMonth ?? nowMonth;
    const currentYear = year ?? this.goalModalYear ?? State.viewingYear ?? nowYear;

    select.innerHTML = CONFIG.MONTHS.map((name, idx) => {
      const timeLeft = TimeBreakdown.getSimpleTimeLeft(idx, currentYear);
      const isPast =
        currentYear < nowYear || (currentYear === nowYear && idx < nowMonth);
      return `<option value="${idx}" ${idx === currentMonth ? "selected" : ""} ${isPast ? 'class="past-month"' : ""}>${name} ${!isPast ? `(${timeLeft})` : "(past)"}</option>`;
    }).join("");

    // Ensure the select has a valid value even if HTML parsing fails.
    select.value = String(currentMonth);

    // Add listener to show time breakdown when month changes
    select.addEventListener("change", () =>
      this.updateGoalModalTimeBreakdown(),
    );

    // Show initial time breakdown
    setTimeout(() => this.updateGoalModalTimeBreakdown(), 0);
  },

  updateGoalModalTimeBreakdown() {
    const select = this.elements.goalMonth;
    if (!select) return;

    const selectedMonth = Number.parseInt(select.value, 10);
    if (!Number.isFinite(selectedMonth)) return;
    const currentYear =
      this.goalModalYear ?? State.viewingYear ?? new Date().getFullYear();

    // Find or create the time breakdown container in the modal
    let breakdownContainer = document.getElementById("modalTimeBreakdown");
    if (!breakdownContainer) {
      breakdownContainer = document.createElement("div");
      breakdownContainer.id = "modalTimeBreakdown";
      breakdownContainer.className = "modal-time-breakdown";
      // Insert after the form-row
      const formRow = this.elements.goalForm?.querySelector(".form-row");
      if (formRow) {
        const parent = formRow.parentNode;
        if (parent) parent.insertBefore(breakdownContainer, formRow.nextSibling);
      }
    }

    breakdownContainer.innerHTML = TimeBreakdown.generateHTML(
      selectedMonth,
      currentYear,
      false,
    );
  },

  handleGoalSubmit(e: Event) {
    e.preventDefault();

    const titleEl = document.getElementById("goalTitle") as HTMLInputElement | null;
    const monthEl = document.getElementById("goalMonth") as HTMLSelectElement | null;
    const categoryEl = document.getElementById("goalCategory") as HTMLSelectElement | null;
    const priorityEl = document.getElementById("goalPriority") as HTMLSelectElement | null;
    const startTimeEl = document.getElementById("goalStartTime") as HTMLInputElement | null;
    const endTimeEl = document.getElementById("goalEndTime") as HTMLInputElement | null;

    const title = titleEl?.value.trim() ?? "";
    const month = monthEl ? parseInt(monthEl.value, 10) : NaN;
    const categoryRaw = categoryEl?.value;
    const category: Category =
      categoryRaw && categoryRaw in CONFIG.CATEGORIES
        ? (categoryRaw as Exclude<Category, null>)
        : null;
    const priorityRaw = priorityEl?.value;
    const priority: Priority =
      priorityRaw === "low" ||
        priorityRaw === "medium" ||
        priorityRaw === "high" ||
        priorityRaw === "urgent"
        ? priorityRaw
        : "medium";
    const year =
      this.goalModalYear ?? State.viewingYear ?? new Date().getFullYear();

    if (!title || !Number.isFinite(month)) return;

    Goals.create({
      title,
      level: this.goalModalLevel,
      month,
      year,
      category,
      priority,
      startTime: startTimeEl?.value || null,
      endTime: endTimeEl?.value || null,
    });

    this.closeGoalModal();
    this.render();
    this.showToast("✨", "Anchor placed.");
  },

  // ============================================
  // Goal Detail View
  // ============================================
  showGoalDetail(goalId?: string) {
    if (!goalId) return;
    const goal = Goals.getById(goalId);
    if (!goal) return;

    State.selectedGoal = goalId;
    const cat = goal.category ? (CONFIG.CATEGORIES[goal.category] ?? null) : null;
    const status = CONFIG.STATUSES[goal.status];

    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "goalDetailModal";
    modal.innerHTML = `
                <div class="modal modal-lg">
                    <div class="modal-header">
                        <div class="goal-detail-header">
                            ${cat
        ? `<span class="goal-category-badge" style="background: ${cat.color}20; color: ${cat.color}">
                                ${cat.emoji} ${cat.label}
                            </span>`
        : ""
      }
                            <span class="goal-status-badge" style="background: ${status.color}20; color: ${status.color}">
                                ${status.emoji} ${status.label}
                            </span>
                        </div>
                        <button class="modal-close" id="closeGoalDetail">×</button>
                    </div>
                    <div class="modal-body">
                        <h2 class="goal-detail-title">${this.escapeHtml(goal.title)}</h2>

                        ${goal.description ? `<p class="goal-description">${this.escapeHtml(goal.description)}</p>` : ""}

                        <!-- Time Breakdown Section -->
                        <div class="detail-section time-section">
                            <h3>⏰ Time You Have</h3>
                            ${TimeBreakdown.generateHTML(goal.month, goal.year)}
                        </div>

                        <!-- Progress Section -->
                        <div class="detail-section">
                            <h3>Progress</h3>
                            <div class="progress-control">
                                <div class="progress-bar-lg">
                                    <div class="progress-fill-lg" style="width: ${goal.progress}%"></div>
                                </div>
                                <span class="progress-value">${goal.progress}%</span>
                            </div>
                            <input type="range" min="0" max="100" value="${goal.progress}"
                                   class="progress-slider" id="progressSlider">
                        </div>

                        <!-- Status Section -->
                        <div class="detail-section">
                            <h3>Status</h3>
                            <div class="status-buttons">
                                ${Object.entries(CONFIG.STATUSES)
        .map(
          ([id, s]) => `
                                    <button class="status-btn ${goal.status === id ? "active" : ""}"
                                            data-status="${id}" style="--status-color: ${s.color}">
                                        ${s.emoji} ${s.label}
                                    </button>
                                `,
        )
        .join("")}
                            </div>
                        </div>

                        <!-- Subtasks Section -->
                        <div class="detail-section">
                            <h3>Subtasks <span class="count">(${goal.subtasks.filter((s) => s.done).length}/${goal.subtasks.length})</span></h3>
                            <div class="subtasks-list" id="subtasksList">
                                ${goal.subtasks
        .map(
          (s) => `
                                    <div class="subtask-item ${s.done ? "done" : ""}" data-subtask-id="${s.id}">
                                        <div class="subtask-checkbox ${s.done ? "checked" : ""}"></div>
                                        <span class="subtask-title">${this.escapeHtml(s.title)}</span>
                                        <button class="btn btn-icon btn-ghost subtask-delete">×</button>
                                    </div>
                                `,
        )
        .join("")}
                            </div>
                            <div class="add-subtask">
                                <input type="text" placeholder="Add a subtask..." id="newSubtaskInput">
                                <button class="btn btn-sm btn-primary" id="addSubtaskBtn">Add</button>
                            </div>
                        </div>

                        <!-- Notes Section -->
                        <div class="detail-section">
                            <h3>Notes & Reflections</h3>
                            <div class="notes-list" id="notesList">
                                ${goal.notes
        .map(
          (n) => `
                                    <div class="note-item">
                                        <p>${this.escapeHtml(n.text)}</p>
                                        <span class="note-date">${this.formatDate(n.createdAt)}</span>
                                    </div>
                                `,
        )
        .join("")}
                            </div>
                            <div class="add-note">
                                <textarea placeholder="Add a note..." id="newNoteInput"></textarea>
                                <button class="btn btn-sm btn-primary" id="addNoteBtn">Add Note</button>
                            </div>
                        </div>

                        <!-- Time Tracking -->
                        <div class="detail-section">
                            <h3>Time Spent</h3>
                            <div class="time-summary">
                                <span class="time-total">${this.formatMinutes(Goals.getTotalTime(goalId))}</span>
                                <button class="btn btn-sm btn-ghost" id="logTimeBtn">+ Log Time</button>
                            </div>
                            ${goal.lastWorkedOn ? `<p class="last-worked">Last worked on: ${this.formatDate(goal.lastWorkedOn)}</p>` : ""}
                        </div>

                        <!-- Meta Info -->
                        <div class="detail-meta">
                            <span>Created: ${this.formatDate(goal.createdAt)}</span>
                            ${goal.completedAt ? `<span>Completed: ${this.formatDate(goal.completedAt)}</span>` : ""}
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-danger" id="deleteGoalBtn">Remove Anchor</button>
                        <button class="btn btn-primary" id="saveGoalBtn">Save Changes</button>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);
    this.bindGoalDetailEvents(modal, goalId);
  },

  bindGoalDetailEvents(modal: HTMLElement, goalId: string) {
    // Close button
    modal.querySelector("#closeGoalDetail")?.addEventListener("click", () => {
      modal.remove();
      State.selectedGoal = null;
    });

    // Click outside to close
    modal.addEventListener("click", (e: MouseEvent) => {
      if (e.target === modal) {
        modal.remove();
        State.selectedGoal = null;
      }
    });

    // Progress slider
    modal.querySelector("#progressSlider")?.addEventListener("input", (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const progress = target ? parseInt(target.value, 10) : NaN;
      if (!Number.isFinite(progress)) return;
      Goals.update(goalId, { progress });
      const progressFill = modal.querySelector(".progress-fill-lg") as HTMLElement | null;
      const progressValue = modal.querySelector(".progress-value") as HTMLElement | null;
      if (progressFill) progressFill.style.width = `${progress}%`;
      if (progressValue) progressValue.textContent = `${progress}%`;
    });

    // Status buttons
    modal.querySelectorAll(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const status = (btn as HTMLElement).dataset.status;
        if (!status) return;
        Goals.update(goalId, { status: status as Goal["status"] });
        modal
          .querySelectorAll(".status-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (status === "done") {
          Goals.complete(goalId);
          modal.remove();
          this.render();
        }
      });
    });

    // Add subtask
    const addSubtask = () => {
      const input = modal.querySelector("#newSubtaskInput") as HTMLInputElement | null;
      const title = input?.value.trim() ?? "";
      if (!title) return;

      Goals.addSubtask(goalId, title);
      if (input) input.value = "";
      this.refreshGoalDetail(modal, goalId);
    };

    modal
      .querySelector("#addSubtaskBtn")
      ?.addEventListener("click", addSubtask);
    (modal.querySelector("#newSubtaskInput") as HTMLInputElement | null)
      ?.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") addSubtask();
      });

    // Toggle subtasks
    modal.querySelectorAll(".subtask-checkbox").forEach((cb) => {
      cb.addEventListener("click", (e: Event) => {
        const mouseEvent = e as MouseEvent;
        const subtaskItem = cb.closest(".subtask-item") as HTMLElement | null;
        const subtaskId = subtaskItem?.dataset.subtaskId;
        if (!subtaskId) return;

        // If checking (not unchecking), spawn sparkles
        const checkbox = cb as HTMLInputElement;
        if (checkbox.checked) {
          this.spawnPollenSparkles(mouseEvent.clientX, mouseEvent.clientY);
        }

        Goals.toggleSubtask(goalId, subtaskId);
        this.refreshGoalDetail(modal, goalId);
      });
    });

    // Delete subtasks
    modal.querySelectorAll(".subtask-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const subtaskItem = btn.closest(".subtask-item") as HTMLElement | null;
        const subtaskId = subtaskItem?.dataset.subtaskId;
        if (!subtaskId) return;
        Goals.deleteSubtask(goalId, subtaskId);
        this.refreshGoalDetail(modal, goalId);
      });
    });

    // Add note
    modal.querySelector("#addNoteBtn")?.addEventListener("click", () => {
      const input = modal.querySelector("#newNoteInput") as HTMLInputElement | null;
      const text = input?.value.trim() ?? "";
      if (!text) return;

      Goals.addNote(goalId, text);
      if (input) input.value = "";
      this.refreshGoalDetail(modal, goalId);
    });

    // Log time
    modal.querySelector("#logTimeBtn")?.addEventListener("click", () => {
      const minutesRaw = prompt("How many minutes did you work on this?");
      const minutes = minutesRaw ? parseInt(minutesRaw, 10) : NaN;
      if (Number.isFinite(minutes)) {
        Goals.logTime(goalId, minutes);
        this.refreshGoalDetail(modal, goalId);
        this.showToast("⏱️", "Time logged!");
      }
    });

    // Delete goal
    modal.querySelector("#deleteGoalBtn")?.addEventListener("click", () => {
      if (confirm("Remove this anchor?")) {
        Goals.delete(goalId);
        modal.remove();
        this.render();
        this.showToast("🗑️", "Anchor removed");
      }
    });

    // Save changes
    modal.querySelector("#saveGoalBtn")?.addEventListener("click", () => {
      modal.remove();
      State.selectedGoal = null;
      this.render();
      this.showToast("✅", "Changes saved");
    });
  },

  refreshGoalDetail(modal: HTMLElement, goalId: string) {
    modal.remove();
    this.showGoalDetail(goalId);
  },

  // ============================================
  // Month Detail View
  // ============================================
  showMonthDetail(monthIndex: number, year: number = new Date().getFullYear()) {
    const monthGoals = Goals.getByMonth(monthIndex, year);
    const monthName = CONFIG.MONTHS[monthIndex];

    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "monthDetailModal";
    modal.innerHTML = `
                <div class="modal modal-xl">
                    <div class="modal-header">
                        <h2 class="modal-title">${monthName} ${year}</h2>
                        <button class="modal-close" id="closeMonthDetail">×</button>
                    </div>
                    <div class="modal-body">
                        <!-- Month Overview -->
                        <div class="month-overview">
                            <div class="overview-stat">
                                <div class="stat-value">${monthGoals.length}</div>
                                <div class="stat-label">Total Anchors</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-value">${monthGoals.filter((g) => g.status === "done").length}</div>
                                <div class="stat-label">Completed</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-value">${monthGoals.filter((g) => g.status === "in-progress").length}</div>
                                <div class="stat-label">In Progress</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-value">${Math.round(monthGoals.reduce((s, g) => s + g.progress, 0) / (monthGoals.length || 1))}%</div>
                                <div class="stat-label">Avg Progress</div>
                            </div>
                        </div>

                        <!-- Milestones by Status -->
                        <div class="goals-by-status">
                            ${this.renderGoalsByStatus(monthGoals)}
                        </div>

                        <!-- Add Milestone for this month -->
                        <div class="quick-add-goal">
                            <input type="text" placeholder="Quick add a milestone for ${monthName}..." id="quickGoalInput">
                            <select id="quickGoalCategory">
                                <option value="">No category</option>
                                ${Object.entries(CONFIG.CATEGORIES)
        .map(
          ([id, cat]) => `
                                    <option value="${id}">${cat.emoji} ${cat.label}</option>
                                `
        )
        .join("")}
                            </select>
                            <button class="btn btn-primary" id="quickAddGoalBtn">Add</button>
                        </div>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);

    // Bind events
    modal
      .querySelector("#closeMonthDetail")
      ?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    // Quick add goal
    modal.querySelector("#quickAddGoalBtn")?.addEventListener("click", () => {
      const input = modal.querySelector("#quickGoalInput") as HTMLInputElement | null;
      const categorySelect = modal.querySelector("#quickGoalCategory") as HTMLSelectElement | null;
      const title = input?.value.trim() ?? "";
      const categoryRaw = categorySelect?.value;
      const category: Category =
        categoryRaw && categoryRaw in CONFIG.CATEGORIES
          ? (categoryRaw as Exclude<Category, null>)
          : null;

      if (!title) return;

      Goals.create({
        title,
        level: "milestone",
        month: monthIndex,
        year,
        category,
      });

      if (input) input.value = "";
      modal.remove();
      this.render();
      this.showToast("✨", "Milestone placed.");
    });

    // Clicking on goal items opens detail
    modal.querySelectorAll(".goal-item").forEach((el) => {
      el.addEventListener("click", () => {
        modal.remove();
        this.showGoalDetail((el as HTMLElement).dataset.goalId);
      });
    });
  },

  renderGoalsByStatus(goals: Goal[]) {
    const grouped: Record<GoalStatus, Goal[]> = {
      "not-started": goals.filter((g) => g.status === "not-started"),
      "in-progress": goals.filter((g) => g.status === "in-progress"),
      blocked: goals.filter((g) => g.status === "blocked"),
      done: goals.filter((g) => g.status === "done"),
    };

    return (Object.entries(grouped) as [GoalStatus, Goal[]][])
      .map(([status, statusGoals]) => {
        const statusConfig = CONFIG.STATUSES[status];
        return `
                    <div class="status-column">
                        <h3 class="status-header" style="color: ${statusConfig.color}">
                            ${statusConfig.emoji} ${statusConfig.label} (${statusGoals.length})
                        </h3>
                        <div class="status-goals">
                            ${statusGoals
            .map((goal) => {
              const cat = goal.category ? CONFIG.CATEGORIES[goal.category] : null;
              const level = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.milestone;
              return `
                                    <div class="goal-item" data-goal-id="${goal.id}">
                                        <div class="goal-content">
                                            <div class="goal-title">
                                                <span class="goal-level-emoji">${level.emoji}</span>
                                                ${this.escapeHtml(goal.title)}
                                            </div>
                                            <div class="goal-meta">
                                                ${cat ? `<span style="color: ${cat.color}">${cat.emoji}</span>` : ""}
                                                <span>${goal.progress}%</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
            })
            .join("") || ""
          }
                        </div>
                    </div>
                `;
      })
      .join("");
  },

  // ============================================
  // Weekly Review
  // ============================================
  showReviewPrompt() {
    if (sessionStorage.getItem("reviewPromptShown")) return;
    sessionStorage.setItem("reviewPromptShown", "true");

    const toast = document.createElement("div");
    toast.className = "review-prompt";
    toast.innerHTML = `
                <div class="review-prompt-content">
                    <span class="review-emoji">📝</span>
                    <span class="review-text">Time for your weekly review!</span>
                    <button class="btn btn-sm btn-primary" id="startReviewBtn">Start Review</button>
                    <button class="btn btn-sm btn-ghost" id="dismissReviewBtn">Later</button>
                </div>
            `;

    document.body.appendChild(toast);

    toast.querySelector("#startReviewBtn")?.addEventListener("click", () => {
      toast.remove();
      this.showWeeklyReview();
    });

    toast
      .querySelector("#dismissReviewBtn")
      ?.addEventListener("click", () => {
        toast.remove();
      });
  },

  showWeeklyReview() {
    const weekGoals = Planning.getWeekGoals();
    const completed = weekGoals.filter((g) => g.status === "done");

    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.innerHTML = `
                <div class="modal modal-lg">
                    <div class="modal-header">
                        <h2 class="modal-title">📝 Weekly Review</h2>
                        <button class="modal-close" id="closeReview">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="review-section">
                            <h3>🎉 This Week's Wins</h3>
                            <p class="review-hint">What felt good this week? (${completed.length} anchors marked done)</p>
                            <textarea id="reviewWins" placeholder="List your wins this week..."></textarea>
                        </div>

                        <div class="review-section">
                            <h3>🧗 Challenges Faced</h3>
                            <textarea id="reviewChallenges" placeholder="What obstacles did you encounter?"></textarea>
                        </div>

                        <div class="review-section">
                            <h3>💡 Key Learnings</h3>
                            <textarea id="reviewLearnings" placeholder="What did you learn?"></textarea>
                        </div>

                        <div class="review-section">
                            <h3>🎯 Next Week's Priorities</h3>
                            <textarea id="reviewPriorities" placeholder="What will you focus on next week?"></textarea>
                        </div>

                        <div class="review-section">
                            <h3>How are you feeling?</h3>
                            <div class="mood-selector">
                                <button class="mood-btn" data-mood="1">😫</button>
                                <button class="mood-btn" data-mood="2">😕</button>
                                <button class="mood-btn" data-mood="3">😐</button>
                                <button class="mood-btn" data-mood="4">🙂</button>
                                <button class="mood-btn" data-mood="5">😊</button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-ghost" id="cancelReview">Skip</button>
                        <button class="btn btn-primary" id="saveReview">Save Review ✨</button>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);

    let selectedMood = 3;

    modal
      .querySelector("#closeReview")
      ?.addEventListener("click", () => modal.remove());
    modal
      .querySelector("#cancelReview")
      ?.addEventListener("click", () => modal.remove());

    modal.querySelectorAll(".mood-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal
          .querySelectorAll(".mood-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedMood = parseInt((btn as HTMLElement).dataset.mood ?? "3", 10);
      });
    });

    modal.querySelector("#saveReview")?.addEventListener("click", () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());

      Planning.createWeeklyReview({
        weekStart: weekStart.toISOString(),
        weekEnd: now.toISOString(),
        wins: (
          (modal.querySelector("#reviewWins") as HTMLTextAreaElement | null)
            ?.value ?? ""
        )
          .split("\n")
          .filter(Boolean),
        challenges: (
          (modal.querySelector("#reviewChallenges") as HTMLTextAreaElement | null)
            ?.value ?? ""
        )
          .split("\n")
          .filter(Boolean),
        learnings:
          (modal.querySelector("#reviewLearnings") as HTMLTextAreaElement | null)
            ?.value ?? "",
        nextWeekPriorities: (
          (modal.querySelector("#reviewPriorities") as HTMLTextAreaElement | null)
            ?.value ?? ""
        )
          .split("\n")
          .filter(Boolean),
        mood: selectedMood,
      });

      modal.remove();
      this.showToast("📝", "Weekly review saved!");
      this.render();
    });
  },

  // ============================================
  // UI Utilities
  // ============================================
  updateTimeDisplay() {
    const now = new Date();
    const monthName = CONFIG.MONTHS[now.getMonth()];
    const dayNum = now.getDate();

    if (this.elements.nowDate) {
      this.elements.nowDate.textContent = `${monthName} ${dayNum}`;
    }

    if (this.elements.nowContext) {
      const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
      this.elements.nowContext.textContent = dayOfWeek;
    }

    // Days and weeks left in year
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    const daysLeft = Math.ceil((endOfYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const weeksLeft = Math.ceil(daysLeft / 7);

    if (this.elements.daysLeft) {
      this.elements.daysLeft.textContent = String(daysLeft);
    }
    if (this.elements.weeksLeft) {
      this.elements.weeksLeft.textContent = String(weeksLeft);
    }
  },

  updateYearProgress() {
    const now = new Date();

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const toPercent = (ratio: number) => Math.round(clamp01(ratio) * 100);

    let start: Date;
    let end: Date;
    let label = "Progress";

    switch (State.currentView) {
      case VIEWS.MONTH: {
        label = "Month position";
        start = new Date(State.viewingYear, State.viewingMonth, 1);
        end = new Date(State.viewingYear, State.viewingMonth + 1, 1);
        break;
      }
      case VIEWS.WEEK: {
        label = "Week position";
        start = State.getWeekStart(State.viewingYear, State.viewingWeek ?? 1);
        end = new Date(start);
        end.setDate(end.getDate() + 7);
        break;
      }
      case VIEWS.DAY: {
        label = "Day position";
        start = new Date(State.viewingDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      }
      case VIEWS.YEAR:
      default: {
        label = "Year position";
        start = new Date(State.viewingYear, 0, 1);
        end = new Date(State.viewingYear + 1, 0, 1);
        break;
      }
    }

    const ratio = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
    const progress = toPercent(ratio);

    if (this.elements.yearProgressFill) {
      this.elements.yearProgressFill.style.width = `${progress}%`;
    }
    if (this.elements.yearProgressValue) {
      this.elements.yearProgressValue.textContent = `${progress}%`;
    }
    if (this.elements.yearProgressLabel) {
      this.elements.yearProgressLabel.textContent = label;
    }

    // Garden Bloom Animation
    if (this.elements.flowerPetals) {
      const petals = this.elements.flowerPetals.querySelectorAll(".petal");
      const scale = 0.2 + (progress / 100) * 0.8; // Scale from 0.2 to 1.0
      const rotationOffset = (progress / 100) * 10; // Slight rotation shift

      petals.forEach((petal, index) => {
        const baseRotation = index * 72;
        const p = petal as SVGElement;
        p.style.transform = `rotate(${baseRotation + rotationOffset}deg) scale(${scale})`;
      });

      if (this.elements.gardenBloom) {
        if (progress >= 100) {
          this.elements.gardenBloom.classList.add("full-bloom");
        } else {
          this.elements.gardenBloom.classList.remove("full-bloom");
        }
      }
    }

    if (this.elements.timeProgress) {
      this.elements.timeProgress.setAttribute("aria-label", label);
      this.elements.timeProgress.setAttribute("aria-valuenow", String(progress));
      this.elements.timeProgress.setAttribute("aria-valuetext", `${progress}%`);
    }
  },

  spawnPollenSparkles(x: number, y: number) {
    const colors = ["var(--petal)", "var(--sage)", "var(--sunset)", "#FFD700"];
    for (let i = 0; i < 8; i++) {
      const sparkle = document.createElement("div");
      sparkle.className = "pollen-sparkle";
      sparkle.style.left = `${x}px`;
      sparkle.style.top = `${y}px`;
      sparkle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

      const tx = (Math.random() - 0.5) * 100;
      const ty = (Math.random() - 0.5) * 100;
      sparkle.style.setProperty("--tx", `${tx}px`);
      sparkle.style.setProperty("--ty", `${ty}px`);
      sparkle.style.animation = `pollen-drift ${0.6 + Math.random() * 0.4}s var(--ease-out) forwards`;

      document.body.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 1000);
    }
  },

  updateStreakDisplay() {
    if (this.elements.streakCount) {
      this.elements.streakCount.textContent = String(Streaks.getCount());
    }
  },

  showRandomAffirmation() {
    const affirmation =
      CONFIG.AFFIRMATIONS[
      Math.floor(Math.random() * CONFIG.AFFIRMATIONS.length)
      ];
    const affirmationText = this.elements.affirmationText;
    if (affirmationText) {
      affirmationText.style.opacity = "0";
      setTimeout(() => {
        affirmationText.textContent = `"${affirmation}"`;
        affirmationText.style.opacity = "1";
      }, 200);
    }
  },

  pickRandomGoal() {
    const upcoming = Goals.getUpcoming(10);
    if (upcoming.length === 0) {
      this.showToast("", "Nothing to pick from yet.");
      return;
    }

    const randomGoal = upcoming[Math.floor(Math.random() * upcoming.length)];

    // Highlight the picked goal
    this.showGoalDetail(randomGoal.id);
    this.showToast("", `Return to: ${randomGoal.title}`);
  },

  zoom(delta: number) {
    State.zoom = Math.max(50, Math.min(150, State.zoom + delta));
    if (this.elements.canvas) {
      this.elements.canvas.style.transform = `scale(${State.zoom / 100})`;
    }
    if (this.elements.zoomLevel) {
      this.elements.zoomLevel.textContent = `${State.zoom}%`;
    }
  },

  toggleFocusMode() {
    const previousView = State.currentView;
    this.setFocusMode(!State.focusMode);
    if (State.currentView !== previousView) {
      State.setView(previousView);
    }
  },

  setFocusMode(
    enabled: boolean,
    options: { silent?: boolean; persist?: boolean } = {},
  ) {
    const { silent = false, persist = true } = options;

    State.focusMode = !!enabled;
    if (persist && State.data) {
      State.data.preferences.focusMode = State.focusMode;
      State.save();
    }

    document.body.classList.toggle("focus-mode", State.focusMode);
    if (State.focusMode) {
      this.updateFocusLayoutVars();
      this.setupFocusHoverReveal();
      document.getElementById("focusHandle")?.removeAttribute("hidden");
    } else {
      document.body.classList.remove("focus-ui-revealed");
      document.getElementById("focusHandle")?.setAttribute("hidden", "");
    }

    const focusToggle = document.getElementById("focusToggle");
    const focusModeBtn = document.getElementById("focusModeBtn");

    if (focusToggle) {
      focusToggle.classList.toggle("active", State.focusMode);
      focusToggle.setAttribute("aria-checked", String(State.focusMode));
    }
    if (focusModeBtn) {
      focusModeBtn.classList.toggle("active", State.focusMode);
      focusModeBtn.setAttribute("aria-pressed", String(State.focusMode));
    }

    if (!silent) {
      this.showToast(
        "",
        State.focusMode ? "Focus on (calmer view)" : "Focus off",
      );
    }
  },

  applySavedUIState() {
    this.setFocusMode(State.focusMode, { silent: true, persist: false });

    const focusToggle = document.getElementById("focusToggle");
    const focusModeBtn = document.getElementById("focusModeBtn");

    if (focusToggle) {
      focusToggle.classList.toggle("active", State.focusMode);
      focusToggle.setAttribute("aria-checked", String(State.focusMode));
    }
    if (focusModeBtn) {
      focusModeBtn.classList.toggle("active", State.focusMode);
      focusModeBtn.setAttribute("aria-pressed", String(State.focusMode));
    }

    this.applyLayoutVisibility();
    this.applySidebarVisibility();
    this.applyThemePreference();
    this.syncViewButtons();
  },

  applyThemePreference() {
    const theme = State.data?.preferences?.theme;
    document.body.classList.toggle(
      "night-garden",
      theme === "night" || theme === "dark",
    );
  },

  applyLayoutVisibility() {
    const defaults = State.getDefaultData().preferences;
    const layout = State.data?.preferences?.layout ?? defaults.layout;

    document.body.classList.toggle("hide-header", layout.showHeader === false);
    document.body.classList.toggle(
      "hide-control-bar",
      layout.showControlBar === false,
    );
    document.body.classList.toggle("hide-sidebar", layout.showSidebar === false);
    document.body.classList.toggle(
      "hide-now-panel",
      layout.showNowPanel === false,
    );

    const layoutHandle = document.getElementById("layoutHandle");
    if (layoutHandle) {
      if (layout.showHeader === false && !State.focusMode) {
        layoutHandle.removeAttribute("hidden");
      } else {
        layoutHandle.setAttribute("hidden", "");
      }
    }

    const sidebarHandle = document.getElementById("sidebarHandle");
    if (sidebarHandle) {
      if (layout.showSidebar === false && !State.focusMode) {
        sidebarHandle.removeAttribute("hidden");
      } else {
        sidebarHandle.setAttribute("hidden", "");
      }
    }
  },

  applySidebarVisibility() {
    const defaults = State.getDefaultData().preferences;
    const sidebar = State.data?.preferences?.sidebar ?? defaults.sidebar;

    document.body.classList.toggle(
      "hide-affirmation",
      sidebar.showAffirmation === false,
    );
    document.body.classList.toggle(
      "hide-whats-next",
      sidebar.showWhatsNext === false,
    );
    document.body.classList.toggle(
      "hide-achievements",
      sidebar.showAchievements === false,
    );
  },

  updateFocusLayoutVars() {
    const header = document.querySelector(".header") as HTMLElement | null;
    const controlBar = document.querySelector(".control-bar") as HTMLElement | null;
    const root = document.documentElement;

    if (header) {
      root.style.setProperty(
        "--focus-header-height",
        `${Math.max(56, header.offsetHeight)}px`,
      );
    }
    if (controlBar) {
      root.style.setProperty(
        "--focus-controlbar-height",
        `${Math.max(48, controlBar.offsetHeight)}px`,
      );
    }
  },

  setupFocusHoverReveal() {
    if (this._focusRevealSetup) return;
    this._focusRevealSetup = true;

    const revealTop = document.getElementById("focusRevealTop");
    const revealLeft = document.getElementById("focusRevealLeft");
    const focusHandle = document.getElementById("focusHandle");
    const header = document.querySelector(".header");
    const sidebar = document.querySelector(".sidebar");
    const controlBar = document.querySelector(".control-bar");

    const setHandleHidden = (hidden: boolean) => {
      if (!focusHandle) return;
      if (hidden) focusHandle.setAttribute("hidden", "");
      else focusHandle.removeAttribute("hidden");
    };

    const reveal = () => {
      if (!State.focusMode) return;
      document.body.classList.add("focus-ui-revealed");
      if (this._focusRevealHideTimer) clearTimeout(this._focusRevealHideTimer);
    };

    const scheduleHide = () => {
      if (this._focusRevealHideTimer) clearTimeout(this._focusRevealHideTimer);
      this._focusRevealHideTimer = setTimeout(() => {
        if (!State.focusMode) return;
        document.body.classList.remove("focus-ui-revealed");
      }, 500);
    };

    const toggleReveal = () => {
      if (!State.focusMode) return;
      const isRevealed = document.body.classList.contains("focus-ui-revealed");
      if (isRevealed) {
        document.body.classList.remove("focus-ui-revealed");
      } else {
        reveal();
      }
    };

    // Keep an always-available control for touch devices (no hover)
    setHandleHidden(!State.focusMode);

    [revealTop, revealLeft, header, sidebar, controlBar].forEach((el) => {
      if (!el) return;
      el.addEventListener("mouseenter", reveal);
      el.addEventListener("mouseleave", scheduleHide);
      el.addEventListener("focusin", reveal);
      el.addEventListener("focusout", scheduleHide);
    });

    [revealTop, revealLeft, focusHandle].forEach((el) => {
      if (!el) return;
      el.addEventListener("click", toggleReveal);
      el.addEventListener(
        "touchstart",
        () => {
          toggleReveal();
        },
        { passive: true },
      );
    });
  },

  syncViewButtons() {
    document.querySelectorAll(".view-btn").forEach((btn) => {
      const isActive = (btn as HTMLElement).dataset.view === State.currentView;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });
  },

  showToast(iconOrMessage: string, messageOrType: string = "") {
    const toast = this.elements.toast;
    const toastIcon = this.elements.toastIcon;
    const toastMessage = this.elements.toastMessage;
    if (!toast || !toastIcon || !toastMessage) return;

    const types = new Set(["info", "success", "warning", "danger", "error"]);

    let icon = iconOrMessage || "";
    let message = messageOrType || "";

    // Back-compat: showToast(message, type)
    if (types.has(messageOrType)) {
      message = iconOrMessage || "";
      const type = messageOrType;
      icon =
        type === "success"
          ? "✓"
          : type === "warning"
            ? "!"
            : type === "danger" || type === "error"
              ? "⚠️"
              : "";
    }

    toastIcon.textContent = icon;
    toastMessage.textContent = message;
    toast.classList.add("active");

    setTimeout(() => {
      toast.classList.remove("active");
    }, 3000);
  },

  celebrate(emoji: string, title: string, text: string) {
    const modal = this.elements.celebrationModal;
    const emojiEl = this.elements.celebrationEmoji;
    const titleEl = this.elements.celebrationTitle;
    const textEl = this.elements.celebrationText;
    if (!modal || !emojiEl || !titleEl || !textEl) return;

    emojiEl.textContent = emoji;
    titleEl.textContent = title;
    textEl.textContent = text;
    modal.classList.add("active");

    // Spawn confetti
    this.spawnConfetti();
  },

  closeCelebration() {
    this.elements.celebrationModal?.classList.remove("active");
  },

  spawnConfetti() {
    const container = this.elements.confettiContainer;
    if (!container) return;

    const colors = [
      "#a78bfa",
      "#c4b5fd",
      "#4ade80",
      "#fbbf24",
      "#f472b6",
      "#60a5fa",
    ];
    const shapes = ["square", "circle"];

    // Reduce count based on energy level and feedback style
    let particleCount = 30; // Reduced from 100

    // Further reduce for minimal feedback
    const feedbackStyle = State.data?.preferences.nd.feedbackStyle || "moderate";
    if (feedbackStyle === "subtle") {
      particleCount = Math.floor(particleCount / 2);
    } else if (feedbackStyle === "minimal") {
      return; // No confetti
    }

    for (let i = 0; i < particleCount; i++) {
      const confetti = document.createElement("div");
      confetti.className = "confetti";
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.backgroundColor =
        colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 2}s`;
      confetti.style.animationDuration = `${3 + Math.random() * 2}s`; // Slower: 3-5s instead of 2-4s

      if (shapes[Math.floor(Math.random() * shapes.length)] === "circle") {
        confetti.style.borderRadius = "50%";
      }

      container.appendChild(confetti);

      // Remove after animation
      setTimeout(() => confetti.remove(), 6000); // Increased from 5000
    }
  },

  handleKeyboard(e: KeyboardEvent) {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement | null;
    if (
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      !!target?.isContentEditable
    ) {
      // Only allow Escape in inputs
      if (e.key !== "Escape") return;
    }

    // Escape to close modals
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
        modal.remove();
      });
      this.closeGoalModal();
      this.closeCelebration();
    }

    // View switching: 1 = Year, 2 = Month, 3 = Week, 4 = Day
    if (e.key === "1" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.YEAR);
      this.syncViewButtons();
      this.showToast("", "Year view");
    }
    if (e.key === "2" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.MONTH);
      this.syncViewButtons();
      this.showToast("", "Month view");
    }
    if (e.key === "3" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.WEEK);
      this.syncViewButtons();
      this.showToast("", "Week view");
    }
    if (e.key === "4" && !e.ctrlKey && !e.metaKey) {
      State.setView(VIEWS.DAY);
      this.syncViewButtons();
      this.showToast("", "Day view");
    }

    // Arrow key navigation
    if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
      State.navigate(-1);
    }
    if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
      State.navigate(1);
    }

    // T for Today
    if (e.key === "t" && !e.ctrlKey && !e.metaKey) {
      State.goToDate(new Date());
      this.render();
      this.showToast("", "Jumped to today");
    }

    // Ctrl/Cmd + N for new anchor
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      this.openGoalModal(this.getCurrentLevel(), State.viewingMonth, State.viewingYear);
    }

    // Ctrl/Cmd + F for focus mode
    if ((e.ctrlKey || e.metaKey) && e.key === "f" && !e.shiftKey) {
      e.preventDefault();
      this.toggleFocusMode();
    }

    // B for brain dump
    if (e.key === "b" && !e.ctrlKey && !e.metaKey) {
      NDSupport.showBrainDumpModal();
    }

    // I for Quick-Add Intention
    if (e.key === "i" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.showQuickAdd();
    }

    // ? for keyboard shortcuts help
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      this.showKeyboardShortcuts();
    }
  },

  // Show keyboard shortcuts help
  showKeyboardShortcuts() {
    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">⌨️ Keyboard Shortcuts</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="shortcuts-grid">
              <div class="shortcut-section">
                <h3>Views</h3>
                <div class="shortcut-item"><kbd>1</kbd> Year view</div>
                <div class="shortcut-item"><kbd>2</kbd> Month view</div>
                <div class="shortcut-item"><kbd>3</kbd> Week view</div>
                <div class="shortcut-item"><kbd>4</kbd> Day view</div>
              </div>
              <div class="shortcut-section">
                <h3>Navigation</h3>
                <div class="shortcut-item"><kbd>←</kbd> Previous</div>
                <div class="shortcut-item"><kbd>→</kbd> Next</div>
                <div class="shortcut-item"><kbd>T</kbd> Go to today</div>
              </div>
              <div class="shortcut-section">
                <h3>Actions</h3>
                <div class="shortcut-item"><kbd>⌘/Ctrl</kbd> + <kbd>N</kbd> New anchor</div>
                <div class="shortcut-item"><kbd>⌘/Ctrl</kbd> + <kbd>F</kbd> Focus (calmer view)</div>
                <div class="shortcut-item"><kbd>B</kbd> Brain dump</div>
                <div class="shortcut-item"><kbd>Esc</kbd> Close modal</div>
              </div>
            </div>
          </div>
        </div>
      `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  // ============================================
  // Utility Methods
  // ============================================
  escapeHtml(text: string) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  },

  formatMinutes(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  },
};

// ============================================
// Initialize App
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("error", (event) => {
    try {
      console.error("Unhandled error:", event.error || event.message);
      UI?.showToast?.("⚠️", "Something went wrong. Try refreshing.");
    } catch {
      // no-op
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      console.error("Unhandled promise rejection:", event.reason);
      UI?.showToast?.("⚠️", "Something went wrong. Try refreshing.");
    } catch {
      // no-op
    }
  });

  State.init();
  UI.init();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }

  // Header "More" Menu Toggle
  const headerMoreToggle = document.getElementById("headerMoreToggle") as HTMLElement | null;
  const headerMoreDropdown = document.getElementById("headerMoreDropdown") as HTMLElement | null;

  if (headerMoreToggle && headerMoreDropdown) {
    const setOpen = (open: boolean) => {
      headerMoreToggle.setAttribute("aria-expanded", open ? "true" : "false");
      headerMoreDropdown.hidden = !open;
    };

    const isOpen = () =>
      headerMoreToggle.getAttribute("aria-expanded") === "true";

    headerMoreToggle.addEventListener("click", () => {
      setOpen(!isOpen());
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        !headerMoreToggle.contains(target) &&
        !headerMoreDropdown.contains(target)
      ) {
        setOpen(false);
      }
    });

    // Close on Escape, keep focus sensible
    headerMoreDropdown.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        headerMoreToggle.focus();
      }
    });

    // Close after clicking "action" items (but keep open for toggles like energy buttons)
    headerMoreDropdown.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as Element | null;
      const closeItem = target?.closest("[data-close-header-more]");
      if (closeItem) setOpen(false);
    });
  }

  // ND Menu Toggle
  const ndMenuToggle = document.getElementById("ndMenuToggle") as HTMLElement | null;
  const ndDropdown = document.getElementById("ndDropdown") as HTMLElement | null;

  if (ndMenuToggle && ndDropdown) {
    ndMenuToggle.addEventListener("click", () => {
      const isExpanded =
        ndMenuToggle.getAttribute("aria-expanded") === "true";
      ndMenuToggle.setAttribute("aria-expanded", String(!isExpanded));
      ndDropdown.hidden = isExpanded;
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (!ndMenuToggle.contains(target) && !ndDropdown.contains(target)) {
        ndMenuToggle.setAttribute("aria-expanded", "false");
        ndDropdown.hidden = true;
      }
    });

    // Keyboard navigation
    ndDropdown.addEventListener("keydown", (e: KeyboardEvent) => {
      const items = Array.from(
        ndDropdown.querySelectorAll<HTMLElement>(".nd-dropdown-item"),
      );
      if (items.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? items.indexOf(active) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex =
          currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        items[nextIndex].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex =
          currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        items[prevIndex].focus();
      } else if (e.key === "Escape") {
        ndMenuToggle.focus();
        ndMenuToggle.setAttribute("aria-expanded", "false");
        ndDropdown.hidden = true;
      }
    });
  }

  // Sidebar Collapsible Sections
  document.querySelectorAll<HTMLElement>(".section-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isExpanded));

      // Save preference
      const sectionEl = toggle.closest(".sidebar-section") as HTMLElement | null;
      const section = sectionEl?.dataset.section;
      if (!section || !State.data) return;
      if (
        section !== "affirmation" &&
        section !== "upcoming" &&
        section !== "achievements"
      ) {
        return;
      }
      State.data.preferences.sidebarSections[section] = !isExpanded;
      State.save();
    });
  });

  // Restore saved sidebar section states
  function restoreSidebarStates() {
    if (!State.data) return;
    const preferences = State.data.preferences.sidebarSections;
    Object.entries(preferences).forEach(([section, expanded]) => {
      const toggle = document.querySelector(
        `[data-section="${section}"] .section-toggle`,
      ) as HTMLElement | null;
      if (toggle) {
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      }
    });
  }

  // Call restore function
  restoreSidebarStates();

  // Show welcome message for first-time users
  if (State.data && State.data.goals.length === 0) {
    setTimeout(() => {
      UI.showToast("👋", "Welcome! Place your first anchor to get started.");
    }, 1000);
  }
});

// Expose for debugging (optional)
(window as any).VisionBoard = { State, Goals, Planning, Analytics, UI };
