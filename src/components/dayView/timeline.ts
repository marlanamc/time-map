import { haptics } from "../../utils/haptics";
import { Goals } from "../../core/Goals";
import type { Category } from "../../types";
import type {
  DayViewOptions,
  DayViewCallbacks,
  DragData,
  UpdateGoalTimeCommand,
} from "./types";
import type { TimeSlotCalculator } from "./TimeSlotCalculator";
import { DragDropManager } from "./DragDropManager";
import { DayViewState } from "./DayViewState";

export interface TimelineDeps {
  container: HTMLElement;
  calculator: TimeSlotCalculator;
  dragDropManager: DragDropManager;
  options: DayViewOptions;
  callbacks: DayViewCallbacks;
  state: DayViewState;
}

export interface TimelineRuntimeState {
  activeCommonTemplate: {
    title: string;
    category: string;
    duration: number;
  } | null;
  activeResize: {
    goalId: string;
    handle: "top" | "bottom";
    startMin: number;
    endMin: number;
    pointerId: number;
    dayBed: HTMLElement;
  } | null;
  swipeCleanup: (() => void) | null;
}

export function createTimelineRuntimeState(): TimelineRuntimeState {
  return {
    activeCommonTemplate: null,
    activeResize: null,
    swipeCleanup: null,
  };
}

