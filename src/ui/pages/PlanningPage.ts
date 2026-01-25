import { eventBus } from "../../core/EventBus";
import { Goals, ensurePlanningFocusForGoal } from "../../core/Goals";
import { RealityPreviewOverlay } from "../components/RealityPreviewOverlay";
import {
  calculateWeeklyTimeCommitment,
  detectOvercommitment,
} from "../../core/TimeCostCalculator";
import type {
  CommitmentHorizon,
  EnergyType,
  Goal,
  GoalLevel,
  GoalStatus,
} from "../../types";

const OVERLAY_ID = "planning-page-overlay";
const PANEL_ID = "planning-page-panel";

type PlanningState = {
  goalId: string | null;
  frequency: number;
  duration: number;
  energyType: EnergyType;
  horizon: CommitmentHorizon;
};

const ENERGY_OPTIONS: EnergyType[] = ["focus", "creative", "rest", "admin"];
const HORIZON_OPTIONS: CommitmentHorizon[] = ["week", "month", "season"];

const DEFAULT_STATE: PlanningState = {
  goalId: null,
  frequency: 2,
  duration: 60,
  energyType: "focus",
  horizon: "week",
};

let overlayElement: HTMLElement | null = null;
let state: PlanningState = { ...DEFAULT_STATE };
let activeGoal: Goal | null = null;
let selectedGoalOptionId: string | null = null;

interface FormElements {
  goalSelect: HTMLSelectElement | null;
  frequencyInput: HTMLInputElement | null;
  durationInput: HTMLInputElement | null;
  energySelect: HTMLSelectElement | null;
  horizonSelect: HTMLSelectElement | null;
  weeklyMinutes: HTMLElement | null;
  existingMinutes: HTMLElement | null;
  consentCopy: HTMLElement | null;
  warning: HTMLElement | null;
  previewBtn: HTMLButtonElement | null;
  includeBtn: HTMLButtonElement | null;
}

let formElements: FormElements | null = null;

function ensureOverlay(): HTMLElement {
  if (overlayElement) return overlayElement;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "planning-page-overlay";
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  document.body.appendChild(overlay);
  overlayElement = overlay;
  return overlay;
}

function resetState(goal?: Goal | null) {
  activeGoal = goal ?? null;
  state = {
    goalId: activeGoal?.id ?? null,
    frequency: clampFrequency(activeGoal?.commitment?.frequency ?? DEFAULT_STATE.frequency),
    duration: clampDuration(activeGoal?.commitment?.duration ?? DEFAULT_STATE.duration),
    energyType: activeGoal?.commitment?.energyType ?? DEFAULT_STATE.energyType,
    horizon: activeGoal?.commitment?.horizon ?? DEFAULT_STATE.horizon,
  };
}

function getPlannableGoals(): Goal[] {
  const LEVEL_ORDER: Record<GoalLevel, number> = {
    vision: 1,
    milestone: 2,
    focus: 3,
    intention: 4,
  };
  const CURRENT_STATUSES: GoalStatus[] = ["not-started", "in-progress", "blocked"];

  return Goals.getAll()
    .filter(
      (goal) =>
        goal.level !== "intention" && CURRENT_STATUSES.includes(goal.status),
    )
    .sort((a, b) => {
      const levelDiff = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
      return levelDiff !== 0 ? levelDiff : a.title.localeCompare(b.title);
    });
}

function formatGoalOption(goal: Goal): string {
  const levelLabel = goal.level.charAt(0).toUpperCase() + goal.level.slice(1);
  return `${levelLabel}: ${goal.title}`;
}

async function selectGoalForPlanning(
  goalId: string | null,
  options?: { suppressRender?: boolean },
) {
  selectedGoalOptionId = goalId;

  if (!goalId) {
    resetState(null);
    if (!options?.suppressRender) {
      renderContent();
    }
    return;
  }

  const goal = Goals.getById(goalId);
  if (!goal) {
    resetState(null);
    if (!options?.suppressRender) {
      renderContent();
    }
    return;
  }

  try {
    const focus = await ensurePlanningFocusForGoal(goal);
    resetState(focus);
  } catch (error) {
    console.warn("Planning selection failed", error);
    resetState(null);
  }

  if (!options?.suppressRender) {
    renderContent();
  }
}

async function prepareGoalSelection(goal: Goal | null) {
  if (goal) {
    selectedGoalOptionId = goal.id;
    resetState(goal);
    return;
  }

  const plannableGoals = getPlannableGoals();
  if (plannableGoals.length === 0) {
    selectedGoalOptionId = null;
    resetState(null);
    return;
  }

  selectedGoalOptionId = plannableGoals[0].id;
  await selectGoalForPlanning(plannableGoals[0].id, { suppressRender: true });
}

