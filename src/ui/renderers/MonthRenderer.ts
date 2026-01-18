// ===================================
// Month View Renderer
// ===================================
import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { CONFIG, VIEWS } from "../../config";
import { expandEventsForRange } from "../../utils/recurrence";
import {
  buildAccentAttributes,
  getInheritedAccent,
} from "../../utils/goalLinkage";
import type { UIElements } from "../../types";

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
    const milestoneGoals = Goals.getForRange(monthStart, monthEnd).filter(
      (g) => g.level === "milestone" && g.status !== "done",
    );
    const primaryMilestone = milestoneGoals[0];

    const goalsById = new Map<string, any>();
    (State.data?.goals ?? []).forEach((g) => goalsById.set(g.id, g));
    const milestoneAccentAttrs = primaryMilestone
      ? buildAccentAttributes(getInheritedAccent(primaryMilestone, goalsById))
      : { dataAttr: "", styleAttr: "" };

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const _daysInMonth = lastDay.getDate();
    const _startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    const _prevMonthDays = new Date(year, month, 0).getDate();
    const isMobile = document.body.classList.contains("is-mobile");
    const dayNames = isMobile
      ? ["M", "T", "W", "T", "F", "S", "S"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
          ${(() => {
            if (primaryMilestone) {
              const icon = primaryMilestone.icon || "🎯";
              return `
                        <button type="button" class="year-vision-icon-only" ${
                          milestoneAccentAttrs.dataAttr
                        }${milestoneAccentAttrs.styleAttr} data-goal-id="${
                          primaryMilestone.id
                        }" aria-label="${escapeHtmlFn(primaryMilestone.title)}">
                          <span class="vision-icon-large">${icon}</span>
                        </button>
                      `;
            } else {
              return `
                      <button type="button" class="year-vision-icon-only year-vision-icon-only--empty" data-action="add-milestone" aria-label="Add Milestone">
                        <span class="vision-icon-large">+</span>
                      </button>
                    `;
            }
          })()}
        </div>
        <div class="month-calendar" role="grid" aria-label="Month calendar">
          <div class="month-calendar-header-row" role="row">
            ${dayNames
              .map(
                (name) =>
                  `<div class="month-calendar-header" role="columnheader">${name}</div>`,
              )
              .join("")}
          </div>
    `;

    const cellDates: Date[] = [];

    // Leading days from previous month
    // Calculate which day of the previous month should be in the Monday position
    const firstDayDate = new Date(year, month, 1);
    const daysToMonday = (firstDayDate.getDay() + 6) % 7; // How many days back to get to Monday
    const mondayOfFirstWeek = new Date(firstDayDate);
    mondayOfFirstWeek.setDate(mondayOfFirstWeek.getDate() - daysToMonday);
    
    // Fill in all days from Monday of the first week through the last day of the month
    const _currentDate = new Date(mondayOfFirstWeek);
    const lastDayDate = new Date(year, month + 1, 0); // Last day of current month
    
    // Calculate how many weeks we need (always include full weeks)
    const daysInRange = Math.ceil((lastDayDate.getTime() - mondayOfFirstWeek.getTime()) / 86400000) + 1;
    const weeksNeeded = Math.ceil(daysInRange / 7);
    const totalDays = weeksNeeded * 7;
    
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(mondayOfFirstWeek);
      date.setDate(date.getDate() + i);
      cellDates.push(date);
    }

    const gridStart =
      cellDates.length > 0 ? new Date(cellDates[0]) : monthStart;
    const gridEnd =
      cellDates.length > 0
        ? new Date(cellDates[cellDates.length - 1])
        : monthEnd;
    const eventsForGrid = State.data?.events
      ? expandEventsForRange(State.data.events, gridStart, gridEnd)
      : [];
    const startOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const addDays = (d: Date, days: number) => {
      const x = new Date(d);
      x.setDate(x.getDate() + days);
      return x;
    };
    const eventCountByYmd = new Map<string, number>();
    for (const ev of eventsForGrid) {
      const start = new Date(ev.startAt);
      const end = ev.endAt ? new Date(ev.endAt) : start;
      for (
        let cursor = startOfDay(start);
        cursor <= startOfDay(end);
        cursor = addDays(cursor, 1)
      ) {
        const key = formatYmd(cursor);
        eventCountByYmd.set(key, (eventCountByYmd.get(key) ?? 0) + 1);
      }
    }

    const renderDayCell = (date: Date) => {
      const isOtherMonth =
        date.getMonth() !== month || date.getFullYear() !== year;
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = selected && date.toDateString() === selected;
      const ymd = formatYmd(date);
      const dayNum = date.getDate();
      const eventCount = eventCountByYmd.get(ymd) ?? 0;
      return `
        <div class="month-day ${isOtherMonth ? "other-month" : ""} ${
          isToday ? "today" : ""
        } ${
          isSelected ? "selected" : ""
        }" data-date="${ymd}" role="gridcell" aria-label="${date.toDateString()}">
          <div class="month-day-number">${dayNum}</div>
          ${
            eventCount > 0
              ? `<div class="month-day-events-badge" aria-label="${eventCount} events">${eventCount}</div>`
              : ``
          }
          <div class="month-day-goals"></div>
        </div>
      `;
    };

    for (let idx = 0; idx < cellDates.length; idx += 7) {
      const weekDates = cellDates.slice(idx, idx + 7);
      if (weekDates.length < 7) break;

      const weekStart = new Date(weekDates[0]);
      const weekEnd = new Date(weekDates[6]);

      const focusGoals = Goals.getForRange(weekStart, weekEnd).filter(
        (g) => g.level === "focus" && g.status !== "done",
      );
      const primaryFocus = focusGoals[0];

      html += `
        <div class="month-week-row${
          primaryFocus ? " has-focus" : ""
        }" role="row">
          ${weekDates.map(renderDayCell).join("")}
          ${
            primaryFocus
              ? `
            <div class="month-week-focus-banner" aria-label="This week focus">
              <span class="month-week-focus-icon">${primaryFocus.icon || "🔎"}</span>
              <span class="month-week-focus-text">This week: ${escapeHtmlFn(
                primaryFocus.title,
              )}</span>
              <button type="button" class="month-week-focus-edit" data-goal-id="${
                primaryFocus.id
              }" aria-label="Edit focus">
                Edit
              </button>
            </div>
          `
              : ""
          }
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Add click handlers for day cells
    container
      .querySelectorAll<HTMLElement>(".month-day[data-date]")
      .forEach((cell) => {
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
    container.querySelectorAll<HTMLElement>("[data-goal-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const goalId = btn.dataset.goalId;
        if (goalId) {
          const event = new CustomEvent("goal-click", { detail: { goalId } });
          container.dispatchEvent(event);
        }
      });
    });

    const addMilestoneBtn = container.querySelector<HTMLButtonElement>(
      '[data-action="add-milestone"]',
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

    container
      .querySelectorAll<HTMLButtonElement>(
        ".month-week-focus-edit[data-goal-id]",
      )
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const goalId = btn.dataset.goalId;
          if (!goalId) return;
          const event = new CustomEvent("goal-click", { detail: { goalId } });
          container.dispatchEvent(event);
        });
      });
  },
};
