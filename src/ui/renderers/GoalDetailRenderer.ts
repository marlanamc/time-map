import type { Goal } from "../../types";
import { Goals, ensurePlanningFocusForGoal } from "../../core/Goals";
import { computeGoalState } from "../../core/GoalStateComputation";
import { goalDetailModal } from "../../components/modals/GoalDetailModal";
import { getVisionAccent } from "../../utils/goalLinkage";
import { eventBus } from "../../core/EventBus";

const PANEL_ID = "goal-detail-panel";

let panelElement: HTMLElement | null = null;
let parentContainer: HTMLElement | null = null;

function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins} min`;
}

function summarizeParent(goal: Goal): string {
  if (!goal.parentId) return "No parent goal";
  const parent = Goals.getById(goal.parentId);
  if (!parent) return "Parent goal missing";
  return `${parent.title} • ${parent.level}`;
}

function ensurePanel(parent: HTMLElement): HTMLElement {
  if (panelElement) return panelElement;

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.className = "goal-detail-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-hidden", "true");
  panel.tabIndex = -1;

  panel.addEventListener("click", (event) => {
    if (event.target === panel) {
      GoalDetailRenderer.hide();
    }
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      GoalDetailRenderer.hide();
    }
  });

  panelElement = panel;
  parent.appendChild(panel);
  return panel;
}

function getPlanLabel(level: Goal["level"]): string | null {
  switch (level) {
    case "vision":
      return "Create recurring plan";
    case "milestone":
      return "Plan effort";
    case "focus":
      return "Plan";
    default:
      return null;
  }
}

function renderGoal(goal: Goal): void {
  if (!panelElement) return;

  const state = computeGoalState(goal);
  const isDormant = state === "dormant";
  const accent = getVisionAccent(goal)?.color ?? "var(--accent)";
  const loggedMinutes = goal.timeLog.reduce((sum, entry) => sum + entry.minutes, 0);
  const commitmentMinutes =
    goal.commitment?.frequency && goal.commitment?.duration
      ? goal.commitment.frequency * goal.commitment.duration
      : 0;
  const commitmentDetails = goal.commitment
    ? `
        <div class="goal-detail-commitment-grid">
          <div>
            <span>Frequency</span>
            <strong>${goal.commitment.frequency}× / week</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>${goal.commitment.duration} min</strong>
          </div>
          <div>
            <span>Energy</span>
            <strong>${goal.commitment.energyType}</strong>
          </div>
          <div>
            <span>Horizon</span>
            <strong>${goal.commitment.horizon}</strong>
          </div>
        </div>
        <p class="goal-detail-commitment-total">
          ~${formatMinutes(commitmentMinutes)} / week
        </p>
      `
    : `<p class="goal-detail-commitment-empty">No commitment yet. Plan something if you'd like to set a rhythm.</p>`;

  // Show dormant action for dormant goals (visions and milestones)
  const showDormantAction = isDormant && (goal.level === "vision" || goal.level === "milestone");
  const dormantActionHtml = showDormantAction
    ? `
      <section class="goal-detail-dormant">
        <div class="goal-detail-dormant-notice">
          <p>This goal hasn't had activity in 30+ days.</p>
          <p class="goal-detail-dormant-prompt">Want to rest it officially, or revive it?</p>
        </div>
        <div class="goal-detail-dormant-actions">
          <button type="button" class="goal-detail-rest-btn">Rest officially</button>
          <button type="button" class="goal-detail-revive-btn">Revive</button>
        </div>
      </section>
    `
    : "";

  panelElement.innerHTML = `
    <div class="goal-detail-card" tabindex="-1">
      <header class="goal-detail-header">
        <button type="button" class="goal-detail-close">← Back to Garden</button>
        ${
          getPlanLabel(goal.level)
            ? `<button type="button" class="goal-detail-plan">${getPlanLabel(goal.level)}</button>`
            : ""
        }
        <button type="button" class="goal-detail-edit">Edit goal</button>
      </header>
      <section class="goal-detail-identity">
        <p class="goal-detail-title">${goal.title}</p>
        <p class="goal-detail-description">${goal.description || "No description yet."}</p>
        <div class="goal-detail-state-badge state-${state}">
          <span style="background: ${accent};"></span>
          <span>${state}</span>
        </div>
      </section>
      ${dormantActionHtml}
      <section class="goal-detail-state">
        <div class="goal-detail-state-row">
          <span>Status</span>
          <strong>${goal.status}</strong>
        </div>
        <div class="goal-detail-state-row">
          <span>Parent</span>
          <strong>${summarizeParent(goal)}</strong>
        </div>
        <div class="goal-detail-state-row">
          <span>Time logged</span>
          <strong>${formatMinutes(loggedMinutes)}</strong>
        </div>
      </section>
      <section class="goal-detail-commitment">
        <h3>Commitment view</h3>
        ${commitmentDetails}
      </section>
      <section class="goal-detail-structure">
        <h3>Optional structure</h3>
        <p>This space can hold structure if helpful.</p>
        <button type="button">+ Add something</button>
        <ul class="goal-detail-structure-list">
          <li>→ Notes (MVP)</li>
          <li>→ Milestones (later)</li>
          <li>→ Habit heatmap (later)</li>
        </ul>
      </section>
    </div>
  `;

  const closeBtn = panelElement.querySelector(".goal-detail-close");
  const planBtn = panelElement.querySelector(".goal-detail-plan");
  const editBtn = panelElement.querySelector(".goal-detail-edit");

  closeBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    GoalDetailRenderer.hide();
  });

  planBtn?.addEventListener("click", async () => {
    try {
      const focus = await ensurePlanningFocusForGoal(goal);
      eventBus.emit("garden:plan-requested", { goalId: focus.id });
    } catch (err) {
      console.warn("Planning not supported for this goal", err);
    }
  });

  editBtn?.addEventListener("click", () => {
    goalDetailModal.show(goal.id);
  });

  // Handle dormant goal actions
  const restBtn = panelElement.querySelector(".goal-detail-rest-btn");
  const reviveBtn = panelElement.querySelector(".goal-detail-revive-btn");

  restBtn?.addEventListener("click", async () => {
    try {
      await Goals.update(goal.id, { archivedAt: new Date().toISOString() });
      GoalDetailRenderer.hide();
      eventBus.emit("garden:goal-archived", { goalId: goal.id });
    } catch (err) {
      console.error("Failed to archive goal", err);
    }
  });

  reviveBtn?.addEventListener("click", async () => {
    try {
      // Update lastWorkedOn to now to make it active again
      await Goals.update(goal.id, { lastWorkedOn: new Date().toISOString() });
      // Re-render to show updated state
      renderGoal(Goals.getById(goal.id)!);
      eventBus.emit("garden:goal-revived", { goalId: goal.id });
    } catch (err) {
      console.error("Failed to revive goal", err);
    }
  });

  const card = panelElement.querySelector(".goal-detail-card") as HTMLElement | null;
  card?.focus();
}

export const GoalDetailRenderer = {
  attach(parent: HTMLElement): void {
    parentContainer = parent;
    ensurePanel(parent);
  },

  show(goalId: string): void {
    if (!parentContainer) return;
    const goal = Goals.getById(goalId);
    if (!goal) return;
    ensurePanel(parentContainer);
    renderGoal(goal);
    if (panelElement) {
      panelElement.classList.add("visible");
      panelElement.setAttribute("aria-hidden", "false");
    }
  },

  hide(): void {
    if (!panelElement) return;
    panelElement.classList.remove("visible");
    panelElement.setAttribute("aria-hidden", "true");
  },
};
