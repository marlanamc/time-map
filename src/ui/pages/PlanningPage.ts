import { eventBus } from "../../core/EventBus";
import { Goals, ensurePlanningFocusForGoal } from "../../core/Goals";
import type {
  EnergyType,
  Goal,
  GoalData,
  GoalLevel,
  GoalStatus,
  LinkTargetType,
} from "../../types";
import { dirtyTracker } from "../../services/DirtyTracker";

const OVERLAY_ID = "planning-page-overlay";
const PANEL_ID = "planning-page-panel";

type IntentionState = {
  title: string;
  emoji: string | null;
  linkType: LinkTargetType;
  linkTargetId: string | null;
  frequency: number;
  duration: number;
  energyType: EnergyType;
  specificDays: number[]; // 0=Sun..6=Sat
  timeOfDay: string;
};

const ENERGY_OPTIONS: EnergyType[] = ["focus", "creative", "rest", "admin"];

const DEFAULT_STATE: IntentionState = {
  title: "",
  emoji: null,
  linkType: "focus",
  linkTargetId: null,
  frequency: 2,
  duration: 30,
  energyType: "focus",
  specificDays: [],
  timeOfDay: "",
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

const LINK_TARGET_TYPES: LinkTargetType[] = ["vision", "milestone", "focus"];
const LINK_TARGET_LABELS: Record<LinkTargetType, string> = {
  vision: "Vision",
  milestone: "Milestone",
  focus: "Focus",
};
const LINKABLE_STATUSES: GoalStatus[] = ["not-started", "in-progress", "blocked"];
const EMOJI_SUGGESTIONS = ["🌱", "✨", "🔥", "☀️", "⚡", "🧘", "📚"];

const GOAL_LEVEL_ORDER: Record<GoalLevel, number> = {
  vision: 1,
  milestone: 2,
  focus: 3,
  intention: 4,
};

function getLinkOptionsForType(type: LinkTargetType): Goal[] {
  const today = new Date();
  switch (type) {
    case "vision": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return Goals.getForRange(start, end)
        .filter(
          (goal) =>
            goal.level === "vision" && LINKABLE_STATUSES.includes(goal.status),
        )
        .sort((a, b) => a.title.localeCompare(b.title));
    }
    case "milestone": {
      return Goals.getForRange(today, today)
        .filter(
          (goal) =>
            goal.level === "milestone" &&
            LINKABLE_STATUSES.includes(goal.status),
        )
        .sort((a, b) => a.title.localeCompare(b.title));
    }
    default:
      return getActiveFocuses();
  }
}

function formatLinkOptionLabel(goal: Goal, type: LinkTargetType): string {
  switch (type) {
    case "vision":
      return goal.title;
    case "milestone": {
      const monthLabel = formatMonthLabel(goal.month);
      return monthLabel ? `${goal.title} · ${monthLabel}` : goal.title;
    }
    case "focus": {
      const startDate = goal.meta?.startDate
        ? new Date(goal.meta.startDate)
        : null;
      const weekLabel = startDate ? `Week ${getWeekNumber(startDate)}` : null;
      return weekLabel ? `${goal.title} · ${weekLabel}` : goal.title;
    }
    default:
      return goal.title;
  }
}

function formatMonthLabel(month?: number): string | null {
  if (month === undefined || Number.isNaN(month)) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(2000, month, 1),
  );
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor(
    (date.getTime() - firstDayOfYear.getTime()) / 86_400_000,
  );
  return Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
}

function computeDefaultLinkTargetId(
  type: LinkTargetType,
  preferredId?: string | null,
): string | null {
  const candidates = getLinkOptionsForType(type);
  if (preferredId && candidates.some((goal) => goal.id === preferredId)) {
    return preferredId;
  }
  return candidates[0]?.id ?? null;
}

function formatYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextScheduledDate(weekdays: number[]): Date {
  const today = new Date();
  if (weekdays.length === 0) {
    return today;
  }
  const normalized = Array.from(new Set(weekdays));
  const todayIndex = today.getDay();
  let minDiff = 7;
  for (const target of normalized) {
    const diff = (target - todayIndex + 7) % 7;
    if (diff < minDiff) {
      minDiff = diff;
    }
  }
  const scheduled = new Date(today);
  scheduled.setDate(scheduled.getDate() + minDiff);
  scheduled.setHours(0, 0, 0, 0);
  return scheduled;
}

