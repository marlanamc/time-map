import type { Goal } from "../../types";
import type { PositionedGoal } from "./types";
import { TimeSlotCalculator } from "./TimeSlotCalculator";
import { CardComponent } from "./CardComponent";
import { TimelineGrid } from "./TimelineGrid";

interface CachedCard {
  element: HTMLElement;
  goalId: string;
  hash: string; // Hash of goal properties to detect changes
}

export class TimelineDayViewRenderer {
  private container: HTMLElement;
  private calculator: TimeSlotCalculator;
  private cardComponent: CardComponent;
  private timelineGrid: TimelineGrid;

  // DOM element caches
  private cachedCards: Map<string, CachedCard> = new Map();
  private dayBedCanvas: HTMLElement | null = null;
  private seedTrayGrid: HTMLElement | null = null;
  private compostGrid: HTMLElement | null = null;
  private fenceValueEl: HTMLElement | null = null;

  // State tracking
  private currentDate: Date | null = null;
  private currentLaneCount: number = 1;

  constructor(
    container: HTMLElement,
    calculator: TimeSlotCalculator,
    cardComponent: CardComponent,
    timelineGrid: TimelineGrid
  ) {
    this.container = container;
    this.calculator = calculator;
    this.cardComponent = cardComponent;
    this.timelineGrid = timelineGrid;
  }

  /**
   * Initial full render
   */
  renderInitial(date: Date, allGoals: Goal[]): void {
    this.currentDate = date;

    const dayGoals = allGoals.filter((g) => this.isGoalForDate(g, date));
    const activeGoals = dayGoals.filter((g) => g.status !== "done");
    const completedGoals = dayGoals.filter((g) => g.status === "done");
    const seedGoals = activeGoals.filter((g) => !g.startTime);

    const timedGoals = this.calculator.getTimedGoals(activeGoals);
    const positionedGoals = this.calculator.assignLanes(timedGoals);
    const laneCount = this.calculator.getLaneCount(positionedGoals);
    this.currentLaneCount = laneCount;

    const isToday = this.isToday(date);
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const html = this.buildDayViewHTML(
      isToday,
      dayName,
      dateStr,
      activeGoals.length,
      seedGoals,
      positionedGoals,
      completedGoals,
      laneCount,
    );

    this.container.innerHTML = html;
    this.container.className = "day-view-container";

    // Cache DOM references
    this.cacheElements();

    // Cache all cards
    this.cacheAllCards();
  }

  /**
   * Update render - only changes what's different
   */
  update(date: Date, allGoals: Goal[]): void {
    // If date changed, do full re-render
    if (!this.currentDate || date.toDateString() !== this.currentDate.toDateString()) {
      this.renderInitial(date, allGoals);
      return;
    }

    const dayGoals = allGoals.filter((g) => this.isGoalForDate(g, date));
    const activeGoals = dayGoals.filter((g) => g.status !== "done");
    const completedGoals = dayGoals.filter((g) => g.status === "done");
    const seedGoals = activeGoals.filter((g) => !g.startTime);

    const timedGoals = this.calculator.getTimedGoals(activeGoals);
    const positionedGoals = this.calculator.assignLanes(timedGoals);
    const laneCount = this.calculator.getLaneCount(positionedGoals);

    // Update fence count
    this.updateFenceCount(activeGoals.length);

    // Update seed tray
    this.updateSeedTray(seedGoals);

    // Update planters (scheduled goals)
    this.updatePlanters(positionedGoals, laneCount);

    // Update compost (completed goals)
    this.updateCompost(completedGoals);

    // Update timeline grid (for current time indicator)
    this.updateTimelineGrid();
  }

  /**
   * Update a single goal card incrementally
   */
  updateCard(goalId: string, goal: Goal): void {
    const cached = this.cachedCards.get(goalId);
    if (!cached) return;

    const newHash = this.hashGoal(goal);
    if (cached.hash === newHash) return; // No changes

    this.cardComponent.updateElement(cached.element, goal);
    cached.hash = newHash;
  }

  /**
   * Clear all caches (call when unmounting)
   */
  clearCaches(): void {
    this.cachedCards.clear();
    this.dayBedCanvas = null;
    this.seedTrayGrid = null;
    this.compostGrid = null;
    this.fenceValueEl = null;
  }

  // --- Private Methods ---

  private cacheElements(): void {
    this.dayBedCanvas = this.container.querySelector(".day-timeline") as HTMLElement;
    this.seedTrayGrid = this.container.querySelector(".day-section-unscheduled .day-section-content") as HTMLElement;
    this.compostGrid = this.container.querySelector(".day-section-completed .day-section-content") as HTMLElement;
    this.fenceValueEl = null; // Removed fence section
  }

