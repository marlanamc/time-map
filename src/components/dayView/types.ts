import type { Goal, CustomIntention } from "../../types";

export interface DayViewOptions {
  timeWindowStart?: number; // Minutes from midnight (default: 480 = 8 AM)
  timeWindowEnd?: number; // Minutes from midnight (default: 1320 = 10 PM)
  maxLanes?: number; // Maximum lanes (default: 4 desktop, 2 mobile)
  snapInterval?: number; // Snap to grid minutes (default: 5)
  longPressMs?: number; // Long press threshold (default: 200)
  onGoalUpdate: (goalId: string, updates: Partial<Goal>) => void;
  onGoalClick: (goalId: string) => void;
  onZenFocus: (goalId: string) => void;
  onPlantSomething?: () => void;
  onShowToast?: (emoji: string, message: string) => void;
  onCelebrate?: (emoji: string, title: string, message: string) => void;
}

export interface DayViewCallbacks {
  onGoalUpdate: (goalId: string, updates: Partial<Goal>) => void;
  onGoalClick: (goalId: string) => void;
  onZenFocus: (goalId: string) => void;
  onPlantSomething?: () => void;
  onShowToast?: (emoji: string, message: string) => void;
  onCelebrate?: (emoji: string, title: string, message: string) => void;
  onGetPreference?: (key: string) => any;
  onNavigate?: (direction: number) => void;
}

export interface TimedGoal {
  goal: Goal;
  startMin: number; // Minutes from midnight
  endMin: number; // Minutes from midnight
}

export interface PositionedGoal extends TimedGoal {
  lane: number;
  startPct: number; // Percentage position (0-100)
  durPct: number; // Percentage duration (0-100)
}

export interface DragData {
  goalId: string;
  type: "seed" | "planter";
  originalStartTime?: string;
  originalEndTime?: string;
}

export interface DragOptions {
  longPressMs?: number;
  moveCancelPx?: number;
  onDragStart?: (data: DragData) => void;
  onDragMove?: (data: DragData, clientX: number, clientY: number) => void;
  onDragEnd?: (data: DragData, clientX: number, clientY: number) => void;
  onDragCancel?: (data: DragData) => void;
}

export interface DropZoneConfig {
  element: HTMLElement;
  onDrop: (data: DragData, clientX: number, clientY: number) => void;
  onDragOver?: () => void;
  onDragLeave?: () => void;
}

export interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

export interface UpdateGoalTimeCommand extends Command {
  goalId: string;
  prevStartTime: string | null | undefined;
  prevEndTime: string | null | undefined;
  prevDueDate: string | null;
  prevMonth: number;
  prevYear: number;
  prevScheduledAt: string | null;
  newStartTime: string;
  newEndTime: string | null;
  newDueDate: string;
  newMonth: number;
  newYear: number;
}

export type GoalVariant = "seed" | "planter" | "compost";

export interface RenderCardOptions {
  variant?: GoalVariant;
  style?: string;
  className?: string;
}

export interface TimeSlot {
  hour: number;
  minute: number;
  totalMinutes: number;
  label12h: string;
  label24h: string;
  position: number; // Percentage position in grid
}

export interface LaneEndTime {
  lane: number;
  endMin: number;
}

export interface SidebarSectionProps {
  id: string;
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  iconEmoji?: string;
  badge?: number;
}

export interface ContextGoals {
  vision: Goal[];
  milestone: Goal[];
  focus: Goal[];
}

export interface SidebarCallbacks {
  onGoalClick?: (goalId: string) => void;
  onIntentionDrag?: (intention: CustomIntention) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskExpand?: (taskId: string, expanded: boolean) => void;
  onCustomizeIntentions?: () => void;
}
