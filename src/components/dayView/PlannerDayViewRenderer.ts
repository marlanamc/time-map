import type { Goal } from "../../types";
import { CardComponent } from "./CardComponent";
import { TimeSlotCalculator } from "./TimeSlotCalculator";
import { TimelineGrid } from "./TimelineGrid";
import { CONFIG } from "../../config/constants";

/**
 * Renderer for the Planner-style day view
 * @remarks Displays goals in a planner layout with a sidebar showing task cloud,
 * ongoing tasks, and upcoming tasks, alongside a timeline view for scheduled items.
 */
export class PlannerDayViewRenderer {
  private container: HTMLElement;
  private calculator: TimeSlotCalculator;
  private timelineGrid: TimelineGrid;

  /**
   * Generate SVG icon markup
   * @param name - The icon type to generate
   * @returns SVG markup as a string
   * @private
   */
  private icon(name: "plus" | "eye" | "minus"): string {
    if (name === "plus") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      `;
    }
    if (name === "minus") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      `;
    }
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" fill="none" stroke="currentColor" stroke-width="2" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
    `;
  }

  /**
   * Creates a new PlannerDayViewRenderer instance
   * @param container - The DOM element that will contain the planner view
   * @param _cardComponent - Card component for rendering (unused but kept for interface compatibility)
   * @param calculator - Time slot calculator for timeline positioning
   * @param timelineGrid - Timeline grid renderer
   */
  constructor(
    container: HTMLElement,
    _cardComponent: CardComponent,
    calculator: TimeSlotCalculator,
    timelineGrid: TimelineGrid
  ) {
    this.container = container;
    this.calculator = calculator;
    this.timelineGrid = timelineGrid;
  }

  /**
   * Render the initial planner view
   * @param date - The date to display
   * @param allGoals - All goals in the system (will be filtered for this date)
   * @remarks Creates a complete planner layout with sidebar sections for
   * unscheduled tasks, ongoing tasks, and upcoming tasks, plus a timeline.
   */
  renderInitial(date: Date, allGoals: Goal[]): void {
    const dayGoals = allGoals
      .filter((g) => this.isGoalForDate(g, date))
      .filter((g) => g.level === "intention");

    // Split goals
    const unscheduled = dayGoals.filter(g => g.status !== 'done' && !g.startTime);
    const scheduled = dayGoals.filter(g => g.status !== 'done' && g.startTime);

    // Group scheduled by "Ongoing" (started before now) and "Upcoming" (starting later)
    // Actually, following the user image: "Task cloud", "Ongoing tasks", "Upcoming tasks"
    // Unscheduled = Task cloud
    // Scheduled = Ongoing + Upcoming
    const nowMinutes = this.calculator.getCurrentTimeMinutes();

    const ongoing = scheduled.filter(g => {
      const startMin = this.calculator.parseTimeToMinutes(g.startTime) || 0;
      const endMin = (this.calculator.parseTimeToMinutes(g.endTime) || startMin + 60);
      return nowMinutes >= startMin && nowMinutes < endMin;
    });

    const upcoming = scheduled.filter(g => {
      const startMin = this.calculator.parseTimeToMinutes(g.startTime) || 0;
      return startMin > nowMinutes;
    });

    // Format date as "Monday, December 29th"
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const day = date.getDate();
    const ordinal = day % 10 === 1 && day !== 11 ? "st" :
                    day % 10 === 2 && day !== 12 ? "nd" :
                    day % 10 === 3 && day !== 13 ? "rd" : "th";
    const dayName = `${weekday}, ${month} ${day}${ordinal}`;

    const html = `
      <div class="day-view planner-day-view">
        <aside class="planner-sidebar">
          <div class="planner-sidebar-header">
            <h3>${dayName}</h3>
          </div>
          <div class="planner-sidebar-actions">
            <div class="planner-date-nav" role="group" aria-label="Day navigation">
              <button class="btn-icon btn-planner-prev" type="button" aria-label="Previous day" title="Previous day">‹</button>
              <button class="btn-icon btn-planner-next" type="button" aria-label="Next day" title="Next day">›</button>
            </div>
            <button class="btn-icon btn-planner-add" type="button" aria-label="Add task" title="Add task">
              ${this.icon("plus")}
            </button>
          </div>

          <div class="planner-sidebar-section">
            <div class="section-title">Task cloud</div>
            <div class="task-cloud-grid">
              ${unscheduled.map(g => this.renderSidebarItem(g)).join('')}
              ${unscheduled.length === 0 ? '<div class="empty-cloud">No tasks in cloud</div>' : ''}
            </div>
          </div>

          <div class="planner-sidebar-section">
            <div class="section-title">Ongoing tasks</div>
            <div class="sidebar-list">
              ${ongoing.map(g => this.renderSidebarItem(g, true)).join('')}
              ${ongoing.length === 0 ? '<div class="empty-list">No ongoing tasks</div>' : ''}
            </div>
          </div>