  private cacheAllCards(): void {
    this.cachedCards.clear();
    const cardElements = this.container.querySelectorAll(".day-goal-card");
    cardElements.forEach((el) => {
      const element = el as HTMLElement;
      const goalId = element.dataset.goalId;
      if (!goalId) return;

      this.cachedCards.set(goalId, {
        element,
        goalId,
        hash: "", // Will be updated on first change
      });
    });
  }

  private updateFenceCount(count: number): void {
    if (this.fenceValueEl) {
      this.fenceValueEl.textContent = `${count} active`;
    }
  }

  private updateSeedTray(seedGoals: Goal[]): void {
    if (!this.seedTrayGrid) return;

    // Simple approach: re-render if count changed
    // Could be optimized further with proper diffing
    const currentCount = this.seedTrayGrid.querySelectorAll(".day-goal-card").length;
    if (currentCount !== seedGoals.length) {
      this.renderSeedTray(seedGoals);
    }
  }

  private updatePlanters(positionedGoals: PositionedGoal[], laneCount: number): void {
    if (!this.dayBedCanvas) return;

    // Update lane count CSS variable if changed
    if (laneCount !== this.currentLaneCount) {
      const dayPlot = this.container.querySelector(".day-plot") as HTMLElement;
      if (dayPlot) {
        dayPlot.style.setProperty("--lanes", String(laneCount));
      }
      this.currentLaneCount = laneCount;
    }

    // Get existing planter IDs
    const existingIds = new Set(
      Array.from(this.dayBedCanvas.querySelectorAll(".day-goal-variant-planter"))
        .map((el) => (el as HTMLElement).dataset.goalId)
        .filter((id): id is string => Boolean(id)),
    );

    const newIds = new Set(positionedGoals.map((p) => p.goal.id));

    // Remove cards that are no longer scheduled
    existingIds.forEach((id) => {
      if (!newIds.has(id)) {
        const cached = this.cachedCards.get(id);
        if (cached) {
          cached.element.remove();
          this.cachedCards.delete(id);
        }
      }
    });

    // Add or update cards
    positionedGoals.forEach((positioned) => {
      const { goal, lane, startPct, durPct } = positioned;
      const cached = this.cachedCards.get(goal.id);

      if (cached && existingIds.has(goal.id)) {
        // Update existing card
        const style = `--start:${startPct.toFixed(4)};--dur:${durPct.toFixed(4)};--lane:${lane};`;
        cached.element.setAttribute("style", style);
        this.cardComponent.updateElement(cached.element, goal);
      } else {
        // Create new card
        const style = `--start:${startPct.toFixed(4)};--dur:${durPct.toFixed(4)};--lane:${lane};`;
        const cardEl = this.cardComponent.createElement(goal, { variant: "planter", style });

        if (this.dayBedCanvas) {
          this.dayBedCanvas.appendChild(cardEl);

          this.cachedCards.set(goal.id, {
            element: cardEl,
            goalId: goal.id,
            hash: this.hashGoal(goal),
          });
        }
      }
    });

    // Empty message is now handled in HTML template via conditional rendering
  }

  private updateCompost(completedGoals: Goal[]): void {
    // For now, simple re-render
    // Could be optimized with proper diffing
    const compostSection = this.container.querySelector(".day-compost");
    if (completedGoals.length === 0) {
      compostSection?.remove();
    } else if (!compostSection) {
      // Need to add compost section
      this.renderCompostSection(completedGoals);
    } else {
      // Update existing
      this.renderCompost(completedGoals);
    }
  }

  private updateTimelineGrid(): void {
    const gridEl = this.container.querySelector(".day-timeline .day-bed-grid") as HTMLElement;
    if (gridEl) {
      this.timelineGrid.updateElement(gridEl);
    }
  }

  private renderSeedTray(seedGoals: Goal[]): void {
    if (!this.seedTrayGrid) return;

    if (seedGoals.length === 0) {
      this.seedTrayGrid.innerHTML = `
        <div class="seed-tray-empty">
          Leave this empty if you need breathing room.
        </div>
      `;
    } else {
      const fragment = document.createDocumentFragment();
      seedGoals.forEach((goal) => {
        const cardEl = this.cardComponent.createElement(goal, { variant: "seed" });
        fragment.appendChild(cardEl);
        this.cachedCards.set(goal.id, {
          element: cardEl,
          goalId: goal.id,
          hash: this.hashGoal(goal),
        });
      });
      this.seedTrayGrid.innerHTML = "";
      this.seedTrayGrid.appendChild(fragment);
    }
  }

