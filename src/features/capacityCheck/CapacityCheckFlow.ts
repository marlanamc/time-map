/**
 * Capacity Check Flow Component
 * @remarks A gentle, step-by-step questionnaire to help users assess their daily
 * planning capacity. Inspired by youfeellikeshit.com's branching flow pattern.
 */

import { eventBus } from "../../core/EventBus";
import {
  CAPACITY_QUESTIONS,
  DEFAULT_CAPACITY_STATE,
  applyEffect,
  getCapacitySummary,
  getFirstQuestion,
  getNextQuestion,
  type CapacityOption,
  type CapacityQuestion,
  type CapacityState,
} from "../../data/capacityQuestions";
import { capacityCheckService } from "../../services/supabase/CapacityCheckService";

const OVERLAY_ID = "capacity-check-overlay";
const PANEL_ID = "capacity-check-panel";

/** Result object returned when check completes */
export interface CapacityResult extends CapacityState {
  summary: string;
  completedAt: string;
}

let overlayElement: HTMLElement | null = null;
let currentQuestion: CapacityQuestion | null = null;
let state: CapacityState = { ...DEFAULT_CAPACITY_STATE };
let guidanceTimeout: ReturnType<typeof setTimeout> | null = null;
let onCompleteCallback: ((result: CapacityResult) => void) | null = null;

/**
 * Get the current question index for progress display
 */
function getCurrentProgress(): { current: number; total: number } {
  if (!currentQuestion) return { current: 0, total: CAPACITY_QUESTIONS.length };
  const idx = CAPACITY_QUESTIONS.findIndex((q) => q.id === currentQuestion!.id);
  // Subtract 1 for the grounding question since it's conditional
  const total = CAPACITY_QUESTIONS.length - 1;
  const current = Math.min(idx + 1, total);
  return { current, total };
}

/**
 * Create the overlay container
 */
function ensureOverlay(): HTMLElement {
  if (overlayElement) return overlayElement;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "capacity-check-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "capacity-check-title");

  // Close on backdrop click
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  // Close on Escape
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });

  document.body.appendChild(overlay);
  overlayElement = overlay;
  return overlay;
}

/**
 * Reset state for a new check-in
 */
function resetState(): void {
  state = { ...DEFAULT_CAPACITY_STATE };
  currentQuestion = getFirstQuestion();
  if (guidanceTimeout) {
    clearTimeout(guidanceTimeout);
    guidanceTimeout = null;
  }
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
  const span = document.createElement("span");
  span.textContent = text;
  return span.innerHTML;
}

/**
 * Render the progress indicator
 */
function renderProgress(): string {
  const { current, total } = getCurrentProgress();
  const dots = Array.from({ length: total }, (_, i) => {
    const filled = i < current;
    return `<span class="capacity-progress-dot ${filled ? "filled" : ""}"></span>`;
  }).join("");

  return `
    <div class="capacity-progress" aria-label="Progress: step ${current} of ${total}">
      ${dots}
    </div>
  `;
}

/**
 * Render a single question step
 */
function renderQuestion(): void {
  const overlay = ensureOverlay();
  if (!currentQuestion) return;

  const question = currentQuestion;
  const { current, total } = getCurrentProgress();

  const optionButtons = question.options
    .map(
      (opt) => `
      <button
        type="button"
        class="capacity-option"
        data-option-id="${opt.id}"
        aria-describedby="${opt.guidance ? `guidance-${opt.id}` : ""}"
      >
        ${escapeHtml(opt.label)}
      </button>
    `,
    )
    .join("");

  overlay.innerHTML = `
    <div class="capacity-check-panel" id="${PANEL_ID}">
      <header class="capacity-header">
        ${renderProgress()}
        <button type="button" class="capacity-close" aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <div class="capacity-content">
        <p class="capacity-category">${getCategoryLabel(question.category)}</p>
        <h2 id="capacity-check-title" class="capacity-question">
          ${escapeHtml(question.text)}
        </h2>
        ${question.subtext ? `<p class="capacity-subtext">${escapeHtml(question.subtext)}</p>` : ""}

        <div class="capacity-options" role="group" aria-label="Answer options">
          ${optionButtons}
        </div>

        <div 
          id="capacity-guidance" 
          class="capacity-guidance" 
          aria-live="polite"
          aria-atomic="true"
        ></div>
      </div>

      <footer class="capacity-footer">
        <p class="capacity-step-label">Step ${current} of ${total}</p>
      </footer>
    </div>
  `;

  setupQuestionListeners();
}

