/**
 * Type definitions for sidebar components
 * @remarks Types specific to the liquid productivity sidebar
 */

import type { Goal, CustomIntention } from '../../../types';

/**
 * Props for SidebarSection component
 */
export interface SidebarSectionProps {
  id: string;
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  iconEmoji?: string;
  badge?: number;
}

/**
 * Props for context goals
 */
export interface ContextGoals {
  vision: Goal[];
  milestone: Goal[];
  focus: Goal[];
}

/**
 * Callback functions for sidebar interactions
 */
export interface SidebarCallbacks {
  onGoalClick?: (goalId: string) => void;
  onIntentionDrag?: (intention: CustomIntention) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskExpand?: (taskId: string, expanded: boolean) => void;
  onCustomizeIntentions?: () => void;
}
