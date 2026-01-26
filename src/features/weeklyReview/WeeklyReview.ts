import { Planning } from "../../core/Planning";
import {
  getVisionsNeedingAttention,
  describeGap,
} from "../../core/AlignmentChecker";
import { getStateIndicator } from "../../core/GoalStateComputation";

export type WeeklyReviewContext = {
  showToast: (iconOrMessage: string, messageOrType?: string) => void;
  render: () => void;
};

// Wizard state interface
interface WizardState {
  currentStep: number;
  data: {
    mood: number;
    wins: string[];
    challenges: string[];
    learnings: string;
    alignmentReflection: string;
    nextWeekPriorities: string[];
  };
}

// Mood options for step 1
const MOOD_OPTIONS = [
  { value: 1, emoji: "😫", label: "Struggling" },
  { value: 2, emoji: "😔", label: "Low" },
  { value: 3, emoji: "😐", label: "Neutral" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "🌟", label: "Thriving" },
];

// Step configuration
const STEPS = [
  { id: 1, title: "Mood", subtitle: "How are you feeling? No judgment here." },
  { id: 2, title: "Wins", subtitle: "Celebrate your wins! Even small ones count." },
  { id: 3, title: "Challenges", subtitle: "What got in the way? Naming it takes away its power." },
  { id: 4, title: "Learnings", subtitle: "What will you carry forward?", optional: true },
  { id: 5, title: "Alignment", subtitle: "Did your work connect to your bigger goals?" },
  { id: 6, title: "Priorities", subtitle: "What 1-3 things matter most next week?" },
  { id: 7, title: "Done!", subtitle: "Taking time to reflect is a win itself." },
];

const PARTIAL_REVIEW_KEY = "weeklyReview.partial";

/**
 * Get partial review from session storage
 */
