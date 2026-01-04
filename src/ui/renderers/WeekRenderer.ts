// ===================================
// Week View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { CONFIG, VIEWS } from '../../config';
import { expandEventsForRange } from '../../utils/recurrence';
import { buildAccentAttributes, getInheritedAccent } from '../../utils/goalLinkage';
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

    const goalsById = new Map<string, any>();
    (State.data?.goals ?? []).forEach((g) => goalsById.set(g.id, g));
    const visionAccentAttrs = primaryVision ? buildAccentAttributes(getInheritedAccent(primaryVision, goalsById)) : { dataAttr: "", styleAttr: "" };
    const focusAccentAttrs = primaryFocus ? buildAccentAttributes(getInheritedAccent(primaryFocus, goalsById)) : { dataAttr: "", styleAttr: "" };

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
    const eventsForWeek = State.data?.events
      ? expandEventsForRange(State.data.events, weekStart, weekEnd)
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
    const eventsByDay = new Map<string, { title: string; label: string }[]>();
    for (const ev of eventsForWeek) {
      const start = new Date(ev.startAt);
      const end = ev.endAt ? new Date(ev.endAt) : start;
      const startKey = formatYmd(start);
      const startLabel = ev.allDay
        ? "All day"
        : start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const dayCursorStart = startOfDay(start) < startOfDay(weekStart) ? startOfDay(weekStart) : startOfDay(start);
      const dayCursorEnd = startOfDay(end) > startOfDay(weekEnd) ? startOfDay(weekEnd) : startOfDay(end);
      for (let cursor = new Date(dayCursorStart); cursor <= dayCursorEnd; cursor = addDays(cursor, 1)) {
        const key = formatYmd(cursor);
        const label = key === startKey ? startLabel : "Continues";
        const list = eventsByDay.get(key) ?? [];
        list.push({ title: ev.title, label });
        eventsByDay.set(key, list);
      }
    }

    let html = `<div class="week-view">
        <div class="week-view-header">
          <h2 class="week-view-title">Week ${weekNum}</h2>
          <p class="week-view-range">${startFormatted} - ${endFormatted}</p>
          ${primaryVision ? `
            <div class="week-vision-strip"${visionAccentAttrs.dataAttr}${visionAccentAttrs.styleAttr} aria-label="Year vision">
              <span class="week-vision-label">✨ Vision</span>
              <button type="button" class="week-vision-chip" data-goal-id="${primaryVision.id}" title="${escapeHtmlFn(primaryVision.title)}">
                ${escapeHtmlFn(primaryVision.title)}
                ${visionGoals.length > 1 ? `<span class="week-vision-more">+${visionGoals.length - 1}</span>` : ""}
              </button>
            </div>
          ` : ""}
          <div class="week-focus-banner year-vision-banner--pill">
            ${primaryFocus ? `
              <button type="button" class="year-vision-pill year-vision-pill--cosmic year-vision-pill--focus week-focus-pill"${focusAccentAttrs.dataAttr}${focusAccentAttrs.styleAttr} data-goal-id="${primaryFocus.id}">
                <span class="year-vision-pill-label" aria-label="Focus">
                  <span class="year-vision-pill-dot" aria-hidden="true"></span>
                  FOCUS
                </span>
                <span class="year-vision-pill-title">${escapeHtmlFn(primaryFocus.title)}</span>
              </button>
            ` : `
              <button type="button" class="year-vision-pill year-vision-pill--cosmic year-vision-pill--focus year-vision-pill--empty week-focus-pill week-focus-pill--empty" data-action="add-focus" data-date="${weekStartYmd}">
                <span class="year-vision-pill-label" aria-label="Focus">
                  <span class="year-vision-pill-dot" aria-hidden="true"></span>
                  FOCUS
                </span>
                <span class="year-vision-pill-title">+ Add Focus</span>
              </button>
            `}
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
      const dayEvents = eventsByDay.get(ymd) ?? [];

      html += `
          <div class="week-day-column ${isToday ? 'today' : ''}">
            <div class="week-day-header">
              <button type="button" class="week-day-jump" data-date="${ymd}" aria-label="Open ${date.toDateString()}">
                <span class="week-day-name">${dayNames[i]}</span>
                <span class="week-day-date">${date.getDate()}</span>
              </button>
              ${dayGoals.length > 0 ? `<div class="week-day-badge" aria-label="${dayGoals.length} intentions">${dayGoals.length}</div>` : ""}
            </div>
            ${dayEvents.length > 0 ? `
              <div class="week-day-events" aria-label="${dayEvents.length} events">
                ${dayEvents.map((ev) => `
                  <div class="week-event-item" role="note">
                    <div class="week-event-title">${escapeHtmlFn(ev.title)}</div>
                    <div class="week-event-meta">${escapeHtmlFn(ev.label)}</div>
                  </div>
                `).join("")}
              </div>
            ` : ""}
            <div class="week-day-goals">
      `;

      if (dayGoals.length > 0) {
        dayGoals.forEach(g => {
          const cat = g.category ? (CONFIG.CATEGORIES[g.category] ?? null) : null;
          const completedClass = g.status === "done" ? "completed" : "";
          const accentAttrs = buildAccentAttributes(getInheritedAccent(g, goalsById));
          html += `
              <div class="week-goal-item ${completedClass}"${accentAttrs.dataAttr}${accentAttrs.styleAttr} data-goal-id="${g.id}" role="button" tabindex="0">
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

    // Add click handlers for the focus pill
    container.querySelectorAll<HTMLElement>('.week-focus-pill[data-goal-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const goalId = btn.dataset.goalId;
        if (!goalId) return;
        const event = new CustomEvent('goal-click', { detail: { goalId } });
        container.dispatchEvent(event);
      });
    });

    const addFocusBtn = container.querySelector<HTMLButtonElement>(
      '[data-action="add-focus"]'
    );
    if (addFocusBtn) {
      addFocusBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const date = addFocusBtn.dataset.date ?? weekStartYmd;
        const event = new CustomEvent("goal-create", {
          detail: { level: "focus", date },
        });
        container.dispatchEvent(event);
      });
    }

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