async function waitForGoalSync(goalId: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (dirtyTracker.isDirty("goal", goalId)) {
    if (Date.now() - start > timeoutMs) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function findMilestoneForVision(vision: Goal): Goal | null {
  return (
    Goals.getAll().find(
      (goal) => goal.level === "milestone" && goal.parentId === vision.id,
    ) ?? null
  );
}

function createMilestoneForVision(vision: Goal): Goal {
  const now = new Date();
  const month = Number.isFinite(vision.month) ? vision.month : now.getMonth();
  const year = Number.isFinite(vision.year) ? vision.year : now.getFullYear();
  const data: GoalData = {
    title: `Milestone for ${vision.title}`,
    level: "milestone",
    parentId: vision.id,
    parentLevel: "vision",
    month,
    year,
    description: `Auto-created milestone for ${vision.title}`,
  };
  return Goals.create(data);
}

async function resolveFocusParentForLinkTarget(goal: Goal): Promise<Goal | null> {
  switch (goal.level) {
    case "focus":
      return goal;
    case "milestone":
      return ensurePlanningFocusForGoal(goal);
    case "vision": {
      const milestone = findMilestoneForVision(goal) || createMilestoneForVision(goal);
      return ensurePlanningFocusForGoal(milestone);
    }
    default:
      return null;
  }
}
let overlayElement: HTMLElement | null = null;
let state: IntentionState = { ...DEFAULT_STATE };

interface FormElements {
  titleInput: HTMLInputElement | null;
  linkSelect: HTMLSelectElement | null;
  frequencyInput: HTMLInputElement | null;
  durationInput: HTMLInputElement | null;
  energySelect: HTMLSelectElement | null;
  saveBtn: HTMLButtonElement | null;
  dayButtons: NodeListOf<HTMLButtonElement> | null;
  timeInput: HTMLInputElement | null;
}

let formElements: FormElements | null = null;
let emojiPickerElement: HTMLElement | null = null;
let emojiButtonElement: HTMLButtonElement | null = null;
let emojiDocClickListener: ((event: MouseEvent) => void) | null = null;
let emojiDocKeydownListener: ((event: KeyboardEvent) => void) | null = null;

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

function resetState(initialFocusId?: string | null) {
  state = {
    ...DEFAULT_STATE,
    emoji: null,
    linkType: "focus",
    linkTargetId: computeDefaultLinkTargetId("focus", initialFocusId),
    // Reset specific days
    specificDays: [],
  };
}

function getActiveFocuses(): Goal[] {
  return Goals.getAll()
    .filter((goal) => goal.level === "focus" && LINKABLE_STATUSES.includes(goal.status))
    .sort((a, b) => {
      const levelDiff = GOAL_LEVEL_ORDER[a.level] - GOAL_LEVEL_ORDER[b.level];
      return levelDiff !== 0 ? levelDiff : a.title.localeCompare(b.title);
    });
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

function formatTimeDescriptor(minutes: number, period: string): string {
  if (minutes <= 0) {
    return `0 minutes per ${period}`;
  }
  if (minutes < 60) {
    const rounded = Math.round(minutes);
    return `${rounded} minute${rounded === 1 ? "" : "s"} per ${period}`;
  }

  const hours = minutes / 60;
  const roundedHours = Math.round(hours * 10) / 10;
  const hourLabel = roundedHours === 1 ? "hour" : "hours";
  return `${roundedHours} ${hourLabel} per ${period}`;
}

function renderContent() {
  const overlay = ensureOverlay();
  hideEmojiPicker();
  const hasAnyLinkTargets = LINK_TARGET_TYPES.some(
    (type) => getLinkOptionsForType(type).length > 0,
  );

  const emojiButtons = EMOJI_SUGGESTIONS.map(
    (emoji) => `
      <button
        type="button"
        class="planning-emoji-option"
        data-emoji-option="${emoji}"
        aria-label="Use ${emoji}"
      >
        ${emoji}
      </button>
    `,
  ).join("");

  const segmentButtons = LINK_TARGET_TYPES.map(
    (type) => {
      const label = LINK_TARGET_LABELS[type as LinkTargetType] ?? type;
      return `
      <button
        type="button"
        class="planning-link-segment ${state.linkType === type ? "active" : ""}"
        data-link-type="${type}"
        aria-pressed="${state.linkType === type}"
      >
        ${label}
      </button>
    `;
    },
  ).join("");

  // Plan / Create Intention modal
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
        <label class="planning-page-field planning-title-field">
          <span>Title</span>
          <div class="planning-title-row">
            <button
              id="planningEmojiButton"
              type="button"
              class="planning-emoji-btn"
              aria-label="Choose an icon for this intention"
              aria-controls="planningEmojiPicker"
              aria-expanded="false"
            >
              ${state.emoji ? escapeHtml(state.emoji) : "+"}
            </button>
            <input
              id="planningTitleInput"
              type="text"
              class="planning-input"
              placeholder="e.g., Morning workout, Clean desk, Read article..."
              value="${escapeHtml(state.title)}"
              autofocus
            />
          </div>
          <div
            id="planningEmojiPicker"
            class="planning-emoji-picker"
            data-visible="false"
            aria-hidden="true"
          >
            <div class="planning-emoji-picker-grid">
              ${emojiButtons}
            </div>
            <input
              id="planningEmojiInput"
              type="text"
              maxlength="2"
              class="planning-emoji-input"
              placeholder="Custom emoji"
            />
          </div>
        </label>

        <div class="planning-page-field planning-link-field">
          <span>Link this to</span>
          <div class="planning-link-controls">
            <div
              class="planning-link-segmented"
              role="group"
              aria-label="Link this intention to a vision, milestone, or focus"
            >
              ${segmentButtons}
            </div>
            <select
              id="planningLinkSelect"
              class="planning-input"
              aria-label="Choose a vision, milestone, or focus"
            ></select>
          </div>
          <p class="planning-helper-text">
            Linking this intention to your map helps Future You remember why it mattered.
          </p>
          <p
            id="planningLinkEmptyMessage"
            class="planning-link-empty"
            aria-live="polite"
          ></p>
        </div>

        <div class="planning-section-label">When and how often?</div>
        <div class="planning-page-field">
          <span>Days</span>
          ${renderDayButtons()}
        </div>

        <div class="planning-input-grid">
          <label class="planning-page-field">
            <span>Times per week</span>
            <input
              id="planningFrequency"
              type="number"
              min="1"
              max="7"
              class="planning-input"
              value="${state.frequency}"
            />
          </label>
          <label class="planning-page-field">
            <span>Length (minutes)</span>
            <input
              id="planningDuration"
              type="number"
              min="15"
              max="120"
              class="planning-input"
              value="${state.duration}"
            />
          </label>
          <label class="planning-page-field">
            <span>Energy type</span>
            <select id="planningEnergy" class="planning-input">
              ${ENERGY_OPTIONS.map(
                (value) =>
                  `<option value="${value}" ${
                    value === state.energyType ? "selected" : ""
                  }>${value}</option>`,
              ).join("")}
            </select>
          </label>
          <label class="planning-page-field">
            <span>Preferred time (optional)</span>
            <input
              id="planningPreferredTime"
              type="time"
              class="planning-input"
              value="${escapeHtml(state.timeOfDay)}"
            />
          </label>
        </div>

        <div class="planning-time-check">
          <p class="planning-time-check-label">Time check</p>
          <p id="planningTimeCheckWeekly" class="planning-time-check-line"></p>
          <p id="planningTimeCheckMonthly" class="planning-time-check-line"></p>
        </div>

        <div class="planning-actions">
          <p class="planning-intention-note">
            You can edit or pause this intention at any time.
          </p>
          <div class="planning-consent-buttons">
            <button
              type="button"
              id="planningSaveBtn"
              class="planning-include-btn"
              ${!hasAnyLinkTargets ? "disabled" : ""}
            >
              Add intention
            </button>
            <button type="button" id="planningCancelBtn" class="planning-neutral-btn">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  populateLinkSelectOptions();
  updateLinkTypeControls();
  setupElements();
  updateSaveButton();
  updateSummary();
  updateEmojiButton();
}

function setupElements() {
  if (!overlayElement) return;

  const titleInput = overlayElement.querySelector<HTMLInputElement>("#planningTitleInput");
  const linkSelect = overlayElement.querySelector<HTMLSelectElement>("#planningLinkSelect");
  const frequencyInput = overlayElement.querySelector<HTMLInputElement>("#planningFrequency");
  const durationInput = overlayElement.querySelector<HTMLInputElement>("#planningDuration");
  const energySelect = overlayElement.querySelector<HTMLSelectElement>("#planningEnergy");
  const timeInput = overlayElement.querySelector<HTMLInputElement>("#planningPreferredTime");
  const saveBtn = overlayElement.querySelector<HTMLButtonElement>("#planningSaveBtn");
  const dayButtons = overlayElement.querySelectorAll<HTMLButtonElement>(".planning-day-btn");

  formElements = {
    titleInput,
    linkSelect,
    frequencyInput,
    durationInput,
    energySelect,
    saveBtn,
    dayButtons,
    timeInput,
  };

  overlayElement
    .querySelector(".planning-page-close")
    ?.addEventListener("click", () => close());

  titleInput?.addEventListener("input", (event) => {
    state.title = (event.currentTarget as HTMLInputElement).value;
    updateSaveButton();
  });

  linkSelect?.addEventListener("change", (event) => {
    state.linkTargetId = (event.currentTarget as HTMLSelectElement).value;
    updateSaveButton();
  });

  overlayElement
    .querySelectorAll<HTMLButtonElement>("[data-link-type]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.linkType as LinkTargetType | undefined;
        if (!type || state.linkType === type) return;
        state.linkType = type;
        updateLinkTypeControls();
        populateLinkSelectOptions();
        updateSaveButton();
      });
    });

  dayButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const day = Number(btn.dataset.day);
      if (state.specificDays.includes(day)) {
        state.specificDays = state.specificDays.filter((d) => d !== day);
      } else {
        state.specificDays.push(day);
      }

      btn.classList.toggle("selected", state.specificDays.includes(day));

      if (state.specificDays.length > 0) {
        state.frequency = state.specificDays.length;
        if (frequencyInput) {
          frequencyInput.value = String(state.frequency);
        }
      }
      updateSummary();
    });
  });

  frequencyInput?.addEventListener("input", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state.frequency = clampFrequency(Number(input.value));
    input.value = String(state.frequency);
    updateSummary();
  });

  durationInput?.addEventListener("input", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    state.duration = clampDuration(Number(input.value));
    input.value = String(state.duration);
    updateSummary();
  });

  energySelect?.addEventListener("change", (event) => {
    state.energyType = (event.currentTarget as HTMLSelectElement).value as EnergyType;
  });

  timeInput?.addEventListener("input", (event) => {
    state.timeOfDay = (event.currentTarget as HTMLInputElement).value;
  });

  saveBtn?.addEventListener("click", () => {
    void handleSave();
  });
  overlayElement
    .querySelector("#planningCancelBtn")
    ?.addEventListener("click", () => close());

  setupEmojiInteractions();

  titleInput?.focus();
}

