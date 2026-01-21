// ===================================
// Goal Management
// ===================================
import type {
  Goal,
  GoalData,
  GoalLevel,
  GoalStatus,
  Priority,
  Subtask,
  Note,
  TimeLogEntry,
  GoalMeta,
} from "../types";
import { State } from "./State";
import { CONFIG } from "../config";
import { SupabaseService } from "../services/supabase";
import { dirtyTracker } from "../services/DirtyTracker";
import { debouncedGoalSync } from "../services/sync/syncHelpers";
import { getFocusStartDate } from "../utils/goalMeta";
import DB, { DB_STORES } from "../db";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseYmdLocal(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  const d = new Date(year, monthIndex, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLocalWeekStart(date: Date): Date {
  const d = startOfDay(date);
  // 0=Sun..6=Sat; convert so Monday is start.
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

function getGoalDateRange(goal: Goal): { start: Date; end: Date } {
  // Default fallbacks: treat as month-scoped.
  const fallbackStart = startOfDay(new Date(goal.year, goal.month ?? 0, 1));
  const fallbackEnd = endOfDay(new Date(goal.year, (goal.month ?? 0) + 1, 0));

  switch (goal.level) {
    case "vision": {
      const start = startOfDay(new Date(goal.year, 0, 1));
      const end = endOfDay(new Date(goal.year, 11, 31));
      return { start, end };
    }
    case "milestone": {
      const start = startOfDay(new Date(goal.year, goal.month ?? 0, 1));
      const end = goal.dueDate
        ? new Date(goal.dueDate)
        : endOfDay(new Date(goal.year, (goal.month ?? 0) + 1, 0));
      return { start, end: end < start ? start : end };
    }
    case "focus": {
      const end = goal.dueDate ? new Date(goal.dueDate) : fallbackEnd;
      const start = (() => {
        const focusStart = getFocusStartDate(goal);
        if (focusStart) return startOfDay(focusStart);
        if (goal.dueDate) {
          const inferred = new Date(goal.dueDate);
          inferred.setDate(inferred.getDate() - 6);
          return startOfDay(inferred);
        }
        return fallbackStart;
      })();
      return { start, end: end < start ? start : end };
    }
    case "intention": {
      if (goal.dueDate) {
        const due = new Date(goal.dueDate);
        return { start: startOfDay(due), end: endOfDay(due) };
      }
      return { start: fallbackStart, end: fallbackEnd };
    }
    default:
      return { start: fallbackStart, end: fallbackEnd };
  }
}

/**
 * Canonical "active in range" check for goals.
 *
 * A goal is considered active if its computed date range overlaps the target range.
 * Both ranges are treated as inclusive on both ends after normalizing to local
 * start-of-day / end-of-day.
 */
export function isGoalActiveInRange(
  goal: Goal,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const start = startOfDay(rangeStart);
  const end = endOfDay(rangeEnd);
  const goalRange = getGoalDateRange(goal);
  return goalRange.start <= end && goalRange.end >= start;
}

// UI callback interface to break circular dependency
interface GoalsCallbacks {
  onCelebrate?: (emoji: string, title: string, message: string) => void;
  onScheduleRender?: () => void;
  onUpdateSyncStatus?: (status: string) => void;
  onShowToast?: (icon: string, message: string) => void;
}

let callbacks: GoalsCallbacks = {};

function persistGoalToIndexedDb(goal: Goal): void {
  void DB.update(DB_STORES.GOALS, goal).catch((err: unknown) => {
    console.warn("[Goals] Failed to persist goal to IndexedDB:", err);
  });
}

function deleteGoalFromIndexedDb(goalId: string): void {
  void DB.delete(DB_STORES.GOALS, goalId).catch((err: unknown) => {
    console.warn("[Goals] Failed to delete goal from IndexedDB:", err);
  });
}

export const Goals = {
  // Set callbacks for UI interactions
  setCallbacks(cb: GoalsCallbacks) {
    callbacks = cb;
  },

  getForRange(rangeStart: Date, rangeEnd: Date): Goal[] {
    if (!State.data) return [];
    return State.data.goals.filter((g) =>
      isGoalActiveInRange(g, rangeStart, rangeEnd),
    );
  },

  getStats() {
    if (!State.data) return { total: 0, completed: 0 };
    const goals = State.data.goals;
    const total = goals.length;
    const completed = goals.filter((g) => g.status === "done").length;
    return { total, completed };
  },

  create(goalData: GoalData): Goal {
    const now = new Date();
    const inputYear = goalData.year ?? now.getFullYear();
    const inputMonth = Number.isFinite(goalData.month)
      ? (goalData.month as number)
      : now.getMonth();

    let month = inputMonth;
    let year = inputYear;
    let dueDate: string | null = goalData.dueDate ?? null;
    const tags = goalData.tags ? [...goalData.tags] : [];
    const meta: GoalMeta = goalData.meta ? { ...goalData.meta } : {};

    switch (goalData.level) {
      case "vision": {
        // Year-only: always align to Jan and end at Dec 31 of the chosen year.
        year = inputYear;
        month = 0;
        const end = endOfDay(new Date(year, 11, 31));
        dueDate = end.toISOString();
        break;
      }

      case "milestone": {
        // Month(s): start month + duration in months.
        month = inputMonth;
        year = inputYear;
        const durationMonths = Math.max(
          1,
          Math.floor(goalData.durationMonths ?? 1),
        );
        const end = endOfDay(new Date(year, month + durationMonths, 0));
        dueDate = end.toISOString();
        break;
      }

      case "focus": {
        // Week(s): start at week-start (Mon) of provided startDate (or today), end after N weeks.
        const durationWeeks = Math.max(
          1,
          Math.floor(goalData.durationWeeks ?? 1),
        );
        const startBase = goalData.startDate
          ? parseYmdLocal(goalData.startDate)
          : null;
        const start = getLocalWeekStart(startBase ?? now);
        const end = endOfDay(new Date(start));
        end.setDate(end.getDate() + durationWeeks * 7 - 1);

        month = start.getMonth();
        year = start.getFullYear();
        dueDate = end.toISOString();
        meta.startDate = formatYmdLocal(start);
        break;
      }

      case "intention": {
        // Single day: align to a specific day (default: today).
        const day = goalData.startDate
          ? parseYmdLocal(goalData.startDate)
          : null;
        const baseDate = day ?? now;
        month = baseDate.getMonth();
        year = baseDate.getFullYear();
        const end = endOfDay(baseDate);
        dueDate = end.toISOString();
        break;
      }
    }

    const goal: Goal = {
      id: this.generateId(),
      title: goalData.title,
      level: goalData.level,
      description: goalData.description || "",
      month,
      year,
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
      dueDate,
      startTime: goalData.startTime || null,
      endTime: goalData.endTime || null,
      scheduledAt: goalData.scheduledAt ?? null,
      tags,
      parentId: goalData.parentId ?? null,
      parentLevel: goalData.parentLevel ?? null,
      icon: goalData.icon,
      activityId: goalData.activityId ?? undefined,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    };

    if (!State.data) {
      State.init();
      if (!State.data) return goal;
    }
    State.data.goals.push(goal);
    State.data.analytics.goalsCreated++;
    State.save();
    persistGoalToIndexedDb(goal);

    // Force sync for new goals to ensure creation persists immediately
    // debouncedGoalSync is better for rapid edits, but creation should be atomic
    (async () => {
      try {
        await SupabaseService.saveGoal(goal);
        dirtyTracker.markClean("goal", goal.id);
        console.log(`✓ Goal "${goal.title}" created and synced`);
        if (callbacks.onUpdateSyncStatus)
          callbacks.onUpdateSyncStatus("synced");
      } catch (error: any) {
        console.error("Failed to sync new goal:", error);

        // Show user-visible error notification
        const errorMessage =
          error?.message || error?.toString() || "Failed to save to cloud";
        const userFriendlyMessage = errorMessage.includes("authenticated")
          ? "Please sign in to save to cloud"
          : errorMessage.includes("column") || errorMessage.includes("schema")
            ? "Database schema mismatch. Please check migrations."
            : `Couldn't save to cloud: ${errorMessage}`;

        if (callbacks.onShowToast) {
          callbacks.onShowToast("⚠️", userFriendlyMessage);
        }

        // Also update sync status to show error
        if (callbacks.onUpdateSyncStatus) {
          callbacks.onUpdateSyncStatus("error");
        }

        // Fallback to debounce if force fails
        debouncedGoalSync(goal);
      }
    })();

    this.checkAchievements();
    if (callbacks.onScheduleRender) callbacks.onScheduleRender();
    return goal;
  },

  update(goalId: string, updates: Partial<Goal>): Goal | null {
    const goal = this.getById(goalId);
    if (!goal) return null;

    // If level is being changed, re-align to new level's time scope
    if (updates.level && updates.level !== goal.level) {
      const now = new Date();
      let newMonth = goal.month;
      let newYear = goal.year;
      let newDueDate = goal.dueDate;

      switch (updates.level) {
        case "vision": {
          // Year-only.
          newYear = now.getFullYear();
          newMonth = 0;
          newDueDate = endOfDay(new Date(newYear, 11, 31)).toISOString();
          if (goal.meta?.startDate) {
            const nextMeta = { ...goal.meta };
            delete nextMeta.startDate;
            updates.meta =
              Object.keys(nextMeta).length > 0 ? nextMeta : undefined;
          }
          break;
        }

        case "milestone": {
          // Default to the current month (single-month).
          newYear = now.getFullYear();
          newMonth = now.getMonth();
          newDueDate = endOfDay(
            new Date(newYear, newMonth + 1, 0),
          ).toISOString();
          if (goal.meta?.startDate) {
            const nextMeta = { ...goal.meta };
            delete nextMeta.startDate;
            updates.meta =
              Object.keys(nextMeta).length > 0 ? nextMeta : undefined;
          }
          break;
        }

        case "focus": {
          // Default to the current week (single-week).
          const start = getLocalWeekStart(now);
          const end = endOfDay(new Date(start));
          end.setDate(end.getDate() + 6);
          newMonth = start.getMonth();
          newYear = start.getFullYear();
          newDueDate = end.toISOString();
          updates.meta = {
            ...(goal.meta ?? {}),
            startDate: formatYmdLocal(start),
          };
          break;
        }

        case "intention": {
          // Default to today.
          newYear = now.getFullYear();
          newMonth = now.getMonth();
          newDueDate = endOfDay(now).toISOString();
          if (goal.meta?.startDate) {
            const nextMeta = { ...goal.meta };
            delete nextMeta.startDate;
            updates.meta =
              Object.keys(nextMeta).length > 0 ? nextMeta : undefined;
          }
          break;
        }
      }

      updates.month = newMonth;
      updates.year = newYear;
      updates.dueDate = newDueDate;
    }

    // Ensure icon update is preserved if passed
    if (updates.icon !== undefined) {
      goal.icon = updates.icon;
    }

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
    persistGoalToIndexedDb(goal);
    // Mark dirty and debounce cloud sync
    dirtyTracker.markDirty("goal", goalId);
    debouncedGoalSync(goal);
    if (callbacks.onScheduleRender) callbacks.onScheduleRender();
    return goal;
  },

  delete(goalId: string): void {
    if (!State.data) return;
    State.data.goals = State.data.goals.filter((g) => g.id !== goalId);
    State.save();
    deleteGoalFromIndexedDb(goalId);
    if (callbacks.onScheduleRender) callbacks.onScheduleRender();
    // Cloud Delete
    SupabaseService.deleteGoal(goalId).catch((err) =>
      console.error("Failed to delete goal from cloud", err),
    );
  },

  getById(goalId: string): Goal | undefined {
    if (!State.data) return undefined;
    return State.data.goals.find((g) => g.id === goalId);
  },

  getByMonth(month: number, year: number): Goal[] {
    if (!State.data) return [];
    return this.getForRange(
      new Date(year, month, 1),
      new Date(year, month + 1, 0),
    );
  },

  getAll(): Goal[] {
    if (!State.data) return [];
    return State.data.goals;
  },

  getUpcoming(limit: number = 5): Goal[] {
    if (!State.data) return [];
    const now = new Date();

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

    return State.data.goals
      .filter((g) => g.status !== "done")
      .map((g) => ({ goal: g, end: getGoalDateRange(g).end.getTime() }))
      .filter(({ end }) => end >= now.getTime())
      .sort((a, b) => {
        if (a.end !== b.end) return a.end - b.end;
        return priorityOrder[a.goal.priority] - priorityOrder[b.goal.priority];
      })
      .slice(0, limit)
      .map(({ goal }) => goal);
  },

  // Get goals by level with proper time scope filtering
  getByLevel(level: GoalLevel): Goal[] {
    return this.getForDate(new Date()).filter((g) => g.level === level);
  },

  // Get goals for specific date with level filtering
  getForDate(date: Date): Goal[] {
    if (!State.data) return [];
    return this.getForRange(date, date);
  },

  complete(goalId: string): void {
    const goal = this.getById(goalId);
    if (!goal || !State.data) return;

    goal.status = "done";
    goal.progress = 100;
    goal.completedAt = new Date().toISOString();
    State.data.analytics.goalsCompleted++;

    State.save();
    persistGoalToIndexedDb(goal);
    // Mark dirty and debounce cloud sync
    dirtyTracker.markDirty("goal", goalId);
    debouncedGoalSync(goal);
    this.checkAchievements();
    if (callbacks.onScheduleRender) callbacks.onScheduleRender();

    // Trigger celebration
    if (callbacks.onCelebrate) {
      const levelLabel = (() => {
        switch (goal.level) {
          case "vision":
            return "Vision";
          case "milestone":
            return "Milestone";
          case "focus":
            return "Focus";
          case "intention":
            return "Intention";
          default:
            return "Intention";
        }
      })();
      callbacks.onCelebrate(
        "✨",
        `${levelLabel} complete.`,
        `"${goal.title}" marked done.`,
      );
    }
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
    persistGoalToIndexedDb(goal);
    // Mark dirty and debounce cloud sync
    dirtyTracker.markDirty("goal", goalId);
    debouncedGoalSync(goal);

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
    persistGoalToIndexedDb(goal);
    // Mark dirty and debounce cloud sync
    dirtyTracker.markDirty("goal", goalId);
    debouncedGoalSync(goal);

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
    persistGoalToIndexedDb(goal);
    // Mark dirty and debounce cloud sync
    dirtyTracker.markDirty("goal", goalId);
    debouncedGoalSync(goal);
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

    const achievement = (
      CONFIG.ACHIEVEMENTS as Record<
        string,
        { emoji: string; symbol: string; label: string; desc: string }
      >
    )[achievementId];
    if (callbacks.onCelebrate) {
      callbacks.onCelebrate(
        achievement.emoji,
        "Achievement Unlocked!",
        achievement.label,
      );
    }
  },

  /**
   * Finds the most relevant active Focus for a given Vision.
   * Walks down: Vision -> Active Milestone -> Active Focus
   * Returns null if no active path exists.
   */
  findActiveFocusForVision(visionId: string): Goal | null {
    if (!State.data) return null;
    const now = new Date();

    // 1. Find active milestone for this vision
    const activeMilestone = State.data.goals.find(
      (g) =>
        g.level === "milestone" &&
        g.parentId === visionId &&
        g.status !== "archived" &&
        isGoalActiveInRange(g, now, now),
    );

    if (!activeMilestone) return null;

    // 2. Find active focus for this milestone
    const activeFocus = State.data.goals.find(
      (g) =>
        g.level === "focus" &&
        g.parentId === activeMilestone.id &&
        g.status !== "archived" &&
        isGoalActiveInRange(g, now, now),
    );

    return activeFocus || null;
  },
};