function ensurePlannerDropIndicator(dayBed: HTMLElement): HTMLElement {
  let indicator = dayBed.querySelector(
    ".planner-drop-indicator"
  ) as HTMLElement | null;
  if (indicator) return indicator;
  indicator = document.createElement("div");
  indicator.className = "planner-drop-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.innerHTML = `
    <div class="planner-drop-indicator-line"></div>
    <div class="planner-drop-indicator-label"></div>
  `;
  dayBed.appendChild(indicator);
  return indicator;
}

export function clearTimelineDropUi(container: HTMLElement): void {
  const dayBed = container.querySelector(".day-timeline") as HTMLElement | null;
  if (!dayBed) return;
  dayBed.classList.remove("is-drop-target");
  const indicator = dayBed.querySelector(".planner-drop-indicator");
  if (indicator) indicator.remove();
}

export function setupDragAndDrop(deps: TimelineDeps): void {
  const container = deps.container;
  const dragDrop = deps.dragDropManager;
  const goals = deps.state.currentGoals;

  const seedCards = container.querySelectorAll(
    ".day-goal-variant-seed[draggable='true']"
  ) as NodeListOf<HTMLElement>;
  seedCards.forEach((card) => {
    const goalId = card.dataset.goalId;
    if (!goalId) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    dragDrop.enableDraggable(card, {
      goalId,
      type: "seed",
      originalStartTime: goal.startTime ?? undefined,
      originalEndTime: goal.endTime ?? undefined,
    });
  });

  const planterCards = container.querySelectorAll(
    ".day-goal-variant-planter[draggable='true']"
  ) as NodeListOf<HTMLElement>;
  planterCards.forEach((card) => {
    const goalId = card.dataset.goalId;
    if (!goalId) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    dragDrop.enableDraggable(card, {
      goalId,
      type: "planter",
      originalStartTime: goal.startTime ?? undefined,
      originalEndTime: goal.endTime ?? undefined,
    });
  });

  const unscheduledItems = container.querySelectorAll(
    ".planner-unscheduled-item[data-goal-id]"
  ) as NodeListOf<HTMLElement>;
  unscheduledItems.forEach((item) => {
    const goalId = item.dataset.goalId;
    if (!goalId) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || goal.status === "done") return;
    dragDrop.enableDraggable(item, {
      goalId,
      type: "seed",
      originalStartTime: goal.startTime ?? undefined,
      originalEndTime: goal.endTime ?? undefined,
    });
  });

  const timedTasks = container.querySelectorAll(
    ".planner-timed-task[data-goal-id]"
  ) as NodeListOf<HTMLElement>;
  timedTasks.forEach((card) => {
    const goalId = card.dataset.goalId;
    if (!goalId) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || goal.status === "done") return;
    dragDrop.enableDraggable(card, {
      goalId,
      type: "planter",
      originalStartTime: goal.startTime ?? undefined,
      originalEndTime: goal.endTime ?? undefined,
    });
  });

  const dayBed = container.querySelector(".day-timeline") as HTMLElement;
  if (dayBed) {
    dragDrop.enableDropZone(dayBed, {
      element: dayBed,
      onDrop: (data, clientX, clientY) =>
        handleDrop(data, clientX, clientY, deps),
      onDragOver: () => {
        dayBed.classList.add("is-drop-target");
      },
      onDragLeave: () => {
        dayBed.classList.remove("is-drop-target");
      },
    });
  }
}

export function handleNativeDragStart(
  e: DragEvent,
  _deps: TimelineDeps,
  runtime: TimelineRuntimeState
): void {
  const item = (e.target as HTMLElement | null)?.closest(
    ".intention-pill"
  ) as HTMLElement | null;
  if (!item || !e.dataTransfer) return;

  const title = item.dataset.title ?? "";
  const category = item.dataset.category ?? "";
  const duration = Number(item.dataset.duration ?? "60") || 60;

  runtime.activeCommonTemplate = { title, category, duration };
  item.classList.add("is-dragging");

  const payload = JSON.stringify({ title, category, duration });
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData("application/json", payload);
  e.dataTransfer.setData("text/plain", payload);
}

export function handleNativeDragEnd(
  e: DragEvent,
  deps: TimelineDeps,
  runtime: TimelineRuntimeState
): void {
  const item = (e.target as HTMLElement | null)?.closest(
    ".intention-pill"
  ) as HTMLElement | null;
  if (item) item.classList.remove("is-dragging");
  runtime.activeCommonTemplate = null;
  clearTimelineDropUi(deps.container);
}

export function handleNativeDragOver(
  e: DragEvent,
  deps: TimelineDeps,
  runtime: TimelineRuntimeState
): void {
  const dayBed = (e.target as HTMLElement | null)?.closest(
    ".day-timeline"
  ) as HTMLElement | null;
  if (!dayBed) return;

  e.preventDefault();
  const rect = dayBed.getBoundingClientRect();
  const y = (e.clientY ?? rect.top) - rect.top;
  const rawStartMin = deps.calculator.yToMinutes(y, rect.height);
  const startMin = deps.calculator.clamp(
    snapMinutesToInterval(rawStartMin, 15),
    deps.calculator.getPlotStartMin(),
    deps.calculator.getPlotEndMin() - 15
  );

  const pct = deps.calculator.minutesToPercent(startMin);
  const indicator = ensurePlannerDropIndicator(dayBed);
  indicator.style.top = `${pct}%`;
  const label = indicator.querySelector(
    ".planner-drop-indicator-label"
  ) as HTMLElement | null;
  if (label) {
    const title = runtime.activeCommonTemplate?.title
      ? `• ${runtime.activeCommonTemplate.title}`
      : "";
    label.textContent = `${deps.calculator.format12h(
      startMin
    )} ${title}`.trim();
  }

  dayBed.classList.add("is-drop-target");
}

export function handleNativeDrop(e: DragEvent, deps: TimelineDeps): void {
  const dayBed = (e.target as HTMLElement | null)?.closest(
    ".day-timeline"
  ) as HTMLElement | null;
  if (!dayBed) return;

  e.preventDefault();
  e.stopPropagation();

  const currentDate = deps.state.currentDate;
  if (!currentDate) return;

  const dt = e.dataTransfer;
  if (!dt) return;

  const raw = dt.getData("application/json") || dt.getData("text/plain") || "";
  let payload: { title: string; category: string; duration: number } | null =
    null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }
  if (!payload?.title) return;

  const rect = dayBed.getBoundingClientRect();
  const y = (e.clientY ?? rect.top) - rect.top;
  const rawStartMin = deps.calculator.yToMinutes(y, rect.height);

  const startMin = deps.calculator.clamp(
    snapMinutesToInterval(rawStartMin, 15),
    deps.calculator.getPlotStartMin(),
    deps.calculator.getPlotEndMin() - 15
  );

  const duration = Math.max(15, Math.floor(payload.duration || 60));
  const endMin = Math.min(startMin + duration, deps.calculator.getPlotEndMin());

  const startTime = deps.calculator.toTimeString(startMin);
  const endTime = deps.calculator.toTimeString(
    endMin > startMin
      ? endMin
      : Math.min(startMin + 15, deps.calculator.getPlotEndMin())
  );

  const ymd = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1
  ).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

  const coerceCategory = (value: string): Category | null => {
    switch (value) {
      case "career":
      case "health":
      case "finance":
      case "personal":
      case "creative":
        return value;
      default:
        return null;
    }
  };

  try {
    const newGoal = Goals.create({
      level: "intention",
      title: payload.title,
      category: coerceCategory(payload.category),
      startDate: ymd,
      startTime,
      endTime,
    });

    // Trigger a refresh to show the new goal immediately
    deps.callbacks.onShowToast?.("🌱", `Added: ${payload.title}`);

    // Dispatch a custom event to trigger refresh
    const refreshEvent = new CustomEvent("goalCreated", {
      detail: { goal: newGoal },
    });
    deps.container.dispatchEvent(refreshEvent);

    // Also trigger the general refresh mechanism
    const requestRefreshEvent = new CustomEvent("requestRefresh");
    deps.container.dispatchEvent(requestRefreshEvent);
  } catch (error: any) {
    console.error("Failed to create goal:", error);
    deps.callbacks.onShowToast?.("❌", "Failed to add intention");
  }

  clearTimelineDropUi(deps.container);
}

function snapMinutesToInterval(mins: number, interval: number): number {
  return Math.round(mins / interval) * interval;
}

export function setupSwipeToComplete(
  deps: TimelineDeps,
  runtime: TimelineRuntimeState
): void {
  runtime.swipeCleanup?.();
  runtime.swipeCleanup = null;
  if (window.innerWidth > 600) return;

  const thresholdPx = 72;
  const maxSwipePx = 160;

  let activeCard: HTMLElement | null = null;
  let activeGoalId: string | null = null;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  let tracking = false;
  let swiping = false;

  const canStart = (target: Element | null) => {
    if (!target) return false;
    if (
      target.closest(".day-goal-checkbox") ||
      target.closest(".btn-zen-focus") ||
      target.closest(".btn-planner-remove") ||
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest(".resize-handle")
    ) {
      return false;
    }
    return true;
  };

  const reset = () => {
    if (activeCard) {
      activeCard.classList.remove(
        "is-swiping",
        "swipe-ready-complete",
        "swipe-ready-undo"
      );
      activeCard.style.removeProperty("--swipe-x");
    }
    activeCard = null;
    activeGoalId = null;
    tracking = false;
    swiping = false;
    dx = 0;
    dy = 0;
  };

  const animateBack = () => {
    if (!activeCard) return reset();
    activeCard.classList.add("swipe-animating");
    activeCard.style.setProperty("--swipe-x", "0px");
    window.setTimeout(() => {
      activeCard?.classList.remove("swipe-animating");
      reset();
    }, 180);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (!canStart(e.target as Element | null)) return;

    const card = (e.target as Element | null)?.closest(
      ".day-goal-card"
    ) as HTMLElement | null;
    const goalId = card?.dataset.goalId ?? null;
    if (!card || !goalId) return;

    tracking = true;
    swiping = false;
    activeCard = card;
    activeGoalId = goalId;

    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dx = 0;
    dy = 0;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!tracking || !activeCard || !activeGoalId) return;
    if (e.touches.length !== 1) return reset();
    const t = e.touches[0];
    dx = t.clientX - startX;
    dy = t.clientY - startY;

    if (!swiping) {
      if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) return reset();
      if (Math.abs(dx) < 12) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      swiping = true;
      activeCard.classList.add("is-swiping");
    }

    e.preventDefault();
    const clamped = Math.max(-maxSwipePx, Math.min(maxSwipePx, dx));
    activeCard.style.setProperty("--swipe-x", `${clamped}px`);

    const goal = deps.state.currentGoals.find((g) => g.id === activeGoalId);
    const isDone = goal?.status === "done";
    const ready = Math.abs(clamped) >= thresholdPx;

    activeCard.classList.toggle(
      "swipe-ready-complete",
      ready && clamped > 0 && !isDone
    );
    activeCard.classList.toggle(
      "swipe-ready-undo",
      ready && clamped < 0 && !!isDone
    );
  };

  const onTouchEnd = () => {
    if (!tracking || !activeCard || !activeGoalId) return reset();
    if (!swiping) return reset();

    const goal = deps.state.currentGoals.find((g) => g.id === activeGoalId);
    const isDone = goal?.status === "done";

    const shouldComplete = dx >= thresholdPx && !isDone;
    const shouldUndo = dx <= -thresholdPx && !!isDone;

    if (shouldComplete) {
      deps.callbacks.onGoalUpdate(activeGoalId, { status: "done" });
      deps.callbacks.onShowToast?.("✅", "Completed");
      haptics.impact("medium");
      if (deps.callbacks.onCelebrate)
        deps.callbacks.onCelebrate("🎉", "Nice work!", "Intention complete.");
    } else if (shouldUndo) {
      deps.callbacks.onGoalUpdate(activeGoalId, { status: "in-progress" });
      deps.callbacks.onShowToast?.("↩️", "Marked active");
      haptics.impact("light");
    }

    animateBack();
  };

  deps.container.addEventListener("touchstart", onTouchStart, {
    passive: true,
  });
  deps.container.addEventListener("touchmove", onTouchMove, { passive: false });
  deps.container.addEventListener("touchend", onTouchEnd, { passive: true });
  deps.container.addEventListener("touchcancel", reset, { passive: true });

  runtime.swipeCleanup = () => {
    deps.container.removeEventListener("touchstart", onTouchStart);
    deps.container.removeEventListener("touchmove", onTouchMove);
    deps.container.removeEventListener("touchend", onTouchEnd);
    deps.container.removeEventListener("touchcancel", reset);
    reset();
  };
}

export function handlePointerDown(
  e: PointerEvent,
  deps: TimelineDeps,
  runtime: TimelineRuntimeState
): void {
  const target = e.target as HTMLElement | null;
  const handle = target?.closest(
    ".planter-resize-handle"
  ) as HTMLElement | null;
  if (!handle) return;

  const card = handle.closest(
    ".planner-timed-task[data-goal-id]"
  ) as HTMLElement | null;
  const goalId = card?.dataset.goalId;
  if (!card || !goalId) return;

  const goal = deps.state.currentGoals.find((g) => g.id === goalId);
  if (!goal || goal.status === "done") return;

  const dayBed = deps.container.querySelector(
    ".day-timeline"
  ) as HTMLElement | null;
  if (!dayBed) return;

  e.preventDefault();
  e.stopPropagation();

  const startMinRaw =
    deps.calculator.parseTimeToMinutes(goal.startTime) ??
    deps.options.timeWindowStart ??
    480;
  const endMinRaw =
    deps.calculator.parseTimeToMinutes(goal.endTime) ?? startMinRaw + 60;
  const startMin = deps.calculator.clamp(
    startMinRaw,
    deps.calculator.getPlotStartMin(),
    deps.calculator.getPlotEndMin() - 15
  );
  const endMin = deps.calculator.clamp(
    endMinRaw,
    startMin + 15,
    deps.calculator.getPlotEndMin()
  );

  const resizeType = (handle.dataset.resize === "top" ? "top" : "bottom") as
    | "top"
    | "bottom";
  runtime.activeResize = {
    goalId,
    handle: resizeType,
    startMin,
    endMin,
    pointerId: e.pointerId,
    dayBed,
  };

  handle.setPointerCapture(e.pointerId);
  document.body.classList.add("is-resizing");
  card.classList.add("is-resizing");
  handle.classList.add("is-resizing");

  const rect = dayBed.getBoundingClientRect();
  const updatePreview = (minsStart: number, minsEnd: number) => {
    const topPct = deps.calculator.minutesToPercent(minsStart);
    const durPct =
      ((minsEnd - minsStart) / deps.calculator.getPlotRangeMin()) * 100;

    // Apply the same tighter positioning adjustments
    const adjustedTop = Math.max(0, topPct - 0.1);
    const adjustedHeight = Math.max(1, durPct - 0.2);

    card.style.top = `${adjustedTop}%`;
    card.style.height = `${adjustedHeight}%`;
  };

  const onMove = (ev: PointerEvent) => {
    if (!runtime.activeResize) return;
    if (ev.pointerId !== runtime.activeResize.pointerId) return;

    const y = ev.clientY - rect.top;
    const plotStart = deps.calculator.getPlotStartMin();
    const plotEnd = deps.calculator.getPlotEndMin();
    const plotRange = deps.calculator.getPlotRangeMin();
    const pct = rect.height > 0 ? y / rect.height : 0;
    const rawFull = plotStart + pct * plotRange;
    const raw =
      runtime.activeResize.handle === "bottom"
        ? rawFull
        : deps.calculator.yToMinutes(y, rect.height);
    const snapped = deps.calculator.snapToInterval(raw);
    const minDur = 15;

    if (runtime.activeResize.handle === "top") {
      const nextStart = deps.calculator.clamp(
        snapped,
        plotStart,
        runtime.activeResize.endMin - minDur
      );
      runtime.activeResize.startMin = nextStart;
    } else {
      const nextEnd = deps.calculator.clamp(
        snapped,
        runtime.activeResize.startMin + minDur,
        plotEnd
      );
      runtime.activeResize.endMin = nextEnd;
    }

    updatePreview(runtime.activeResize.startMin, runtime.activeResize.endMin);
  };

  const onUp = (ev: PointerEvent) => {
    if (!runtime.activeResize) return;
    if (ev.pointerId !== runtime.activeResize.pointerId) return;
    const active = runtime.activeResize;
    runtime.activeResize = null;

    try {
      handle.releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }

    card.classList.remove("is-resizing");
    handle.classList.remove("is-resizing");
    document.body.classList.remove("is-resizing");

    const prevStartTime = goal.startTime;
    const prevEndTime = goal.endTime;
    const prevDueDate = goal.dueDate;
    const prevMonth = goal.month;
    const prevYear = goal.year;

    const newStartTime = deps.calculator.toTimeString(active.startMin);
    const newEndTime = deps.calculator.toTimeString(active.endMin);

    const command: UpdateGoalTimeCommand = {
      goalId,
      prevStartTime,
      prevEndTime,
      prevDueDate,
      prevMonth,
      prevYear,
      newStartTime,
      newEndTime,
      newDueDate: deps.state.currentDate
        ? deps.state.currentDate.toISOString()
        : goal.dueDate ?? new Date().toISOString(),
      newMonth: deps.state.currentDate
        ? deps.state.currentDate.getMonth()
        : goal.month,
      newYear: deps.state.currentDate
        ? deps.state.currentDate.getFullYear()
        : goal.year,
      description: "Resize task",
      execute: () => {
        deps.callbacks.onGoalUpdate(goalId, {
          startTime: newStartTime,
          endTime: newEndTime,
        });
      },
      undo: () => {
        deps.callbacks.onGoalUpdate(goalId, {
          startTime: prevStartTime ?? undefined,
          endTime: prevEndTime ?? undefined,
          dueDate: prevDueDate,
          month: prevMonth,
          year: prevYear,
        });
      },
    };

    deps.dragDropManager.executeCommand(command);
    deps.callbacks.onShowToast?.("⏱️", `${newStartTime}–${newEndTime}`);

    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
  };

  const onCancel = (ev: PointerEvent) => {
    if (!runtime.activeResize) return;
    if (ev.pointerId !== runtime.activeResize.pointerId) return;
    runtime.activeResize = null;
    card.classList.remove("is-resizing");
    handle.classList.remove("is-resizing");
    document.body.classList.remove("is-resizing");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerup", onUp, { passive: true });
  document.addEventListener("pointercancel", onCancel, { passive: true });
}

export function handleDrop(
  data: DragData,
  _clientX: number,
  clientY: number,
  deps: TimelineDeps
): void {
  if (!deps.state.currentDate) return;

  const dayBed = deps.container.querySelector(
    ".day-timeline"
  ) as HTMLElement | null;
  if (!dayBed) return;

  const rect = dayBed.getBoundingClientRect();
  const y = clientY - rect.top;

  const goal = deps.state.currentGoals.find((g) => g.id === data.goalId);
  if (!goal) return;

  const newStartMin = deps.calculator.yToMinutes(y, rect.height);
  const newStartTime = deps.calculator.toTimeString(newStartMin);

  const prevStartMin = deps.calculator.parseTimeToMinutes(goal.startTime);
  const prevEndMin = deps.calculator.parseTimeToMinutes(goal.endTime);
  const durationMin =
    prevStartMin !== null && prevEndMin !== null && prevEndMin > prevStartMin
      ? prevEndMin - prevStartMin
      : 60;

  const newEndTime = deps.calculator.toTimeString(
    Math.min(newStartMin + durationMin, deps.options.timeWindowEnd ?? 1320)
  );

  const command: UpdateGoalTimeCommand = {
    goalId: data.goalId,
    prevStartTime: goal.startTime,
    prevEndTime: goal.endTime,
    prevDueDate: goal.dueDate,
    prevMonth: goal.month,
    prevYear: goal.year,
    newStartTime,
    newEndTime,
    newDueDate: deps.state.currentDate.toISOString(),
    newMonth: deps.state.currentDate.getMonth(),
    newYear: deps.state.currentDate.getFullYear(),
    description: `Schedule goal at ${deps.calculator.format12h(newStartMin)}`,
    execute: () => {
      deps.callbacks.onGoalUpdate(data.goalId, {
        startTime: newStartTime,
        endTime: newEndTime,
        dueDate: deps.state.currentDate!.toISOString(),
        month: deps.state.currentDate!.getMonth(),
        year: deps.state.currentDate!.getFullYear(),
      });
    },
    undo: () => {
      deps.callbacks.onGoalUpdate(data.goalId, {
        startTime: command.prevStartTime,
        endTime: command.prevEndTime,
        dueDate: command.prevDueDate,
        month: command.prevMonth,
        year: command.prevYear,
      });
    },
  };

  deps.dragDropManager.executeCommand(command);
  deps.callbacks.onShowToast?.(
    "🌱",
    `Planted at ${deps.calculator.format12h(newStartMin)}`
  );
}