function escapeHtml(text: string): string {
  const span = document.createElement("span");
  span.textContent = text;
  return span.innerHTML;
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins} min`;
}

function renderGoalSelectMarkup(): string {
  const goals = getPlannableGoals();
  if (goals.length === 0) {
    return `<div class="planning-input disabled">Add a vision, milestone, or focus to start planning.</div>`;
  }

  if (!selectedGoalOptionId) {
    selectedGoalOptionId = goals[0].id;
  }

  return `
    <select id="planningGoalSelect" class="planning-input">
      ${goals
        .map(
          (goal) =>
            `<option value="${goal.id}" ${
              goal.id === selectedGoalOptionId ? "selected" : ""
            }>${escapeHtml(formatGoalOption(goal))}</option>`,
        )
        .join("")}
    </select>
  `;
}

function clampFrequency(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STATE.frequency;
  return Math.min(7, Math.max(1, Math.round(value)));
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STATE.duration;
  return Math.min(120, Math.max(15, Math.round(value)));
}

function renderContent() {
  const overlay = ensureOverlay();
  const goalLabel = getGoalLabelText();
  overlay.innerHTML = `
    <div class="planning-page-panel" id="${PANEL_ID}">
      <header class="planning-page-header">
        <div>
          <p class="planning-page-label">Plan for</p>
          <h2 class="planning-page-title">
            ${goalLabel}
          </h2>
        </div>
        <button type="button" class="planning-page-close" aria-label="Close planning workspace">
          ×
        </button>
      </header>
      <div class="planning-page-body">
        <div class="planning-page-field">
          <span>Goal</span>
          ${renderGoalSelectMarkup()}
        </div>

        <div class="planning-input-grid">
          <label class="planning-page-field">
            <span>Frequency / week</span>
            <input id="planningFrequency" type="number" min="1" max="7" class="planning-input" value="${state.frequency}" />
          </label>
          <label class="planning-page-field">
            <span>Duration (minutes)</span>
            <input id="planningDuration" type="number" min="15" max="120" class="planning-input" value="${state.duration}" />
          </label>
          <label class="planning-page-field">
            <span>Energy type</span>
            <select id="planningEnergy" class="planning-input">
              ${ENERGY_OPTIONS.map(
                (value) => `<option value="${value}" ${value === state.energyType ? "selected" : ""}>${value}</option>`,
              ).join("")}
            </select>
          </label>
          <label class="planning-page-field">
            <span>Horizon</span>
            <select id="planningHorizon" class="planning-input">
              ${HORIZON_OPTIONS.map(
                (value) => `<option value="${value}" ${value === state.horizon ? "selected" : ""}>${value}</option>`,
              ).join("")}
            </select>
          </label>
        </div>

        <div class="planning-summary">
          <p id="planningExistingMinutes" class="planning-summary-text"></p>
          <p id="planningWeeklyMinutes" class="planning-summary-text"></p>
          <p id="planningWarning" class="planning-warning"></p>
        </div>

        <div class="planning-actions">
          <button type="button" id="planningPreviewBtn" class="planning-preview-btn">Preview</button>
          <div class="planning-consent">
            <p class="planning-consent-copy" id="planningConsentCopy">
              This adds ~${formatMinutes(state.frequency * state.duration)} per week on top of what’s already here.
            </p>
            <div class="planning-consent-buttons">
              <button type="button" id="planningIncludeBtn" class="planning-include-btn">Include</button>
              <button type="button" id="planningNotNowBtn" class="planning-neutral-btn">Not now</button>
              <button type="button" id="planningLightenBtn" class="planning-neutral-btn">Make lighter</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupElements();
  updateSummary();
}

function getGoalLabelText(): string {
  if (activeGoal) {
    return `${escapeHtml(activeGoal.title)} (${activeGoal.level})`;
  }

  if (selectedGoalOptionId) {
    const goal = Goals.getById(selectedGoalOptionId);
    if (goal) {
      return `${escapeHtml(goal.title)} (${goal.level})`;
    }
  }

  return "Select a goal to plan";
}

