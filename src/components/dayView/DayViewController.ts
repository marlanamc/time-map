import type { Goal } from "../../types";
import type { DayViewOptions, DayViewCallbacks, DragData } from "./types";
import { TimeSlotCalculator } from "./TimeSlotCalculator";
import { CardComponent } from "./CardComponent";
import { TimelineGrid } from "./TimelineGrid";
import { PlannerDayViewRenderer } from "./PlannerDayViewRenderer";
import { DragDropManager } from "./DragDropManager";
import { DayViewState } from "./DayViewState";
import { DayViewRenderer } from "./DayViewRenderer";
import { DayViewEvents } from "./DayViewEvents";
import { DayViewTimeline } from "./DayViewTimeline";
import { setupCustomizationPanel } from "./CustomizationPanel";

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
  private events: DayViewEvents;
  private timeline: DayViewTimeline;

  private resizeObserver: ResizeObserver | null = null;
  private timeUpdateInterval: number | null = null;
  private isMounted: boolean = false;
  private customizationPanelSetup: boolean = false;

  private state = new DayViewState();

  private readonly boundHandleClick: (e: Event) => void;
  private readonly boundHandleKeyDown: (e: KeyboardEvent) => void;
  private readonly boundHandleNativeDragStart: (e: DragEvent) => void;
  private readonly boundHandleNativeDragEnd: (e: DragEvent) => void;
  private readonly boundHandleNativeDragOver: (e: DragEvent) => void;
  private readonly boundHandleNativeDrop: (e: DragEvent) => void;
  private readonly boundHandlePointerDown: (e: PointerEvent) => void;

  constructor(
    container: HTMLElement,
    callbacks: DayViewCallbacks,
    _config: AppConfig,
    options: Partial<DayViewOptions> = {},
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
      this.options.snapInterval!,
    );

    this.cardComponent = new CardComponent(_config);
    this.timelineGrid = new TimelineGrid(this.calculator);
    this.plannerRenderer = new PlannerDayViewRenderer(
      container,
      this.cardComponent,
      this.calculator,
      this.timelineGrid,
    );

    this.dragDropManager = new DragDropManager({
      longPressMs: this.options.longPressMs,
      onDragStart: (data) => this.handleDragStart(data),
      onDragEnd: (data, clientX, clientY) => this.handleDragEnd(data, clientX, clientY),
    });

    // Initialize new class-based modules
    this.renderer = new DayViewRenderer(this.plannerRenderer, this.state);
    this.events = new DayViewEvents(
      container,
      this.callbacks,
      this.state,
      () => this.undo(),
      () => this.redo()
    );
    this.timeline = new DayViewTimeline(
      container,
      this.calculator,
      this.dragDropManager,
      this.options,
      this.callbacks,
      this.state
    );

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
  }

  private get eventDeps(): EventDeps {
    return {
      container: this.container,
      callbacks: this.callbacks,
      state: this.state,
      undo: () => this.undo(),
      redo: () => this.redo(),
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

  private get rendererDeps() {
    return {
      plannerRenderer: this.plannerRenderer,
      state: this.state,
    };
  }

  mount(): void {
    if (this.isMounted) return;

    try {
      this.isMounted = true;

      this.container.addEventListener("click", this.boundHandleClick);
      this.container.addEventListener("keydown", this.boundHandleKeyDown);
      this.container.addEventListener("dragstart", this.boundHandleNativeDragStart);
      this.container.addEventListener("dragend", this.boundHandleNativeDragEnd);
      this.container.addEventListener("dragover", this.boundHandleNativeDragOver);
      this.container.addEventListener("drop", this.boundHandleNativeDrop);
      this.container.addEventListener("pointerdown", this.boundHandlePointerDown);

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
          const gridEl = this.container.querySelector(".day-bed-grid") as
            | HTMLElement
            | null;
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
    this.container.removeEventListener("dragstart", this.boundHandleNativeDragStart);
    this.container.removeEventListener("dragend", this.boundHandleNativeDragEnd);
    this.container.removeEventListener("dragover", this.boundHandleNativeDragOver);
    this.container.removeEventListener("drop", this.boundHandleNativeDrop);
    this.container.removeEventListener("pointerdown", this.boundHandlePointerDown);
  }

  setGoals(date: Date, goals: Goal[], contextGoals?: { vision: Goal[]; milestone: Goal[]; focus: Goal[] }): void {
    this.state.setGoals(date, goals, contextGoals);

    if (!this.isMounted) {
      this.renderer.renderCurrent();
      setupDragAndDrop(this.timelineDeps);
    } else {
      this.renderer.updateCurrent();
      setupDragAndDrop(this.timelineDeps);
    }
  }

  render(): void {
    renderCurrent(this.rendererDeps);
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
      this.options.snapInterval!,
    );
    this.timelineGrid = new TimelineGrid(this.calculator);
    this.plannerRenderer = new PlannerDayViewRenderer(
      this.container,
      this.cardComponent,
      this.calculator,
      this.timelineGrid,
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
        this.options.snapInterval!,
      );
      this.timelineGrid = new TimelineGrid(this.calculator);
      this.plannerRenderer = new PlannerDayViewRenderer(
        this.container,
        this.cardComponent,
        this.calculator,
        this.timelineGrid,
      );
      this.render();
    }
  }

  private handleDragStart(data: DragData): void {
    document.body.classList.add(`is-dragging-${data.type}`);
  }

  private handleDragEnd(data: DragData, _clientX: number, _clientY: number): void {
    document.body.classList.remove(`is-dragging-${data.type}`);
  }

  private isMobileViewport(): boolean {
    return window.innerWidth <= 600;
  }
}
