import type { Goal } from "../../types";
import type { DayViewOptions, DayViewCallbacks, DragData } from "./types";
import { TimeSlotCalculator } from "./TimeSlotCalculator";
import { CardComponent } from "./CardComponent";
import { TimelineGrid } from "./TimelineGrid";
import { PlannerDayViewRenderer } from "./PlannerDayViewRenderer";
import { DragDropManager } from "./DragDropManager";
import { DayViewState } from "./DayViewState";
import { DayViewRenderer } from "./DayViewRenderer";
import { setupCustomizationPanel } from "./CustomizationPanel";

import { handleClick, handleKeyDown, type EventDeps } from "./events";
import {
  handleNativeDragStart,
  handleNativeDragEnd,
  handleNativeDragOver,
  handleNativeDrop,
  handlePointerDown,
  setupDragAndDrop,
  setupSwipeToComplete,
  clearTimelineDropUi,
  createTimelineRuntimeState,
  updateTimelineDragPreview,
  type TimelineDeps,
} from "./timeline";

interface AppConfig {
  CATEGORIES: Record<string, { emoji: string; label: string; color: string }>;
  LEVELS: Record<string, { emoji: string; label: string; color: string }>;
  PRIORITIES: Record<string, { symbol: string }>;
}

export class DayViewController {
  private container: HTMLElement;
  private callbacks: DayViewCallbacks;
  private options: DayViewOptions;

  private calculator: TimeSlotCalculator;
  private cardComponent: CardComponent;
  private timelineGrid: TimelineGrid;
  private plannerRenderer: PlannerDayViewRenderer;
  private dragDropManager: DragDropManager;

  private renderer: DayViewRenderer;

  private resizeObserver: ResizeObserver | null = null;
  private timeUpdateInterval: number | null = null;
  private isMounted: boolean = false;
  private customizationPanelSetup: boolean = false;

  private state = new DayViewState();
  private timelineState = createTimelineRuntimeState();
  private plannerScrollContainer: HTMLElement | null = null;
  private syncStatusElement: HTMLElement | null = null;
  private lastSyncAt: Date | null = null;

  private readonly boundHandleClick: (e: Event) => void;
  private readonly boundHandleKeyDown: (e: KeyboardEvent) => void;
  private readonly boundHandleNativeDragStart: (e: DragEvent) => void;
  private readonly boundHandleNativeDragEnd: (e: DragEvent) => void;
  private readonly boundHandleNativeDragOver: (e: DragEvent) => void;
  private readonly boundHandleNativeDrop: (e: DragEvent) => void;
  private readonly boundHandlePointerDown: (e: PointerEvent) => void;
  private readonly boundHandleSyncStatus: (event: Event) => void;

  constructor(
    container: HTMLElement,
    callbacks: DayViewCallbacks,
    _config: AppConfig,
    options: Partial<DayViewOptions> = {}
  ) {
    this.container = container;
    this.callbacks = callbacks;

    this.options = {
      timeWindowStart: options.timeWindowStart ?? 480,
      timeWindowEnd: options.timeWindowEnd ?? 1320,
      maxLanes: options.maxLanes ?? (this.isMobileViewport() ? 2 : 4),
      snapInterval: options.snapInterval ?? 5,
      longPressMs: options.longPressMs ?? 200,
      onGoalUpdate: callbacks.onGoalUpdate,
      onGoalClick: callbacks.onGoalClick,
      onZenFocus: callbacks.onZenFocus,
      onPlantSomething: callbacks.onPlantSomething,
      onShowToast: callbacks.onShowToast,
      onCelebrate: callbacks.onCelebrate,
    };

    this.calculator = new TimeSlotCalculator(
      this.options.timeWindowStart!,
      this.options.timeWindowEnd!,
      this.options.maxLanes!,
      this.options.snapInterval!
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
      onDragEnd: (data, clientX, clientY) =>
        this.handleDragEnd(data, clientX, clientY),
      onDragMove: (data, clientX, clientY) =>
        this.handleDragMove(data, clientX, clientY),
      onDragCancel: () => clearTimelineDropUi(this.container),
    });

    // Initialize new class-based modules
    this.renderer = new DayViewRenderer(this.plannerRenderer, this.state);

    this.boundHandleClick = (e) => handleClick(e, this.eventDeps);