function setupElements() {
  if (!overlayElement) return;
  formElements = {
    goalSelect: overlayElement.querySelector("#planningGoalSelect"),
    frequencyInput: overlayElement.querySelector("#planningFrequency"),
    durationInput: overlayElement.querySelector("#planningDuration"),
    energySelect: overlayElement.querySelector("#planningEnergy"),
    horizonSelect: overlayElement.querySelector("#planningHorizon"),
    weeklyMinutes: overlayElement.querySelector("#planningWeeklyMinutes"),
    existingMinutes: overlayElement.querySelector("#planningExistingMinutes"),
    consentCopy: overlayElement.querySelector("#planningConsentCopy"),
    warning: overlayElement.querySelector("#planningWarning"),
    previewBtn: overlayElement.querySelector("#planningPreviewBtn"),
    includeBtn: overlayElement.querySelector("#planningIncludeBtn"),
  };

  overlayElement
    .querySelector(".planning-page-close")
    ?.addEventListener("click", () => close());

  formElements?.goalSelect?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    void selectGoalForPlanning(select.value);
  });

  formElements?.frequencyInput?.addEventListener("input", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state.frequency = clampFrequency(Number(input.value));
    input.value = String(state.frequency);
    updateSummary();
  });

  formElements?.durationInput?.addEventListener("input", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state.duration = clampDuration(Number(input.value));
    input.value = String(state.duration);
    updateSummary();
  });

  formElements?.energySelect?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    state.energyType = select.value as EnergyType;
    updateSummary();
  });

  formElements?.horizonSelect?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    state.horizon = select.value as CommitmentHorizon;
    updateSummary();
  });

  formElements?.previewBtn?.addEventListener("click", () => handlePreview());
  formElements?.includeBtn?.addEventListener("click", () => handleInclude());
  overlayElement
    .querySelector("#planningNotNowBtn")
    ?.addEventListener("click", () => close());
  overlayElement
    .querySelector("#planningLightenBtn")
    ?.addEventListener("click", () => lightenPlan());
}

function updateSummary() {
  const allCommitments = calculateWeeklyTimeCommitment(Goals.getAll());
  const currentGoalCommitment = state.goalId
    ? allCommitments.byGoal.get(state.goalId) ?? 0
    : 0;
  const weeklyMinutes = state.frequency * state.duration;
  const entriesMinutes = allCommitments.totalMinutes - currentGoalCommitment;
  const warning = detectOvercommitment(entriesMinutes, weeklyMinutes);

  if (formElements?.weeklyMinutes) {
    formElements.weeklyMinutes.textContent = `Planned addition: ${formatMinutes(
      weeklyMinutes,
    )} per week.`;
  }
  if (formElements?.existingMinutes) {
    formElements.existingMinutes.textContent = `Existing commitments (excluding current goal): ${formatMinutes(
      entriesMinutes,
    )}`;
  }
  if (formElements?.consentCopy) {
    formElements.consentCopy.textContent = `This adds ~${formatMinutes(
      weeklyMinutes,
    )} on top of what’s already planned.`;
  }
  if (formElements?.warning) {
    formElements.warning.textContent = warning ? warning.message : "";
  }
  const disableButtons = !state.goalId && !selectedGoalOptionId;
  if (formElements?.previewBtn) {
    formElements.previewBtn.disabled = disableButtons;
  }
  if (formElements?.includeBtn) {
    formElements.includeBtn.disabled = disableButtons;
  }
}

function getPreviewGoal(commitment: PlanningState): Goal | null {
  if (!state.goalId) return null;
  const existing = Goals.getById(state.goalId);
  if (!existing) return null;

  const previewCommitment = {
    frequency: commitment.frequency,
    duration: commitment.duration,
    energyType: commitment.energyType,
    horizon: commitment.horizon,
    createdAt: existing.commitment?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    ...existing,
    commitment: previewCommitment,
  };
}

function handlePreview() {
  const preview = getPreviewGoal(state);
  if (!preview) return;
  RealityPreviewOverlay.show(preview);
}

function handleInclude() {
  if (!state.goalId) return;
  const goal = Goals.getById(state.goalId);
  if (!goal) return;

  const newCommitment = {
    frequency: state.frequency,
    duration: state.duration,
    energyType: state.energyType,
    horizon: state.horizon,
    createdAt: goal.commitment?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  Goals.update(state.goalId, { commitment: newCommitment });
  eventBus.emit("ui:toast", {
    icon: "✅",
    message: "Commitment added",
  });
  close();
}

function lightenPlan() {
  state.frequency = Math.max(1, Math.min(7, Math.floor(state.frequency * 0.75)));
  state.duration = Math.max(15, Math.min(120, Math.floor(state.duration * 0.75)));

  if (formElements?.frequencyInput) {
    formElements.frequencyInput.value = String(state.frequency);
  }
  if (formElements?.durationInput) {
    formElements.durationInput.value = String(state.duration);
  }
  updateSummary();
}

async function openOverlay(goal: Goal | null) {
  await prepareGoalSelection(goal);
  renderContent();
  requestAnimationFrame(() => {
    overlayElement?.classList.add("visible");
  });
}

function close() {
  overlayElement?.classList.remove("visible");
  RealityPreviewOverlay.hide();
}

export const PlanningPage = {
  async open(goalId?: string | null) {
    const goal = goalId ? Goals.getById(goalId) : null;
    if (goal && goal.level !== "focus") {
      console.warn("PlanningPage expected focus, got", goal.level);
    }
    await openOverlay(goal?.level === "focus" ? goal : null);
  },
  close() {
    close();
  },
};