/**
 * Get a friendly label for the question category
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    physical: "🌱 Physical Foundation",
    mental: "💭 Current State",
    energy: "⚡ Energy Check",
  };
  // eslint-disable-next-line security/detect-object-injection
  return labels[category] || category;
}

/**
 * Set up event listeners for the current question
 */
function setupQuestionListeners(): void {
  if (!overlayElement) return;

  // Close button
  overlayElement
    .querySelector(".capacity-close")
    ?.addEventListener("click", () => close());

  // Option buttons
  overlayElement
    .querySelectorAll<HTMLButtonElement>(".capacity-option")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const optionId = btn.dataset.optionId;
        if (!optionId || !currentQuestion) return;

        const option = currentQuestion.options.find((o) => o.id === optionId);
        if (!option) return;

        handleOptionSelect(option, btn);
      });
    });
}

/**
 * Handle when user selects an option
 */
function handleOptionSelect(
  option: CapacityOption,
  button: HTMLButtonElement,
): void {
  if (!currentQuestion) return;

  // Apply effect to state
  state = applyEffect(state, option.effect);

  // Show guidance if present
  if (option.guidance) {
    showGuidance(option.guidance, button, () => {
      advanceToNext(option.nextId);
    });
  } else {
    // Immediately advance
    advanceToNext(option.nextId);
  }
}

/**
 * Show guidance message with a brief pause
 */
function showGuidance(
  message: string,
  button: HTMLButtonElement,
  onDone: () => void,
): void {
  const guidanceEl = document.getElementById("capacity-guidance");
  if (!guidanceEl) {
    onDone();
    return;
  }

  // Mark selected button
  button.classList.add("selected");

  // Show the guidance
  guidanceEl.innerHTML = `
    <p class="capacity-guidance-text">${escapeHtml(message)}</p>
    <button type="button" class="capacity-continue" aria-label="Continue">
      Continue →
    </button>
  `;
  guidanceEl.classList.add("visible");

  // Continue button
  const continueBtn = guidanceEl.querySelector(".capacity-continue");
  continueBtn?.addEventListener("click", () => {
    if (guidanceTimeout) clearTimeout(guidanceTimeout);
    onDone();
  });

  // Auto-advance after 4 seconds
  guidanceTimeout = setTimeout(() => {
    onDone();
  }, 4000);
}

/**
 * Advance to the next question or show summary
 */
function advanceToNext(nextId: string | "next" | "end"): void {
  if (guidanceTimeout) {
    clearTimeout(guidanceTimeout);
    guidanceTimeout = null;
  }

  const next = currentQuestion
    ? getNextQuestion(currentQuestion.id, nextId)
    : null;

  if (!next) {
    renderSummary();
  } else {
    currentQuestion = next;
    renderQuestion();
  }
}

/**
 * Render the final summary screen
 */
function renderSummary(): void {
  const overlay = ensureOverlay();
  const summary = getCapacitySummary(state);

  const levelEmoji: Record<string, string> = {
    high: "🚀",
    medium: "🌤️",
    low: "🌙",
    rest: "🛋️",
  };

  const energyEmoji: Record<string, string> = {
    focus: "🎯",
    creative: "✨",
    rest: "🧘",
    admin: "📋",
  };

  const timeLabel =
    state.availableMinutes >= 90
      ? "2+ hours"
      : state.availableMinutes >= 45
        ? "30–60 min"
        : state.availableMinutes >= 20
          ? "15–30 min"
          : "A few min";

  overlay.innerHTML = `
    <div class="capacity-check-panel capacity-summary" id="${PANEL_ID}">
      <header class="capacity-header">
        <button type="button" class="capacity-close" aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <div class="capacity-content">
        <h2 class="capacity-summary-title">Here's your check-in ✨</h2>
        
        <div class="capacity-summary-cards">
          <div class="capacity-summary-card">
            <span class="capacity-card-emoji">${levelEmoji[state.capacityLevel] || "📊"}</span>
            <span class="capacity-card-label">Capacity</span>
            <span class="capacity-card-value">${capitalize(state.capacityLevel)}</span>
          </div>
          <div class="capacity-summary-card">
            <span class="capacity-card-emoji">${energyEmoji[state.energyType] || "⚡"}</span>
            <span class="capacity-card-label">Energy</span>
            <span class="capacity-card-value">${capitalize(state.energyType)}</span>
          </div>
          <div class="capacity-summary-card">
            <span class="capacity-card-emoji">⏱️</span>
            <span class="capacity-card-label">Time</span>
            <span class="capacity-card-value">${timeLabel}</span>
          </div>
        </div>

        <p class="capacity-summary-text">${escapeHtml(summary)}</p>
      </div>

      <footer class="capacity-footer capacity-summary-actions">
        <button type="button" class="capacity-action-primary" id="capacity-continue-planning">
          Let's plan with this in mind
        </button>
        <button type="button" class="capacity-action-secondary" id="capacity-done">
          I'll come back later
        </button>
      </footer>
    </div>
  `;

  setupSummaryListeners();
}

