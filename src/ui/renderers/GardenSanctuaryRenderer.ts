/**
 * GardenSanctuaryRenderer
 *
 * A calm, visual sanctuary where progress is visualized through
 * the garden metaphor. The garden IS the data - no floating stats,
 * just plants that grow based on actual completion rates.
 */

import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { WeekReflections } from "../../core/WeekReflections";
import { eventBus } from "../../core/EventBus";
import { NDSupport } from "../../features/ndSupport";
import type { Goal, GoalLevel, UIElements, WeekReflection } from "../../types";
import { getVisionAccent, type LinkAccent } from "../../utils/goalLinkage";

// ============================================
// Types
// ============================================

type GrowthState = "seed" | "sprouting" | "growing" | "blooming";

interface VisionPlot {
  vision: Goal;
  accent: LinkAccent | null;
  milestones: Goal[];
  focuses: Goal[];
  intentions: Goal[];
  completionRate: number;
  growthState: GrowthState;
  totalIntentions: number;
  completedIntentions: number;
}

// ============================================
// State
// ============================================

let selectedVisionId: string | null = null;
let reflectionCache: WeekReflection | null = null;
let reflectionLoaded = false;

// ============================================
// Helpers
// ============================================

function getWeekInfo(date: Date): { weekNum: number; weekYear: number } {
  const weekNum = State.getWeekNumber(date);
  const weekYear = State.getWeekYear(date);
  return { weekNum, weekYear };
}

function getGrowthState(completionRate: number): GrowthState {
  if (completionRate === 0) return "seed";
  if (completionRate < 35) return "sprouting";
  if (completionRate < 75) return "growing";
  return "blooming";
}

function getGrowthLabel(state: GrowthState): string {
  switch (state) {
    case "seed":
      return "Planted";
    case "sprouting":
      return "Sprouting";
    case "growing":
      return "Growing";
    case "blooming":
      return "Blooming";
  }
}