function setupEmojiInteractions() {
  if (!overlayElement) return;

  emojiButtonElement = overlayElement.querySelector("#planningEmojiButton");
  emojiPickerElement = overlayElement.querySelector("#planningEmojiPicker");
  const emojiInput = overlayElement.querySelector<HTMLInputElement>("#planningEmojiInput");
  const emojiOptions = overlayElement.querySelectorAll<HTMLButtonElement>("[data-emoji-option]");

  emojiButtonElement?.addEventListener("click", () => {
    if (emojiPickerElement?.getAttribute("data-visible") === "true") {
      hideEmojiPicker();
    } else {
      showEmojiPicker();
    }
  });

  emojiOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const value = option.dataset.emojiOption ?? "";
      state.emoji = value || null;
      updateEmojiButton();
      hideEmojiPicker();
    });
  });

  emojiInput?.addEventListener("input", (event) => {
    const value = (event.currentTarget as HTMLInputElement).value.trim();
    state.emoji = value || null;
    updateEmojiButton();
    if (value) {
      hideEmojiPicker();
    }
  });
}

function showEmojiPicker() {
  if (!emojiPickerElement || !emojiButtonElement) return;
  hideEmojiPicker();
  emojiPickerElement.setAttribute("data-visible", "true");
  emojiPickerElement.setAttribute("aria-hidden", "false");
  emojiButtonElement.setAttribute("aria-expanded", "true");

  emojiDocClickListener = (event) => {
    const target = event.target as Node;
    if (
      !emojiPickerElement?.contains(target) &&
      target !== emojiButtonElement
    ) {
      hideEmojiPicker();
    }
  };
  document.addEventListener("pointerdown", emojiDocClickListener);

  emojiDocKeydownListener = (event) => {
    if (event.key === "Escape") {
      hideEmojiPicker();
    }
  };
  document.addEventListener("keydown", emojiDocKeydownListener);
}

