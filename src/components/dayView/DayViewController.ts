import type { Goal } from "../../types";
import type { DayViewOptions, DayViewCallbacks, DragData, UpdateGoalTimeCommand } from "./types";
import { TimeSlotCalculator } from "./TimeSlotCalculator";
import { CardComponent } from "./CardComponent";
import { TimelineGrid } from "./TimelineGrid";
import { PlannerDayViewRenderer } from "./PlannerDayViewRenderer";
import { DragDropManager } from "./DragDropManager";
import { haptics } from "../../utils/haptics";
import { Goals } from "../../core/Goals";
import type { Category } from "../../types";

/**
 * Application configuration interface
 * @remarks This configuration is injected from app.ts
 */
interface AppConfig {
  CATEGORIES: Record<string, { emoji: string; label: string; color: string }>;
  LEVELS: Record<string, { emoji: string; label: string; color: string }>;
  PRIORITIES: Record<string, { symbol: string }>;
}

/**
 * Main controller for the Day View component
 * @remarks Manages the day view lifecycle, rendering, and user interactions.
 * Supports multiple view styles (timeline, simple, planner) and handles
 * drag-and-drop, keyboard navigation, and undo/redo operations.
 */
export class DayViewController {
  private container: HTMLElement;
  private callbacks: DayViewCallbacks;

  // Core components
  private calculator: TimeSlotCalculator;
  private cardComponent: CardComponent;
  private timelineGrid: TimelineGrid;
  private plannerRenderer: PlannerDayViewRenderer;
  private dragDropManager: DragDropManager;

  // State
  private currentDate: Date | null = null;
  private currentGoals: Goal[] = [];
  private currentContextGoals: { vision: Goal[], milestone: Goal[], focus: Goal[] } | undefined = undefined;
  private isMounted: boolean = false;

  // Lifecycle resources
  private resizeObserver: ResizeObserver | null = null;
  private timeUpdateInterval: number | null = null;
  private readonly boundHandleClick: (e: Event) => void;
  private readonly boundHandleKeyDown: (e: KeyboardEvent) => void;
  private readonly boundHandleNativeDragStart: (e: DragEvent) => void;
  private readonly boundHandleNativeDragEnd: (e: DragEvent) => void;
  private readonly boundHandleNativeDragOver: (e: DragEvent) => void;
  private readonly boundHandleNativeDrop: (e: DragEvent) => void;
  private swipeCleanup: (() => void) | null = null;

  // Options
  private options: DayViewOptions;
  private activeCommonTemplate:
    | { title: string; category: string; duration: number }
    | null = null;

  /**
   * Creates a new DayViewController instance
   * @param container - The DOM element that will contain the day view
   * @param callbacks - Callback functions for handling user interactions
   * @param _config - Application configuration (unused but kept for interface compatibility)
   * @param options - Optional configuration overrides for the day view
   */
  constructor(container: HTMLElement, callbacks: DayViewCallbacks, _config: AppConfig, options: Partial<DayViewOptions> = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.boundHandleClick = (e: Event) => this.handleClick(e);
    this.boundHandleKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.boundHandleNativeDragStart = (e: DragEvent) =>
      this.handleNativeDragStart(e);
    this.boundHandleNativeDragEnd = (e: DragEvent) =>
      this.handleNativeDragEnd(e);
    this.boundHandleNativeDragOver = (e: DragEvent) =>
      this.handleNativeDragOver(e);
    this.boundHandleNativeDrop = (e: DragEvent) => this.handleNativeDrop(e);

    // Merge options with defaults
    this.options = {
      timeWindowStart: options.timeWindowStart ?? 480, // 8 AM
      timeWindowEnd: options.timeWindowEnd ?? 1320, // 10 PM
      maxLanes: options.maxLanes ?? (this.isMobileViewport() ? 2 : 4),
      snapInterval: options.snapInterval ?? 5,
      longPressMs: options.longPressMs ?? 200,
      onGoalUpdate: callbacks.onGoalUpdate,
      onGoalClick: callbacks.onGoalClick,
      onZenFocus: callbacks.onZenFocus,
      onShowToast: callbacks.onShowToast,
      onCelebrate: callbacks.onCelebrate,
    };

    // Initialize components
    this.calculator = new TimeSlotCalculator(
      this.options.timeWindowStart,
      this.options.timeWindowEnd,
      this.options.maxLanes,
      this.options.snapInterval,
    );

    this.cardComponent = new CardComponent(_config);
    this.timelineGrid = new TimelineGrid(this.calculator);

    this.plannerRenderer = new PlannerDayViewRenderer(
      container,
      this.cardComponent,
      this.calculator,
      this.timelineGrid
    );

    this.dragDropManager = new DragDropManager({
      longPressMs: this.options.longPressMs,
      onDragStart: (data) => this.handleDragStart(data),
      onDragEnd: (data, clientX, clientY) => this.handleDragEnd(data, clientX, clientY),
    });
  }

