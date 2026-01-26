import { eventBus } from "../../core/EventBus";
import { Goals } from "../../core/Goals";
import type { EnergyType, Goal, GoalLevel, GoalStatus } from "../../types";

const OVERLAY_ID = "planning-page-overlay";
const PANEL_ID = "planning-page-panel";

type IntentionState = {
  title: string;
  parentGoalId: string | null;
  frequency: number;
  duration: number;
  energyType: EnergyType;
  energyType: EnergyType;
  specificDays: number[]; // 0=Sun..6=Sat
};

const ENERGY_OPTIONS: EnergyType[] = ["focus", "creative", "rest", "admin"];

const DEFAULT_STATE: IntentionState = {
  title: "",
  parentGoalId: null,
  frequency: 2,
  duration: 30,
  energyType: "focus",
  specificDays: [],
};

const DAYS_OF_WEEK = [
  { label: "S", value: 0 },
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
];

let overlayElement: HTMLElement | null = null;
let state: IntentionState = { ...DEFAULT_STATE };

interface FormElements {
  titleInput: HTMLInputElement | null;
  goalSelect: HTMLSelectElement | null;
  frequencyInput: HTMLInputElement | null;
  durationInput: HTMLInputElement | null;
  energySelect: HTMLSelectElement | null;
  saveBtn: HTMLButtonElement | null;
  dayButtons: NodeListOf<HTMLButtonElement> | null;
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

function resetState(parentGoalId?: string | null) {
  state = {
    ...DEFAULT_STATE,
    parentGoalId: parentGoalId ?? null,
    // Reset specific days
    specificDays: [],
  };
}

function getPlannableGoals(): Goal[] {
  const LEVEL_ORDER: Record<GoalLevel, number> = {
    vision: 1,
    milestone: 2,
    focus: 3,
    intention: 4,
  };
  const CURRENT_STATUSES: GoalStatus[] = [
    "not-started",
    "in-progress",
    "blocked",
  ];

  return Goals.getAll()
    .filter(
      (goal) =>
        goal.level === "focus" && CURRENT_STATUSES.includes(goal.status),
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

function escapeHtml(text: string): string {
  const span = document.createElement("span");
  span.textContent = text;
  return span.innerHTML;
}

function clampFrequency(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STATE.frequency;
  return Math.min(7, Math.max(1, Math.round(value)));
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STATE.duration;
  return Math.min(120, Math.max(15, Math.round(value)));
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
    return `<div class="planning-input disabled">Add a focus goal first.</div>`;
  }

  if (!state.parentGoalId) {
    state.parentGoalId = goals[0].id;
  }

  return `
    <select id="planningGoalSelect" class="planning-input">
      ${goals
        .map(
          (goal) =>
            `<option value="${goal.id}" ${
              goal.id === state.parentGoalId ? "selected" : ""
            }>${escapeHtml(formatGoalOption(goal))}</option>`,
        )
        .join("")}
    </select>
  `;
}

function renderDayButtons(): string {
  return `
    <div class="planning-days-grid">
      ${DAYS_OF_WEEK.map(
        (day) => `
        <button 
          type="button" 
          class="planning-day-btn ${state.specificDays.includes(day.value) ? "selected" : ""}" 
          data-day="${day.value}"
        >
          ${day.label}
        </button>
      `,
      ).join("")}
    </div>
  `;
}

function renderContent() {
  const overlay = ensureOverlay();
  const hasGoals = getPlannableGoals().length > 0;

  overlay.innerHTML = `
    <div class="planning-page-panel" id="${PANEL_ID}">
      <header class="planning-page-header">
        <div>
          <p class="planning-page-label">Create Intention</p>
          <h2 class="planning-page-title">What do you want to do?</h2>
        </div>
        <button type="button" class="planning-page-close" aria-label="Close">
          ×
        </button>
      </header>
      <div class="planning-page-body">
        <label class="planning-page-field">
          <span>Title</span>
          <input 
            id="planningTitleInput" 
            type="text" 
            class="planning-input" 
            placeholder="e.g., Morning workout, Clean desk, Read article..."
            value="${escapeHtml(state.title)}"
            autofocus
          />
        </label>

        <div class="planning-page-field">
          <span>Link to Goal</span>
          ${renderGoalSelectMarkup()}
        </div>

        <div class="planning-page-field">
          <span>Days</span>
          ${renderDayButtons()}
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
                (value) =>
                  `<option value="${value}" ${value === state.energyType ? "selected" : ""}>${value}</option>`,
              ).join("")}
            </select>
          </label>
        </div>

        <div class="planning-summary">
          <p id="planningWeeklyMinutes" class="planning-summary-text"></p>
        </div>

        <div class="planning-actions">
          <div class="planning-consent-buttons">
            <button type="button" id="planningSaveBtn" class="planning-include-btn" ${!hasGoals ? "disabled" : ""}>
              Add Intention
            </button>
            <button type="button" id="planningCancelBtn" class="planning-neutral-btn">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add styles for day buttons if not present (simple inline injection for now, ideally in CSS)
  // But wait, user said "Vanilla CSS". PlanningPage.ts usually relies on global CSS.
  // I will check if I need to inject styles or if "planning-day-btn" needs to be added to CSS.
  // For now, I'll assume I should rely on existing classes or basic styles.
  // Let's add a style block just for this feature to ensure it works immediately.
  const styleId = "planning-page-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .planning-days-grid {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }
      .planning-day-btn {
        flex: 1;
        height: 40px;
        border: 1px solid var(--border-color, #e5e7eb);
        background: var(--bg-surface, #ffffff);
        border-radius: 8px;
        font-weight: 500;
        color: var(--text-secondary, #6b7280);
        cursor: pointer;
        transition: all 0.2s;
      }
      .planning-day-btn:hover {
        background: var(--bg-hover, #f3f4f6);
      }
      .planning-day-btn.selected {
        background: var(--primary-color, #8b5cf6);
        color: white;
        border-color: var(--primary-color, #8b5cf6);
      }
    `;
    document.head.appendChild(style);
  }

  setupElements();
  updateSaveButton();
  updateSummary();
}

function setupElements() {
  if (!overlayElement) return;
  formElements = {
    titleInput: overlayElement.querySelector("#planningTitleInput"),
    goalSelect: overlayElement.querySelector("#planningGoalSelect"),
    frequencyInput: overlayElement.querySelector("#planningFrequency"),
    durationInput: overlayElement.querySelector("#planningDuration"),
    energySelect: overlayElement.querySelector("#planningEnergy"),
    saveBtn: overlayElement.querySelector("#planningSaveBtn"),
    dayButtons: overlayElement.querySelectorAll(".planning-day-btn"),
  };

  overlayElement
    .querySelector(".planning-page-close")
    ?.addEventListener("click", () => close());

  formElements?.titleInput?.addEventListener("input", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state.title = input.value;
    updateSaveButton();
  });

