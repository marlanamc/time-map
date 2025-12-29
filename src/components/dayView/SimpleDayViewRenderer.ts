import type { Goal } from "../../types";
import { CardComponent } from "./CardComponent";

export class SimpleDayViewRenderer {
  private container: HTMLElement;
  private cardComponent: CardComponent;
  private currentDate: Date | null = null;

  constructor(
    container: HTMLElement,
    cardComponent: CardComponent,
  ) {
    this.container = container;
    this.cardComponent = cardComponent;
    // this.callbacks = callbacks;
  }

  renderInitial(date: Date, allGoals: Goal[]): void {
    this.currentDate = date;
    const dayGoals = allGoals.filter((g) => this.isGoalForDate(g, date));

    const isToday = this.isToday(date);
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Buckets
    const unscheduled = dayGoals.filter(g => g.status !== 'done' && !g.startTime);
    const scheduled = dayGoals.filter(g => g.status !== 'done' && g.startTime);
    const completed = dayGoals.filter(g => g.status === 'done');

    // Categorize scheduled goals
    const morning = scheduled.filter(g => this.getTimeBucket(g.startTime!) === 'morning');
    const afternoon = scheduled.filter(g => this.getTimeBucket(g.startTime!) === 'afternoon');
    const evening = scheduled.filter(g => this.getTimeBucket(g.startTime!) === 'evening');
    const night = scheduled.filter(g => this.getTimeBucket(g.startTime!) === 'night');

    const html = `
      <div class="day-view simple-day-view ${isToday ? "is-today" : ""}">
        <div class="day-view-header">
          <h2 class="day-view-title">${dayName}</h2>
          <p class="day-view-subtitle">${dateStr}</p>
        </div>

        <div class="simple-day-content">
          ${this.renderSection("Unscheduled", unscheduled, "🌱")}
          ${this.renderSection("Morning", morning, "🌅")}
          ${this.renderSection("Afternoon", afternoon, "☀️")}
          ${this.renderSection("Evening", evening, "🌆")}
          ${this.renderSection("Night", night, "🌙")}
          ${completed.length > 0 ? this.renderSection("Completed", completed, "✅", "completed") : ""}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.container.className = "day-view-container simple-style";
  }

  update(date: Date, allGoals: Goal[]): void {
    // For simple view, full re-render is fine for now as it's just lists
    this.renderInitial(date, allGoals);
  }

  updateCard(_goalId: string, _goal: Goal): void {
    // Refresh the whole view to ensure correct bucket placement
    if (this.currentDate) {
      // This is a bit heavy, but ensures UI consistency
      // In a real app we'd trigger a re-render from the controller
    }
  }

  clearCaches(): void {
    // No specific caches in simple renderer yet
  }

  private renderSection(title: string, goals: Goal[], icon: string, extraClass: string = ""): string {
    if (goals.length === 0 && title !== "Unscheduled" && title !== "Morning" && title !== "Afternoon") return "";

    const cardsHtml = goals.length > 0
      ? goals.map(g => this.cardComponent.render(g, { variant: "seed" })).join("")
      : `<div class="simple-section-empty">Nothing here yet</div>`;

    return `
      <section class="simple-day-section ${extraClass}">
        <div class="simple-section-header">
          <span class="simple-section-icon">${icon}</span>
          <span class="simple-section-title">${title}</span>
          <span class="simple-section-count">${goals.length}</span>
        </div>
        <div class="simple-section-content">
          ${cardsHtml}
        </div>
      </section>
    `;
  }

  private getTimeBucket(timeStr: string): 'morning' | 'afternoon' | 'evening' | 'night' {
    const [hours] = timeStr.split(':').map(Number);
    if (hours >= 5 && hours < 12) return 'morning';
    if (hours >= 12 && hours < 17) return 'afternoon';
    if (hours >= 17 && hours < 22) return 'evening';
    return 'night';
  }

  private isGoalForDate(goal: Goal, date: Date): boolean {
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
}
