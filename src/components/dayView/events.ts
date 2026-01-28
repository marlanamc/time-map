import { haptics } from "../../utils/haptics";
import { openCustomizationPanel } from "./CustomizationPanel";
import type { DayViewCallbacks } from "./types";
import { DayViewState } from "./DayViewState";
import type { TimeSlotCalculator } from "./TimeSlotCalculator";
import type { Goal } from "../../types";

export type EventDeps = {
  container: HTMLElement;
  callbacks: DayViewCallbacks;
  state: DayViewState;
  undo: () => boolean;
  redo: () => boolean;
  calculator: TimeSlotCalculator;
};

const KEY_ADJUST_MIN = 15;

function parseScheduledMinutes(goal: Goal, calculator: TimeSlotCalculator): number | null {
  if (goal.scheduledAt) {
    const parsed = new Date(goal.scheduledAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getHours() * 60 + parsed.getMinutes();
    }
  }
  return calculator.parseTimeToMinutes(goal.startTime);
}

function getGoalEndMin(goal: Goal, startMin: number, calculator: TimeSlotCalculator): number {
  const parsedEnd = calculator.parseTimeToMinutes(goal.endTime);
  if (parsedEnd !== null && parsedEnd > startMin) {
    return parsedEnd;
  }
  return Math.min(startMin + 60, calculator.getPlotEndMin());
}

function applyTimelineAdjustment(
  deps: EventDeps,
  goal: Goal,
  newStartMin: number,
  newEndMin: number,
  message: string,
): void {
  const calculator = deps.calculator;
  const currentDate = deps.state.currentDate ?? new Date();
  const startTime = calculator.toTimeString(newStartMin);
  const endTime = calculator.toTimeString(newEndMin);

  const scheduledAt = new Date(currentDate);
  scheduledAt.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0);

  deps.callbacks.onGoalUpdate(goal.id, {
    startTime,
    endTime,
    dueDate: currentDate.toISOString(),
    month: currentDate.getMonth(),
    year: currentDate.getFullYear(),
    scheduledAt: scheduledAt.toISOString(),
  });

  deps.callbacks.onShowToast?.("🕓", message);
}

function handleTimelineKey(
  e: KeyboardEvent,
  deps: EventDeps,
): boolean {
  const target = e.target as HTMLElement;
  const card = target.closest(".planner-timed-task") as HTMLElement | null;
  if (!card) return false;

  const goalId = card.dataset.goalId;
  if (!goalId) return false;
  const goal = deps.state.currentGoals.find((g) => g.id === goalId);
  if (!goal || goal.status === "done") return false;

  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return false;

  e.preventDefault();
  e.stopPropagation();

  const calculator = deps.calculator;
  const startMin = parseScheduledMinutes(goal, calculator) ?? calculator.getPlotStartMin();
  const endMin = getGoalEndMin(goal, startMin, calculator);
  const plotStart = calculator.getPlotStartMin();
  const plotEnd = calculator.getPlotEndMin();
  const delta = e.key === "ArrowDown" ? KEY_ADJUST_MIN : -KEY_ADJUST_MIN;

  let newStart = startMin;
  let newEnd = endMin;

  if (e.shiftKey) {
    newEnd = calculator.clamp(newEnd + delta, newStart + 15, plotEnd);
  } else {
    newStart = calculator.clamp(newStart + delta, plotStart, plotEnd - 15);
    const duration = Math.max(15, newEnd - startMin);
    newEnd = Math.min(newStart + duration, plotEnd);
    if (newEnd - newStart < 15) newEnd = newStart + 15;
  }

  const message = e.shiftKey
    ? `Duration ${newEnd - newStart} min`
    : `Moved to ${calculator.format12h(newStart)}`;

  applyTimelineAdjustment(deps, goal, newStart, newEnd, message);
  return true;
}

function formatDateComponent(value: number): string {
  return String(value).padStart(2, "0");
}

