/**
 * Goal State Computation Module
 * Computes the state of goals (active/resting/dormant) based on recent activity.
 * This is a runtime computation, not stored in the database.
 */

import type { Goal, GoalState } from "../types";
import { Goals } from "./Goals";

/** Number of days to consider a goal "active" */
const ACTIVE_THRESHOLD_DAYS = 7;

/** Number of days to consider a goal "resting" (vs dormant) */
const RESTING_THRESHOLD_DAYS = 30;

/**
 * Get the most recent activity date for a goal.
 * Considers: lastWorkedOn, updatedAt, completedAt, and child goal activity.
 */
function getLastActivityDate(goal: Goal): Date | null {
  const dates: Date[] = [];

  // Direct activity on this goal
  if (goal.lastWorkedOn) {
    dates.push(new Date(goal.lastWorkedOn));
  }

  // Time log entries
  if (goal.timeLog && goal.timeLog.length > 0) {
    const latestLog = goal.timeLog.reduce((latest, entry) => {
      const entryDate = new Date(entry.date);
      return entryDate > latest ? entryDate : latest;
    }, new Date(goal.timeLog[0].date));
    dates.push(latestLog);
  }

  // Completion date
  if (goal.completedAt) {
    dates.push(new Date(goal.completedAt));
  }

  // Check child goals for visions
  if (goal.level === "vision") {
    const allGoals = Goals.getAll();
    const children = allGoals.filter((g) => g.parentId === goal.id);
    for (const child of children) {
      const childActivity = getLastActivityDate(child);
      if (childActivity) {
        dates.push(childActivity);
      }
    }
  }

  if (dates.length === 0) {
    return null;
  }

  return dates.reduce((latest, date) => (date > latest ? date : latest));
}

/**
 * Check if a goal has scheduled items this week.
 */
function hasScheduledItemsThisWeek(goal: Goal): boolean {
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? 6 : day - 1; // Adjust so Monday is start
  startOfWeek.setDate(startOfWeek.getDate() - diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  // Check goal's own scheduled date
  if (goal.scheduledAt) {
    const scheduled = new Date(goal.scheduledAt);
    if (scheduled >= startOfWeek && scheduled < endOfWeek) {
      return true;
    }
  }

  // Check due date
  if (goal.dueDate) {
    const due = new Date(goal.dueDate);
    if (due >= startOfWeek && due < endOfWeek) {
      return true;
    }
  }

  // For visions, check if any child goals are scheduled this week
  if (goal.level === "vision") {
    const allGoals = Goals.getAll();
    const descendants = getDescendants(goal.id, allGoals);
    for (const descendant of descendants) {
      if (descendant.scheduledAt) {
        const scheduled = new Date(descendant.scheduledAt);
        if (scheduled >= startOfWeek && scheduled < endOfWeek) {
          return true;
        }
      }
      if (descendant.dueDate) {
        const due = new Date(descendant.dueDate);
        if (due >= startOfWeek && due < endOfWeek) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Get all descendants of a goal (children, grandchildren, etc.)
 */
function getDescendants(goalId: string, allGoals: Goal[]): Goal[] {
  const descendants: Goal[] = [];
  const children = allGoals.filter((g) => g.parentId === goalId);

  for (const child of children) {
    descendants.push(child);
    descendants.push(...getDescendants(child.id, allGoals));
  }

  return descendants;
}

/**
 * Compute the state of a single goal.
 *
 * - **Active**: Activity in past 7 days OR scheduled items this week
 * - **Resting**: Activity in past 30 days but not past 7 days
 * - **Dormant**: No activity in 30+ days
 */
export function computeGoalState(goal: Goal): GoalState {
  // Completed or cancelled goals are considered resting
  if (goal.status === "done" || goal.status === "cancelled") {
    return "resting";
  }

  // Archived goals are dormant
  if (goal.archivedAt) {
    return "dormant";
  }

  const now = new Date();
  const lastActivity = getLastActivityDate(goal);

  // Check for scheduled items this week (makes it active)
  if (hasScheduledItemsThisWeek(goal)) {
    return "active";
  }

  // No activity ever recorded
  if (!lastActivity) {
    // New goals (created within 7 days) are active
    const createdDate = new Date(goal.createdAt);
    const daysSinceCreation = Math.floor(
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceCreation <= ACTIVE_THRESHOLD_DAYS) {
      return "active";
    }
    return "dormant";
  }

  const daysSinceActivity = Math.floor(
    (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceActivity <= ACTIVE_THRESHOLD_DAYS) {
    return "active";
  }

  if (daysSinceActivity <= RESTING_THRESHOLD_DAYS) {
    return "resting";
  }

  return "dormant";
}

/**
 * Get states for all visions.
 * Returns a Map of vision ID to GoalState.
 */
export function getVisionStates(visions: Goal[]): Map<string, GoalState> {
  const states = new Map<string, GoalState>();

  for (const vision of visions) {
    if (vision.level === "vision") {
      states.set(vision.id, computeGoalState(vision));
    }
  }

  return states;
}

/**
 * Sort goals by state priority (active first, then resting, then dormant).
 */
export function sortByState(goals: Goal[]): Goal[] {
  const getPriority = (state: GoalState): number => {
    switch (state) {
      case "active":
        return 0;
      case "resting":
        return 1;
      case "dormant":
      default:
        return 2;
    }
  };

  return [...goals].sort((a, b) => {
    const stateA = computeGoalState(a);
    const stateB = computeGoalState(b);
    return getPriority(stateA) - getPriority(stateB);
  });
}

/**
 * Get state indicator symbol for display.
 */
export function getStateIndicator(state: GoalState): string {
  switch (state) {
    case "active":
      return "●";
    case "resting":
      return "◐";
    case "dormant":
      return "○";
  }
}

/**
 * Get state CSS class for styling.
 */
export function getStateClass(state: GoalState): string {
  return `state-${state}`;
}
