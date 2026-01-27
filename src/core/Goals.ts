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
import {
  validateGoalData,
  formatValidationErrors,
  sanitizeString,
} from "./Validation";

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

export function getGoalDateRange(goal: Goal): { start: Date; end: Date } {
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

const PARENT_LEVEL_REQUIREMENTS: Record<GoalLevel, GoalLevel | null> = {
  vision: null,
  milestone: "vision",
  focus: "milestone",
  intention: "focus",
};

function getParentGoalById(parentId?: string | null): Goal | null {
  if (!parentId || !State.data) return null;
  return State.data.goals.find((g) => g.id === parentId) || null;
}

function hasCircularParent(childId: string, parent: Goal | null): boolean {
  if (!parent || !State.data) return false;
  const visited = new Set<string>();
  let current: Goal | null = parent;

  while (current && !visited.has(current.id)) {
    if (current.id === childId) {
      return true;
    }
    visited.add(current.id);
    current = getParentGoalById(current.parentId ?? null);
  }

  return false;
}

function ensureValidParentLink(
  childId: string,
  childLevel: GoalLevel,
  parentId?: string | null,
): Goal | null {
  // eslint-disable-next-line security/detect-object-injection
  const expectedParentLevel = PARENT_LEVEL_REQUIREMENTS[childLevel];

  if (expectedParentLevel === null) {
    if (parentId) {
      throw new Error("Vision goals cannot be linked to a parent");
    }
    return null;
  }

  if (!parentId) {
    console.warn(
      `[Goals] ${childLevel} goal (${childId}) has no parent. Expected a ${expectedParentLevel}.`,
    );
    return null;
  }

  const parentGoal = getParentGoalById(parentId);
  if (!parentGoal) {
    throw new Error(`Parent goal (${parentId}) not found`);
  }

  if (parentGoal.level !== expectedParentLevel) {
    throw new Error(
      `${childLevel} goals must link to a ${expectedParentLevel}; received ${parentGoal.level}`,
    );
  }

  if (hasCircularParent(childId, parentGoal)) {
    throw new Error("Parent link would create a circular goal hierarchy");
  }

  return parentGoal;
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
    // Validate input data
    const validation = validateGoalData(goalData);
    if (!validation.success) {
      const errorMsg = formatValidationErrors(validation.errors);
      console.error("[Goals] Invalid goal data:", errorMsg);
      throw new Error(`Invalid goal data: ${errorMsg}`);
    }

    // Sanitize user-provided strings to prevent XSS
    const sanitizedData = {
      ...validation.data,
      title: sanitizeString(validation.data.title),
      description: validation.data.description
        ? sanitizeString(validation.data.description)
        : undefined,
    };

    const now = new Date();
    const inputYear = sanitizedData.year ?? now.getFullYear();
    const inputMonth = Number.isFinite(sanitizedData.month)
      ? (sanitizedData.month as number)
      : now.getMonth();

    let month = inputMonth;
    let year = inputYear;
    let dueDate: string | null = sanitizedData.dueDate ?? null;
    const tags = sanitizedData.tags ? sanitizedData.tags.map(sanitizeString) : [];
    const meta: GoalMeta = sanitizedData.meta ? { ...sanitizedData.meta } : {};

    switch (sanitizedData.level) {
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
          Math.floor(sanitizedData.durationMonths ?? 1),
        );
        const end = endOfDay(new Date(year, month + durationMonths, 0));
        dueDate = end.toISOString();
        break;
      }

      case "focus": {
        // Week(s): start at week-start (Mon) of provided startDate (or today), end after N weeks.
        const durationWeeks = Math.max(
          1,
          Math.floor(sanitizedData.durationWeeks ?? 1),
        );
        const startBase = sanitizedData.startDate
          ? parseYmdLocal(sanitizedData.startDate)
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
        // For recurring intentions: use the parent's dueDate (passed from PlanningPage)
        // For one-off intentions: align to a specific day (default: today)
        const day = sanitizedData.startDate
          ? parseYmdLocal(sanitizedData.startDate)
          : null;
        const baseDate = day ?? now;
        month = baseDate.getMonth();
        year = baseDate.getFullYear();

        // If dueDate was explicitly provided (recurring intention), use it
        // Otherwise use just the startDate (one-off intention)
        if (!dueDate) {
          const end = endOfDay(baseDate);
          dueDate = end.toISOString();
        }
        break;
      }
    }

    const goalId = this.generateId();
    const parentGoal = ensureValidParentLink(
      goalId,
      sanitizedData.level,
      sanitizedData.parentId ?? null,
    );

    const goal: Goal = {
      id: goalId,
      title: sanitizedData.title,
      level: sanitizedData.level,
      description: sanitizedData.description || "",
      month,
      year,
      category: sanitizedData.category || null,
      priority: (sanitizedData.priority || "medium") as Priority,
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
      startTime: sanitizedData.startTime || null,
      endTime: sanitizedData.endTime || null,
      scheduledAt: sanitizedData.scheduledAt ?? null,
      startDate: sanitizedData.startDate ?? undefined,
      tags,
      parentId: sanitizedData.parentId ?? null,
      parentLevel: parentGoal?.level ?? sanitizedData.parentLevel ?? null,
      icon: sanitizedData.icon,
      activityId: sanitizedData.activityId ?? undefined,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
      commitment: sanitizedData.commitment ?? undefined,
      linkTarget: sanitizedData.linkTarget ?? undefined,
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

    const targetLevel = updates.level ?? goal.level;
    const proposedParentId =
      updates.parentId !== undefined ? updates.parentId : goal.parentId ?? null;
    let parentGoal: Goal | null = null;
    try {
      parentGoal = ensureValidParentLink(goalId, targetLevel, proposedParentId);
    } catch (error: any) {
      // For intention goals without parents, we'll allow it (just warn)
      if (targetLevel === 'intention' && !proposedParentId) {
        parentGoal = null;
      } else {
        throw error;
      }
    }

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

    if (updates.parentId !== undefined) {
      goal.parentId = updates.parentId ?? null;
    }
    if (parentGoal) {
      goal.parentLevel = parentGoal.level;
    } else if (updates.parentId === null) {
      goal.parentLevel = null;
    }

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
      // eslint-disable-next-line security/detect-object-injection
      (CONFIG.ACHIEVEMENTS as Record<
        string,
        { emoji: string; symbol: string; label: string; desc: string }
      >)[achievementId]
    );
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

export async function ensurePlanningFocusForGoal(goal: Goal): Promise<Goal> {
  if (goal.level === "focus") {
    return goal;
  }

  if (goal.level === "vision" || goal.level === "milestone") {
    // Check if a focus already exists for this goal
    const existingFocus = Goals.getAll().find(
      (g) => g.level === "focus" && g.parentId === goal.id
    );
    if (existingFocus) {
      return existingFocus;
    }

    // Create a new focus only if one doesn't exist
    const focusTitle =
      goal.level === "vision"
        ? `Weekly plan for: ${goal.title}`
        : `Work on: ${goal.title}`;
    const referenceDate = goal.dueDate ? new Date(goal.dueDate) : new Date();
    const focusData: GoalData = {
      title: focusTitle,
      level: "focus",
      description: `Planner created for ${goal.title}`,
      parentId: goal.id,
      parentLevel: goal.level,
      month: referenceDate.getMonth(),
      year: referenceDate.getFullYear(),
      startDate: formatYmdLocal(referenceDate),
    };

    const createdFocus = Goals.create(focusData);
    return createdFocus;
  }

  throw new Error(`Cannot plan from goal level: ${goal.level}`);
}
