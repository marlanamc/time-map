import type { Goal } from "../../types";
import { CardComponent } from "./CardComponent";
import { TimeSlotCalculator } from "./TimeSlotCalculator";
import { TimelineGrid } from "./TimelineGrid";

export class PlannerDayViewRenderer {
  private container: HTMLElement;
  // private cardComponent: CardComponent;
  private calculator: TimeSlotCalculator;
  private timelineGrid: TimelineGrid;

  constructor(
    container: HTMLElement,
    _cardComponent: CardComponent,
    calculator: TimeSlotCalculator,
    timelineGrid: TimelineGrid
  ) {
    this.container = container;
    // this.cardComponent = cardComponent;
    this.calculator = calculator;
    this.timelineGrid = timelineGrid;
  }

  renderInitial(date: Date, allGoals: Goal[]): void {
    const dayGoals = allGoals.filter((g) => this.isGoalForDate(g, date));

    // Split goals
    const unscheduled = dayGoals.filter(g => g.status !== 'done' && !g.startTime);
    const scheduled = dayGoals.filter(g => g.status !== 'done' && g.startTime);
    // const completed = dayGoals.filter(g => g.status === 'done');

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

    const dayName = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const html = `
      <div class="day-view planner-day-view">
        <aside class="planner-sidebar">
          <div class="planner-sidebar-header">
            <h3>Day</h3>
            <div class="planner-sidebar-actions">
                <button class="btn-icon">📅</button>
                <button class="btn-icon">🎨</button>
                <button class="btn-icon">🔍</button>
                <button class="btn-icon btn-planner-add">+</button>
            </div>
          </div>

          <div class="planner-date-select">
            <span class="planner-current-date">${dayName}</span>
            <div class="planner-date-nav">
                <button class="btn-icon btn-planner-prev">‹</button>
                <button class="btn-icon btn-planner-next">›</button>
            </div>
          </div>

          <div class="planner-sidebar-section">
            <div class="section-title">☁️ Task cloud</div>
            <div class="task-cloud-grid">
              ${unscheduled.map(g => this.renderSidebarItem(g)).join('')}
              ${unscheduled.length === 0 ? '<div class="empty-cloud">No tasks in cloud</div>' : ''}
            </div>
          </div>

          <div class="planner-sidebar-section">
            <div class="section-title">🌱 Ongoing tasks</div>
            <div class="sidebar-list">
              ${ongoing.map(g => this.renderSidebarItem(g, true)).join('')}
              ${ongoing.length === 0 ? '<div class="empty-list">No ongoing tasks</div>' : ''}
            </div>
          </div>

          <div class="planner-sidebar-section">
            <div class="section-title">🔍 Upcoming tasks</div>
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

  update(date: Date, allGoals: Goal[]): void {
    this.renderInitial(date, allGoals);
  }

  updateCard(_goalId: string, _goal: Goal): void {
    // Re-render for simplicity and consistency
  }

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
          <button class="btn-zen-focus btn-icon" data-goal-id="${goal.id}" title="Focus">👁️</button>
          <button class="btn-icon btn-planner-remove" data-goal-id="${goal.id}" title="Remove from timeline">➖</button>
        </div>
      </div>
    `;
  }

  private isGoalForDate(goal: Goal, date: Date): boolean {
    if (goal.dueDate) {
      const dueDate = new Date(goal.dueDate);
      return dueDate.toDateString() === date.toDateString();
    }
    return false;
  }

  private getCategoryEmoji(catId: string): string {
    // This should ideally come from CONFIG, but keeping it simple for now
    const map: Record<string, string> = {
      'cycling': '🚴',
      'workout': '🏋️',
      'family': '🏠',
      'boating': '⛵',
      'movie': '🎬',
      'reading': '📚',
      'dog': '🐕',
      'cardio': '🏃',
      'cooking': '🍳',
      'self-care': '🧘',
      'gardening': '🪴',
      'skating': '⛸️',
      'video': '📹',
      'tennis': '🎾',
      'surfing': '🏄'
    };
    return map[catId] || '📍';
  }
}