export function handleClick(e: Event, deps: EventDeps): void {
  const target = e.target as HTMLElement;
  const currentDate = deps.state.currentDate ?? new Date();

  const contextGoalBtn = target.closest(
    ".year-vision-icon-only[data-goal-id]"
  ) as HTMLElement | null;
  if (contextGoalBtn) {
    e.preventDefault();
    e.stopPropagation();
    const goalId = contextGoalBtn.dataset.goalId;
    if (goalId) deps.callbacks.onGoalClick(goalId);
    return;
  }

  const customizeBtn = target.closest(
    '[data-action="customize"], [data-action="add-intention"], [data-action="edit-intentions"]'
  ) as HTMLElement | null;
  if (customizeBtn) {
    e.preventDefault();
    e.stopPropagation();
    openCustomizationPanel(deps.container);
    return;
  }

  const editEventBtn = target.closest(
    "[data-action='edit-event']"
  ) as HTMLElement | null;
  if (editEventBtn) {
    e.preventDefault();
    e.stopPropagation();
    const eventId = editEventBtn.dataset.eventId;
    const y = currentDate.getFullYear();
    const m = formatDateComponent(currentDate.getMonth() + 1);
    const d = formatDateComponent(currentDate.getDate());
    const event = new CustomEvent("open-event-modal", {
      detail: { date: `${y}-${m}-${d}`, eventId },
    });
    deps.container.dispatchEvent(event);
    return;
  }

  const detailBtn = target.closest(".btn-intention-details") as HTMLElement | null;
  if (detailBtn) {
    e.preventDefault();
    e.stopPropagation();
    const goalId = detailBtn.dataset.goalId;
    if (goalId) {
      deps.callbacks.onOpenGoalDetail?.(goalId);
    }
    return;
  }

  const card = target.closest(".day-goal-card") as HTMLElement;
  if (
    card &&
    !target.closest(".day-goal-checkbox") &&
    !target.closest(".btn-zen-focus")
  ) {
    const goalId = card.dataset.goalId;
    if (goalId) deps.callbacks.onGoalClick(goalId);
    return;
  }

  if (
    target.classList.contains("day-goal-checkbox") ||
    target.closest(".day-goal-checkbox")
  ) {
    e.stopPropagation();
    const goalCard = target.closest(".day-goal-card") as HTMLElement;
    const unscheduledItem = target.closest(
      ".planner-unscheduled-item"
    ) as HTMLElement;
    const timedTask = target.closest(".planner-timed-task") as HTMLElement;

    // Try to find goal ID from any of the possible parent containers
    const goalId =
      goalCard?.dataset.goalId ||
      unscheduledItem?.dataset.goalId ||
      timedTask?.dataset.goalId;

    if (!goalId) return;

    const goal = deps.state.currentGoals.find((g) => g.id === goalId);
    if (!goal) return;

    const newStatus = goal.status === "done" ? "in-progress" : "done";
    deps.callbacks.onGoalUpdate(goalId, { status: newStatus });
    haptics.impact(newStatus === "done" ? "medium" : "light");

    if (newStatus === "done" && deps.callbacks.onCelebrate) {
      deps.callbacks.onCelebrate("🎉", "Nice work!", "Intention complete.");
    }
    return;
  }

  if (
    target.classList.contains("btn-zen-focus") ||
    target.closest(".btn-zen-focus")
  ) {
    e.stopPropagation();
    const btn = target.classList.contains("btn-zen-focus")
      ? (target as HTMLElement)
      : (target.closest(".btn-zen-focus") as HTMLElement);
    const goalId = btn?.dataset.goalId;
    if (goalId) deps.callbacks.onZenFocus(goalId);
    return;
  }

  if (
    target.classList.contains("btn-planner-add") ||
    target.closest(".btn-planner-add")
  ) {
    deps.callbacks.onPlantSomething?.();
    return;
  }

  if (
    target.classList.contains("btn-planner-event") ||
    target.closest(".btn-planner-event")
  ) {
    const y = currentDate.getFullYear();
    const m = formatDateComponent(currentDate.getMonth() + 1);
    const d = formatDateComponent(currentDate.getDate());
    const event = new CustomEvent("open-event-modal", {
      detail: { date: `${y}-${m}-${d}` },
    });
    deps.container.dispatchEvent(event);
    return;
  }

  if (
    target.classList.contains("btn-planner-prev") ||
    target.closest(".btn-planner-prev")
  ) {
    deps.callbacks.onNavigate?.(-1);
    return;
  }
  if (
    target.classList.contains("btn-planner-next") ||
    target.closest(".btn-planner-next")
  ) {
    deps.callbacks.onNavigate?.(1);
    return;
  }

  const removeBtn = target.closest(".btn-planner-remove") as HTMLElement;
  if (removeBtn) {
    e.stopPropagation();
    const goalId = removeBtn.dataset.goalId;
    if (goalId) {
      const goal = deps.state.currentGoals.find((g) => g.id === goalId);
      if (goal) {
        haptics.impact("light");
        deps.callbacks.onGoalUpdate(goalId, {
          startTime: undefined,
          endTime: undefined,
          scheduledAt: null,
        });
        deps.callbacks.onShowToast?.("💨", "Removed from timeline");
      }
    }
    return;
  }

  const unscheduledItem = target.closest(
    ".planner-unscheduled-item"
  ) as HTMLElement;
  if (
    unscheduledItem &&
    !target.closest(".unscheduled-task-actions") &&
    !target.closest(".day-goal-checkbox")
  ) {
    e.stopPropagation();
    const allItems = deps.container.querySelectorAll(
      ".planner-unscheduled-item"
    );
    allItems.forEach((item) => {
      if (item !== unscheduledItem) {
        item.classList.remove("active");
      }
    });
    unscheduledItem.classList.toggle("active");
    haptics.impact("light");
    return;
  }

  const scheduleBtn = target.closest(".btn-schedule-task") as HTMLElement;
  if (scheduleBtn) {
    e.stopPropagation();
    const goalId = scheduleBtn.dataset.goalId;
    if (goalId) {
      const goal = deps.state.currentGoals.find((g) => g.id === goalId);
      if (goal && !goalHasSchedule(goal)) {
        haptics.impact("light");
        deps.callbacks.onGoalClick(goalId);
      }
    }
    return;
  }

  if (!target.closest(".planner-unscheduled-item")) {
    const allItems = deps.container.querySelectorAll(
      ".planner-unscheduled-item"
    );
    allItems.forEach((item) => item.classList.remove("active"));
  }
}

const goalHasSchedule = (goal: Goal): boolean =>
  Boolean(goal.scheduledAt ?? goal.startTime);

export function handleKeyDown(e: KeyboardEvent, deps: EventDeps): void {
  if (handleTimelineKey(e, deps)) return;
  const target = e.target as HTMLElement;

  if (
    (e.key === "Enter" || e.key === " ") &&
    target.classList.contains("day-goal-card")
  ) {
    e.preventDefault();
    const goalId = target.dataset.goalId;
    if (goalId) {
      deps.callbacks.onGoalClick(goalId);
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    if (deps.undo()) {
      deps.callbacks.onShowToast?.("↩️", "Undone");
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
    e.preventDefault();
    if (deps.redo()) {
      deps.callbacks.onShowToast?.("↪️", "Redone");
    }
  }
}
