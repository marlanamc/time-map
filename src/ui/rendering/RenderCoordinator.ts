import { State } from "../../core/State";
import { VIEWS } from "../../config";
import { viewportManager } from "../viewport/ViewportManager";
import type { UIElements } from "../../types";
import { MonthRenderer, WeekRenderer, LivingGardenRenderer } from "../renderers";
import { goalDetailModal } from "../../components/modals/GoalDetailModal";

type RenderCoordinatorCallbacks = {
  renderCategoryFilters: () => void;
  renderUpcomingGoals: () => void;
  updateDateDisplay: () => void;
  updateTimeDisplay: () => void;
  updateYearProgress: () => void;
  updateStreaks: () => void;
  updateMobileHomeView: () => void;
  syncAddButtonLabel: () => void;
  syncViewButtons: () => void;
  renderDayView: () => void;
  renderCalendar: () => void;
  openGoalModal: (level: any, month: number, year: number, options?: any) => void;
  escapeHtml: (text: string) => string;
  dayViewController: any;
};

type RenderCoordinatorOptions = {
  elements: UIElements;
  callbacks: RenderCoordinatorCallbacks;
};

export class RenderCoordinator {
  private elements: UIElements;
  private callbacks: RenderCoordinatorCallbacks;
  private renderRaf: number | null = null;
  private pendingViewTransition = false;
  private lastNavKey: string | null = null;
  private scrollResetRaf: number | null = null;

  constructor(options: RenderCoordinatorOptions) {
    this.elements = options.elements;
    this.callbacks = options.callbacks;
  }

  scheduleRender(opts?: { transition?: boolean }) {
    if (opts?.transition) this.pendingViewTransition = true;
    if (this.renderRaf !== null) return;

    this.renderRaf = window.requestAnimationFrame(() => {
      this.renderRaf = null;
      const useViewTransition = this.pendingViewTransition;
      this.pendingViewTransition = false;

      const doc = document as unknown as {
        startViewTransition?: (cb: () => void) => void;
      };

      // Use View Transition API for smoother navigation
      if (useViewTransition && typeof doc.startViewTransition === "function") {
        try {
          doc.startViewTransition(() => {
            // Add transitioning class for custom animations
            const calendarGrid = this.elements.calendarGrid;
            if (calendarGrid) {
              calendarGrid.classList.add("view-transitioning");
            }

            this.render();

            // Remove transitioning class after render
            requestAnimationFrame(() => {
              if (calendarGrid) {
                calendarGrid.classList.remove("view-transitioning");
              }
            });
          });
          return;
        } catch (error) {
          console.warn(
            "View transition failed, falling back to regular render:",
            error
          );
        }
      }

      // Fallback to regular render with optimizations
      this.render();
    });
  }

  render() {
    if (this.renderRaf !== null) {
      cancelAnimationFrame(this.renderRaf);
      this.renderRaf = null;
      this.pendingViewTransition = false;
    }

    const navKey = (() => {
      const year = State.viewingYear;
      const month = State.viewingMonth;
      const week = State.viewingWeek;
      const day = State.viewingDate
        ? State.viewingDate.toISOString().slice(0, 10)
        : "";

      switch (State.currentView) {
        case VIEWS.YEAR:
          return `year:${year}`;
        case VIEWS.MONTH:
          return `month:${year}-${month}`;
        case VIEWS.WEEK:
          return `week:${year}-${week}`;
        case VIEWS.DAY:
          return `day:${day}`;
        default:
          return `${State.currentView}:${day}`;
      }
    })();

    const shouldResetScroll = navKey !== this.lastNavKey;
    this.lastNavKey = navKey;

    // Mobile Day view should be readable at default scale; reset zoom only when navigating.
    if (
      shouldResetScroll &&
      viewportManager.isMobileViewport() &&
      State.currentView === VIEWS.DAY &&
      State.zoom !== 100
    ) {
      State.zoom = 100;
      if (this.elements.canvas) {
        this.elements.canvas.style.transform = `scale(${State.zoom / 100})`;
      }
      if (this.elements.zoomLevel) {
        this.elements.zoomLevel.textContent = `${State.zoom}%`;
      }
    }

    // Batch DOM updates to prevent layout thrashing
    this.batchRenderUpdates(shouldResetScroll);
  }

