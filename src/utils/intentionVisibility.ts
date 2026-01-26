import { Goals, getGoalDateRange } from "../core/Goals";
import type { Goal } from "../types";

/** Determines whether an intention should surface on a specific date. */
export function isIntentionActiveOnDate(goal: Goal, date: Date): boolean {
  if (goal.level !== "intention") return false;
  const weekdays = goal.commitment?.specificDays;
  if (weekdays && weekdays.length > 0) {
    return weekdays.includes(date.getDay());
  }
  if (goal.linkTarget?.id) {
    const parent = Goals.getById(goal.linkTarget.id);
    if (parent) {
      const { start, end } = getGoalDateRange(parent);
      return date >= start && date <= end;
    }
  }
  return true;
}
