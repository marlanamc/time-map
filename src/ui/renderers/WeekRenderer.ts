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
    // Use ISO week year, not calendar year (important for late Dec/early Jan)
    const viewingDate = State.viewingDate || new Date();
    const weekYear = State.getWeekYear(viewingDate);
    const weekStart = State.getWeekStart(weekYear, weekNum);
    const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
    const today = new Date();
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const visionGoals = Goals.getForRange(new Date(weekStart.getFullYear(), 0, 1), new Date(weekStart.getFullYear(), 11, 31))
      .filter((g) => g.level === "vision" && g.status !== "done");
    const primaryVision = visionGoals[0];

    const focusGoals = Goals.getForRange(weekStart, weekEnd)
      .filter((g) => g.level === "focus" && g.status !== "done")
      .slice(0, 2);

    // Format date range with years if they differ
    const startYear = weekStart.getFullYear();
    const endYear = weekEnd.getFullYear();
    const startFormatted = weekStart.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: startYear !== endYear ? "numeric" : undefined
    });
    const endFormatted = weekEnd.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });

    let html = `<div class="week-view">
        <div class="week-view-header">
          <h2 class="week-view-title">Week ${weekNum}</h2>
          <p class="week-view-range">${startFormatted} - ${endFormatted}</p>
          ${primaryVision ? `
            <div class="week-vision-strip" aria-label="Year vision">
              <span class="week-vision-label">✨ Vision</span>
              <button type="button" class="week-vision-chip" data-goal-id="${primaryVision.id}" title="${escapeHtmlFn(primaryVision.title)}">
                ${escapeHtmlFn(primaryVision.title)}
                ${visionGoals.length > 1 ? `<span class="week-vision-more">+${visionGoals.length - 1}</span>` : ""}
              </button>
            </div>
          ` : ""}
          ${focusGoals.length > 0 ? `
            <div class="week-focus-strip" aria-label="Week focus">
              <span class="week-focus-label">🔎 Focus</span>
              <div class="week-focus-chips">
                ${focusGoals.map((g) => `
                  <button type="button" class="week-focus-chip" data-goal-id="${g.id}" title="${escapeHtmlFn(g.title)}">
                    ${escapeHtmlFn(g.title)}
                  </button>
                `).join("")}
              </div>
            </div>
          ` : ""}
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

    // Click handlers for focus chips
    container.querySelectorAll('.week-focus-chip[data-goal-id]').forEach((chip: Element) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const goalId = (chip as HTMLElement).dataset.goalId;
        if (goalId) {
          const event = new CustomEvent('goal-click', { detail: { goalId } });
          container.dispatchEvent(event);
        }
      });
    });

    // Click handler for vision chip
    container.querySelectorAll('.week-vision-chip[data-goal-id]').forEach((chip: Element) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const goalId = (chip as HTMLElement).dataset.goalId;
        if (goalId) {
          const event = new CustomEvent('goal-click', { detail: { goalId } });
          container.dispatchEvent(event);
        }
      });
    });
  }
};