          <div class="planner-sidebar-section">
            <div class="section-title">Upcoming tasks</div>
            <div class="sidebar-list">
              ${upcoming.map(g => this.renderSidebarItem(g, true)).join('')}
              ${upcoming.length === 0 ? '<div class="empty-list">No upcoming tasks</div>' : ''}
            </div>
          </div>
        </aside>

        <main class="planner-main">
          <div class="planner-timeline-container">
            ${this.timelineGrid.render()}
            <div class="planner-timeline-content">
              ${scheduled.map(g => this.renderTimedTask(g)).join('')}
            </div>
          </div>
        </main>
      </div>
    `;

    this.container.innerHTML = html;
    this.container.className = "day-view-container planner-style";
  }

  /**
   * Update the planner view with new data
   * @param date - The date to display
   * @param allGoals - All goals in the system
   * @remarks Currently performs a full re-render for simplicity
   */
  update(date: Date, allGoals: Goal[]): void {
    this.renderInitial(date, allGoals);
  }

  /**
   * Update a single goal card
   * @param _goalId - The ID of the goal to update (unused)
   * @param _goal - The updated goal data (unused)
   * @remarks Currently a no-op. Updates are handled via full re-render for consistency.
   */
  updateCard(_goalId: string, _goal: Goal): void {
    // Re-render for simplicity and consistency
  }

  /**
   * Render a sidebar item (task in cloud, ongoing, or upcoming)
   * @param goal - The goal to render
   * @param showTime - Whether to display the time range
   * @returns HTML string for the sidebar item
   * @private
   */
  private renderSidebarItem(goal: Goal, showTime: boolean = false): string {
    const emoji = goal.category ? this.getCategoryEmoji(goal.category) : '📍';
    const timeStr = showTime ? `<span class="sidebar-item-time">${goal.startTime} - ${goal.endTime || ''}</span>` : '';

    return `
      <div class="day-goal-card sidebar-item ${goal.status === 'done' ? 'completed' : ''}" data-goal-id="${goal.id}">
        <div class="day-goal-checkbox ${goal.status === 'done' ? 'checked' : ''}"></div>
        <span class="sidebar-item-emoji">${emoji}</span>
        <span class="sidebar-item-title">${goal.title}</span>
        ${timeStr}
      </div>
    `;
  }

  /**
   * Render a timed task on the timeline
   * @param goal - The goal to render
   * @returns HTML string for the timed task card
   * @private
   */
  private renderTimedTask(goal: Goal): string {
    const startMin = this.calculator.parseTimeToMinutes(goal.startTime) || 0;
    const endMin = this.calculator.parseTimeToMinutes(goal.endTime) || startMin + 60;
    const duration = endMin - startMin;
    const top = this.calculator.minutesToPercent(startMin);
    const durPct = (duration / this.calculator.getPlotRangeMin()) * 100;

    const emoji = goal.category ? this.getCategoryEmoji(goal.category) : '📍';
    const colorClass = goal.category ? `cat-${goal.category}` : 'cat-default';

    return `
        <div class="day-goal-card planner-timed-task ${colorClass}" style="top: ${top}%; height: ${durPct}%;" data-goal-id="${goal.id}">
        <div class="day-goal-checkbox ${goal.status === 'done' ? 'checked' : ''}"></div>
        <div class="timed-task-content">
          <span class="timed-task-emoji">${emoji}</span>
          <span class="timed-task-title">${goal.title}</span>
        </div>
        <div class="timed-task-actions">
          <button class="btn-zen-focus btn-icon" type="button" data-goal-id="${goal.id}" aria-label="Focus" title="Focus">${this.icon("eye")}</button>
          <button class="btn-icon btn-planner-remove" type="button" data-goal-id="${goal.id}" aria-label="Remove from timeline" title="Remove from timeline">${this.icon("minus")}</button>
        </div>
      </div>
    `;
  }

  /**
   * Check if a goal belongs to a specific date
   * @param goal - The goal to check
   * @param date - The target date
   * @returns True if the goal's due date matches the target date
   * @private
   */
  private isGoalForDate(goal: Goal, date: Date): boolean {
    if (goal.dueDate) {
      const dueDate = new Date(goal.dueDate);
      return dueDate.toDateString() === date.toDateString();
    }
    return false;
  }

  /**
   * Get the emoji for a category or activity
   * @param catId - The category or activity identifier
   * @returns The emoji character, or a default pin emoji if not found
   * @private
   */
  private getCategoryEmoji(catId: string): string {
    // First check activity-specific emojis
    if (CONFIG.ACTIVITY_EMOJIS[catId]) {
      return CONFIG.ACTIVITY_EMOJIS[catId];
    }
    // Fall back to main category emojis
    if (CONFIG.CATEGORIES[catId as keyof typeof CONFIG.CATEGORIES]) {
      return CONFIG.CATEGORIES[catId as keyof typeof CONFIG.CATEGORIES].emoji;
    }
    // Default fallback
    return '📍';
  }
}
