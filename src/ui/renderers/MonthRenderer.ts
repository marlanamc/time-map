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

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const visionGoals = Goals.getForRange(yearStart, yearEnd)
      .filter(g => g.level === 'vision' && g.status !== 'done');
    const primaryVision = visionGoals[0];

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
          ${primaryVision ? `
            <div class="month-view-context">
              <button type="button" class="month-vision-chip" data-goal-id="${primaryVision.id}" title="${escapeHtmlFn(primaryVision.title)}">
                ✨ ${escapeHtmlFn(primaryVision.title)}
                ${visionGoals.length > 1 ? `<span class="month-vision-more">+${visionGoals.length - 1}</span>` : ""}
              </button>
            </div>
          ` : ""}
          ${primaryMilestone ? `
            <div class="month-view-context">
              <button type="button" class="month-milestone-chip" data-goal-id="${primaryMilestone.id}" title="${escapeHtmlFn(primaryMilestone.title)}">
                🎯 ${escapeHtmlFn(primaryMilestone.title)}
                ${milestoneGoals.length > 1 ? `<span class="month-milestone-more">+${milestoneGoals.length - 1}</span>` : ""}
              </button>
            </div>
          ` : ""}
        </div>
        <div class="month-calendar" role="grid" aria-label="Month calendar">
          ${dayNames
            .map((name) => `<div class="month-calendar-header" role="columnheader">${name}</div>`)
            .join("")}
    `;

    // Leading days from previous month
    for (let i = 0; i < startDayOfWeek; i++) {
      const dayNum = prevMonthDays - startDayOfWeek + i + 1;
      const date = new Date(year, month - 1, dayNum);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = selected && date.toDateString() === selected;
      const ymd = formatYmd(date);

      html += `
        <div class="month-day other-month ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${ymd}" role="gridcell" aria-label="${date.toDateString()}">
          <div class="month-day-number">${dayNum}</div>
          <div class="month-day-goals"></div>
        </div>
      `;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = selected && date.toDateString() === selected;
      const ymd = formatYmd(date);

      html += `
        <div class="month-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${ymd}" role="gridcell" aria-label="${date.toDateString()}">
          <div class="month-day-number">${day}</div>
          <div class="month-day-goals"></div>
        </div>
      `;
    }

    // Trailing days from next month to complete the last week row
    const totalCells = startDayOfWeek + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      const date = new Date(year, month + 1, i);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = selected && date.toDateString() === selected;
      const ymd = formatYmd(date);

      html += `
        <div class="month-day other-month ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${ymd}" role="gridcell" aria-label="${date.toDateString()}">
          <div class="month-day-number">${i}</div>
          <div class="month-day-goals"></div>
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
    container.querySelectorAll<HTMLElement>('.month-view-header [data-goal-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const goalId = btn.dataset.goalId;
        if (goalId) {
          const event = new CustomEvent('goal-click', { detail: { goalId } });
          container.dispatchEvent(event);
        }
      });
    });
  }
};
