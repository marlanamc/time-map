// ===================================
// Month View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { CONFIG, VIEWS } from '../../config';
import type { UIElements } from '../../types';

export const MonthRenderer = {
  render(elements: UIElements, escapeHtmlFn: (text: string) => string) {
    const container = elements.calendarGrid;
    if (!container) return;

    container.className = "month-view-container";

    const year = State.viewingYear;
    const month = State.viewingMonth;
    const today = new Date();
    const selected = State.viewingDate ? State.viewingDate.toDateString() : "";
    const monthTitle = escapeHtmlFn(`${CONFIG.MONTHS[month]} ${year}`);

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const milestoneGoals = Goals.getForRange(monthStart, monthEnd)
      .filter(g => g.level === 'milestone' && g.status !== 'done');
    const primaryMilestone = milestoneGoals[0];

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    const prevMonthDays = new Date(year, month, 0).getDate();
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const formatYmd = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    let html = `<div class="month-view">`;

    html += `
        <div class="month-view-header">
          <h2 class="month-view-title">${monthTitle}</h2>
        </div>
        <div class="month-milestone-banner year-vision-banner--pill">
          ${primaryMilestone ? `
            <button type="button" class="year-vision-pill year-vision-pill--cosmic year-vision-pill--milestone month-milestone-pill" data-goal-id="${primaryMilestone.id}">
              <span class="year-vision-pill-label" aria-label="Milestone">
                <span class="year-vision-pill-dot" aria-hidden="true"></span>
                MILESTONE
              </span>
              <span class="year-vision-pill-title">${escapeHtmlFn(primaryMilestone.title)}</span>
            </button>
          ` : `
            <button type="button" class="year-vision-pill year-vision-pill--cosmic year-vision-pill--milestone year-vision-pill--empty month-milestone-pill month-milestone-pill--empty" data-action="add-milestone">
              <span class="year-vision-pill-label" aria-label="Milestone">
                <span class="year-vision-pill-dot" aria-hidden="true"></span>
                MILESTONE
              </span>
              <span class="year-vision-pill-title">+ Add Milestone</span>
            </button>
          `}
        </div>
        <div class="month-calendar" role="grid" aria-label="Month calendar">
          <div class="month-calendar-header-row" role="row">
            ${dayNames
              .map((name) => `<div class="month-calendar-header" role="columnheader">${name}</div>`)
              .join("")}
          </div>
    `;

    const cellDates: Date[] = [];

    // Leading days from previous month
    for (let i = 0; i < startDayOfWeek; i++) {
      const dayNum = prevMonthDays - startDayOfWeek + i + 1;
      cellDates.push(new Date(year, month - 1, dayNum));
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      cellDates.push(new Date(year, month, day));
    }

    // Trailing days from next month to complete the last week row
    const totalCells = startDayOfWeek + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      cellDates.push(new Date(year, month + 1, i));
    }

    const renderDayCell = (date: Date) => {
      const isOtherMonth = date.getMonth() !== month || date.getFullYear() !== year;
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = selected && date.toDateString() === selected;
      const ymd = formatYmd(date);
      const dayNum = date.getDate();
      return `
        <div class="month-day ${isOtherMonth ? "other-month" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${ymd}" role="gridcell" aria-label="${date.toDateString()}">
          <div class="month-day-number">${dayNum}</div>
          <div class="month-day-goals"></div>
        </div>
      `;
    };

    for (let idx = 0; idx < cellDates.length; idx += 7) {
      const weekDates = cellDates.slice(idx, idx + 7);
      if (weekDates.length < 7) break;

      const weekStart = new Date(weekDates[0]);
      const weekEnd = new Date(weekDates[6]);

      const focusGoals = Goals.getForRange(weekStart, weekEnd)
        .filter((g) => g.level === "focus" && g.status !== "done");
      const primaryFocus = focusGoals[0];

      html += `
        <div class="month-week-row${primaryFocus ? " has-focus" : ""}" role="row">
          ${primaryFocus ? `
            <div class="month-week-focus-banner" aria-label="This week focus">
              <span class="month-week-focus-text">This week: ${escapeHtmlFn(primaryFocus.title)}</span>
              <button type="button" class="month-week-focus-edit" data-goal-id="${primaryFocus.id}" aria-label="Edit focus">
                Edit
              </button>
            </div>
          ` : ""}
          ${weekDates.map(renderDayCell).join("")}
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Add click handlers for day cells
    container.querySelectorAll<HTMLElement>(".month-day[data-date]").forEach((cell) => {
      cell.addEventListener("click", () => {
        const iso = cell.dataset.date;
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

    // Add click handlers for the milestone chip
    container.querySelectorAll<HTMLElement>('[data-goal-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const goalId = btn.dataset.goalId;
        if (goalId) {
          const event = new CustomEvent('goal-click', { detail: { goalId } });
          container.dispatchEvent(event);
        }
      });
    });

    const addMilestoneBtn = container.querySelector<HTMLButtonElement>(
      '[data-action="add-milestone"]'
    );
    if (addMilestoneBtn) {
      addMilestoneBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const event = new CustomEvent("open-goal-modal", {
          detail: { level: "milestone", month, year },
        });
        container.dispatchEvent(event);
      });
    }

    container.querySelectorAll<HTMLButtonElement>('.month-week-focus-edit[data-goal-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const goalId = btn.dataset.goalId;
        if (!goalId) return;
        const event = new CustomEvent('goal-click', { detail: { goalId } });
        container.dispatchEvent(event);
      });
    });
  }
};
