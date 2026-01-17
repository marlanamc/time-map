/**
 * Type definitions for Time Map application
 * @remarks Core types and interfaces used throughout the vision board application
 */

/** Available view types in the application */
export type ViewType = "year" | "month" | "week" | "day" | "home" | "garden";

/** Goal hierarchy levels from highest to lowest */
export type GoalLevel = "vision" | "milestone" | "focus" | "intention";

/** Possible status states for a goal */
export type GoalStatus = "not-started" | "in-progress" | "done" | "blocked";

/** Priority levels for goals */
export type Priority = "low" | "medium" | "high" | "urgent";

/** Main category types for organizing goals */
export type Category =
  | "career"
  | "health"
  | "finance"
  | "personal"
  | "creative"
  | null;

/**
 * Structured metadata for goals
 * @remarks Stores helper fields that were previously embedded in descriptions or tags
 */
export interface GoalMeta {
  tinyVersion?: string;
  lowEnergyVersion?: string;
  startDate?: string;
  easyMode?: boolean;
  accentTheme?: AccentTheme;
}

/**
 * Custom intention template for the Day View intentions grid
 * @remarks User-editable templates stored locally
 */
export interface CustomIntention {
  id: string;
  title: string;
  category: Category;
  duration: number;
  emoji?: string;
  order: number;
  createdAt: string;
}
/** Available accent theme colors for the UI */
export type AccentTheme =
  | "rose"
  | "coral"
  | "amber"
  | "mint"
  | "sage"
  | "sky"
  | "teal"
  | "indigo"
  | "violet"
  | "lime"
  | "emerald"
  | "fuchsia"
  | "pink"
  | "cyan"
  | "yellow"
  | "orange"
  | "rainbow"
  | "dawn"
  | "morning"
  | "afternoon"
  | "evening"
  | "night";

/** Break reminder frequency options for ADHD support */
export type BreakReminder = "pomodoro" | "gentle" | "hyperfocus" | "off";

/** Feedback animation and celebration styles */
export type FeedbackStyle = "subtle" | "moderate" | "celebration" | "minimal";

/** Task visibility limits based on energy level (ADHD support) */
export type MaxVisibleTasks =
  | "overwhelmed"
  | "low_energy"
  | "normal"
  | "high_energy";

/** Font options including dyslexia-friendly choices */
export type FontChoice = "default" | "dyslexia" | "mono" | "readable";

/** Text spacing options for readability */
export type TextSpacing = "compact" | "normal" | "relaxed" | "dyslexia";

/** Color blind accessibility modes */
export type ColorBlindMode =
  | "none"
  | "deuteranopia"
  | "protanopia"
  | "tritanopia";

/**
 * Time breakdown analysis result
 * @remarks Calculates remaining time in various units to help with time blindness
 */
export interface TimeBreakdownResult {
  days: number;
  weeks: number;
  months: number;
  weekends: number;
  workSessions3x: number;
  workSessions5x: number;
  focusHours1hDay: number;
  focusHours2hDay: number;
  isPast: boolean;
  isCurrentMonth: boolean;
  // Additional fields for day/week/year calculations
  hoursLeftInDay?: number;
  daysLeftInWeek?: number;
  weekendsInWeek?: number;
  quartersLeft?: number;
  isCurrentDay?: boolean;
  isCurrentWeek?: boolean;
  isCurrentYear?: boolean;
}

/**
 * A subtask within a goal
 * @remarks Allows breaking down larger goals into manageable pieces
 */
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

/**
 * A note attached to a goal
 * @remarks Supports journaling and reflection on goals
 */
export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

/**
 * A time tracking entry for a goal
 * @remarks Records time spent working on a goal
 */
export interface TimeLogEntry {
  minutes: number;
  description: string;
  date: string;
}

/**
 * A goal or task in the vision board
 * @remarks Core data structure representing user goals at various levels
 * (vision, milestone, focus, intention) with full tracking and metadata
 */
export interface Goal {
  id: string;
  title: string;
  level: GoalLevel;
  description: string;
  month: number;
  year: number;
  category: Category;
  priority: Priority;
  status: GoalStatus;
  progress: number;
  subtasks: Subtask[];
  notes: Note[];
  timeLog: TimeLogEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  lastWorkedOn: string | null;
  dueDate: string | null;
  startTime?: string | null;
  endTime?: string | null;
  tags: string[];
  meta?: GoalMeta;
  activityId?: string;
  /** Optional parent linkage for hierarchy/alignment (Vision → Milestone → Focus → Intention). */
  parentId?: string | null;
  /** Cached parent level for quick color access */
  parentLevel?: GoalLevel | null;
  /** Optional icon/emoji for the goal (primarily for Visions) */
  icon?: string;
}

