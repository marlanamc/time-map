// Type definitions for Time Map application

export type ViewType = 'year' | 'month' | 'week' | 'day' | 'home';
export type GoalLevel = "vision" | "milestone" | "focus" | "intention";
export type GoalStatus = "not-started" | "in-progress" | "done" | "blocked";
export type Priority = "low" | "medium" | "high" | "urgent";
export type Category = "career" | "health" | "finance" | "personal" | "creative" | null;
export type AccentTheme = "teal" | "coral" | "sage" | "amber" | "clay";
export type BreakReminder = "pomodoro" | "gentle" | "hyperfocus" | "off";
export type FeedbackStyle = "subtle" | "moderate" | "celebration" | "minimal";
export type MaxVisibleTasks = "overwhelmed" | "low_energy" | "normal" | "high_energy";
export type FontChoice = "default" | "dyslexia" | "mono" | "readable";
export type TextSpacing = "compact" | "normal" | "relaxed" | "dyslexia";
export type ColorBlindMode = "none" | "deuteranopia" | "protanopia" | "tritanopia";

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

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface TimeLogEntry {
  minutes: number;
  description: string;
  date: string;
}

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
}

export interface GoalData {
  title: string;
  level: GoalLevel;
  description?: string;
  month: number;
  year?: number;
  category?: Category;
  priority?: Priority;
  dueDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  tags?: string[];
}

export interface Streak {
  count: number;
  lastDate: string | null;
}

export interface Achievement {
  id: string;
  unlockedAt: string;
}

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

export interface BrainDumpEntry {
  id: string;
  text: string;
  createdAt: string;
  processed: boolean;
  archived?: boolean;
  processedAction?: string;
  processedAt?: string;
}

export interface BodyDoubleSession {
  id: string;
  duration: number;
  startedAt: string;
  completedAt: string | null;
  goalId: string | null;
  completed?: boolean;
  endedAt?: string;
}

export interface LayoutPreferences {
  showHeader: boolean;
  showControlBar: boolean;
  showSidebar: boolean;
  showNowPanel: boolean;
}

export interface SidebarPreferences {
  showAffirmation: boolean;
  showWhatsNext: boolean;
  showAchievements: boolean;
}

export interface SidebarSections {
  affirmation: boolean;
  upcoming: boolean;
  achievements: boolean;
}

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
  dayViewStyle?: 'timeline' | 'simple' | 'planner';
}

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

export interface Analytics {
  goalsCreated: number;
  goalsCompleted: number;
  totalTimeSpent: number;
  streakBest: number;
}

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
