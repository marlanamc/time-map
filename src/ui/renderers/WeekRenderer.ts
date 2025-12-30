// ===================================
// Week View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { CONFIG } from '../../config';
import type { UIElements } from '../../types';

export const WeekRenderer = {
  render(elements: UIElements, escapeHtmlFn: (text: string) => string) {
    const container = elements.calendarGrid;
    if (!container) return;

    container.className = "week-view-container";

    const weekNum = State.viewingWeek ?? 1;
    const weekStart = State.getWeekStart(State.viewingYear, weekNum);
    const today = new Date();
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    let html = `<div class="week-view">
        <div class="week-view-header">
          <h2 class="week-view-title">Week ${weekNum}</h2>
          <p class="week-view-range">${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
        <div class="week-grid">
      `;

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();
      const dayGoals = Goals.getForDate(date)
        .filter((g) => g.level === "intention")
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title));

      html += `
          <div class="week-day-column ${isToday ? 'today' : ''}">
            <div class="week-day-header">
              <div class="week-day-name">${dayNames[i]}</div>
              <div class="week-day-date">${date.getDate()}</div>
            </div>
            <div class="week-day-goals">
      `;

      if (dayGoals.length > 0) {
        dayGoals.forEach(g => {
          const cat = g.category ? (CONFIG.CATEGORIES[g.category] ?? null) : null;
          const completedClass = g.status === "done" ? "completed" : "";
          html += `
              <div class="week-goal-item ${completedClass}" data-goal-id="${g.id}" role="button" tabindex="0">
                <div class="week-goal-title">
                  ${g.status === "done" ? '<span class="goal-checkmark">✓</span>' : ""}
                  ${escapeHtmlFn(g.title)}
                </div>
                ${cat ? `<div class="week-goal-category">${cat.emoji} ${cat.label}</div>` : ""}
              </div>
          `;
        });
      } else {
        html += `<div class="week-day-empty">No intention</div>`;
      }

      html += `
            </div>
          </div>
      `;
    }

    html += `
        </div>
      </div>`;

    container.innerHTML = html;

    // Add click handlers for goal items
    container.querySelectorAll('.week-goal-item[data-goal-id]').forEach((card: Element) => {
      card.addEventListener('click', () => {
        const goalId = (card as HTMLElement).dataset.goalId;
        if (goalId) {
          // Trigger goal detail (callback needed)
          const event = new CustomEvent('goal-click', { detail: { goalId } });
          container.dispatchEvent(event);
        }
      });
    });
  }
};