/**
 * Data required to create a new goal
 * @remarks Simplified interface for goal creation, with optional fields
 */
export interface GoalData {
  title: string;
  level: GoalLevel;
  description?: string;
  month?: number;
  year?: number;
  category?: Category;
  priority?: Priority;
  dueDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  activityId?: string;
  /** Optional parent linkage for hierarchy/alignment (Vision → Milestone → Focus → Intention). */
  parentId?: string | null;
  parentLevel?: GoalLevel | null;
  /**
   * For range-based levels (milestone/focus/intention), an explicit local-date start (YYYY-MM-DD).
   * This is used only at creation time; persisted shape remains month/year + dueDate.
   */
  startDate?: string;
  /** Milestone duration in whole months (>= 1). */
  durationMonths?: number;
  /** Focus duration in whole weeks (>= 1). */
  durationWeeks?: number;
  tags?: string[];
  meta?: GoalMeta;
  /** Optional icon/emoji for the goal */
  icon?: string;
}

/**
 * User's streak data for daily engagement
 * @remarks Tracks consecutive days of app usage
 */
export interface Streak {
  count: number;
  lastDate: string | null;
}

/**
 * An unlocked achievement
 * @remarks References an achievement ID from CONFIG.ACHIEVEMENTS
 */
export interface Achievement {
  id: string;
  unlockedAt: string;
}

/**
 * A weekly review entry
 * @remarks Supports weekly reflection and planning practices
 */
export interface WeeklyReview {
  id: string;
  weekStart: string;
  weekEnd: string;
  goalsCompleted: number;
  timeSpent: number;
  notes: string;
  createdAt: string;
  // Optional fields for extended review data
  wins?: string[];
  challenges?: string[];
  learnings?: string;
  nextWeekPriorities?: string[];
  mood?: number;
  energyAvg?: string;
}

/**
 * Lightweight week reflection (local-only)
 * @remarks Used by Garden Weekly Alignment prompts; not synced.
 */
export type WeekReflection = {
  id: string;
  weekYear: number;
  weekNum: number;
  createdAt: number;
  answers: {
    q1?: string;
    q2?: string;
    q3?: string;
    wins?: string;
    alignmentScore?: number;
    growthNote?: string;
    nextWeekPriorities?: string;
  };
};

export type EventRecurrence = {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  /** 0=Sun..6=Sat (weekly only). */
  byWeekday?: number[];
  /** Inclusive end date/time (ISO string). */
  until?: string;
  /** Max number of occurrences. */
  count?: number;
};

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startAt: string; // ISO
  endAt?: string | null; // ISO
  allDay: boolean;
  recurrence?: EventRecurrence | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A brain dump entry for capturing quick thoughts
 * @remarks ADHD-friendly feature for getting thoughts out of your head
 */
export interface BrainDumpEntry {
  id: string;
  text: string;
  createdAt: string;
  processed: boolean;
  archived?: boolean;
  processedAction?: string;
  processedAt?: string;
}

/**
 * A body doubling session record
 * @remarks Tracks focused work sessions with virtual accountability
 */
export interface BodyDoubleSession {
  id: string;
  duration: number;
  startedAt: string;
  completedAt: string | null;
  goalId: string | null;
  completed?: boolean;
  endedAt?: string;
}

/**
 * Layout visibility preferences
 * @remarks Controls which UI panels are shown
 */
export interface LayoutPreferences {
  showHeader: boolean;
  showControlBar: boolean;
  showSidebar: boolean;
  showNowPanel: boolean;
}

/**
 * Sidebar content preferences
 * @remarks Controls which sidebar sections are displayed
 * @deprecated Use SidebarSections instead
 */
export interface SidebarPreferences {
  showAffirmation: boolean;
  showWhatsNext: boolean;
  showAchievements: boolean;
}

/**
 * Sidebar section expansion state
 * @remarks Tracks which sidebar sections are expanded or collapsed
 */
export interface SidebarSections {
  affirmation: boolean;
  upcoming: boolean;
  achievements: boolean;
}

