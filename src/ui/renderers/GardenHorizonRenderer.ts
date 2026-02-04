/**
 * Garden Horizon Renderer
 *
 * A calm, time-first home page that orients users in time rather than
 * overwhelming them with tasks. Core philosophy: "Arrival, orientation, calm reality check."
 *
 * Layout:
 * - Goal Spine (left): You Are Here panel + Visions list
 * - Time Canvas (center): Vertical scroll from Year → Month → Week → NOW
 * - Floating Utility Rail (bottom): Plan | Review | Map | Check
 */

import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { Events } from "../../core/Events";
import { eventBus } from "../../core/EventBus";
import type { Goal, GoalLevel, UIElements, CalendarEvent } from "../../types";
import { getVisionAccent } from "../../utils/goalLinkage";
import { isIntentionActiveOnDate } from "../../utils/intentionVisibility";
import { InboxPage } from "../pages/InboxPage";
import { RealityPreviewOverlay } from "../components/RealityPreviewOverlay";
import {
  computeGoalState,
  sortByState,
  getStateIndicator,
  getStateClass,
} from "../../core/GoalStateComputation";
import {
  openCapacityCheck,
  getLastCapacityResult,
} from "../../features/capacityCheck";

// Module state
let isDrawerOpen = false;
let selectedVisionId: string | null = null;
let showTimePassed = false; // Toggle between "time left" and "time passed"

function isGardenFenceVisible(): boolean {
  if (typeof window === "undefined") return true;
  return window.innerWidth >= 768;
}

function clearVisionSelectionStyles(): void {
  document
    .querySelectorAll(".spine-vision-item.is-selected")
    .forEach((el) => el.classList.remove("is-selected"));
}

function applyVisionSelectionStyles(goalId: string | null): void {
  clearVisionSelectionStyles();
  if (!goalId) return;
  const escapedId = CSS.escape(goalId);
  const spineItem = document.querySelector<HTMLElement>(
    `.spine-vision-item[data-goal-id="${escapedId}"]`,
  );
  spineItem?.classList.add("is-selected");
}

function selectVision(
  goalId: string,
  onVisionClick: (visionId: string) => void,
): void {
  selectedVisionId = goalId;
  applyVisionSelectionStyles(goalId);
  onVisionClick(goalId);
}

/**
 * Get the start of the current week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the current week (Sunday)
 */
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

/**
 * Format compact date for mobile
 */
function formatDateCompact(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

/**
 * Get time of day greeting
 */
function getTimeGreeting(date: Date) {
  const hour = date.getHours();

  if (hour >= 0 && hour < 5) {
    return {
      title: "Late night",
      subtitle: "You’re still here.",
    };
  }

  if (hour >= 5 && hour < 9) {
    return {
      title: "Early morning",
      subtitle: "Ease into today.",
    };
  }

  if (hour >= 9 && hour < 12) {
    return {
      title: "Good morning",
      subtitle: "Today is unfolding.",
    };
  }

  if (hour >= 12 && hour < 14) {
    return {
      title: "Midday",
      subtitle: "The day is in motion.",
    };
  }

  if (hour >= 14 && hour < 17) {
    return {
      title: "Good afternoon",
      subtitle: "This part of the day counts too.",
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      title: "Good evening",
      subtitle: "Winding things down.",
    };
  }

  return {
    title: "Night",
    subtitle: "It’s okay to slow down.",
  };
}

/**
 * Calculate days remaining in year
 */
function getDaysLeftInYear(date: Date = new Date()): number {
  const now = new Date(date);
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  const diff = endOfYear.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getMonthsLeftInYear(date: Date = new Date()): number {
  return Math.max(0, 11 - date.getMonth());
}

function getWeeksLeftInMonth(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startOfNextMonth = new Date(year, month + 1, 1);
  const diff = startOfNextMonth.getTime() - date.getTime();
  const daysLeft = diff / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(daysLeft / 7));
}

function getHoursLeftToday(date: Date = new Date()): number {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const diff = endOfDay.getTime() - date.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
}

/**
 * Calculate time passed functions (inverse of time left)
 */
function getDaysPassedInYear(date: Date = new Date()): number {
  const now = new Date(date);
  const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getMonthsPassedInYear(date: Date = new Date()): number {
  return date.getMonth();
}

function getWeeksPassedInMonth(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const diff = date.getTime() - startOfMonth.getTime();
  const daysPassed = diff / (1000 * 60 * 60 * 24);
  return Math.floor(daysPassed / 7);
}

function getHoursPassedToday(date: Date = new Date()): number {
  return date.getHours();
}

/**
 * Get the week number of the year
 */
function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil((diff + start.getDay() * 24 * 60 * 60 * 1000) / oneWeek);
}

/**
 * Get month name
 */
function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long" });
}