function formatTimeLogged(minutes: number): string {
  if (minutes === 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function calculateTimeLogged(goal: Goal): number {
  if (!goal.timeLog || goal.timeLog.length === 0) return 0;
  return goal.timeLog.reduce((sum, entry) => sum + (entry.minutes || 0), 0);
}

// ============================================
// Data Building
// ============================================

function buildVisionPlots(): VisionPlot[] {
  const allGoals = Goals.getAll();
  const viewingYear = State.viewingYear;

  // Get visions for current year
  const visions = allGoals.filter(
    (g) =>
      g.level === "vision" && g.year === viewingYear && g.status !== "archived",
  );

  return visions.map((vision) => {
    const accent = getVisionAccent(vision);

    // Find all descendants
    const milestones = allGoals.filter(
      (g) =>
        g.level === "milestone" &&
        g.parentId === vision.id &&
        g.status !== "archived",
    );

    const milestoneIds = new Set(milestones.map((m) => m.id));

    const focuses = allGoals.filter((g) => {
      if (g.level !== "focus" || g.status === "archived") return false;
      // Direct child of vision or child of a milestone
      return g.parentId === vision.id || milestoneIds.has(g.parentId || "");
    });

    const focusIds = new Set(focuses.map((f) => f.id));

    const intentions = allGoals.filter((g) => {
      if (g.level !== "intention" || g.status === "archived") return false;
      // Direct child of focus or milestone
      return (
        focusIds.has(g.parentId || "") || milestoneIds.has(g.parentId || "")
      );
    });

    const totalIntentions = intentions.length;
    const completedIntentions = intentions.filter(
      (i) => i.status === "done",
    ).length;
    const completionRate =
      totalIntentions > 0
        ? Math.round((completedIntentions / totalIntentions) * 100)
        : 0;

    return {
      vision,
      accent,
      milestones,
      focuses,
      intentions,
      completionRate,
      growthState: getGrowthState(completionRate),
      totalIntentions,
      completedIntentions,
    };
  });
}

// ============================================
// Render Components
// ============================================

function renderPlant(
  plot: VisionPlot,
  escapeHtml: (s: string) => string,
): string {
  const { vision, accent, growthState } = plot;
  const accentColor = accent?.color || "var(--primary)";
  const icon = vision.icon || "✨";

  const isSelected = selectedVisionId === vision.id;

  return `
    <button
      class="sanctuary-plant sanctuary-plant--${growthState} ${isSelected ? "is-selected" : ""}"
      data-action="select-vision"
      data-id="${vision.id}"
      style="--plant-accent: ${accentColor};"
      aria-label="${escapeHtml(vision.title)}, ${getGrowthLabel(growthState)}"
    >
      <div class="sanctuary-plant__visual">
        <div class="sanctuary-plant__icon">${icon}</div>
        <svg class="sanctuary-plant__growth" viewBox="0 0 100 100" aria-hidden="true">
          ${renderGrowthSvg(growthState, accentColor)}
        </svg>
      </div>
      <div class="sanctuary-plant__label">
        <span class="sanctuary-plant__title">${escapeHtml(vision.title)}</span>
        <span class="sanctuary-plant__state">${getGrowthLabel(growthState)}</span>
      </div>
    </button>
  `;
}

function renderGrowthSvg(state: GrowthState, color: string): string {
  const baseOpacity = "0.15";
  const growthOpacity = "0.3";

  switch (state) {
    case "seed":
      return `
        <circle cx="50" cy="70" r="8" fill="${color}" opacity="${baseOpacity}" class="sanctuary-seed"/>
        <circle cx="50" cy="70" r="4" fill="${color}" opacity="0.4" class="sanctuary-seed-core"/>
      `;
    case "sprouting":
      return `
        <circle cx="50" cy="75" r="6" fill="${color}" opacity="${baseOpacity}"/>
        <path d="M50 75 Q50 55 50 45" stroke="${color}" stroke-width="3" fill="none" opacity="${growthOpacity}" class="sanctuary-stem"/>
        <ellipse cx="45" cy="48" rx="8" ry="5" fill="${color}" opacity="${growthOpacity}" transform="rotate(-30 45 48)" class="sanctuary-leaf"/>
      `;
    case "growing":
      return `
        <circle cx="50" cy="80" r="8" fill="${color}" opacity="${baseOpacity}"/>
        <path d="M50 80 Q50 50 50 30" stroke="${color}" stroke-width="4" fill="none" opacity="${growthOpacity}" class="sanctuary-stem"/>
        <ellipse cx="40" cy="55" rx="12" ry="6" fill="${color}" opacity="${growthOpacity}" transform="rotate(-40 40 55)" class="sanctuary-leaf"/>
        <ellipse cx="60" cy="45" rx="12" ry="6" fill="${color}" opacity="${growthOpacity}" transform="rotate(40 60 45)" class="sanctuary-leaf"/>
        <ellipse cx="42" cy="35" rx="10" ry="5" fill="${color}" opacity="${growthOpacity}" transform="rotate(-25 42 35)" class="sanctuary-leaf"/>
      `;
    case "blooming":
      return `
        <circle cx="50" cy="85" r="10" fill="${color}" opacity="${baseOpacity}"/>
        <path d="M50 85 Q50 50 50 25" stroke="${color}" stroke-width="5" fill="none" opacity="${growthOpacity}" class="sanctuary-stem"/>
        <ellipse cx="35" cy="60" rx="14" ry="7" fill="${color}" opacity="${growthOpacity}" transform="rotate(-45 35 60)" class="sanctuary-leaf"/>
        <ellipse cx="65" cy="50" rx="14" ry="7" fill="${color}" opacity="${growthOpacity}" transform="rotate(45 65 50)" class="sanctuary-leaf"/>
        <ellipse cx="38" cy="38" rx="12" ry="6" fill="${color}" opacity="${growthOpacity}" transform="rotate(-30 38 38)" class="sanctuary-leaf"/>
        <ellipse cx="62" cy="32" rx="12" ry="6" fill="${color}" opacity="${growthOpacity}" transform="rotate(30 62 32)" class="sanctuary-leaf"/>
        <!-- Flower -->
        <circle cx="50" cy="20" r="12" fill="${color}" opacity="0.5" class="sanctuary-bloom"/>
        <circle cx="50" cy="20" r="6" fill="${color}" opacity="0.8" class="sanctuary-bloom-center"/>
      `;
  }
}

function renderVisionDetail(
  plot: VisionPlot,
  escapeHtml: (s: string) => string,
): string {
  const {
    vision,
    accent,
    milestones,
    focuses,
    intentions,
    completionRate,
    growthState,
  } = plot;
  const accentColor = accent?.color || "var(--primary)";
  const icon = vision.icon || "✨";

  const completedIntentions = intentions.filter(
    (i) => i.status === "done",
  ).length;
  const inProgressIntentions = intentions.filter(
    (i) => i.status === "in-progress",
  ).length;
  const activeFocuses = focuses.filter(
    (f) => f.status === "in-progress",
  ).length;
  const completedMilestones = milestones.filter(
    (m) => m.status === "done",
  ).length;

  // Calculate total time logged across all descendants
  const totalTime = [...milestones, ...focuses, ...intentions].reduce(
    (sum, g) => sum + calculateTimeLogged(g),
    calculateTimeLogged(vision),
  );
  const timeDisplay = formatTimeLogged(totalTime);

  return `
    <div class="sanctuary-detail" style="--detail-accent: ${accentColor};">
      <button class="sanctuary-detail__close" data-action="close-detail" aria-label="Close details">
        <span aria-hidden="true">&larr;</span> Back to garden
      </button>

      <div class="sanctuary-detail__header">
        <span class="sanctuary-detail__icon">${icon}</span>
        <h2 class="sanctuary-detail__title">${escapeHtml(vision.title)}</h2>
        ${vision.description ? `<p class="sanctuary-detail__desc">${escapeHtml(vision.description)}</p>` : ""}
      </div>

      <div class="sanctuary-detail__progress">
        <div class="sanctuary-detail__ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--divider)" stroke-width="8"/>
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="${accentColor}"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray="${completionRate * 2.83} 283"
              transform="rotate(-90 50 50)"
              class="sanctuary-detail__ring-progress"
            />
          </svg>
          <span class="sanctuary-detail__ring-value">${completionRate}%</span>
        </div>
        <span class="sanctuary-detail__growth-label">${getGrowthLabel(growthState)}</span>
      </div>

      <div class="sanctuary-detail__stats">
        ${completedIntentions > 0 ? `<div class="sanctuary-detail__stat"><span class="stat-icon">🌸</span> ${completedIntentions} bloomed</div>` : ""}
        ${inProgressIntentions > 0 ? `<div class="sanctuary-detail__stat"><span class="stat-icon">🌿</span> ${inProgressIntentions} growing</div>` : ""}
        ${activeFocuses > 0 ? `<div class="sanctuary-detail__stat"><span class="stat-icon">🔎</span> ${activeFocuses} active focus</div>` : ""}
        ${completedMilestones > 0 ? `<div class="sanctuary-detail__stat"><span class="stat-icon">🎯</span> ${completedMilestones} milestones reached</div>` : ""}
        ${timeDisplay ? `<div class="sanctuary-detail__stat"><span class="stat-icon">⏱️</span> ${timeDisplay} invested</div>` : ""}
      </div>

      ${milestones.length > 0 ? renderMilestoneTree(milestones, focuses, intentions, escapeHtml, accentColor) : ""}
    </div>
  `;
}

function renderMilestoneTree(
  milestones: Goal[],
  focuses: Goal[],
  intentions: Goal[],
  escapeHtml: (s: string) => string,
  accentColor: string,
): string {
  return `
    <div class="sanctuary-detail__tree">
      <h3 class="sanctuary-detail__tree-title">Journey</h3>
      <div class="sanctuary-detail__branches">
        ${milestones
          .map((milestone) => {
            const isDone = milestone.status === "done";
            const milestoneIntentions = intentions.filter((i) => {
              const focus = focuses.find((f) => f.id === i.parentId);
              return (
                focus?.parentId === milestone.id || i.parentId === milestone.id
              );
            });
            const completedCount = milestoneIntentions.filter(
              (i) => i.status === "done",
            ).length;

            return `
            <div class="sanctuary-branch ${isDone ? "is-complete" : ""}">
              <div class="sanctuary-branch__connector" style="--branch-color: ${accentColor}"></div>
              <div class="sanctuary-branch__content">
                <span class="sanctuary-branch__icon">${isDone ? "🌸" : "🎯"}</span>
                <span class="sanctuary-branch__title">${escapeHtml(milestone.title)}</span>
                ${
                  milestoneIntentions.length > 0
                    ? `<span class="sanctuary-branch__count">${completedCount}/${milestoneIntentions.length}</span>`
                    : ""
                }
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderQuietPulse(streak: number, bloomsToday: number): string {
  // Only show if there's something to show
  if (streak === 0 && bloomsToday === 0) return "";

  return `
    <div class="sanctuary-pulse" aria-label="Today's garden activity">
      ${
        bloomsToday > 0
          ? `
        <span class="sanctuary-pulse__item sanctuary-pulse__blooms" title="${bloomsToday} intentions completed today">
          ${"🌸".repeat(Math.min(bloomsToday, 5))}${bloomsToday > 5 ? `+${bloomsToday - 5}` : ""}
        </span>
      `
          : ""
      }
      ${
        streak > 0
          ? `
        <span class="sanctuary-pulse__item sanctuary-pulse__streak" title="${streak} day streak">
          <span class="sanctuary-pulse__vine" style="--vine-length: ${Math.min(streak, 30)}"></span>
        </span>
      `
          : ""
      }
    </div>
  `;
}

function renderStartButton(
  currentFocus: Goal | null,
  escapeHtml: (s: string) => string,
): string {
  return `
    <div class="sanctuary-start">
      <button class="sanctuary-start__btn" data-action="start-focus">
        <span class="sanctuary-start__icon">🌱</span>
        <span class="sanctuary-start__label">
          ${
            currentFocus
              ? `Continue: ${escapeHtml(currentFocus.title.slice(0, 30))}${currentFocus.title.length > 30 ? "..." : ""}`
              : "Start tending"
          }
        </span>
      </button>
    </div>
  `;
}

function renderEmptyGarden(): string {
  return `
    <div class="sanctuary-empty">
      <div class="sanctuary-empty__icon">🌱</div>
      <h2 class="sanctuary-empty__title">Your garden awaits</h2>
      <p class="sanctuary-empty__text">Plant your first vision to begin growing</p>
    </div>
  `;
}

// ============================================
// Main Renderer
// ============================================

export const GardenSanctuaryRenderer = {
  render(
    elements: UIElements,
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
    onAddGoal?: (level: GoalLevel) => void,
  ) {
    if (!State.data) return;

    const container = elements.calendarGrid;
    if (!container) return;

    const today = new Date();
    const { weekNum, weekYear } = getWeekInfo(today);

    // Load reflection if not loaded
    if (!reflectionLoaded) {
      reflectionLoaded = true;
      WeekReflections.get(weekYear, weekNum).then((reflection) => {
        reflectionCache = reflection;
        if (State.currentView === "garden") {
          eventBus.emit("view:changed", { transition: false });
        }
      });
    }

    // Build data
    const plots = buildVisionPlots();
    const selectedPlot = selectedVisionId
      ? plots.find((p) => p.vision.id === selectedVisionId)
      : null;

    // Calculate today's stats
    const allGoals = Goals.getAll();
    const bloomsToday = allGoals.filter(
      (g) =>
        g.level === "intention" &&
        g.status === "done" &&
        g.completedAt &&
        new Date(g.completedAt).toDateString() === today.toDateString(),
    ).length;

    const streak = State.data?.streak?.count || 0;

    // Find current in-progress intention
    const currentFocus =
      allGoals.find(
        (g) => g.level === "intention" && g.status === "in-progress",
      ) || null;

    // Render
    container.className = "sanctuary-container";

    if (selectedPlot) {
      // Detail view
      container.innerHTML = `
        <div class="sanctuary sanctuary--detail">
          ${renderVisionDetail(selectedPlot, escapeHtmlFn)}
        </div>
      `;
    } else {
      // Overview
      container.innerHTML = `
        <div class="sanctuary sanctuary--overview">
          ${renderQuietPulse(streak, bloomsToday)}

          <div class="sanctuary-garden">
            ${
              plots.length > 0
                ? `<div class="sanctuary-garden__plots">
                  ${plots.map((plot) => renderPlant(plot, escapeHtmlFn)).join("")}
                </div>`
                : renderEmptyGarden()
            }
          </div>

          ${renderStartButton(currentFocus, escapeHtmlFn)}
        </div>
      `;
    }

    // Bind events
    bindEvents(container, onGoalClick, onAddGoal, weekYear, weekNum);
  },
};

// ============================================
// Event Binding
// ============================================

function bindEvents(
  container: HTMLElement,
  _onGoalClick: (goalId: string) => void,
  onAddGoal: ((level: GoalLevel) => void) | undefined,
  weekYear: number,
  weekNum: number,
) {
  // Select vision
  container.querySelectorAll('[data-action="select-vision"]').forEach((el) => {
    el.addEventListener("click", (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      if (id) {
        selectedVisionId = id;
        eventBus.emit("view:changed", { transition: false });
      }
    });
  });

  // Close detail
  container
    .querySelector('[data-action="close-detail"]')
    ?.addEventListener("click", () => {
      selectedVisionId = null;
      eventBus.emit("view:changed", { transition: false });
    });

  // Start focus
  container
    .querySelector('[data-action="start-focus"]')
    ?.addEventListener("click", () => {
      // Find an in-progress intention or the first available one
      const allGoals = Goals.getAll();
      let targetGoal = allGoals.find(
        (g) => g.level === "intention" && g.status === "in-progress",
      );

      if (!targetGoal) {
        targetGoal = allGoals.find(
          (g) => g.level === "intention" && g.status === "not-started",
        );
      }

      if (targetGoal) {
        Goals.update(targetGoal.id, { status: "in-progress" });
        NDSupport.startBodyDouble(15); // Start 15-minute focus
        eventBus.emit("view:changed", { transition: false });
      } else if (onAddGoal) {
        onAddGoal("intention");
      }
    });

  // Keyboard navigation for plants
  container.querySelectorAll(".sanctuary-plant").forEach((el, index, arr) => {
    el.addEventListener("keydown", (e) => {
      const key = (e as KeyboardEvent).key;
      if (key === "ArrowRight" || key === "ArrowDown") {
        e.preventDefault();
        const next = arr[(index + 1) % arr.length] as HTMLElement;
        next?.focus();
      } else if (key === "ArrowLeft" || key === "ArrowUp") {
        e.preventDefault();
        const prev = arr[(index - 1 + arr.length) % arr.length] as HTMLElement;
        prev?.focus();
      }
    });
  });
}

// Reset state when leaving garden view
eventBus.on("view:changed", () => {
  if (State.currentView !== "garden") {
    selectedVisionId = null;
    reflectionLoaded = false;
    reflectionCache = null;
  }
});