  /**
   * Batch DOM updates to prevent flashing during tab switches
   */
  batchRenderUpdates(shouldResetScroll: boolean) {
    // Use document fragment for batch DOM operations
    const updates: (() => void)[] = [];

    // Show loading state for main content during navigation
    const calendarGrid = this.elements.calendarGrid;
    if (calendarGrid && shouldResetScroll) {
      calendarGrid.classList.add("loading");
    }

    // Collect all DOM updates
    updates.push(() => this.renderCurrentView());
    updates.push(() => this.renderLevelContextBar());
    updates.push(() => this.callbacks.renderCategoryFilters());
    updates.push(() => this.callbacks.renderUpcomingGoals());
    updates.push(() => this.callbacks.updateDateDisplay());
    updates.push(() => this.callbacks.updateTimeDisplay());
    updates.push(() => this.callbacks.updateYearProgress());

    updates.push(() => {
      this.callbacks.updateStreaks();
    });

    // Mobile view updates
    const isMobile = viewportManager.isMobileViewport();
    const isMobileHome = isMobile && State.currentView === VIEWS.HOME;
    const isMobileGarden = isMobile && State.currentView === VIEWS.GARDEN;

    updates.push(() => {
      document.body.classList.toggle("mobile-home-view", isMobileHome);
      document.body.classList.toggle("mobile-garden-view", isMobileGarden);
    });

    if (this.elements.mobileHomeView) {
      updates.push(() => {
        this.elements.mobileHomeView!.setAttribute("hidden", "");
      });
    }

    if (isMobileHome) {
      updates.push(() => this.callbacks.updateMobileHomeView());
    }

    updates.push(() => viewportManager.updateMobileLayoutVars());
    updates.push(() => this.callbacks.syncAddButtonLabel());

    // Execute all updates in a single frame
    requestAnimationFrame(() => {
      // Execute all DOM updates
      updates.forEach((update) => {
        try {
          update();
        } catch (error) {
          console.error("Error during render update:", error);
        }
      });

      // Remove loading state with smooth transition
      if (calendarGrid && shouldResetScroll) {
        requestAnimationFrame(() => {
          calendarGrid.classList.remove("loading");
          calendarGrid.classList.add("view-transitioning");

          // Remove transitioning class after animation
          setTimeout(() => {
            calendarGrid.classList.remove("view-transitioning");
          }, 200);
        });
      }

      // Handle scroll reset
      if (shouldResetScroll) {
        this.handleScrollReset();
      }
    });
  }

  /**
   * Handle scroll reset with proper timing
   */
  handleScrollReset() {
    if (this.scrollResetRaf !== null) {
      cancelAnimationFrame(this.scrollResetRaf);
    }

    this.scrollResetRaf = requestAnimationFrame(() => {
      this.scrollResetRaf = null;

      // Batch scroll operations
      const scrollOperations: (() => void)[] = [];

      const canvasContainer = this.elements.canvasContainer;
      if (canvasContainer) {
        scrollOperations.push(() => {
          canvasContainer.scrollTop = 0;
          canvasContainer.scrollLeft = 0;
        });
      }

      const appEl = document.querySelector(".app") as HTMLElement | null;
      if (appEl) {
        scrollOperations.push(() => {
          appEl.scrollTop = 0;
        });
      }

      const scrollingElement = document.scrollingElement as HTMLElement | null;
      if (scrollingElement) {
        scrollOperations.push(() => {
          scrollingElement.scrollTop = 0;
        });
      }

      // Execute all scroll operations
      scrollOperations.forEach((op) => op());
    });
  }

  /**
   * Render based on current view
   */
  renderCurrentView() {
    const container = this.elements.calendarGrid;
    if (!container) {
      console.error(
        "renderCurrentView: calendarGrid element not found! Current view:",
        State.currentView
      );
      return;
    }
    console.log("renderCurrentView: rendering view", State.currentView);

    // Update view button states
    this.callbacks.syncViewButtons();

    if (State.currentView !== VIEWS.DAY && this.callbacks.dayViewController) {
      this.callbacks.dayViewController.unmount();
      this.callbacks.dayViewController = null;
    }

    switch (State.currentView) {
      case VIEWS.YEAR:
        this.callbacks.renderCalendar();
        break;
      case VIEWS.MONTH:
        this.renderMonthView();
        break;
      case VIEWS.WEEK:
        this.renderWeekView();
        break;
      case VIEWS.DAY:
        this.callbacks.renderDayView();
        break;
      case VIEWS.HOME:
        // Do nothing for main grid, overlay is handled in render()
        break;
      case VIEWS.GARDEN:
        LivingGardenRenderer.render(
          this.elements,
          this.callbacks.escapeHtml.bind(this),
          (goalId) => goalDetailModal.show(goalId),
          (level) =>
            this.callbacks.openGoalModal(level, State.viewingMonth, State.viewingYear),
          (opts) =>
            this.callbacks.openGoalModal(
              opts.level,
              opts.preselectedMonth ?? State.viewingMonth,
              opts.preselectedYear ?? State.viewingYear,
              { parentId: opts.parentId, parentLevel: opts.parentLevel }
            )
        );
        break;
      default:
        this.callbacks.renderCalendar();
    }
  }

  renderLevelContextBar() {
    const container = this.elements.levelContextBar;
    if (!container) return;

    // Level context bar is no longer needed - always hide it
    container.innerHTML = "";
    container.setAttribute("hidden", "");
    container.style.display = "none";
    return;
  }

  renderMonthView() {
    MonthRenderer.render(this.elements, this.callbacks.escapeHtml.bind(this));
  }

  renderWeekView() {
    WeekRenderer.render(this.elements, this.callbacks.escapeHtml.bind(this));
  }
}
