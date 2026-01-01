// ===================================
// Week View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { CONFIG, VIEWS } from '../../config';
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
    const formatYmd = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const visionGoals = Goals.getForRange(new Date(weekStart.getFullYear(), 0, 1), new Date(weekStart.getFullYear(), 11, 31))
      .filter((g) => g.level === "vision" && g.status !== "done");
    const primaryVision = visionGoals[0];

    const focusGoals = Goals.getForRange(weekStart, weekEnd)
      .filter((g) => g.level === "focus" && g.status !== "done")
      .slice();
    const primaryFocus = focusGoals[0];
    const additionalFocusCount = Math.max(0, focusGoals.length - 1);

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

    const weekStartYmd = formatYmd(weekStart);

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
          <div class="week-focus-card" aria-label="Week focus">
            <div class="week-focus-card-body">
              <div class="week-focus-card-label">This week’s focus</div>
              <div class="week-focus-card-title">${primaryFocus ? escapeHtmlFn(primaryFocus.title) : "No focus set"}</div>
            </div>
            <div class="week-focus-card-right">
              ${additionalFocusCount > 0 ? `<div class="week-focus-card-meta">+${additionalFocusCount} more</div>` : ""}
              ${primaryFocus ? `
                <button type="button" class="week-focus-card-action" data-action="edit" data-goal-id="${primaryFocus.id}">
                  Edit
                </button>
              ` : `
                <button type="button" class="week-focus-card-action" data-action="add" data-date="${weekStartYmd}">
                  Add
                </button>
              `}
            </div>
          </div>
        </div>
        <div class="week-grid">
      `;

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();
      const ymd = formatYmd(date);
      const dayGoals = Goals.getForDate(date)
        .filter((g) => g.level === "intention")
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title));

      html += `
          <div class="week-day-column ${isToday ? 'today' : ''}">
            <div class="week-day-header">
              <button type="button" class="week-day-jump" data-date="${ymd}" aria-label="Open ${date.toDateString()}">
                <span class="week-day-name">${dayNames[i]}</span>
                <span class="week-day-date">${date.getDate()}</span>
              </button>
              ${dayGoals.length > 0 ? `<div class="week-day-badge" aria-label="${dayGoals.length} intentions">${dayGoals.length}</div>` : ""}
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

    container.querySelectorAll<HTMLButtonElement>('.week-focus-card-action[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'edit') {
          const goalId = btn.dataset.goalId;
          if (!goalId) return;
          const event = new CustomEvent('goal-click', { detail: { goalId } });
          container.dispatchEvent(event);
          return;
        }
        if (action === 'add') {
          const date = btn.dataset.date ?? weekStartYmd;
          const event = new CustomEvent('goal-create', { detail: { level: "focus", date } });
          container.dispatchEvent(event);
        }
      });
    });

    // Navigate to the day view when tapping a day header.
    container.querySelectorAll<HTMLElement>('.week-day-jump[data-date]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const iso = btn.dataset.date;
        if (!iso) return;
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
        if (!match) return;
        const y = Number(match[1]);
        const m = Number(match[2]) - 1;
        const d = Number(match[3]);
        State.goToDate(new Date(y, m, d));
        State.setView(VIEWS.DAY);
      });
    });

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
