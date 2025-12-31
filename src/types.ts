/**
 * Type definitions for Time Map application
 * @remarks Core types and interfaces used throughout the vision board application
 */

/** Available view types in the application */
export type ViewType = 'year' | 'month' | 'week' | 'day' | 'home';

/** Goal hierarchy levels from highest to lowest */
export type GoalLevel = "vision" | "milestone" | "focus" | "intention";

/** Possible status states for a goal */
export type GoalStatus = "not-started" | "in-progress" | "done" | "blocked";

/** Priority levels for goals */
export type Priority = "low" | "medium" | "high" | "urgent";

/** Main category types for organizing goals */
export type Category = "career" | "health" | "finance" | "personal" | "creative" | null;
/** Available accent theme colors for the UI */
export type AccentTheme = "teal" | "coral" | "sage" | "amber" | "clay" | "violet";

/** Break reminder frequency options for ADHD support */
export type BreakReminder = "pomodoro" | "gentle" | "hyperfocus" | "off";

/** Feedback animation and celebration styles */
export type FeedbackStyle = "subtle" | "moderate" | "celebration" | "minimal";

/** Task visibility limits based on energy level (ADHD support) */
export type MaxVisibleTasks = "overwhelmed" | "low_energy" | "normal" | "high_energy";

/** Font options including dyslexia-friendly choices */
export type FontChoice = "default" | "dyslexia" | "mono" | "readable";

/** Text spacing options for readability */
export type TextSpacing = "compact" | "normal" | "relaxed" | "dyslexia";

/** Color blind accessibility modes */
export type ColorBlindMode = "none" | "deuteranopia" | "protanopia" | "tritanopia";

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
  /** ID of parent goal (for visual hierarchy) */
  parentId?: string | null;
  /** Cached parent level for quick color access */
  parentLevel?: GoalLevel | null;
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
  /** Preferred day view layout style */
  dayViewStyle?: 'timeline' | 'simple' | 'planner';
  /** Whether the level context bar is collapsed */
  contextBarCollapsed?: boolean;
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
  mobileHereContext: HTMLElement | null;
  mobileHereGarden: HTMLElement | null;

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

/**
 * Event listeners for document-level filter interactions
 * @remarks Used for cleanup when removing event listeners
 */
export interface FilterDocListeners {
  onDocClick: (e: MouseEvent) => void;
  onDocKeydown: (e: KeyboardEvent) => void;
}