function hideEmojiPicker() {
  if (!emojiPickerElement || !emojiButtonElement) return;
  emojiPickerElement.setAttribute("data-visible", "false");
  emojiPickerElement.setAttribute("aria-hidden", "true");
  emojiButtonElement.setAttribute("aria-expanded", "false");
  if (emojiDocClickListener) {
    document.removeEventListener("pointerdown", emojiDocClickListener);
    emojiDocClickListener = null;
  }
  if (emojiDocKeydownListener) {
    document.removeEventListener("keydown", emojiDocKeydownListener);
    emojiDocKeydownListener = null;
  }
}

function updateEmojiButton() {
  if (!emojiButtonElement) {
    emojiButtonElement =
      overlayElement?.querySelector<HTMLButtonElement>("#planningEmojiButton") ??
      null;
  }
  if (!emojiButtonElement) return;
  emojiButtonElement.textContent = state.emoji || "+";
}

function populateLinkSelectOptions() {
  if (!overlayElement) return;
  const select = overlayElement.querySelector<HTMLSelectElement>("#planningLinkSelect");
  const message = overlayElement.querySelector<HTMLParagraphElement>(
    "#planningLinkEmptyMessage",
  );
  if (!select || !message) return;

  const options = getLinkOptionsForType(state.linkType);
  if (options.length === 0) {
    const linkTypeLabel = LINK_TARGET_LABELS[state.linkType] ?? state.linkType;
    select.innerHTML = `<option value="" disabled>No ${linkTypeLabel} available</option>`;
    select.disabled = true;
    state.linkTargetId = null;
    message.textContent = `Add a ${linkTypeLabel} to link this intention.`;
    return;
  }

  const selectedId =
    options.find((goal) => goal.id === state.linkTargetId)?.id ?? options[0].id;
  state.linkTargetId = selectedId;
  select.innerHTML = options
    .map(
      (goal) =>
        `<option value="${goal.id}" ${
          goal.id === selectedId ? "selected" : ""
        }>${escapeHtml(formatLinkOptionLabel(goal, state.linkType))}</option>`,
    )
    .join("");
  select.disabled = false;
  select.value = selectedId;
  message.textContent = "";
}