function getPartialReview(): WizardState | null {
  try {
    const stored = sessionStorage.getItem(PARTIAL_REVIEW_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load partial review", e);
  }
  return null;
}

/**
 * Save partial review to session storage
 */
function savePartialReview(state: WizardState): void {
  try {
    sessionStorage.setItem(PARTIAL_REVIEW_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save partial review", e);
  }
}

/**
 * Clear partial review from session storage
 */
function clearPartialReview(): void {
  sessionStorage.removeItem(PARTIAL_REVIEW_KEY);
}

/**
 * Build the progress stepper HTML
 */
function buildStepperHTML(currentStep: number): string {
  return STEPS.map((_, index) => {
    const stepNum = index + 1;
    const isActive = stepNum === currentStep;
    const isCompleted = stepNum < currentStep;
    const dotClass = isActive ? "active" : isCompleted ? "completed" : "";
    const connectorClass = isCompleted ? "completed" : "";

    const connector =
      stepNum < STEPS.length
        ? `<div class="review-step-connector ${connectorClass}"></div>`
        : "";

    return `
      <div class="review-step-item">
        <div class="review-step-dot ${dotClass}">${isCompleted ? "✓" : stepNum}</div>
        ${connector}
      </div>
    `;
  }).join("");
}

/**
 * Build mood selector HTML (Step 1)
 */
function buildMoodStepHTML(selectedMood: number): string {
  const moodButtons = MOOD_OPTIONS.map(
    (opt) => `
    <button
      type="button"
      class="mood-btn-wizard ${selectedMood === opt.value ? "selected" : ""}"
      data-mood="${opt.value}"
    >
      <span class="mood-emoji">${opt.emoji}</span>
      <span class="mood-label">${opt.label}</span>
    </button>
  `
  ).join("");

  return `
    <div class="review-step-header">
      <h3 class="review-step-title">How are you feeling?</h3>
      <p class="review-step-subtitle">Check in with yourself. No judgment here.</p>
    </div>
    <div class="mood-selector-wizard">
      ${moodButtons}
    </div>
    <p class="review-encouragement">Awareness is the first step to growth.</p>
  `;
}

/**
 * Build bullet list input HTML
 */
function buildBulletListHTML(
  items: string[],
  fieldId: string,
  placeholder: string,
  hint: string,
  maxItems: number = 5
): string {
  const itemsToShow = items.length > 0 ? items : [""];
  const bulletItems = itemsToShow
    .map(
      (item, index) => `
    <div class="bullet-item" data-index="${index}">
      <span class="bullet-marker">${index + 1}</span>
      <textarea
        class="bullet-input"
        data-field="${fieldId}"
        data-index="${index}"
        placeholder="${placeholder}"
        rows="1"
      >${item}</textarea>
      ${
        itemsToShow.length > 1
          ? `<button type="button" class="bullet-remove-btn" data-index="${index}" title="Remove">×</button>`
          : ""
      }
    </div>
  `
    )
    .join("");

  const canAddMore = itemsToShow.length < maxItems;

  return `
    <div class="bullet-list-input" data-field="${fieldId}">
      ${bulletItems}
      ${
        canAddMore
          ? `<button type="button" class="bullet-add-btn" data-field="${fieldId}">+ Add another</button>`
          : ""
      }
    </div>
    <p class="bullet-count-hint">${hint}</p>
  `;
}

/**
 * Build wins step HTML (Step 2)
 */
function buildWinsStepHTML(wins: string[]): string {
  return `
    <div class="review-step-header">
      <h3 class="review-step-title">This week's wins</h3>
      <p class="review-step-subtitle">What went well? What are you proud of?</p>
    </div>
    ${buildBulletListHTML(wins, "wins", "Finished that difficult task...", "List 1-3 wins. Tiny wins count!")}
    <p class="review-encouragement">Celebrating progress builds momentum.</p>
  `;
}

/**
 * Build challenges step HTML (Step 3)
 */
function buildChallengesStepHTML(challenges: string[]): string {
  return `
    <div class="review-step-header">
      <h3 class="review-step-title">Challenges faced</h3>
      <p class="review-step-subtitle">What was difficult? What got in the way?</p>
    </div>
    ${buildBulletListHTML(challenges, "challenges", "Got distracted by...", "Naming challenges takes away their power.")}
    <p class="review-encouragement">You're not alone in struggling. It's part of the journey.</p>
  `;
}

/**
 * Build learnings step HTML (Step 4)
 */
function buildLearningsStepHTML(learnings: string): string {
  return `
    <div class="review-step-header">
      <h3 class="review-step-title">Key learnings <span class="review-optional-badge">Optional</span></h3>
      <p class="review-step-subtitle">What insight will you carry forward?</p>
    </div>
    <textarea
      id="reviewLearnings"
      class="review-wizard-textarea"
      placeholder="I noticed that I work best when..."
    >${learnings}</textarea>
    <p class="review-encouragement">Every experience teaches something valuable.</p>
  `;
}

/**
 * Build alignment step HTML (Step 5)
 */
function buildAlignmentStepHTML(alignmentReflection: string): string {
  const visionsNeedingAttention = getVisionsNeedingAttention();

  let contextHTML = "";
  if (visionsNeedingAttention.length > 0) {
    const visionItems = visionsNeedingAttention
      .slice(0, 3)
      .map((status) => {
        const stateIndicator = getStateIndicator(status.visionState);
        const gapDescription = describeGap(status);
        return `
          <div class="alignment-vision-item-wizard">
            <span class="alignment-vision-indicator-wizard state-${status.visionState}">${stateIndicator}</span>
            <div>
              <span class="alignment-vision-title-wizard">${status.visionTitle}</span>
              <p class="alignment-vision-gap-wizard">${gapDescription}</p>
            </div>
          </div>
        `;
      })
      .join("");

    contextHTML = `
      <div class="review-alignment-context">
        <h4>Visions that could use attention:</h4>
        ${visionItems}
      </div>
    `;
  } else {
    contextHTML = `
      <div class="review-alignment-context">
        <h4>Nice alignment!</h4>
        <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">All your visions have active work connected to them.</p>
      </div>
    `;
  }

  return `
    <div class="review-step-header">
      <h3 class="review-step-title">Vision check-in</h3>
      <p class="review-step-subtitle">How did your work this week connect to your bigger goals?</p>
    </div>
    ${contextHTML}
    <textarea
      id="reviewAlignment"
      class="review-wizard-textarea"
      placeholder="Reflect on whether your daily actions moved you toward your visions..."
    >${alignmentReflection}</textarea>
    <p class="review-encouragement">Progress isn't always linear, and that's okay.</p>
  `;
}

/**
 * Build priorities step HTML (Step 6)
 */
function buildPrioritiesStepHTML(priorities: string[]): string {
  return `
    <div class="review-step-header">
      <h3 class="review-step-title">Next week's focus</h3>
      <p class="review-step-subtitle">What 1-3 things matter most?</p>
    </div>
    ${buildBulletListHTML(priorities, "priorities", "Complete the project proposal...", "Less is more. Pick 1-3 priorities max.", 3)}
    <p class="review-encouragement">Focus is a superpower. You can't do everything.</p>
  `;
}

/**
 * Build summary/completion step HTML (Step 7)
 */
function buildSummaryStepHTML(state: WizardState): string {
  const moodOption = MOOD_OPTIONS.find((m) => m.value === state.data.mood);
  const moodDisplay = moodOption ? `${moodOption.emoji} ${moodOption.label}` : "Not set";

  const formatList = (items: string[]) => {
    const filtered = items.filter((i) => i.trim());
    if (filtered.length === 0) return "<em style='color: var(--text-ghost)'>None entered</em>";
    return `<ul class="review-summary-list">${filtered.map((i) => `<li>${i}</li>`).join("")}</ul>`;
  };

  const formatText = (text: string) => {
    if (!text.trim()) return "<em style='color: var(--text-ghost)'>None entered</em>";
    return text;
  };

  return `
    <div class="review-completion">
      <div class="review-completion-emoji">🎉</div>
      <h3 class="review-completion-title">Week reflected!</h3>
      <p class="review-completion-text">You took time to reflect — that's a win itself.</p>
    </div>
    <div class="review-summary-preview">
      <div class="review-summary-item">
        <span class="review-summary-label">Mood</span>
        <span class="review-summary-value">${moodDisplay}</span>
      </div>
      <div class="review-summary-item">
        <span class="review-summary-label">Wins</span>
        <div class="review-summary-value">${formatList(state.data.wins)}</div>
      </div>
      <div class="review-summary-item">
        <span class="review-summary-label">Challenges</span>
        <div class="review-summary-value">${formatList(state.data.challenges)}</div>
      </div>
      <div class="review-summary-item">
        <span class="review-summary-label">Learnings</span>
        <div class="review-summary-value">${formatText(state.data.learnings)}</div>
      </div>
      <div class="review-summary-item">
        <span class="review-summary-label">Priorities</span>
        <div class="review-summary-value">${formatList(state.data.nextWeekPriorities)}</div>
      </div>
    </div>
  `;
}

/**
 * Render the current step content
 */
function renderStepContent(state: WizardState): string {
  switch (state.currentStep) {
    case 1:
      return buildMoodStepHTML(state.data.mood);
    case 2:
      return buildWinsStepHTML(state.data.wins);
    case 3:
      return buildChallengesStepHTML(state.data.challenges);
    case 4:
      return buildLearningsStepHTML(state.data.learnings);
    case 5:
      return buildAlignmentStepHTML(state.data.alignmentReflection);
    case 6:
      return buildPrioritiesStepHTML(state.data.nextWeekPriorities);
    case 7:
      return buildSummaryStepHTML(state);
    default:
      return "";
  }
}

/**
 * Get the next button text based on current step
 */
function getNextButtonText(currentStep: number): string {
  if (currentStep === 6) return "Review";
  if (currentStep === 7) return "Save review";
  return "Next";
}

/**
 * Collect data from the current step's inputs
 */
function collectStepData(modal: HTMLElement, state: WizardState): void {
  switch (state.currentStep) {
    case 2:
    case 3:
    case 6: {
      const fieldId =
        state.currentStep === 2
          ? "wins"
          : state.currentStep === 3
            ? "challenges"
            : "priorities";
      const inputs = modal.querySelectorAll(
        `.bullet-input[data-field="${fieldId}"]`
      ) as NodeListOf<HTMLTextAreaElement>;
      const values = Array.from(inputs)
        .map((input) => input.value.trim())
        .filter(Boolean);
      if (fieldId === "wins") state.data.wins = values;
      else if (fieldId === "challenges") state.data.challenges = values;
      else if (fieldId === "priorities") state.data.nextWeekPriorities = values;
      break;
    }
    case 4: {
      const learningsInput = modal.querySelector(
        "#reviewLearnings"
      ) as HTMLTextAreaElement | null;
      state.data.learnings = learningsInput?.value.trim() ?? "";
      break;
    }
    case 5: {
      const alignmentInput = modal.querySelector(
        "#reviewAlignment"
      ) as HTMLTextAreaElement | null;
      state.data.alignmentReflection = alignmentInput?.value.trim() ?? "";
      break;
    }
  }
}

export function showReviewPrompt(ctx: WeeklyReviewContext) {
  if (sessionStorage.getItem("reviewPromptShown")) return;
  sessionStorage.setItem("reviewPromptShown", "true");

  const toast = document.createElement("div");
  toast.className = "review-prompt";
  toast.innerHTML = `
    <div class="review-prompt-content">
      <div class="review-prompt-copy">
        <p class="review-prompt-title">Weekly review</p>
        <p class="review-prompt-text">
          Capture what moved forward, what challenged you, and what deserves your focus next.
        </p>
      </div>
      <div class="review-prompt-actions">
        <button class="btn btn-sm btn-primary" id="startReviewBtn">Start review</button>
        <button class="btn btn-sm btn-ghost" id="dismissReviewBtn">Remind me later</button>
      </div>
    </div>
  `;

  document.body.appendChild(toast);

  toast.querySelector("#startReviewBtn")?.addEventListener("click", () => {
    toast.remove();
    showWeeklyReview(ctx);
  });

  toast.querySelector("#dismissReviewBtn")?.addEventListener("click", () => {
    toast.remove();
  });
}

export function showWeeklyReview(ctx: WeeklyReviewContext) {
  // Check for partial review to resume
  const partialReview = getPartialReview();

  // Initialize wizard state
  const state: WizardState = partialReview ?? {
    currentStep: 1,
    data: {
      mood: 3,
      wins: [""],
      challenges: [""],
      learnings: "",
      alignmentReflection: "",
      nextWeekPriorities: [""],
    },
  };

  // Create modal
  const modal = document.createElement("div");
  modal.className = "modal-overlay active";

  // Render function
  const render = () => {
    const isFirstStep = state.currentStep === 1;
    const isLastStep = state.currentStep === 7;

    modal.innerHTML = `
      <div class="modal modal-lg review-wizard">
        <div class="modal-header">
          <h2 class="modal-title">Weekly review</h2>
          <button class="modal-close" id="closeReview">×</button>
        </div>
        <div class="review-stepper">
          ${buildStepperHTML(state.currentStep)}
        </div>
        <div class="modal-body">
          <div class="review-step-content" data-step="${state.currentStep}">
            ${renderStepContent(state)}
          </div>
        </div>
        <div class="review-wizard-footer">
          <div class="review-nav-secondary">
            ${!isFirstStep && !isLastStep ? `<button class="review-btn-back" id="backBtn">Back</button>` : ""}
            ${!isLastStep ? `<button class="review-btn-save-exit" id="saveExitBtn">Save & Exit</button>` : ""}
          </div>
          <div class="review-nav-primary">
            ${isLastStep ? `<button class="review-btn-back" id="backBtn">Edit</button>` : ""}
            <button class="review-btn-next" id="nextBtn">${getNextButtonText(state.currentStep)}</button>
          </div>
        </div>
      </div>
    `;

    attachEventListeners();
  };

  // Attach event listeners
  const attachEventListeners = () => {
    // Close button
    modal.querySelector("#closeReview")?.addEventListener("click", () => {
      if (state.currentStep > 1 && state.currentStep < 7) {
        // Show skip confirmation
        if (confirm("You have unsaved progress. Save before leaving?")) {
          collectStepData(modal, state);
          savePartialReview(state);
          ctx.showToast("", "Progress saved. Continue anytime.");
        }
      }
      modal.remove();
    });

    // Back button
    modal.querySelector("#backBtn")?.addEventListener("click", () => {
      if (state.currentStep > 1) {
        collectStepData(modal, state);
        state.currentStep--;
        render();
      }
    });

    // Save & Exit button
    modal.querySelector("#saveExitBtn")?.addEventListener("click", () => {
      collectStepData(modal, state);
      savePartialReview(state);
      ctx.showToast("", "Progress saved. Continue anytime.");
      modal.remove();
    });

    // Next/Submit button
    modal.querySelector("#nextBtn")?.addEventListener("click", async () => {
      collectStepData(modal, state);

      if (state.currentStep < 7) {
        state.currentStep++;
        savePartialReview(state);
        render();
      } else {
        // Submit the review
        const nextBtn = modal.querySelector("#nextBtn") as HTMLButtonElement;
        if (nextBtn) {
          nextBtn.disabled = true;
          nextBtn.textContent = "Saving...";
        }

        try {
          const now = new Date();
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());

          await Planning.createWeeklyReview({
            weekStart: weekStart.toISOString(),
            weekEnd: now.toISOString(),
            wins: state.data.wins.filter(Boolean),
            challenges: state.data.challenges.filter(Boolean),
            learnings: state.data.learnings,
            alignmentReflection: state.data.alignmentReflection,
            nextWeekPriorities: state.data.nextWeekPriorities.filter(Boolean),
            mood: state.data.mood,
          });

          clearPartialReview();
          modal.remove();
          ctx.showToast("", "Weekly review saved!");
          ctx.render();
        } catch (err) {
          console.error("Weekly review save failed", err);
          ctx.showToast("", "Couldn't save your review. Please try again.");
          if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.textContent = "Save review";
          }
        }
      }
    });

    // Mood buttons
    modal.querySelectorAll(".mood-btn-wizard").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal
          .querySelectorAll(".mood-btn-wizard")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        state.data.mood = parseInt(
          (btn as HTMLElement).dataset.mood ?? "3",
          10
        );
      });
    });

    // Bullet list: Add button
    modal.querySelectorAll(".bullet-add-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fieldId = (btn as HTMLElement).dataset.field;
        if (!fieldId) return;

        collectStepData(modal, state);

        if (fieldId === "wins" && state.data.wins.length < 5) {
          state.data.wins.push("");
        } else if (fieldId === "challenges" && state.data.challenges.length < 5) {
          state.data.challenges.push("");
        } else if (fieldId === "priorities" && state.data.nextWeekPriorities.length < 3) {
          state.data.nextWeekPriorities.push("");
        }

        render();

        // Focus the new input
        const inputs = modal.querySelectorAll(
          `.bullet-input[data-field="${fieldId}"]`
        );
        const lastInput = inputs[inputs.length - 1] as HTMLTextAreaElement;
        lastInput?.focus();
      });
    });

    // Bullet list: Remove button
    modal.querySelectorAll(".bullet-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt((btn as HTMLElement).dataset.index ?? "0", 10);
        const bulletItem = btn.closest(".bullet-item");
        const fieldId = bulletItem?.querySelector(".bullet-input")?.getAttribute("data-field");

        if (!fieldId) return;

        collectStepData(modal, state);

        if (fieldId === "wins" && state.data.wins.length > 1) {
          state.data.wins.splice(index, 1);
        } else if (fieldId === "challenges" && state.data.challenges.length > 1) {
          state.data.challenges.splice(index, 1);
        } else if (fieldId === "priorities" && state.data.nextWeekPriorities.length > 1) {
          state.data.nextWeekPriorities.splice(index, 1);
        }

        render();
      });
    });

    // Auto-resize textareas
    modal.querySelectorAll("textarea").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      });
    });

    // Enter key navigation (only for single-line bullet inputs)
    modal.querySelectorAll(".bullet-input").forEach((input) => {
      input.addEventListener("keydown", (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === "Enter" && !keyEvent.shiftKey) {
          e.preventDefault();
          const fieldId = (input as HTMLElement).dataset.field;
          const addBtn = modal.querySelector(
            `.bullet-add-btn[data-field="${fieldId}"]`
          ) as HTMLButtonElement;
          if (addBtn) {
            addBtn.click();
          }
        }
      });
    });
  };

  document.body.appendChild(modal);
  render();

  // Show resume toast if we loaded a partial review
  if (partialReview) {
    ctx.showToast("", "Continuing your review from where you left off.");
  }
}
