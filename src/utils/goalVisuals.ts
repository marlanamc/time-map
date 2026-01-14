import { CONFIG } from "../config/constants";
import type { Goal } from "../types";

export function getGoalCategoryMeta(category?: string | null) {
  if (!category) return null;
  return (CONFIG.CATEGORIES as Record<string, { emoji: string; color: string; label: string }>)[category] ?? null;
}

export function getGoalActivityId(goal: Goal): string | undefined {
  if (goal.activityId && CONFIG.ACTIVITY_EMOJIS[goal.activityId]) {
    return goal.activityId;
  }
  if (
    goal.category &&
    !CONFIG.CATEGORIES[goal.category as keyof typeof CONFIG.CATEGORIES] &&
    CONFIG.ACTIVITY_EMOJIS[goal.category]
  ) {
    return goal.category;
  }
  return undefined;
}

export function getActivityEmoji(goal: Goal): string | undefined {
  const id = getGoalActivityId(goal);
  return id ? CONFIG.ACTIVITY_EMOJIS[id] : undefined;
}

export function getGoalEmoji(goal: Goal, fallback = "📍"): string {
  const activity = getActivityEmoji(goal);
  if (activity) return activity;
  const categoryMeta = getGoalCategoryMeta(goal.category);
  if (categoryMeta?.emoji) return categoryMeta.emoji;
  if (goal.icon) return goal.icon;
  return fallback;
}