  private renderCompost(completedGoals: Goal[]): void {
    if (!this.compostGrid) return;

    const fragment = document.createDocumentFragment();
    completedGoals.forEach((goal) => {
      const cardEl = this.cardComponent.createElement(goal, { variant: "compost" });
      fragment.appendChild(cardEl);
    });
    this.compostGrid.innerHTML = "";
    this.compostGrid.appendChild(fragment);
  }

  private renderCompostSection(completedGoals: Goal[]): void {
    const dayPlot = this.container.querySelector(".day-plot");
    if (!dayPlot) return;

    const section = document.createElement("div");
    section.className = "day-compost";
    section.setAttribute("role", "region");
    section.setAttribute("aria-label", "Compost (done)");
    section.innerHTML = `
      <div class="compost-header">
        <span class="compost-title">Compost</span>
        <span class="compost-subtitle">${completedGoals.length} done</span>
      </div>
      <div class="compost-grid" role="list"></div>
    `;

    dayPlot.appendChild(section);
    this.compostGrid = section.querySelector(".compost-grid");
    this.renderCompost(completedGoals);
  }

  private buildDayViewHTML(
    isToday: boolean,
    dayName: string,
    dateStr: string,
    activeCount: number,
    seedGoals: Goal[],
    positionedGoals: PositionedGoal[],
    completedGoals: Goal[],
    laneCount: number,
  ): string {
    const capacityWarning = activeCount >= 6 ? this.buildCapacityWarning() : "";
    const seedCardsHtml = seedGoals.map((g) => this.cardComponent.render(g, { variant: "seed" })).join("");
    const planterCardsHtml = positionedGoals
      .map((p) => {
        const style = `--start:${p.startPct.toFixed(4)};--dur:${p.durPct.toFixed(4)};--lane:${p.lane};`;
        return this.cardComponent.render(p.goal, { variant: "planter", style });
      })
      .join("");
    const compostCardsHtml = completedGoals.map((g) => this.cardComponent.render(g, { variant: "compost" })).join("");

    return `
      <div class="day-view ${isToday ? "is-today" : ""}">
        <div class="day-view-header">
          <h2 class="day-view-title">${dayName}</h2>
          <p class="day-view-subtitle">${dateStr}</p>
        </div>

        ${capacityWarning}

        <div class="day-content">
          <div class="day-sections" style="--lanes:${laneCount}">
            <div class="day-section day-section-unscheduled" role="region" aria-label="Unscheduled tasks">
              <div class="day-section-header">
                <span class="day-section-title">Unscheduled</span>
                ${seedGoals.length > 0 ? `<span class="day-section-count">${seedGoals.length}</span>` : ""}
              </div>
              <div class="day-section-content" role="list">
                ${seedGoals.length > 0
        ? seedCardsHtml
        : '<div class="day-section-empty">No unscheduled tasks</div>'
      }
              </div>
            </div>

            <div class="day-section day-section-scheduled" role="region" aria-label="Scheduled tasks">
              <div class="day-section-header">
                <span class="day-section-title">Scheduled</span>
                ${positionedGoals.length > 0 ? `<span class="day-section-count">${positionedGoals.length}</span>` : ""}
              </div>
              <div class="day-section-content day-timeline" role="list" aria-label="Scheduled tasks">
                ${this.timelineGrid.render()}
                ${positionedGoals.length > 0
        ? planterCardsHtml
        : '<div class="day-section-empty">No scheduled tasks. Add a start time to schedule a task.</div>'
      }
              </div>
            </div>

            ${completedGoals.length > 0
        ? `
              <div class="day-section day-section-completed" role="region" aria-label="Completed tasks">
                <div class="day-section-header">
                  <span class="day-section-title">Completed</span>
                  <span class="day-section-count">${completedGoals.length}</span>
                </div>
                <div class="day-section-content" role="list">
                  ${compostCardsHtml}
                </div>
              </div>
            `
        : ""
      }
          </div>
        </div>
      </div>
    `;
  }

  private buildCapacityWarning(): string {
    return `
      <div class="garden-capacity-warning">
        <span class="warning-icon">🌸</span>
        <div class="warning-text">
          <strong>Your garden bed is full!</strong>
          <span>Refining your fences (boundaries) helps you focus. Consider moving some blooms to tomorrow.</span>
        </div>
      </div>
    `;
  }

  private isGoalForDate(goal: Goal, date: Date): boolean {
    // This logic should match Goals.getForDate()
    // Simplified version - you may need to adjust based on actual implementation
    if (goal.dueDate) {
      const dueDate = new Date(goal.dueDate);
      return dueDate.toDateString() === date.toDateString();
    }
    return false;
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  private hashGoal(goal: Goal): string {
    // Simple hash of relevant properties
    return `${goal.id}-${goal.title}-${goal.status}-${goal.startTime}-${goal.endTime}-${goal.progress}`;
  }
}
