import type { Goal } from "../../types";
import type { DayViewOptions, DayViewCallbacks, DragData, UpdateGoalTimeCommand } from "./types";
import { TimeSlotCalculator } from "./TimeSlotCalculator";
import { CardComponent } from "./CardComponent";
import { TimelineGrid } from "./TimelineGrid";
import { TimelineDayViewRenderer } from "./TimelineDayViewRenderer";
import { ListDayViewRenderer } from "./ListDayViewRenderer";
import { PlannerDayViewRenderer } from "./PlannerDayViewRenderer";
import { DragDropManager } from "./DragDropManager";

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
  private renderer: TimelineDayViewRenderer;
  private simpleRenderer: ListDayViewRenderer;
  private plannerRenderer: PlannerDayViewRenderer;
  private dragDropManager: DragDropManager;

  // State
  private currentDate: Date | null = null;
  private currentGoals: Goal[] = [];
  private isMounted: boolean = false;

  // Lifecycle resources
  private resizeObserver: ResizeObserver | null = null;
  private timeUpdateInterval: number | null = null;
  private readonly boundHandleClick: (e: Event) => void;
  private readonly boundHandleKeyDown: (e: KeyboardEvent) => void;

  // Options
  private options: DayViewOptions;

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

    this.renderer = new TimelineDayViewRenderer(
      container,
      this.calculator,
      this.cardComponent,
      this.timelineGrid
    );

    this.simpleRenderer = new ListDayViewRenderer(
      container,
      this.cardComponent
    );

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
          this.renderer.update(this.currentDate, this.currentGoals);
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
    this.renderer.clearCaches();

    // Remove event listeners with defensive null checks
    if (this.boundHandleClick) {
      this.container.removeEventListener("click", this.boundHandleClick);
    }
    if (this.boundHandleKeyDown) {
      this.container.removeEventListener("keydown", this.boundHandleKeyDown);
    }
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
    const style = this.callbacks.onGetPreference?.("dayViewStyle");
    if (style === "simple") {
      this.simpleRenderer.renderInitial(this.currentDate, this.currentGoals);
    } else if (style === "planner") {
      this.plannerRenderer.renderInitial(this.currentDate, this.currentGoals, contextGoals);
    } else {
      this.renderer.renderInitial(this.currentDate, this.currentGoals);
    }
  }

  /**
   * Update using current style
   */
  private updateCurrent(contextGoals?: { vision: Goal[], milestone: Goal[], focus: Goal[] }): void {
    if (!this.currentDate) return;
    const style = this.callbacks.onGetPreference?.("dayViewStyle");
    if (style === "simple") {
      this.simpleRenderer.update(this.currentDate, this.currentGoals);
    } else if (style === "planner") {
      this.plannerRenderer.update(this.currentDate, this.currentGoals, contextGoals);
    } else {
      this.renderer.update(this.currentDate, this.currentGoals);
    }
  }

  /**
   * Force a full re-render of the current view
   * @remarks Uses the current date and goals. Useful when view style changes
   * or when you need to refresh the entire display.
   */
  render(): void {
    if (!this.currentDate) return;
    this.renderCurrent();
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
    const style = this.callbacks.onGetPreference?.("dayViewStyle");
    if (style === "simple") {
      this.simpleRenderer.updateCard(goalId, goal);
    } else if (style === "planner") {
      this.plannerRenderer.updateCard(goalId, goal);
    } else {
      this.renderer.updateCard(goalId, goal);
    }

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

    this.renderer = new TimelineDayViewRenderer(
      this.container,
      this.calculator,
      this.cardComponent,
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

      if (newStatus === "done" && this.callbacks.onCelebrate) {
        this.callbacks.onCelebrate("🎉", "Nice work!", "You completed a task!");
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
}