function formatEventTimeRange(event: CalendarEvent): string {
  if (event.allDay) {
    return "All day";
  }
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const start = new Date(event.startAt);
  const startLabel = start.toLocaleTimeString("en-US", options);
  if (event.endAt) {
    const end = new Date(event.endAt);
    const endLabel = end.toLocaleTimeString("en-US", options);
    return `${startLabel} → ${endLabel}`;
  }
  return startLabel;
}

export const GardenHorizonRenderer = {
  /**
   * Main render function
   */
  render(
    elements: UIElements,
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
    onVisionClick: (visionId: string) => void,
    onAddGoal?: (level: GoalLevel) => void,
  ): void {
    if (!State.data) return;

    const container = elements.calendarGrid;
    if (!container) return;

    RealityPreviewOverlay.hide();

    const viewDate = State.viewingDate ?? new Date();
    const viewYear = viewDate.getFullYear();

    // Get data for all time horizons
    const yearStart = new Date(viewYear, 0, 1);
    const yearEnd = new Date(viewYear, 11, 31);
    const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const monthEnd = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth() + 1,
      0,
    );
    const weekStart = getWeekStart(viewDate);
    const weekEnd = getWeekEnd(viewDate);
    const todayStart = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth(),
      viewDate.getDate(),
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    // Get visions for the year
    const visions = Goals.getForRange(yearStart, yearEnd).filter(
      (g) => g.level === "vision" && !g.archivedAt,
    );

    // Get goals by time horizon
    const milestones = Goals.getForRange(monthStart, monthEnd).filter(
      (g) => g.level === "milestone" && !g.archivedAt,
    );
    const focuses = Goals.getForRange(weekStart, weekEnd).filter(
      (g) => g.level === "focus" && !g.archivedAt,
    );
    const intentions = Goals.getForRange(todayStart, todayEnd).filter(
      (g) =>
        g.level === "intention" &&
        !g.archivedAt &&
        isIntentionActiveOnDate(g, viewDate),
    );

    // Get events for the week
    const weekEvents = Events.getForRange(weekStart, weekEnd);

    // Sort visions by state
    const sortedVisions = sortByState(visions);

    // Build the layout
    container.innerHTML = "";
    // Preserve base class and add garden-specific class
    container.classList.add("garden-horizon");
    // Remove other view-specific classes
    container.classList.remove(
      "year-view",
      "month-view",
      "week-view",
      "day-view",
    );

    // Create the main layout
    const layout = document.createElement("div");
    layout.className = "garden-horizon-layout";

    // Goal Spine (sidebar)
    const spine = this.renderGoalSpine(
      sortedVisions,
      viewDate,
      escapeHtmlFn,
      onVisionClick,
      onAddGoal,
    );
    layout.appendChild(spine);

    // Time Canvas (main area)
    const canvas = this.renderTimeCanvas(
      viewDate,
      milestones,
      focuses,
      intentions,
      weekEvents,
      escapeHtmlFn,
      onGoalClick,
    );
    RealityPreviewOverlay.attach(canvas);
    layout.appendChild(canvas);

    container.appendChild(layout);
    this.syncVisionSelectionStyles();

    // Floating Utility Rail
    const rail = this.renderUtilityRail();
    container.appendChild(rail);

    // #region agent log
    // Debug: Check border styles after render
    requestAnimationFrame(() => {
      const calendarGrid = document.getElementById("calendarGrid");
      const layout = calendarGrid?.querySelector(".garden-horizon-layout");
      const root = document.documentElement;

      if (calendarGrid && calendarGrid.classList.contains("garden-horizon")) {
        const computed = window.getComputedStyle(calendarGrid);
        const borderColor = computed.borderColor;
        const borderWidth = computed.borderWidth;
        const borderStyle = computed.borderStyle;
        const boxShadow = computed.boxShadow;
        const outline = computed.outline;
        const cssVar = getComputedStyle(root)
          .getPropertyValue("--gh-border-container")
          .trim();
        const hasDarkMode =
          root.classList.contains("dark-mode") ||
          document.body.classList.contains("dark-mode");
        const rootClasses = root.className;
        const bodyClasses = document.body.className;

        // Check all matching CSS rules
        const allRules: Array<{
          selector: string;
          border: string;
          borderColor: string;
          specificity: string;
        }> = [];
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            Array.from(sheet.cssRules || []).forEach((rule) => {
              if (rule instanceof CSSStyleRule) {
                try {
                  if (calendarGrid.matches(rule.selectorText)) {
                    allRules.push({
                      selector: rule.selectorText,
                      border: rule.style.border || "",
                      borderColor: rule.style.borderColor || "",
                      specificity: "",
                    });
                  }
                } catch {
                  // Ignore CSS parsing errors (CORS or unsupported rules)
                }
              }
            });
          } catch {
            // Ignoring stylesheet access issues (cross-origin, etc.)
          }
        });

        fetch(
          "http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "GardenHorizonRenderer.ts:362",
              message: "Border debug - calendar-grid computed styles",
              data: {
                borderColor,
                borderWidth,
                borderStyle,
                boxShadow,
                outline,
                cssVarValue: cssVar,
                hasDarkMode,
                rootClasses,
                bodyClasses,
                matchingRuleCount: allRules.length,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            }),
          },
        ).catch(() => {});

        // Log matching rules separately
        allRules.forEach((rule, idx) => {
          fetch(
            "http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "GardenHorizonRenderer.ts:362",
                message: `Matching CSS rule ${idx}`,
                data: rule,
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "B",
              }),
            },
          ).catch(() => {});
        });
      }

      // Check layout element
      if (layout) {
        const layoutComputed = window.getComputedStyle(layout);
        const layoutBorderColor = layoutComputed.borderColor;
        const layoutBorderWidth = layoutComputed.borderWidth;
        const layoutBoxShadow = layoutComputed.boxShadow;
        fetch(
          "http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "GardenHorizonRenderer.ts:362",
              message: "Border debug - garden-horizon-layout styles",
              data: {
                borderColor: layoutBorderColor,
                borderWidth: layoutBorderWidth,
                boxShadow: layoutBoxShadow,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "C",
            }),
          },
        ).catch(() => {});
      }

      // Check if box-shadow is creating the visual border effect
      if (calendarGrid) {
        const computed = window.getComputedStyle(calendarGrid);
        const hasBoxShadow =
          computed.boxShadow && computed.boxShadow !== "none";
        const hasOutline = computed.outline && computed.outline !== "none";
        fetch(
          "http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "GardenHorizonRenderer.ts:362",
              message: "Visual border check - box-shadow/outline",
              data: {
                hasBoxShadow,
                hasOutline,
                boxShadow: computed.boxShadow,
                outline: computed.outline,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "D",
            }),
          },
        ).catch(() => {});

        // Check parent elements for borders
        const parent = calendarGrid.parentElement;
        const canvas = parent?.closest("#canvas");
        const canvasContainer = canvas?.parentElement;
        if (parent) {
          const parentComputed = window.getComputedStyle(parent);
          const canvasComputed = canvas
            ? window.getComputedStyle(canvas)
            : null;
          const containerComputed = canvasContainer
            ? window.getComputedStyle(canvasContainer)
            : null;
          fetch(
            "http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "GardenHorizonRenderer.ts:362",
                message: "Parent element border check",
                data: {
                  parentBorder: parentComputed.border,
                  parentBorderColor: parentComputed.borderColor,
                  canvasBorder: canvasComputed?.border,
                  canvasBorderColor: canvasComputed?.borderColor,
                  containerBorder: containerComputed?.border,
                  containerBorderColor: containerComputed?.borderColor,
                  dividerVar: getComputedStyle(root)
                    .getPropertyValue("--divider")
                    .trim(),
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "E",
              }),
            },
          ).catch(() => {});
        }

        // Check for pseudo-elements that might create visual borders
        const before = window.getComputedStyle(calendarGrid, "::before");
        const after = window.getComputedStyle(calendarGrid, "::after");
        const hasBefore =
          before.content &&
          before.content !== "none" &&
          before.content !== "normal";
        const hasAfter =
          after.content &&
          after.content !== "none" &&
          after.content !== "normal";
        fetch(
          "http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "GardenHorizonRenderer.ts:362",
              message: "Pseudo-element check",
              data: {
                hasBefore,
                hasAfter,
                beforeContent: before.content,
                beforeBorder: before.border,
                beforeBorderColor: before.borderColor,
                beforeBoxShadow: before.boxShadow,
                afterContent: after.content,
                afterBorder: after.border,
                afterBorderColor: after.borderColor,
                afterBoxShadow: after.boxShadow,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "F",
            }),
          },
        ).catch(() => {});

        // Check actual rendered border color by inspecting the element's visual appearance
        // This is a workaround - we can't directly get the "visual" color, but we can check if there are any filters/blend modes
        const filter = computed.filter;
        const mixBlendMode = computed.mixBlendMode;
        const backdropFilter = computed.backdropFilter;
        fetch(
          "http://127.0.0.1:7242/ingest/4467fe45-6449-42ed-a52d-b93a0f522e1a",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "GardenHorizonRenderer.ts:362",
              message: "Visual effects check",
              data: {
                filter,
                mixBlendMode,
                backdropFilter,
                backgroundColor: computed.backgroundColor,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "G",
            }),
          },
        ).catch(() => {});
      }
    });
    // #endregion

    // Mobile drawer toggle
    this.setupMobileDrawer(container, viewDate);

    container
      .querySelectorAll<HTMLElement>('[data-action="open-goal-detail"]')
      .forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const goalId = el.dataset.goalId;
          if (!goalId) return;
          onGoalClick(goalId);
        });
      });

    // Scroll to NOW section by default
    requestAnimationFrame(() => {
      const nowSection = container.querySelector(".time-band-now");
      if (nowSection) {
        nowSection.scrollIntoView({ behavior: "auto", block: "start" });
      }
    });
  },

  /**
   * Render the Goal Spine sidebar
   */
  renderGoalSpine(
    visions: Goal[],
    viewDate: Date,
    escapeHtmlFn: (text: string) => string,
    onVisionClick: (visionId: string) => void,
    onAddGoal?: (level: GoalLevel) => void,
  ): HTMLElement {
    const spine = document.createElement("aside");
    spine.className = `goal-spine ${isDrawerOpen ? "drawer-open" : ""}`;
    spine.setAttribute("role", "complementary");
    spine.setAttribute("aria-label", "Goal Spine");

    // You Are Here section (reuses existing sidebar content conceptually)
    const youAreHere = document.createElement("div");
    youAreHere.className = "spine-you-are-here";
    youAreHere.setAttribute("role", "button");
    youAreHere.setAttribute("tabindex", "0");
    youAreHere.setAttribute(
      "aria-label",
      "Toggle between time left and time passed",
    );
    youAreHere.style.cursor = "pointer";

    const updateStats = () => {
      if (showTimePassed) {
        // Show time passed
        const daysPassed = getDaysPassedInYear(viewDate);
        const monthsPassed = getMonthsPassedInYear(viewDate);
        const weeksPassed = getWeeksPassedInMonth(viewDate);
        const hoursPassed = getHoursPassedToday(viewDate);

        const formatStat = (value: number, unit: string, suffix: string) => {
          const unitText = value === 1 ? unit : `${unit}s`;
          return `<span class="spine-stat-value">${value} ${unitText}</span> ${suffix}`;
        };

        youAreHere.innerHTML = `
          <div class="spine-date">${formatDate(viewDate)}</div>
          <div class="spine-stats">
            <span class="spine-stat-line">${formatStat(daysPassed, "day", `have passed in ${viewDate.getFullYear()}`)}</span>
            <span class="spine-stat-line">${formatStat(monthsPassed, "month", `have passed in ${viewDate.getFullYear()}`)}</span>
            <span class="spine-stat-line">${formatStat(weeksPassed, "week", `have passed in ${getMonthName(viewDate)}`)}</span>
            <span class="spine-stat-line">${formatStat(hoursPassed, "hour", "have passed today")}</span>
          </div>
        `;
      } else {
        // Show time left
        const daysLeft = getDaysLeftInYear(viewDate);
        const monthsLeft = getMonthsLeftInYear(viewDate);
        const weeksLeft = getWeeksLeftInMonth(viewDate);
        const hoursLeft = getHoursLeftToday(viewDate);

        const formatStat = (value: number, unit: string, suffix: string) => {
          const unitText = value === 1 ? unit : `${unit}s`;
          return `<span class="spine-stat-value">${value} ${unitText}</span> ${suffix}`;
        };

        youAreHere.innerHTML = `
          <div class="spine-date">${formatDate(viewDate)}</div>
          <div class="spine-stats">
            <span class="spine-stat-line">${formatStat(daysLeft, "day", `left in ${viewDate.getFullYear()}`)}</span>
            <span class="spine-stat-line">${formatStat(monthsLeft, "month", `left in ${viewDate.getFullYear()}`)}</span>
            <span class="spine-stat-line">${formatStat(weeksLeft, "week", `left in ${getMonthName(viewDate)}`)}</span>
            <span class="spine-stat-line">${formatStat(hoursLeft, "hour", "left today")}</span>
          </div>
        `;
      }
    };

    // Initial render
    updateStats();

    // Toggle on click
    youAreHere.addEventListener("click", () => {
      showTimePassed = !showTimePassed;
      updateStats();
    });

    // Toggle on Enter key
    youAreHere.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showTimePassed = !showTimePassed;
        updateStats();
      }
    });

    spine.appendChild(youAreHere);

    // Divider
    const divider = document.createElement("hr");
    divider.className = "spine-divider";
    spine.appendChild(divider);

    // Visions section
    const visionsSection = document.createElement("div");
    visionsSection.className = "spine-visions";

    const visionsHeader = document.createElement("div");
    visionsHeader.className = "spine-section-header";
    visionsHeader.innerHTML = `<span class="spine-section-title">Your Visions</span>`;
    visionsSection.appendChild(visionsHeader);

    // Visions list
    const visionsList = document.createElement("ul");
    visionsList.className = "spine-visions-list";
    visionsList.setAttribute("role", "list");

    if (visions.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "spine-empty";
      emptyItem.innerHTML = `
        <span class="spine-empty-text">No visions yet</span>
        <span class="spine-empty-hint">Add a vision to get started</span>
      `;
      visionsList.appendChild(emptyItem);
    } else {
      for (const vision of visions) {
        const state = computeGoalState(vision);
        const accent = getVisionAccent(vision);
        const indicator = getStateIndicator(state);

        const item = document.createElement("li");
        item.className = `spine-vision-item ${getStateClass(state)}`;
        item.setAttribute("role", "listitem");
        item.setAttribute("tabindex", "0");
        item.setAttribute("data-goal-id", vision.id);

        if (selectedVisionId === vision.id) {
          item.classList.add("is-selected");
        }

        item.innerHTML = `
          <span class="spine-vision-indicator" aria-label="${state}">${indicator}</span>
          <span class="spine-vision-icon">${vision.icon || "✨"}</span>
          <span class="spine-vision-title">${escapeHtmlFn(vision.title)}</span>
        `;

        // Apply accent color
        if (accent?.color) {
          item.style.setProperty("--vision-accent", accent.color);
        }

        // Click handler
        item.addEventListener("click", () => {
          selectVision(vision.id, onVisionClick);
        });

        // Keyboard handler
        item.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectVision(vision.id, onVisionClick);
          }
        });

        item.addEventListener("mouseenter", () => {
          RealityPreviewOverlay.show(vision);
        });
        item.addEventListener("mouseleave", () => {
          RealityPreviewOverlay.hide();
        });
        item.addEventListener("focus", () => {
          RealityPreviewOverlay.show(vision);
        });
        item.addEventListener("blur", () => {
          RealityPreviewOverlay.hide();
        });

        visionsList.appendChild(item);
      }
    }

    visionsSection.appendChild(visionsList);
    spine.appendChild(visionsSection);

    // Add new goal button
    const addButton = document.createElement("button");
    addButton.className = "spine-add-goal";
    addButton.type = "button";
    addButton.innerHTML = `
      <span class="spine-add-icon">+</span>
      <span class="spine-add-text">New vision</span>
    `;
    addButton.addEventListener("click", () => {
      if (onAddGoal) {
        onAddGoal("vision");
      }
    });
    spine.appendChild(addButton);

    return spine;
  },

  /**
   * Render the Time Canvas main area
   */
  renderTimeCanvas(
    viewDate: Date,
    milestones: Goal[],
    focuses: Goal[],
    intentions: Goal[],
    events: CalendarEvent[],
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
  ): HTMLElement {
    const canvas = document.createElement("main");
    canvas.className = "time-canvas";
    canvas.setAttribute("role", "main");
    canvas.setAttribute("aria-label", "Time Canvas");

    // NOW band is the first thing we see
    const nowBand = this.renderNowBand(
      viewDate,
      intentions,
      escapeHtmlFn,
      onGoalClick,
    );
    canvas.appendChild(nowBand);

    // THIS WEEK band
    const weekNum = getWeekNumber(viewDate);
    const weekBand = this.renderTimeBand(
      "week",
      `Week ${weekNum}`,
      focuses,
      escapeHtmlFn,
      onGoalClick,
      { subtitle: `Week ${weekNum} focus`, events },
    );
    canvas.appendChild(weekBand);

    // THIS MONTH band
    const monthBand = this.renderTimeBand(
      "month",
      getMonthName(viewDate),
      milestones,
      escapeHtmlFn,
      onGoalClick,
      { subtitle: "Monthly milestones" },
    );
    canvas.appendChild(monthBand);

    return canvas;
  },

  /**
   * Render a time band section
   */
  renderTimeBand(
    type: "month" | "week",
    label: string,
    goals: Goal[],
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
    options?: { subtitle?: string; events?: CalendarEvent[] },
  ): HTMLElement {
    const { subtitle, events } = options ?? {};
    const band = document.createElement("section");
    band.className = `time-band time-band-${type}`;
    band.setAttribute("role", "region");
    band.setAttribute("aria-label", `This ${type}: ${label}`);

    const header = document.createElement("div");
    header.className = "time-band-header";

    const labelStack = document.createElement("div");
    labelStack.className = "time-band-label-stack";

    const labelText = document.createElement("span");
    labelText.className = "time-band-label";
    labelText.textContent = `This ${type}`;
    labelStack.appendChild(labelText);

    if (subtitle) {
      const subtitleText = document.createElement("span");
      subtitleText.className = "time-band-subtitle";
      subtitleText.textContent = subtitle;
      labelStack.appendChild(subtitleText);
    }

    const labelValue = document.createElement("span");
    labelValue.className = "time-band-value";
    labelValue.textContent = label;

    header.append(labelStack, labelValue);
    band.appendChild(header);

    // Goals for this time band (subtle markers, not boxes)
    if (goals.length > 0) {
      const markers = document.createElement("div");
      markers.className = "time-band-markers";

      for (const goal of goals.slice(0, 5)) {
        const marker = document.createElement("div");
        marker.className =
          "time-band-marker time-band-marker-chip garden-horizon-chip";
        marker.setAttribute("tabindex", "0");
        marker.setAttribute("role", "button");
        marker.setAttribute("aria-label", escapeHtmlFn(goal.title));
        marker.setAttribute("data-action", "open-goal-detail");
        marker.setAttribute("data-goal-id", goal.id);

        const accent = getVisionAccent(goal);
        if (accent?.color) {
          marker.style.setProperty("--marker-color", accent.color);
        }

        const markerDot = document.createElement("span");
        markerDot.className = "marker-dot";
        marker.append(markerDot);

        const markerTitle = document.createElement("span");
        markerTitle.className = "marker-title";
        markerTitle.textContent = escapeHtmlFn(goal.title);
        marker.append(markerTitle);

        marker.addEventListener("click", () => onGoalClick(goal.id));
        marker.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onGoalClick(goal.id);
          }
        });

        markers.appendChild(marker);
      }

      if (goals.length > 5) {
        const more = document.createElement("div");
        more.className = "time-band-more";
        more.textContent = `+${goals.length - 5} more`;
        markers.appendChild(more);
      }

      band.appendChild(markers);
    } else {
      const empty = document.createElement("div");
      empty.className = "time-band-empty";
      empty.textContent =
        type === "week"
          ? "No planted work for this week yet. You can add a Focus or drag something in when you are ready."
          : "Nothing mapped for this month yet. New Milestones will show up here.";
      band.appendChild(empty);
    }

    // Events for week band
    if (type === "week" && events && events.length > 0) {
      const eventsSection = document.createElement("div");
      eventsSection.className = "time-band-events";

      for (const event of events.slice(0, 3)) {
        const eventEl = document.createElement("div");
        eventEl.className = "time-band-event";
        eventEl.innerHTML = `
          <span class="event-dot"></span>
          <span class="event-title">${escapeHtmlFn(event.title)}</span>
          <span class="event-time">${formatEventTimeRange(event)}</span>
        `;
        eventsSection.appendChild(eventEl);
      }

      if (events.length > 3) {
        const more = document.createElement("div");
        more.className = "time-band-more";
        more.textContent = `+${events.length - 3} events`;
        eventsSection.appendChild(more);
      }

      band.appendChild(eventsSection);
    }

    return band;
  },

  /**
   * Render the NOW band (special treatment)
   */
  renderNowBand(
    currentDate: Date,
    intentions: Goal[],
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
  ): HTMLElement {
    const band = document.createElement("section");
    band.className = "time-band time-band-now";
    band.setAttribute("role", "region");
    band.setAttribute("aria-label", "Now");

    // Greeting and current time
    const header = document.createElement("div");
    header.className = "time-band-header time-band-header-now";

    const labelStack = document.createElement("div");
    labelStack.className = "time-band-label-stack";

    const labelText = document.createElement("span");
    labelText.className = "time-band-label";
    labelText.textContent = "Now";
    labelStack.appendChild(labelText);

    const subtitleText = document.createElement("span");
    subtitleText.className = "time-band-subtitle";
    subtitleText.textContent = "Today and tonight";
    labelStack.appendChild(subtitleText);

    header.appendChild(labelStack);

    const greeting = getTimeGreeting(currentDate);
    const greetingBlock = document.createElement("div");
    greetingBlock.className = "now-greeting-block";
    greetingBlock.innerHTML = `
      <span class="now-greeting-title">${greeting.title}</span>
      <span class="now-greeting-subtitle">${greeting.subtitle}</span>
    `;
    header.appendChild(greetingBlock);

    band.appendChild(header);

    // Capacity status badge (if check was done today)
    const capacityResult = getLastCapacityResult();
    if (capacityResult) {
      const capacityBadge = document.createElement("div");
      capacityBadge.className = `capacity-status-badge capacity-${capacityResult.capacityLevel}`;
      capacityBadge.setAttribute("role", "status");
      capacityBadge.setAttribute(
        "aria-label",
        `Current capacity: ${capacityResult.capacityLevel}`,
      );

      const levelEmojis: Record<string, string> = {
        high: "🌟",
        medium: "🌤️",
        low: "🌙",
        rest: "💤",
      };
      const energyEmojis: Record<string, string> = {
        focus: "🎯",
        creative: "✨",
        rest: "🌿",
        admin: "📋",
      };

      capacityBadge.innerHTML = `
        <span class="capacity-badge-level">${levelEmojis[capacityResult.capacityLevel] || "💭"} ${capacityResult.capacityLevel} capacity</span>
        <span class="capacity-badge-energy">${energyEmojis[capacityResult.energyType] || "⚡"} ${capacityResult.energyType} energy</span>
        <span class="capacity-badge-time">~${capacityResult.availableMinutes}min</span>
      `;

      // Click to redo check
      capacityBadge.style.cursor = "pointer";
      capacityBadge.addEventListener("click", () => {
        openCapacityCheck(() => {
          eventBus.emit("view:changed", { transition: false });
        });
      });

      band.appendChild(capacityBadge);
    }

    const showFullDate = !isGardenFenceVisible();
    if (showFullDate) {
      const dateEl = document.createElement("div");
      dateEl.className = "now-date-display";
      dateEl.textContent = formatDate(currentDate);
      band.appendChild(dateEl);
    }

    // Today's intentions (if any)
    if (intentions.length > 0) {
      const intentionsSection = document.createElement("div");
      intentionsSection.className = "now-intentions";

      const intentionsLabel = document.createElement("div");
      intentionsLabel.className = "now-intentions-label";
      intentionsLabel.textContent = "Today's intentions";
      intentionsSection.appendChild(intentionsLabel);

      for (const intention of intentions.slice(0, 3)) {
        const intentionEl = document.createElement("div");
        intentionEl.className = `now-intention ${intention.status === "done" ? "done" : ""} garden-horizon-chip`;
        intentionEl.setAttribute("tabindex", "0");
        intentionEl.setAttribute("role", "button");
        intentionEl.setAttribute("aria-label", escapeHtmlFn(intention.title));
        intentionEl.setAttribute("data-action", "open-goal-detail");
        intentionEl.setAttribute("data-goal-id", intention.id);

        const accent = getVisionAccent(intention);
        if (accent?.color) {
          intentionEl.style.setProperty("--intention-color", accent.color);
        }

        intentionEl.innerHTML = `
          <span class="intention-status">${intention.status === "done" ? "✓" : "○"}</span>
          <span class="intention-title">${escapeHtmlFn(intention.title)}</span>
        `;

        intentionEl.addEventListener("click", () => onGoalClick(intention.id));
        intentionEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onGoalClick(intention.id);
          }
        });
        intentionsSection.appendChild(intentionEl);
      }

      if (intentions.length > 3) {
        const more = document.createElement("div");
        more.className = "now-intentions-more";
        more.textContent = `+${intentions.length - 3} more`;
        intentionsSection.appendChild(more);
      }

      band.appendChild(intentionsSection);
    }

    return band;
  },

  /**
   * Render the floating utility rail
   */
  renderUtilityRail(): HTMLElement {
    const rail = document.createElement("nav");
    rail.className = "utility-rail";
    rail.setAttribute("role", "navigation");
    rail.setAttribute("aria-label", "Quick actions");

    const buttons = [
      { id: "check", label: "Check", icon: "💭" },
      { id: "plan", label: "Plan", icon: "📋" },
      { id: "review", label: "Review", icon: "📝" },
      { id: "map", label: "Map", icon: "🗺️" },
      { id: "inbox", label: "Inbox", icon: "📥" },
    ];

    for (const btn of buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "utility-rail-btn";
      button.setAttribute("data-action", btn.id);
      button.setAttribute("data-garden-action", btn.id);
      button.innerHTML = `
        <span class="utility-rail-icon" aria-hidden="true">${btn.icon}</span>
        <span class="utility-rail-label">${btn.label}</span>
      `;

      button.addEventListener("click", () => {
        this.handleUtilityAction(btn.id);
      });

      rail.appendChild(button);
    }

    return rail;
  },

  /**
   * Handle utility rail actions
   */
  handleUtilityAction(action: string): void {
    switch (action) {
      case "check":
        // Open capacity check
        openCapacityCheck((result) => {
          eventBus.emit("ui:toast", {
            icon: "💭",
            message: `Today: ${result.capacityLevel} capacity, ${result.energyType} energy`,
          });
        });
        break;
      case "plan":
        // Open planning page
        eventBus.emit("garden:plan-requested", { goalId: selectedVisionId });
        break;
      case "review":
        // Open weekly review
        eventBus.emit("garden:review-requested");
        break;
      case "map":
        // Open map view
        eventBus.emit("garden:map-requested");
        break;
      case "inbox":
        InboxPage.open(State.viewingDate);
        break;
    }
  },

  /**
   * Setup mobile drawer toggle
   */
  setupMobileDrawer(container: HTMLElement, viewDate: Date): void {
    const isMobile = window.innerWidth <= 900;
    const layout = container.querySelector(".garden-horizon-layout");
    if (!isMobile || !layout) {
      if (!isMobile) {
        isDrawerOpen = false;
      }
      return;
    }

    // Remove any stale mobile nodes before inserting fresh ones
    container
      .querySelectorAll(
        ".garden-horizon-mobile-header, .mobile-you-are-here, .spine-overlay",
      )
      .forEach((el) => el.remove());

    const mobileHeader = document.createElement("header");
    mobileHeader.className = "garden-horizon-mobile-header";

    const daysLeft = getDaysLeftInYear(viewDate);
    const hoursLeft = getHoursLeftToday(viewDate);
    mobileHeader.innerHTML = `
      <button class="mobile-menu-btn" type="button" aria-label="Open menu" aria-expanded="${isDrawerOpen}">
        <span aria-hidden="true">☰</span>
      </button>
      <div class="mobile-header-center">
        <span class="mobile-title">Garden Horizon</span>
        <span class="mobile-header-subtitle">${formatDateCompact(viewDate)} · ${daysLeft} days left · ${hoursLeft} hrs left</span>
      </div>
      <button class="mobile-settings-btn" type="button" aria-label="Settings">
        <span aria-hidden="true">⚙️</span>
      </button>
    `;

    const mobileSnapshot = document.createElement("div");
    mobileSnapshot.className = "mobile-you-are-here";
    mobileSnapshot.innerHTML = `
      <div class="mobile-you-are-here-text">
        <span class="mobile-you-are-here-label">Today</span>
        <span class="mobile-you-are-here-summary">${daysLeft} days left · ${hoursLeft} hrs to roam</span>
      </div>
      <span class="mobile-you-are-here-date">${formatDateCompact(viewDate)}</span>
    `;

    const spineOverlay = document.createElement("div");
    spineOverlay.className = "spine-overlay";

    container.insertBefore(mobileHeader, layout);
    container.insertBefore(mobileSnapshot, layout);
    container.appendChild(spineOverlay);

    const spine = container.querySelector(".goal-spine");
    const menuBtn = mobileHeader.querySelector(".mobile-menu-btn");

    const setDrawerState = (open: boolean) => {
      isDrawerOpen = open;
      if (spine) {
        spine.classList.toggle("drawer-open", open);
      }
      spineOverlay.classList.toggle("visible", open);
      if (menuBtn) {
        menuBtn.setAttribute("aria-expanded", String(open));
      }
    };

    menuBtn?.addEventListener("click", () => {
      setDrawerState(!isDrawerOpen);
    });

    spineOverlay.addEventListener("click", () => {
      setDrawerState(false);
    });

    setDrawerState(isDrawerOpen);
  },

  /**
   * Sync any selected vision styling after rendering
   */
  syncVisionSelectionStyles(): void {
    applyVisionSelectionStyles(selectedVisionId);
  },

  /**
   * Reset module state
   */
  reset(): void {
    isDrawerOpen = false;
    selectedVisionId = null;
  },

  /**
   * Clean up the garden view before switching away
   * Removes event listeners and resets state
   */
  cleanup(): void {
    // Hide overlays
    RealityPreviewOverlay.hide();

    // Remove garden-specific class from container
    const container = document.getElementById("calendarGrid");
    if (container) {
      container.classList.remove("garden-horizon");
    }

    // Reset module state
    isDrawerOpen = false;
    selectedVisionId = null;
    clearVisionSelectionStyles();
  },
};

/*
Garden Horizon map:
- Entry: render() mounts on elements.calendarGrid, resets GoalDetailRenderer + RealityPreviewOverlay.
- Spine: renderGoalSpine(viewDate) → You Are Here stats plus visions list and add-vision control.
- Canvas: renderTimeCanvas(viewDate) → renderNowBand + week/month bands, wiring markers to onGoalClick and overlays.
- Utility: renderUtilityRail + setupMobileDrawer(viewDate) emit plan/review/map via eventBus.
Fixes: aligned spine/Now bands to State.viewingDate and let garden navigation shift viewingDate with arrows; week/month bands now render empty-state copy.
TODO/Risks: plan rail still keys off selected vision only.
*/