/**
 * Neurodivergent (ND) support preferences
 * @remarks ADHD-friendly features and accessibility options
 */
export interface NDPreferences {
  accentTheme: AccentTheme;
  breakReminder: BreakReminder;
  feedbackStyle: FeedbackStyle;
  maxVisibleTasks: MaxVisibleTasks;
  showInitiationPrompts: boolean;
  fontChoice: FontChoice;
  textSpacing: TextSpacing;
  hideCompletedTasks: boolean;
  autoBodyDouble: boolean;
  transitionWarnings: boolean;
  simplifiedView: boolean;
  colorBlindMode: ColorBlindMode;
  showTimeInMultipleFormats: boolean;
  taskStartReminders: boolean;
  allowPartialProgress: boolean;
  reduceEmojis: boolean;
  /** Whether the level context bar is collapsed */
  contextBarCollapsed?: boolean;
  /** Custom intention templates for the Day View */
  customIntentions?: CustomIntention[];
  /** Weekly check-in schedule Settings */
  checkInDay?: number; // 0=Sunday, 1=Monday...
  checkInTime?: string; // HH:mm format
}

/**
 * User preferences for the application
 * @remarks Combines all preference categories
 */
export interface Preferences {
  focusMode: boolean;
  reducedMotion: boolean;
  theme: string;
  defaultView: ViewType;
  layout: LayoutPreferences;
  sidebar: SidebarPreferences;
  sidebarSections: SidebarSections;
  nd: NDPreferences;
}

/**
 * Usage analytics data
 * @remarks Tracks user activity and progress metrics
 */
export interface Analytics {
  goalsCreated: number;
  goalsCompleted: number;
  totalTimeSpent: number;
  streakBest: number;
}

/**
 * Complete application data structure
 * @remarks Root data object stored in localStorage
 */
export interface AppData {
  goals: Goal[];
  events: CalendarEvent[];
  streak: Streak;
  achievements: string[];
  weeklyReviews: WeeklyReview[];
  brainDump: BrainDumpEntry[];
  bodyDoubleHistory: BodyDoubleSession[];
  preferences: Preferences;
  analytics: Analytics;
  createdAt: string;
  version: number;
}

/**
 * Application runtime state
 * @remarks Manages current view state and user context
 */
export interface AppState {
  data: AppData | null;
  currentView: ViewType;
  selectedMonth: number | null;
  selectedGoal: string | null;
  zoom: number;
  focusMode: boolean;
  activeCategory: string;
  viewingYear: number;
  viewingMonth: number;
  viewingWeek: number | null;
  viewingDate: Date;
}

/**
 * References to key DOM elements
 * @remarks Cached element references for performance
 */
export interface UIElements {
  calendarGrid: HTMLElement | null;
  canvas: HTMLCanvasElement | null;
  canvasContainer: HTMLElement | null;
  categoryFilters: HTMLElement | null;
  upcomingGoals: HTMLElement | null;
  levelContextBar: HTMLElement | null;

  // Mobile Home Elements
  mobileHomeView: HTMLElement | null;
  mobileHereCloseBtn: HTMLButtonElement | null;
  mobileDateDisplay: HTMLElement | null;
  mobileNowContext: HTMLElement | null;
  mobileTimeVis: HTMLElement | null;
  mobileTimeStats: HTMLElement | null;
  mobileGardenBloom: HTMLElement | null;
  mobileBloomText: HTMLElement | null;
  mobileAffirmationText: HTMLElement | null;
  mobileUpcomingList: HTMLElement | null;
  mobileSurpriseBtn: HTMLButtonElement | null;
  mobileTabHome: HTMLElement | null;
  mobileGoalsByLevel: HTMLElement | null;
  mobileHereGarden: HTMLElement | null;
  headerLogo: HTMLElement | null;

  goalModal: HTMLElement | null;
  goalForm: HTMLFormElement | null;
  goalMonth: HTMLInputElement | null;
  nowDate: HTMLElement | null;
  nowContext: HTMLElement | null;
  daysLeft: HTMLElement | null;
  daysLeftLabel?: HTMLElement | null;
  weeksLeft: HTMLElement | null;
  weeksLeftLabel?: HTMLElement | null;
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

/**
 * Event listeners for document-level filter interactions
 * @remarks Used for cleanup when removing event listeners
 */
export interface FilterDocListeners {
  onDocClick: (e: MouseEvent) => void;
  onDocKeydown: (e: KeyboardEvent) => void;
}