    this.boundHandleKeyDown = (e) => handleKeyDown(e, this.eventDeps);
    this.boundHandleNativeDragStart = (e) =>
      handleNativeDragStart(e, this.timelineDeps, this.timelineState);
    this.boundHandleNativeDragEnd = (e) =>
      handleNativeDragEnd(e, this.timelineDeps, this.timelineState);
    this.boundHandleNativeDragOver = (e) =>
      handleNativeDragOver(e, this.timelineDeps, this.timelineState);
    this.boundHandleNativeDrop = (e) => handleNativeDrop(e, this.timelineDeps);
    this.boundHandlePointerDown = (e) =>
      handlePointerDown(e, this.timelineDeps, this.timelineState);
    this.boundHandleSyncStatus = (event) => this.handleSyncStatus(event);
  }

  private get eventDeps(): EventDeps {
    return {
      container: this.container,
      callbacks: this.callbacks,
      state: this.state,
      undo: () => this.undo(),
      redo: () => this.redo(),
      calculator: this.calculator,
    };
  }

  private get timelineDeps(): TimelineDeps {
    return {
      container: this.container,
      calculator: this.calculator,
      dragDropManager: this.dragDropManager,
      options: this.options,
      callbacks: this.callbacks,
      state: this.state,
    };
  }

  mount(): void {
    if (this.isMounted) return;

    try {
      this.isMounted = true;

      this.container.addEventListener("click", this.boundHandleClick);
      this.container.addEventListener("keydown", this.boundHandleKeyDown);
      this.container.addEventListener(
        "dragstart",
        this.boundHandleNativeDragStart
      );
      this.container.addEventListener("dragend", this.boundHandleNativeDragEnd);
      this.container.addEventListener(
        "dragover",
        this.boundHandleNativeDragOver
      );
      this.container.addEventListener("drop", this.boundHandleNativeDrop);
      this.container.addEventListener(
        "pointerdown",
        this.boundHandlePointerDown
      );
      window.addEventListener("sync-status", this.boundHandleSyncStatus);
      this.updateSyncIndicator("synced");

      // Add event listeners for refresh events
      this.container.addEventListener(
        "goalCreated",
        this.handleGoalCreated.bind(this) as EventListener
      );
      this.container.addEventListener(
        "requestRefresh",
        this.handleRequestRefresh.bind(this) as EventListener
      );

      this.setupSwipeSupport();
      this.ensureCustomizationPanelSetup();

      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => {
          this.handleResize();
        });
        this.resizeObserver.observe(this.container);
      }

      this.timeUpdateInterval = window.setInterval(() => {
        const currentDate = this.state.currentDate;
        if (!currentDate) return;
        const today = new Date();
        if (currentDate.toDateString() === today.toDateString()) {
          this.renderer.renderCurrent();
        } else {
          const gridEl = this.container.querySelector(
            ".day-bed-grid"
          ) as HTMLElement | null;
          if (gridEl) this.timelineGrid.updateElement(gridEl);
        }
      }, 60000);
    } catch (error) {
      console.error("Failed to mount DayViewController:", error);
      this.unmount();
      throw error;
    }
  }

  unmount(): void {
    if (!this.isMounted) return;

    this.isMounted = false;
    this.timelineState.swipeCleanup?.();
    clearTimelineDropUi(this.container);

    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.dragDropManager.destroy();

    this.container.removeEventListener("click", this.boundHandleClick);
    this.container.removeEventListener("keydown", this.boundHandleKeyDown);
    this.container.removeEventListener(
      "dragstart",
      this.boundHandleNativeDragStart
    );
    this.container.removeEventListener(
      "dragend",
      this.boundHandleNativeDragEnd
    );
    this.container.removeEventListener(
      "dragover",
      this.boundHandleNativeDragOver
    );
    this.container.removeEventListener("drop", this.boundHandleNativeDrop);
    this.container.removeEventListener(
      "pointerdown",
      this.boundHandlePointerDown
    );
    window.removeEventListener("sync-status", this.boundHandleSyncStatus);

    // Remove refresh event listeners
    this.container.removeEventListener(
      "goalCreated",
      this.handleGoalCreated.bind(this) as EventListener
    );
    this.container.removeEventListener(
      "requestRefresh",
      this.handleRequestRefresh.bind(this) as EventListener
    );
  }

  setGoals(
    date: Date,
    goals: Goal[],
    contextGoals?: { vision: Goal[]; milestone: Goal[]; focus: Goal[] }
  ): void {
    this.state.setGoals(date, goals, contextGoals);

    if (!this.isMounted) {
      this.renderer.renderCurrent();
      this.refreshScrollContainer();
      setupDragAndDrop(this.timelineDeps);
    } else {
      this.renderer.updateCurrent();
      this.refreshScrollContainer();
      setupDragAndDrop(this.timelineDeps);
    }
  }

  render(): void {
    this.renderer.renderCurrent();
    this.refreshScrollContainer();
    setupDragAndDrop(this.timelineDeps);
  }

  updateGoal(goalId: string, goal: Goal): void {
    this.renderer.updateGoal(goalId, goal);
  }

  undo(): boolean {
    return this.dragDropManager.undo();
  }

  redo(): boolean {
    return this.dragDropManager.redo();
  }

  setTimeWindow(start: number, end: number): void {
    this.options.timeWindowStart = start;
    this.options.timeWindowEnd = end;

    this.calculator = new TimeSlotCalculator(
      start,
      end,
      this.options.maxLanes!,
      this.options.snapInterval!
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

  private setupSwipeSupport(): void {
    setupSwipeToComplete(this.timelineDeps, this.timelineState);
  }

  private ensureCustomizationPanelSetup(): void {
    if (this.customizationPanelSetup) return;
    this.customizationPanelSetup = true;
    setupCustomizationPanel(this.container, () => {
      if (!this.state.currentDate) return;
      this.renderer.renderCurrent();
    });
  }

  private handleResize(): void {
    const newMaxLanes = this.isMobileViewport() ? 2 : 4;
    if (newMaxLanes !== this.options.maxLanes) {
      this.options.maxLanes = newMaxLanes;
      this.calculator = new TimeSlotCalculator(
        this.options.timeWindowStart!,
        this.options.timeWindowEnd!,
        newMaxLanes,
        this.options.snapInterval!
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
    document.body.classList.add(`is-dragging-${data.type}`);
  }

  private handleDragEnd(
    data: DragData,
    _clientX: number,
    _clientY: number
  ): void {
    document.body.classList.remove(`is-dragging-${data.type}`);
  }

  private handleDragMove(data: DragData, clientX: number, clientY: number): void {
    this.autoScrollPlanner(clientY);
    const duration = this.getGoalDuration(data.goalId);
    updateTimelineDragPreview(this.timelineDeps, clientX, clientY, duration);
  }

  private autoScrollPlanner(clientY: number): void {
    const container = this.plannerScrollContainer;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const threshold = 72;
    const scrollSpeed = 14;

    if (clientY < rect.top + threshold) {
      const delta = Math.min(
        scrollSpeed,
        Math.max(1, rect.top + threshold - clientY),
      );
      container.scrollBy({ top: -delta, left: 0 });
    } else if (clientY > rect.bottom - threshold) {
      const delta = Math.min(
        scrollSpeed,
        Math.max(1, clientY - (rect.bottom - threshold)),
      );
      container.scrollBy({ top: delta, left: 0 });
    }
  }

  private getGoalDuration(goalId: string): number {
    const goal = this.state.currentGoals.find((g) => g.id === goalId);
    if (!goal) return 60;
    const prevStartMin = this.calculator.parseTimeToMinutes(goal.startTime);
    const prevEndMin = this.calculator.parseTimeToMinutes(goal.endTime);
    if (prevStartMin !== null && prevEndMin !== null && prevEndMin > prevStartMin) {
      return prevEndMin - prevStartMin;
    }
    return 60;
  }

  private refreshScrollContainer(): void {
    this.plannerScrollContainer = this.container.querySelector(
      ".planner-main",
    ) as HTMLElement | null;
    this.syncStatusElement = null;
  }

  private handleGoalCreated(_event: Event): void {
    // A new goal was created, refresh the view
    if (!this.state.currentDate) return;

    // Trigger a re-render to show the new goal
    this.renderer.updateCurrent();
    this.refreshScrollContainer();
    setupDragAndDrop(this.timelineDeps);
  }

  private handleRequestRefresh(_event: Event): void {
    // General refresh request
    if (!this.state.currentDate) return;

    this.renderer.updateCurrent();
    this.refreshScrollContainer();
    setupDragAndDrop(this.timelineDeps);
  }

  private handleSyncStatus(event: Event): void {
    const detail = (event as CustomEvent<{ status?: string }>)?.detail ?? {};
    const status = detail.status ?? "synced";
    this.updateSyncIndicator(status);
  }

  private updateSyncIndicator(status: string): void {
    if (!this.syncStatusElement) {
      this.syncStatusElement = this.container.querySelector(
        ".planner-timeline-status",
      ) as HTMLElement | null;
    }
    if (!this.syncStatusElement) return;

    this.syncStatusElement.dataset.syncState = status;
    const textEl = this.syncStatusElement.querySelector(
      ".planner-sync-text",
    ) as HTMLElement | null;
    if (!textEl) return;

    if (status === "synced") {
      this.lastSyncAt = new Date();
      const formatted = this.lastSyncAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      textEl.textContent = `Synced at ${formatted}`;
    } else if (status === "syncing") {
      textEl.textContent = "Syncing…";
    } else if (status === "error") {
      textEl.textContent = "Sync error";
    } else if (status === "offline") {
      textEl.textContent = "Offline (saved locally)";
    } else if (status === "local") {
      textEl.textContent = "Local-only edits";
    } else {
      textEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  private isMobileViewport(): boolean {
    return window.innerWidth <= 600;
  }
}