/**
 * Set up listeners for the summary screen
 */
function setupSummaryListeners(): void {
  if (!overlayElement) return;

  overlayElement
    .querySelector(".capacity-close")
    ?.addEventListener("click", () => close());

  overlayElement
    .querySelector("#capacity-continue-planning")
    ?.addEventListener("click", () => {
      complete(true);
    });

  overlayElement
    .querySelector("#capacity-done")
    ?.addEventListener("click", () => {
      complete(false);
    });
}

/**
 * Complete the check and emit result
 */
function complete(openPlanning: boolean): void {
  const result: CapacityResult = {
    ...state,
    summary: getCapacitySummary(state),
    completedAt: new Date().toISOString(),
  };

  // Store in session for immediate access
  try {
    sessionStorage.setItem("capacityCheckResult", JSON.stringify(result));
  } catch {
    // Ignore storage errors
  }

  // Save to Supabase (async, don't block UI)
  const today = new Date().toISOString().split("T")[0];
  capacityCheckService
    .saveCheck({
      checkDate: today,
      capacityLevel: result.capacityLevel,
      energyType: result.energyType,
      availableMinutes: result.availableMinutes,
      summary: result.summary,
    })
    .catch((err) => {
      console.warn("[CapacityCheck] Failed to save to Supabase:", err);
    });

  // Emit event for other components
  eventBus.emit("capacityCheck:complete", result);

  if (onCompleteCallback) {
    onCompleteCallback(result);
  }

  close();

  if (openPlanning) {
    eventBus.emit("capacityCheck:openPlanning", result);
  }
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Open the Capacity Check flow
 * @param onComplete Optional callback when check completes
 */
export function openCapacityCheck(
  onComplete?: (result: CapacityResult) => void,
): void {
  onCompleteCallback = onComplete ?? null;
  resetState();
  renderQuestion();
  overlayElement?.classList.add("visible");

  // Focus first option for accessibility
  setTimeout(() => {
    const firstOption =
      overlayElement?.querySelector<HTMLButtonElement>(".capacity-option");
    firstOption?.focus();
  }, 100);
}

/**
 * Close the Capacity Check flow
 */
export function close(): void {
  if (guidanceTimeout) {
    clearTimeout(guidanceTimeout);
    guidanceTimeout = null;
  }

  overlayElement?.classList.remove("visible");
  setTimeout(() => {
    overlayElement?.remove();
    overlayElement = null;
    currentQuestion = null;
    onCompleteCallback = null;
  }, 200);
}

/**
 * Get the most recent capacity check result from session storage
 */
export function getLastCapacityResult(): CapacityResult | null {
  try {
    const stored = sessionStorage.getItem("capacityCheckResult");
    if (!stored) return null;
    return JSON.parse(stored) as CapacityResult;
  } catch {
    return null;
  }
}

/**
 * Load today's capacity check from Supabase (async version)
 * Falls back to session storage if not logged in
 */
export async function loadTodayCapacityResult(): Promise<CapacityResult | null> {
  // First check session storage for immediate result
  const sessionResult = getLastCapacityResult();

  // Try loading from Supabase
  try {
    const dbResult = await capacityCheckService.getTodayCheck();
    if (dbResult) {
      // Convert DB record to CapacityResult format (add defaults for non-stored fields)
      const result: CapacityResult = {
        capacityLevel: dbResult.capacityLevel,
        energyType: dbResult.energyType,
        availableMinutes: dbResult.availableMinutes,
        notes: [], // Not stored in DB, default to empty
        needsGrounding: false, // Not stored in DB, assume resolved
        summary: dbResult.summary,
        completedAt:
          dbResult.updatedAt || dbResult.createdAt || new Date().toISOString(),
      };
      // Update session storage for future sync
      try {
        sessionStorage.setItem("capacityCheckResult", JSON.stringify(result));
      } catch {
        // Ignore
      }
      return result;
    }
  } catch {
    // Fall through to session result
  }

  return sessionResult;
}

/**
 * Clear the stored capacity check result
 */
export function clearCapacityResult(): void {
  try {
    sessionStorage.removeItem("capacityCheckResult");
  } catch {
    // Ignore errors
  }
}
