import type { Goal } from "../../types";
import type { DayViewOptions, DayViewCallbacks, DragData, UpdateGoalTimeCommand } from "./types";
import { TimeSlotCalculator } from "./TimeSlotCalculator";
import { CardComponent } from "./CardComponent";
import { TimelineGrid } from "./TimelineGrid";
import { DayViewRenderer } from "./DayViewRenderer";
import { DragDropManager } from "./DragDropManager";

// This will be injected from app.ts
interface AppConfig {
  CATEGORIES: Record<string, { emoji: string; label: string; color: string }>;
  LEVELS: Record<string, { emoji: string; label: string }>;
  PRIORITIES: Record<string, { symbol: string }>;
}

export class DayViewController {
  private container: HTMLElement;
  private callbacks: DayViewCallbacks;
  private config: AppConfig;

  // Core components
  private calculator: TimeSlotCalculator;
  private cardComponent: CardComponent;
  private timelineGrid: TimelineGrid;
  private renderer: DayViewRenderer;
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

  constructor(container: HTMLElement, callbacks: DayViewCallbacks, config: AppConfig, options: Partial<DayViewOptions> = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.config = config;
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

    this.cardComponent = new CardComponent(config);
    this.timelineGrid = new TimelineGrid(this.calculator);

    this.renderer = new DayViewRenderer(
      container,
      this.calculator,
      this.cardComponent,
      this.timelineGrid,
      callbacks,
    );

    this.dragDropManager = new DragDropManager({
      longPressMs: this.options.longPressMs,
      onDragStart: (data) => this.handleDragStart(data),
      onDragEnd: (data, clientX, clientY) => this.handleDragEnd(data, clientX, clientY),
    });
  }

  /**
   * Mount the day view (set up event listeners)
   */
  mount(): void {
    if (this.isMounted) return;

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
  }

  /**
   * Unmount the day view (cleanup)
   */
  unmount(): void {
    if (!this.isMounted) return;

    this.isMounted = false;
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.dragDropManager.destroy();
    this.renderer.clearCaches();

    // Remove event listeners
    this.container.removeEventListener("click", this.boundHandleClick);
    this.container.removeEventListener("keydown", this.boundHandleKeyDown);
  }

  /**
   * Set goals and render
   */
  setGoals(date: Date, goals: Goal[]): void {
    this.currentDate = date;
    this.currentGoals = goals;

    if (!this.isMounted) {
      // Initial render
      this.renderer.renderInitial(date, goals);
      this.setupDragAndDrop();
    } else {
      // Update render
      this.renderer.update(date, goals);
      this.setupDragAndDrop();
    }
  }

  /**
   * Full re-render
   */
  render(): void {
    if (!this.currentDate) return;
    this.renderer.renderInitial(this.currentDate, this.currentGoals);
    this.setupDragAndDrop();
  }

  /**
   * Update a single goal card
   */
  updateGoal(goalId: string, goal: Goal): void {
    this.renderer.updateCard(goalId, goal);

    // Update currentGoals
    const index = this.currentGoals.findIndex((g) => g.id === goalId);
    if (index >= 0) {
      this.currentGoals[index] = goal;
    }
  }

  /**
   * Undo last action
   */
  undo(): boolean {
    return this.dragDropManager.undo();
  }

  /**
   * Redo last undone action
   */
  redo(): boolean {
    return this.dragDropManager.redo();
  }

  /**
   * Set time window
   */
  setTimeWindow(start: number, end: number): void {
    this.options.timeWindowStart = start;
    this.options.timeWindowEnd = end;

    this.calculator = new TimeSlotCalculator(start, end, this.options.maxLanes, this.options.snapInterval);
    this.timelineGrid = new TimelineGrid(this.calculator);

    this.renderer = new DayViewRenderer(
      this.container,
      this.calculator,
      this.cardComponent,
      this.timelineGrid,
      this.callbacks,
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
        originalStartTime: goal.startTime,
        originalEndTime: goal.endTime,
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
        originalStartTime: goal.startTime,
        originalEndTime: goal.endTime,
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

  private handleDragEnd(data: DragData, clientX: number, clientY: number): void {
    // Remove body class
    document.body.classList.remove(`is-dragging-${data.type}`);
  }

  private handleDrop(data: DragData, clientX: number, clientY: number): void {
    if (!this.currentDate) return;

    const dayBed = this.container.querySelector(".day-timeline") as HTMLElement;
    if (!dayBed) return;

    const rect = dayBed.getBoundingClientRect();
    const y = clientY - rect.top;

    // Calculate new time
    const minutes = this.calculator.yToMinutes(y, rect.height);
    const newStartTime = this.calculator.toTimeString(minutes);

    // Get goal
    const goal = this.currentGoals.find((g) => g.id === data.goalId);
    if (!goal) return;

    // Calculate duration
    const prevStartMin = this.calculator.parseTimeToMinutes(goal.startTime);
    const prevEndMin = this.calculator.parseTimeToMinutes(goal.endTime);
    const durationMin =
      prevStartMin !== null && prevEndMin !== null && prevEndMin > prevStartMin ? prevEndMin - prevStartMin : 60;

    const newEndTime = this.calculator.toTimeString(
      Math.min(minutes + durationMin, this.options.timeWindowEnd ?? 1320),
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
      description: `Schedule goal at ${this.calculator.format12h(minutes)}`,
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
    this.callbacks.onShowToast?.("🌱", `Planted at ${this.calculator.format12h(minutes)}`);
  }

  private isMobileViewport(): boolean {
    return window.innerWidth <= 600;
  }
}