  formElements?.goalSelect?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    state.parentGoalId = select.value;
  });

  formElements?.dayButtons?.forEach((btn) => {
    btn.addEventListener("click", () => {
      const day = Number(btn.dataset.day);
      if (state.specificDays.includes(day)) {
        state.specificDays = state.specificDays.filter((d) => d !== day);
      } else {
        state.specificDays.push(day);
      }

      // Update UI
      btn.classList.toggle("selected", state.specificDays.includes(day));

      // Sync frequency
      if (state.specificDays.length > 0) {
        state.frequency = state.specificDays.length;
        if (formElements?.frequencyInput) {
          formElements.frequencyInput.value = String(state.frequency);
        }
      }
      updateSummary();
    });
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
  });

  formElements?.saveBtn?.addEventListener("click", () => handleSave());
  overlayElement
    .querySelector("#planningCancelBtn")
    ?.addEventListener("click", () => close());

  // Focus the title input
  formElements?.titleInput?.focus();
}

function updateSaveButton() {
  const canSave = state.title.trim().length > 0 && state.parentGoalId !== null;
  if (formElements?.saveBtn) {
    formElements.saveBtn.disabled = !canSave;
  }
}

function updateSummary() {
  const weeklyMinutes = state.frequency * state.duration;
  const weeklyMinutesEl = overlayElement?.querySelector(
    "#planningWeeklyMinutes",
  );
  if (weeklyMinutesEl) {
    weeklyMinutesEl.textContent = `This adds ~${formatMinutes(weeklyMinutes)} per week to your schedule.`;
  }
}

function handleSave() {
  const title = state.title.trim();
  if (!title || !state.parentGoalId) return;

  const parentGoal = Goals.getById(state.parentGoalId);
  if (!parentGoal) return;

  // Create the new intention linked to the parent goal with commitment
  Goals.create({
    title,
    level: "intention",
    category: parentGoal.category ?? undefined,
    parentId: state.parentGoalId,
    commitment: {
      frequency: state.frequency,
      duration: state.duration,
      energyType: state.energyType,
      specificDays:
        state.specificDays.length > 0 ? state.specificDays : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  eventBus.emit("ui:toast", {
    icon: "✅",
    message: "Intention added",
  });

  close();
}

async function openOverlay(parentGoalId: string | null) {
  resetState(parentGoalId);
  renderContent();
  requestAnimationFrame(() => {
    overlayElement?.classList.add("visible");
  });
}

function close() {
  overlayElement?.classList.remove("visible");
}

export const PlanningPage = {
  async open(goalId?: string | null) {
    await openOverlay(goalId ?? null);
  },
  close() {
    close();
  },
};
