// Shared utilities for ND Support features
import { State } from '../../core/State';
import { CONFIG } from '../../config';

/**
 * Helper to conditionally show emoji or symbol based on user preference
 */
export function icon(emojiChar: string, symbolChar: string = ""): string {
  if (State.data?.preferences?.nd?.reduceEmojis) {
    return symbolChar;
  }
  return emojiChar;
}

/**
 * Get category display (emoji or symbol based on preference)
 */
export function getCategoryIcon(categoryKey: string): string {
  const categories = CONFIG.CATEGORIES as Record<string, { emoji: string; symbol: string; label: string; color: string }>;
  const cat = categories[categoryKey];
  if (!cat) return "";
  return icon(cat.emoji, cat.symbol);
}

/**
 * Get status display (emoji or symbol based on preference)
 */
export function getStatusIcon(statusKey: string): string {
  const statuses = CONFIG.STATUSES as Record<string, { emoji: string; symbol: string; label: string; color: string }>;
  const status = statuses[statusKey];
  if (!status) return "";
  return icon(status.emoji, status.symbol);
}

/**
 * Get priority display (emoji or symbol based on preference)
 */
export function getPriorityIcon(priorityKey: string): string {
  const priorities = CONFIG.PRIORITIES as Record<string, { emoji: string; symbol: string; label: string; color: string }>;
  const priority = priorities[priorityKey];
  if (!priority) return "";
  return icon(priority.emoji, priority.symbol);
}

/**
 * Get achievement display (emoji or symbol based on preference)
 */
export function getAchievementIcon(achievementKey: string): string {
  const achievements = CONFIG.ACHIEVEMENTS as Record<string, { emoji: string; symbol: string; label: string; desc: string }>;
  const achievement = achievements[achievementKey];
  if (!achievement) return "";
  return icon(achievement.emoji, achievement.symbol);
}
