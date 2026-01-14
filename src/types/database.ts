/**
 * Database schema types for Supabase tables
 * These types represent the structure of data as stored in the database,
 * before transformation to application types
 */

import type { GoalMeta } from "./types";

/**
 * Goals table schema
 * Represents how goals are stored in the database
 */
export interface GoalRow {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  level: string;
  category?: string;
  priority: string;
  status: string;
  progress: number;
  month: number;
  year: number;
  due_date?: string;
  start_time?: string;
  end_time?: string;
  completed_at?: string;
  last_worked_on?: string;
  created_at: string;
  updated_at: string;
  subtasks: any[]; // JSONB array
  notes: any[]; // JSONB array
  time_log: any[]; // JSONB array
  tags?: string[];
  meta?: GoalMeta | null;
  activity_id?: string;
  parent_id?: string;
  parent_level?: string;
}

/**
 * Brain dump entries table schema
 */
export interface BrainDumpRow {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  processed: boolean;
  archived: boolean;
  processed_action?: string;
  processed_at?: string;
}

/**
 * Achievements table schema
 */
export interface AchievementRow {
  achievement_id: string;
  user_id: string;
  unlocked_at: string;
}

/**
 * Weekly reviews table schema
 */
export interface WeeklyReviewRow {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  goals_completed: number;
  time_spent: number;
  notes?: string;
  created_at: string;
  wins?: string[];
  challenges?: string[];
  learnings?: string[];
  next_week_priorities?: string[];
  mood?: string;
  energy_avg?: number;
}

/**
 * Body double sessions table schema
 */
export interface BodyDoubleSessionRow {
  id: string;
  user_id: string;
  duration: number;
  started_at: string;
  completed_at?: string;
  goal_id?: string;
  completed: boolean;
}

/**
 * Preferences table schema
 * Stores user preferences as JSONB
 */
export interface PreferencesRow {
  user_id: string;
  data: any; // JSONB - stores the full Preferences object
  updated_at: string;
}

/**
 * Streaks table schema
 * Stores user streak tracking for cross-device sync
 */
export interface StreakRow {
  user_id: string;
  count: number;
  last_date: string | null;
  best_streak: number;
  updated_at: string;
}

/**
 * Events table schema
 */
export interface EventRow {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  all_day: boolean;
  recurrence?: any;
  created_at: string;
  updated_at: string;
}