  /**
   * Mount the day view and set up event listeners
   * @remarks Should only be called once. Subsequent calls are ignored.
   * Sets up resize observers, time update intervals, and DOM event delegation.
   */
  mount(): void {
    if (this.isMounted) return;

    try {
      this.isMounted = true;

      // Delegate event listeners
      this.container.addEventListener("click", this.boundHandleClick);
      this.container.addEventListener("keydown", this.boundHandleKeyDown);
      this.container.addEventListener("dragstart", this.boundHandleNativeDragStart);
      this.container.addEventListener("dragend", this.boundHandleNativeDragEnd);
      this.container.addEventListener("dragover", this.boundHandleNativeDragOver);
      this.container.addEventListener("drop", this.boundHandleNativeDrop);
      this.setupSwipeToComplete();

      // Set up resize observer to update on viewport changes
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => {
          this.handleResize();
        });
        this.resizeObserver.observe(this.container);
      }

      // Update current time indicator every minute
      this.timeUpdateInterval = window.setInterval(() => {
        if (this.currentDate) {
          const today = new Date();
          if (this.currentDate.toDateString() === today.toDateString()) {
            this.plannerRenderer.update(
              this.currentDate,
              this.currentGoals,
              this.currentContextGoals
            );
          } else {
            const gridEl = this.container.querySelector(".day-bed-grid") as
              | HTMLElement
              | null;
            if (gridEl) this.timelineGrid.updateElement(gridEl);
          }
        }
      }, 60000);
    } catch (error) {
      // If mount fails, cleanup what we started
      console.error('Failed to mount DayViewController:', error);
      this.unmount();
      throw error;
    }
  }

  /**
   * Unmount the day view and perform cleanup
   * @remarks Clears intervals, disconnects observers, removes event listeners,
   * and cleans up drag-and-drop handlers. Should be called before removing
   * the component from the DOM.
   */
  unmount(): void {
    if (!this.isMounted) return;

    this.isMounted = false;

    this.swipeCleanup?.();
    this.swipeCleanup = null;

    // Clear interval with null check
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }

    // Disconnect observer with null check
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Cleanup drag-drop manager
    this.dragDropManager.destroy();

    // Remove event listeners with defensive null checks
    if (this.boundHandleClick) {
      this.container.removeEventListener("click", this.boundHandleClick);
    }
    if (this.boundHandleKeyDown) {
      this.container.removeEventListener("keydown", this.boundHandleKeyDown);
    }
    this.container.removeEventListener("dragstart", this.boundHandleNativeDragStart);
    this.container.removeEventListener("dragend", this.boundHandleNativeDragEnd);
    this.container.removeEventListener("dragover", this.boundHandleNativeDragOver);
    this.container.removeEventListener("drop", this.boundHandleNativeDrop);
  }

  /**
   * Set goals for a specific date and trigger rendering
   * @param date - The date to display goals for
   * @param goals - Array of goals to display
   * @param contextGoals - Optional Vision/Milestone/Focus goals for sidebar context
   * @remarks Automatically determines whether to perform initial render or update
   * based on mount status. Sets up drag-and-drop after rendering.
   */
  setGoals(date: Date, goals: Goal[], contextGoals?: { vision: Goal[], milestone: Goal[], focus: Goal[] }): void {
    this.currentDate = date;
    this.currentGoals = goals;
    this.currentContextGoals = contextGoals;

    if (!this.isMounted) {
      // Initial render
      this.renderCurrent(contextGoals);
      this.setupDragAndDrop();
    } else {
      // Update render
      this.updateCurrent(contextGoals);
      this.setupDragAndDrop();
    }
  }

  /**
   * Render using current style
   */
  private renderCurrent(contextGoals?: { vision: Goal[], milestone: Goal[], focus: Goal[] }): void {
    if (!this.currentDate) return;
    this.plannerRenderer.renderInitial(this.currentDate, this.currentGoals, contextGoals);
  }

  /**
   * Update using current style
   */
  private updateCurrent(contextGoals?: { vision: Goal[], milestone: Goal[], focus: Goal[] }): void {
    if (!this.currentDate) return;
    this.plannerRenderer.update(this.currentDate, this.currentGoals, contextGoals);
  }

  /**
   * Force a full re-render of the current view
   * @remarks Uses the current date and goals. Useful when view style changes
   * or when you need to refresh the entire display.
   */
  render(): void {
    if (!this.currentDate) return;
    this.renderCurrent(this.currentContextGoals);
    this.setupDragAndDrop();
  }

  /**
   * Update a single goal card without re-rendering the entire view
   * @param goalId - The ID of the goal to update
   * @param goal - The updated goal data
   * @remarks More efficient than a full re-render when only one goal changes.
   * Also updates the internal goals array.
   */
  updateGoal(goalId: string, goal: Goal): void {
    this.plannerRenderer.updateCard(goalId, goal);

    // Update currentGoals
    const index = this.currentGoals.findIndex((g) => g.id === goalId);
    if (index >= 0) {
      this.currentGoals[index] = goal;
    }
  }

  /**
   * Undo the last drag-and-drop action
   * @returns True if an action was undone, false if nothing to undo
   * @remarks Restores the previous state of goals that were moved or scheduled
   */
  undo(): boolean {
    return this.dragDropManager.undo();
  }

  /**
   * Redo the last undone action
   * @returns True if an action was redone, false if nothing to redo
   * @remarks Re-applies a previously undone drag-and-drop operation
   */
  redo(): boolean {
    return this.dragDropManager.redo();
  }

  /**
   * Set the time window for the day view
   * @param start - Start time in minutes from midnight (e.g., 480 for 8:00 AM)
   * @param end - End time in minutes from midnight (e.g., 1320 for 10:00 PM)
   * @remarks Recreates the calculator and timeline grid with new bounds,
   * then triggers a full re-render.
   */
  setTimeWindow(start: number, end: number): void {
    this.options.timeWindowStart = start;
    this.options.timeWindowEnd = end;

    this.calculator = new TimeSlotCalculator(start, end, this.options.maxLanes, this.options.snapInterval);
    this.timelineGrid = new TimelineGrid(this.calculator);
    this.plannerRenderer = new PlannerDayViewRenderer(
      this.container,
      this.cardComponent,
      this.calculator,
      this.timelineGrid
    );

    this.render();
  }

  // --- Private Methods ---

  private setupDragAndDrop(): void {
    // Set up seed cards as draggable
    const seedCards = this.container.querySelectorAll(".day-goal-variant-seed[draggable='true']") as NodeListOf<HTMLElement>;
    seedCards.forEach((card) => {
      const goalId = card.dataset.goalId;
      if (!goalId) return;

      const goal = this.currentGoals.find((g) => g.id === goalId);
      if (!goal) return;

      this.dragDropManager.enableDraggable(card, {
        goalId,
        type: "seed",
        originalStartTime: goal.startTime ?? undefined,
        originalEndTime: goal.endTime ?? undefined,
      });
    });

    // Set up planter cards as draggable
    const planterCards = this.container.querySelectorAll(".day-goal-variant-planter[draggable='true']") as NodeListOf<HTMLElement>;
    planterCards.forEach((card) => {
      const goalId = card.dataset.goalId;
      if (!goalId) return;

      const goal = this.currentGoals.find((g) => g.id === goalId);
      if (!goal) return;

      this.dragDropManager.enableDraggable(card, {
        goalId,
        type: "planter",
        originalStartTime: goal.startTime ?? undefined,
        originalEndTime: goal.endTime ?? undefined,
      });
    });

    // Set up timeline as drop zone
    const dayBed = this.container.querySelector(".day-timeline") as HTMLElement;
    if (dayBed) {
      this.dragDropManager.enableDropZone(dayBed, {
        element: dayBed,
        onDrop: (data, clientX, clientY) => this.handleDrop(data, clientX, clientY),
        onDragOver: () => {
          dayBed.classList.add("is-drop-target");
        },
        onDragLeave: () => {
          dayBed.classList.remove("is-drop-target");
        },
      });
    }
  }

  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;

    // Handle card click
    const card = target.closest(".day-goal-card") as HTMLElement;
    if (card && !target.closest(".day-goal-checkbox") && !target.closest(".btn-zen-focus")) {
      const goalId = card.dataset.goalId;
      if (goalId) {
        this.callbacks.onGoalClick(goalId);
      }
      return;
    }

    // Handle checkbox click
    if (target.classList.contains("day-goal-checkbox") || target.closest(".day-goal-checkbox")) {
      e.stopPropagation();
      const goalCard = target.closest(".day-goal-card") as HTMLElement;
      const goalId = goalCard?.dataset.goalId;
      if (!goalId) return;

      const goal = this.currentGoals.find((g) => g.id === goalId);
      if (!goal) return;

      const newStatus = goal.status === "done" ? "in-progress" : "done";
      this.callbacks.onGoalUpdate(goalId, { status: newStatus });
      haptics.impact(newStatus === "done" ? "medium" : "light");

      if (newStatus === "done" && this.callbacks.onCelebrate) {
        this.callbacks.onCelebrate("🎉", "Nice work!", "Intention complete.");
      }
      return;
    }

    // Handle Zen Focus button click
    if (target.classList.contains("btn-zen-focus") || target.closest(".btn-zen-focus")) {
      e.stopPropagation();
      const btn = (target.classList.contains("btn-zen-focus") ? target : target.closest(".btn-zen-focus")) as HTMLElement;
      const goalId = btn?.dataset.goalId;
      if (goalId) {
        this.callbacks.onZenFocus(goalId);
      }
      return;
    }

    // --- Planner View Specific Actions ---

    // Sidebar Add Task
    if (target.classList.contains("btn-planner-add") || target.closest(".btn-planner-add")) {
      this.callbacks.onPlantSomething?.();
      return;
    }

    // Sidebar Navigation
    if (target.classList.contains("btn-planner-prev") || target.closest(".btn-planner-prev")) {
      this.callbacks.onNavigate?.(-1);
      return;
    }
    if (target.classList.contains("btn-planner-next") || target.closest(".btn-planner-next")) {
      this.callbacks.onNavigate?.(1);
      return;
    }

    // Remove from timeline (clear startTime/endTime)
    const removeBtn = target.closest(".btn-planner-remove") as HTMLElement;
    if (removeBtn) {
      e.stopPropagation();
      const goalId = removeBtn.dataset.goalId;
      if (goalId) {
        const goal = this.currentGoals.find((g) => g.id === goalId);
        if (goal) {
          haptics.impact("light");
          this.callbacks.onGoalUpdate(goalId, {
            startTime: undefined,
            endTime: undefined
          });
          this.callbacks.onShowToast?.("💨", "Removed from timeline");
        }
      }
      return;
    }

    // Note: Removed "Plant something" button - users can add tasks via the main add button
  }

  private snapMinutesToInterval(mins: number, interval: number): number {
    return Math.round(mins / interval) * interval;
  }

  private ensureTimelineDropIndicator(dayBed: HTMLElement): HTMLElement {
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

  private clearTimelineDropUi(): void {
    const dayBed = this.container.querySelector(".day-timeline") as
      | HTMLElement
      | null;
    if (!dayBed) return;
    dayBed.classList.remove("is-drop-target");
    const indicator = dayBed.querySelector(".planner-drop-indicator");
    if (indicator) indicator.remove();
  }

  private handleNativeDragStart(e: DragEvent): void {
    const target = e.target as HTMLElement | null;
    const item = target?.closest(".common-intention-item") as HTMLElement | null;
    if (!item) return;
    if (!e.dataTransfer) return;

    const title = item.dataset.title ?? "";
    const category = item.dataset.category ?? "";
    const duration = Number(item.dataset.duration ?? "60") || 60;

    this.activeCommonTemplate = { title, category, duration };
    item.classList.add("is-dragging");

    const payload = JSON.stringify({ title, category, duration });
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/json", payload);
    e.dataTransfer.setData("text/plain", payload);
  }

  private handleNativeDragEnd(e: DragEvent): void {
    const target = e.target as HTMLElement | null;
    const item = target?.closest(".common-intention-item") as HTMLElement | null;
    if (item) item.classList.remove("is-dragging");
    this.activeCommonTemplate = null;
    this.clearTimelineDropUi();
  }

  private handleNativeDragOver(e: DragEvent): void {
    const target = e.target as HTMLElement | null;
    const dayBed = target?.closest(".day-timeline") as HTMLElement | null;
    if (!dayBed) return;

    e.preventDefault();

    const rect = dayBed.getBoundingClientRect();
    const y = (e.clientY ?? rect.top) - rect.top;
    const rawStartMin = this.calculator.yToMinutes(y, rect.height);

    const startMin = this.calculator.clamp(
      this.snapMinutesToInterval(rawStartMin, 15),
      this.calculator.getPlotStartMin(),
      this.calculator.getPlotEndMin() - 15
    );

    const pct = this.calculator.minutesToPercent(startMin);
    const indicator = this.ensureTimelineDropIndicator(dayBed);
    indicator.style.top = `${pct}%`;
    const label = indicator.querySelector(
      ".planner-drop-indicator-label"
    ) as HTMLElement | null;
    if (label) {
      const title = this.activeCommonTemplate?.title
        ? `• ${this.activeCommonTemplate.title}`
        : "";
      label.textContent = `${this.calculator.format12h(startMin)} ${title}`.trim();
    }

    dayBed.classList.add("is-drop-target");
  }

  private handleNativeDrop(e: DragEvent): void {
    const target = e.target as HTMLElement | null;
    const dayBed = target?.closest(".day-timeline") as HTMLElement | null;
    if (!dayBed) return;

    e.preventDefault();
    e.stopPropagation();

    if (!this.currentDate) return;

    const dt = e.dataTransfer;
    if (!dt) return;

    const raw =
      dt.getData("application/json") ||
      dt.getData("text/plain") ||
      "";
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
    const rawStartMin = this.calculator.yToMinutes(y, rect.height);

    const startMin = this.calculator.clamp(
      this.snapMinutesToInterval(rawStartMin, 15),
      this.calculator.getPlotStartMin(),
      this.calculator.getPlotEndMin() - 15
    );

    const duration = Math.max(15, Math.floor(payload.duration || 60));
    const endMin = Math.min(startMin + duration, this.calculator.getPlotEndMin());

    const startTime = this.calculator.toTimeString(startMin);
    const endTime = this.calculator.toTimeString(
      endMin > startMin ? endMin : Math.min(startMin + 15, this.calculator.getPlotEndMin())
    );

    const ymd = `${this.currentDate.getFullYear()}-${String(
      this.currentDate.getMonth() + 1
    ).padStart(2, "0")}-${String(this.currentDate.getDate()).padStart(2, "0")}`;

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

    Goals.create({
      level: "intention",
      title: payload.title,
      category: coerceCategory(payload.category),
      startDate: ymd,
      startTime,
      endTime,
    });

    this.callbacks.onShowToast?.("🌱", `Added: ${payload.title}`);
    this.clearTimelineDropUi();
    this.render();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;

    // Handle Enter/Space on cards
    if ((e.key === "Enter" || e.key === " ") && target.classList.contains("day-goal-card")) {
      e.preventDefault();
      const goalId = target.dataset.goalId;
      if (goalId) {
        this.callbacks.onGoalClick(goalId);
      }
    }

    // Handle Ctrl+Z / Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      if (this.undo()) {
        this.callbacks.onShowToast?.("↩️", "Undone");
      }
    }

    // Handle Ctrl+Shift+Z / Cmd+Shift+Z for redo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      if (this.redo()) {
        this.callbacks.onShowToast?.("↪️", "Redone");
      }
    }
  }

  private handleResize(): void {
    // Update max lanes based on viewport
    const newMaxLanes = this.isMobileViewport() ? 2 : 4;
    if (newMaxLanes !== this.options.maxLanes) {
      this.options.maxLanes = newMaxLanes;
      this.calculator = new TimeSlotCalculator(
        this.options.timeWindowStart,
        this.options.timeWindowEnd,
        newMaxLanes,
        this.options.snapInterval,
      );
      this.timelineGrid = new TimelineGrid(this.calculator);
      this.plannerRenderer = new PlannerDayViewRenderer(
        this.container,
        this.cardComponent,
        this.calculator,
        this.timelineGrid
      );
      this.render();
    }
  }

  private handleDragStart(data: DragData): void {
    // Add body class for styling
    document.body.classList.add(`is-dragging-${data.type}`);
  }

  private handleDragEnd(data: DragData, _clientX: number, _clientY: number): void {
    // Remove body class
    document.body.classList.remove(`is-dragging-${data.type}`);
  }

  private handleDrop(data: DragData, _clientX: number, clientY: number): void {
    if (!this.currentDate) return;

    const dayBed = this.container.querySelector(".day-timeline") as HTMLElement;
    if (!dayBed) return;

    const rect = dayBed.getBoundingClientRect();
    const y = clientY - rect.top;

    // Get goal
    const goal = this.currentGoals.find((g) => g.id === data.goalId);
    if (!goal) return;

    // Calculate new time
    const newStartMin = this.calculator.yToMinutes(y, rect.height);
    const newStartTime = this.calculator.toTimeString(newStartMin);

    // Calculate duration
    const prevStartMin = this.calculator.parseTimeToMinutes(goal.startTime);
    const prevEndMin = this.calculator.parseTimeToMinutes(goal.endTime);
    const durationMin =
      prevStartMin !== null && prevEndMin !== null && prevEndMin > prevStartMin ? prevEndMin - prevStartMin : 60;

    const newEndTime = this.calculator.toTimeString(
      Math.min(newStartMin + durationMin, this.options.timeWindowEnd ?? 1320),
    );

    // Create command for undo/redo
    const command: UpdateGoalTimeCommand = {
      goalId: data.goalId,
      prevStartTime: goal.startTime,
      prevEndTime: goal.endTime,
      prevDueDate: goal.dueDate,
      prevMonth: goal.month,
      prevYear: goal.year,
      newStartTime,
      newEndTime,
      newDueDate: this.currentDate.toISOString(),
      newMonth: this.currentDate.getMonth(),
      newYear: this.currentDate.getFullYear(),
      description: `Schedule goal at ${this.calculator.format12h(newStartMin)}`,
      execute: () => {
        this.callbacks.onGoalUpdate(data.goalId, {
          startTime: newStartTime,
          endTime: newEndTime,
          dueDate: this.currentDate!.toISOString(),
          month: this.currentDate!.getMonth(),
          year: this.currentDate!.getFullYear(),
        });
      },
      undo: () => {
        this.callbacks.onGoalUpdate(data.goalId, {
          startTime: command.prevStartTime,
          endTime: command.prevEndTime,
          dueDate: command.prevDueDate,
          month: command.prevMonth,
          year: command.prevYear,
        });
      },
    };

    this.dragDropManager.executeCommand(command);

    // Show toast
    this.callbacks.onShowToast?.("🌱", `Planted at ${this.calculator.format12h(newStartMin)}`);
  }

  private isMobileViewport(): boolean {
    return window.innerWidth <= 600;
  }

  private setupSwipeToComplete(): void {
    this.swipeCleanup?.();
    this.swipeCleanup = null;
    if (!this.isMobileViewport()) return;

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
        activeCard.classList.remove("is-swiping", "swipe-ready-complete", "swipe-ready-undo");
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
      if (!this.isMobileViewport()) return;
      if (e.touches.length !== 1) return;
      if (!canStart(e.target as Element | null)) return;

      const card = (e.target as Element | null)?.closest(".day-goal-card") as HTMLElement | null;
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

      // Only take over once we are confident it is a horizontal swipe.
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

      const goal = this.currentGoals.find((g) => g.id === activeGoalId);
      const isDone = goal?.status === "done";
      const ready = Math.abs(clamped) >= thresholdPx;

      activeCard.classList.toggle("swipe-ready-complete", ready && clamped > 0 && !isDone);
      activeCard.classList.toggle("swipe-ready-undo", ready && clamped < 0 && !!isDone);
    };

    const onTouchEnd = () => {
      if (!tracking || !activeCard || !activeGoalId) return reset();
      if (!swiping) return reset();

      const goal = this.currentGoals.find((g) => g.id === activeGoalId);
      const isDone = goal?.status === "done";

      const shouldComplete = dx >= thresholdPx && !isDone;
      const shouldUndo = dx <= -thresholdPx && !!isDone;

      if (shouldComplete) {
        this.callbacks.onGoalUpdate(activeGoalId, { status: "done" });
        this.callbacks.onShowToast?.("✅", "Completed");
        haptics.impact("medium");
        if (this.callbacks.onCelebrate) this.callbacks.onCelebrate("🎉", "Nice work!", "Intention complete.");
      } else if (shouldUndo) {
        this.callbacks.onGoalUpdate(activeGoalId, { status: "in-progress" });
        this.callbacks.onShowToast?.("↩️", "Marked active");
        haptics.impact("light");
      }

      animateBack();
    };

    this.container.addEventListener("touchstart", onTouchStart, { passive: true });
    this.container.addEventListener("touchmove", onTouchMove, { passive: false });
    this.container.addEventListener("touchend", onTouchEnd, { passive: true });
    this.container.addEventListener("touchcancel", reset, { passive: true });

    this.swipeCleanup = () => {
      this.container.removeEventListener("touchstart", onTouchStart);
      this.container.removeEventListener("touchmove", onTouchMove);
      this.container.removeEventListener("touchend", onTouchEnd);
      this.container.removeEventListener("touchcancel", reset);
      reset();
    };
  }
}
