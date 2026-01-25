// ===================================
// Year View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { CONFIG, VIEWS } from '../../config';
import { TimeBreakdown } from '../../utils/TimeBreakdown';
import { buildAccentAttributes, getVisionAccent } from '../../utils/goalLinkage';
import { monthDetailModal } from '../../components/modals/MonthDetailModal';
import type { UIElements, Goal, GoalLevel, Subtask } from '../../types';

export interface YearRendererCallbacks {
  escapeHtml: (text: string) => string;
  openGoalModal: (level: GoalLevel, month: number | null, year: number) => void;
  updateYearDisplay: () => void;
}

export const YearRenderer = {
  render(
    elements: UIElements,
    callbacks: YearRendererCallbacks
  ) {
    const container = elements.calendarGrid;
    if (!container) {
      console.error("YearRenderer: calendarGrid element not found!");
      return;
    }
    console.log(
      "YearRenderer: rendering calendar for year",
      State.viewingYear
    );

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const viewingYear = State.viewingYear;

    // Update year display
    callbacks.updateYearDisplay();

    const yearStart = new Date(viewingYear, 0, 1);
    const yearEnd = new Date(viewingYear, 11, 31);
    const visionGoals = Goals.getForRange(yearStart, yearEnd).filter(
      (g) => g.level === "vision" && g.status !== "done"
    );

    // Render year header + grid
    // Preserve base class and add year-specific classes
    container.classList.add("year-view-container");
    container.classList.remove("month-view-container", "week-view-container", "garden-horizon");
    container.innerHTML = "";

    const yearView = document.createElement("div");
    yearView.className = "year-view";

    const header = document.createElement("div");
    header.className = "year-view-header";
    header.innerHTML = `
      <h2 class="year-view-title">${viewingYear}</h2>
    `;

    const visionWrap = document.createElement("div");
    visionWrap.className = "year-vision-hero-container";

    if (visionGoals.length > 0) {
      const visionIcons = visionGoals
        .map((vision) => {
          const accentAttrs = buildAccentAttributes(getVisionAccent(vision));
          const icon = vision.icon || "✨";
          return `
            <div class="year-vision-icon-only"
               ${accentAttrs.dataAttr} 
               ${accentAttrs.styleAttr} 
               data-goal-id="${vision.id}" 
               role="button" 
               tabindex="0"
               aria-label="Vision: ${callbacks.escapeHtml(vision.title)}">
               <span class="vision-icon-large">${icon}</span>
          </div>
          `;
        })
        .join("");

      const cardsContainer = document.createElement("div");
      cardsContainer.className = "year-vision-icons-grid";
      cardsContainer.innerHTML = visionIcons;
      visionWrap.appendChild(cardsContainer);
    } else {
      const cardsContainer = document.createElement("div");
      cardsContainer.className = "year-vision-icons-grid";
      cardsContainer.innerHTML = `
        <button type="button" class="year-vision-icon-only year-vision-icon-only--empty year-add-vision-btn" aria-label="Add Vision for ${viewingYear}">
          <span class="vision-icon-large">+</span>
        </button>
      `;
      visionWrap.appendChild(cardsContainer);
    }

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    yearView.appendChild(header);
    yearView.appendChild(visionWrap);
    yearView.appendChild(grid);
    container.appendChild(yearView);
    console.log(
      "YearRenderer: Created yearView structure, container children:",
      container.children.length
    );

    visionWrap.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement | null)?.closest?.(
        ".year-vision-icon-only[data-goal-id]"
      ) as HTMLElement | null;
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      const goalId = target.dataset.goalId;
      if (!goalId) return;
      container.dispatchEvent(
        new CustomEvent("goal-click", { detail: { goalId } })
      );
    });

    visionWrap.addEventListener("keydown", (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key !== "Enter" && ke.key !== " ") return;
      const target = (e.target as HTMLElement | null)?.closest?.(
        ".year-vision-icon-only[data-goal-id]"
      ) as HTMLElement | null;
      if (!target) return;
      ke.preventDefault();
      (target as HTMLElement).click();
    });

    const addVisionBtn = yearView.querySelector<HTMLButtonElement>(
      ".year-add-vision-btn"
    );
    if (addVisionBtn) {
      addVisionBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        callbacks.openGoalModal("vision", null, viewingYear);
      });
    }

    CONFIG.MONTHS.forEach((monthName, monthIndex) => {
      try {
        const card = this.createMonthCard(
          monthIndex,
          monthName,
          currentMonth,
          currentYear,
          viewingYear,
          callbacks
        );

        // Click handler to drill into month view
        card.addEventListener("click", (e) => {
          // Don't navigate if clicking on a goal item
          const target = e.target as Element | null;
          if (target?.closest(".goal-item")) return;
          State.viewingMonth = monthIndex;
          State.viewingYear = viewingYear;
          State.viewingDate = new Date(viewingYear, monthIndex, 1);
          State.setView(VIEWS.MONTH);
        });

        grid.appendChild(card);
      } catch (error) {
        console.error(
          `YearRenderer: Error creating card for ${monthName}:`,
          error
        );
      }
    });
    console.log(
      "YearRenderer: Finished creating",
      CONFIG.MONTHS.length,
      "month cards, grid children:",
      grid.children.length
    );
  },

  createMonthCard(
    monthIndex: number,
    monthName: string,
    currentMonth: number,
    currentYear: number,
    viewingYear: number,
    callbacks: YearRendererCallbacks
  ): HTMLElement {
    const card = document.createElement("div");
    card.className = "month-card";
    card.dataset.month = String(monthIndex);
    card.dataset.year = String(viewingYear);

    // Determine card state based on viewing year vs current year
    const isCurrentYear = viewingYear === currentYear;
    const isPastYear = viewingYear < currentYear;
    const isFutureYear = viewingYear > currentYear;

    if (isCurrentYear && monthIndex === currentMonth) {
      card.classList.add("current");
    } else if (isPastYear || (isCurrentYear && monthIndex < currentMonth)) {
      card.classList.add("past");
    } else {
      card.classList.add("future");
    }

    // Year view is milestone-oriented (month goals), not week/day tasks.
    const monthGoals = Goals.getByMonth(monthIndex, viewingYear).filter(
      (g) => g.level === "milestone"
    );
    const completedCount = monthGoals.filter((g) => g.status === "done").length;
    const progressPercent =
      monthGoals.length > 0
        ? Math.round((completedCount / monthGoals.length) * 100)
        : 0;

    // Time context with breakdown
    let timeContext = "";
    let timeDetail = "";
    const breakdown = TimeBreakdown.calculate(monthIndex, viewingYear);

    if (isPastYear) {
      timeContext = `${currentYear - viewingYear} year${
        currentYear - viewingYear > 1 ? "s" : ""
      } ago`;
      timeDetail = "";
    } else if (isFutureYear) {
      const monthsAway =
        (viewingYear - currentYear) * 12 + (monthIndex - currentMonth);
      timeContext = `In ${monthsAway} months`;
      timeDetail =
        breakdown.days > 0
          ? `${breakdown.days} days • ${breakdown.weeks} weeks`
          : "";
    } else if (monthIndex === currentMonth) {
      timeContext = "This month";
      timeDetail = `${breakdown.days} days left`;
    } else if (monthIndex === currentMonth + 1) {
      timeContext = "Next month";
      timeDetail = `${breakdown.days} days • ${breakdown.weeks} weeks`;
    } else if (monthIndex > currentMonth) {
      timeContext = `In ${monthIndex - currentMonth} months`;
      timeDetail = `${breakdown.days} days • ${breakdown.weekends} weekends`;
    } else {
      timeContext = `${currentMonth - monthIndex} months ago`;
      timeDetail = "";
    }

    card.innerHTML = `
      <div class="month-header">
        <div class="month-name">${monthName}</div>
        <div class="month-context">${timeContext}</div>
        ${
          timeDetail ? `<div class="month-time-detail">${timeDetail}</div>` : ""
        }
          </div>
      <div class="month-progress">
        <div class="month-progress-bar">
          <div class="month-progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="month-progress-label">${completedCount}/${
      monthGoals.length
    } milestones</div>
      </div>
      <div class="month-goals">
        ${this.renderMonthGoals(monthGoals, callbacks)}
      </div>
      <div class="month-actions">
        <button class="btn btn-sm btn-ghost add-goal-btn" data-month="${monthIndex}">+ Add Milestone</button>
        <button class="btn btn-sm btn-ghost view-month-btn" data-month="${monthIndex}">View Details</button>
        </div>
      `;

    // Bind events
    card.querySelector(".add-goal-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.openGoalModal("milestone", monthIndex, viewingYear);
    });

    card.querySelector(".view-month-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
      monthDetailModal.show(monthIndex, viewingYear);
    });

    card.addEventListener("click", () => {
      monthDetailModal.show(monthIndex, viewingYear);
    });

    return card;
  },

  renderMonthGoals(goals: Goal[], callbacks: YearRendererCallbacks): string {
    if (goals.length === 0) {
      return "";
    }

    // Filter by active category
    let filteredGoals = goals;
    if (State.activeCategory !== "all") {
      filteredGoals = goals.filter((g) => g.category === State.activeCategory);
    }

    return filteredGoals
      .slice(0, 5)
      .map((goal) => {
        const cat = goal.category
          ? CONFIG.CATEGORIES[goal.category] ?? null
          : null;
        const statusClass = goal.status === "done" ? "completed" : "";
        const level = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.milestone;
        const subtasksSummary =
          goal.subtasks.length > 0
            ? `${goal.subtasks.filter((s: Subtask) => s.done).length}/${
                goal.subtasks.length
              }`
            : "";

        const dotColor = cat?.color ?? "var(--accent)";
        const hasMeta =
          Boolean(cat) ||
          Boolean(subtasksSummary) ||
          (goal.progress > 0 && goal.progress < 100);

        return `
          <div class="goal-item goal-item--month-milestone ${statusClass}" data-goal-id="${
          goal.id
        }">
            <div class="goal-content">
              <div class="month-goal-row">
                <span class="month-goal-dot" style="--goal-dot-color: ${dotColor}" aria-hidden="true"></span>
                <div class="goal-title">
                  <span class="goal-level-emoji" aria-hidden="true">${
                    level.emoji
                  }</span>
                  <span class="goal-title-text">${callbacks.escapeHtml(
                    goal.title
                  )}</span>
                </div>
                ${
                  goal.status === "done"
                    ? `<span class="month-goal-done" aria-hidden="true">✓</span>`
                    : ""
                }
              </div>
              ${
                hasMeta
                  ? `<div class="month-goal-meta">
                      ${
                        cat
                          ? `<span class="month-goal-meta-chip" style="color: ${
                              cat.color
                            }" title="${callbacks.escapeHtml(cat.label)}">${
                              cat.emoji
                            }</span>`
                          : ""
                      }
                      ${
                        subtasksSummary
                          ? `<span class="month-goal-meta-chip month-goal-meta-chip--subtasks" title="Subtasks">${subtasksSummary}</span>`
                          : ""
                      }
                      ${
                        goal.progress > 0 && goal.progress < 100
                          ? `<span class="month-goal-meta-chip month-goal-meta-chip--progress" title="Progress">${goal.progress}%</span>`
                          : ""
                      }
                    </div>`
                  : ""
              }
              ${
                goal.progress > 0
                  ? `<div class="goal-progress"><div class="goal-progress-fill" style="width: ${goal.progress}%"></div></div>`
                  : ""
              }
            </div>
            <button class="btn btn-icon btn-ghost goal-edit-btn" data-goal-id="${
              goal.id
            }" type="button" aria-label="Options">⋮</button>
          </div>
        `;
      })
      .join("");
  },
};