function updateLinkTypeControls() {
  if (!overlayElement) return;
  overlayElement
    .querySelectorAll<HTMLButtonElement>("[data-link-type]")
    .forEach((btn) => {
      const type = btn.dataset.linkType as LinkTargetType | undefined;
      const isActive = type === state.linkType;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
}

function updateSaveButton() {
  const canSave = state.title.trim().length > 0 && Boolean(state.linkTargetId);
  if (formElements?.saveBtn) {
    formElements.saveBtn.disabled = !canSave;
  }
}

function updateSummary() {
  const weeklyMinutes = state.frequency * state.duration;
  const weeklyEl = overlayElement?.querySelector("#planningTimeCheckWeekly");
  const monthlyEl = overlayElement?.querySelector("#planningTimeCheckMonthly");
  if (!weeklyEl || !monthlyEl) return;
  weeklyEl.textContent = `About ${formatTimeDescriptor(weeklyMinutes, "week")}`;
  const monthlyMinutes = weeklyMinutes * 4;
  monthlyEl.textContent = `Roughly ${formatTimeDescriptor(monthlyMinutes, "month")}`;
}

async function handleSave() {
  const title = state.title.trim();
  if (!title || !state.linkTargetId) return;

  const targetGoal = Goals.getById(state.linkTargetId);
  if (!targetGoal) return;

  const focusParent = await resolveFocusParentForLinkTarget(targetGoal);
  if (!focusParent) return;

  hideEmojiPicker();

  await waitForGoalSync(focusParent.id);
  const scheduledDate = getNextScheduledDate(state.specificDays);
  const startDate = formatYmd(scheduledDate);
  const dueDate =
    (targetGoal.dueDate && new Date(targetGoal.dueDate).toISOString()) ??
    (focusParent.dueDate && new Date(focusParent.dueDate).toISOString()) ??
    null;

  Goals.create({
    title,
    level: "intention",
    category: focusParent.category ?? undefined,
    parentId: focusParent.id,
    parentLevel: focusParent.level,
    icon: state.emoji ?? undefined,
    startTime: state.timeOfDay || undefined,
    dueDate,
    startDate,
    linkTarget: {
      type: state.linkType,
      id: targetGoal.id,
    },
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

async function openOverlay(initialFocusId: string | null) {
  resetState(initialFocusId);
  renderContent();
  requestAnimationFrame(() => {
    overlayElement?.classList.add("visible");
  });
}

function close() {
  hideEmojiPicker();
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
