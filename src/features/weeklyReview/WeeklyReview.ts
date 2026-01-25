import { Planning } from "../../core/Planning";
import { Goals } from "../../core/Goals";
import {
  getVisionsNeedingAttention,
  getAllDormantGoals,
  describeGap,
} from "../../core/AlignmentChecker";
import { getStateIndicator } from "../../core/GoalStateComputation";

export type WeeklyReviewContext = {
  showToast: (iconOrMessage: string, messageOrType?: string) => void;
  render: () => void;
};

/**
 * Build HTML for the alignment section showing visions with gaps
 */
function buildAlignmentSection(): string {
  const visionsNeedingAttention = getVisionsNeedingAttention();

  if (visionsNeedingAttention.length === 0) {
    return `
      <div class="review-section review-alignment">
        <h3>Vision alignment</h3>
        <p class="review-alignment-good">All your visions have active work connected to them. Nice alignment!</p>
      </div>
    `;
  }

  const visionItems = visionsNeedingAttention
    .slice(0, 5) // Show max 5 visions needing attention
    .map((status) => {
      const stateIndicator = getStateIndicator(status.visionState);
      const gapDescription = describeGap(status);
      return `
        <div class="alignment-vision-item" data-vision-id="${status.visionId}">
          <div class="alignment-vision-header">
            <span class="alignment-vision-indicator state-${status.visionState}">${stateIndicator}</span>
            <span class="alignment-vision-title">${status.visionTitle}</span>
          </div>
          <p class="alignment-vision-gap">${gapDescription}</p>
        </div>
      `;
    })
    .join("");

  return `
    <div class="review-section review-alignment">
      <h3>Vision alignment</h3>
      <p class="review-alignment-intro">Some of your visions could use attention:</p>
      <div class="alignment-visions-list">
        ${visionItems}
      </div>
    </div>
  `;
}

/**
 * Build HTML for the dormant goals section
 */
function buildDormantGoalsSection(): string {
  const dormantGoals = getAllDormantGoals();

  // Filter to only show visions and milestones (higher-level goals)
  const significantDormant = dormantGoals.filter(
    (g) => g.level === "vision" || g.level === "milestone"
  );

  if (significantDormant.length === 0) {
    return "";
  }

  const dormantItems = significantDormant
    .slice(0, 6) // Show max 6 dormant goals
    .map((goal) => {
      const levelLabel = goal.level === "vision" ? "Vision" : "Milestone";
      return `
        <div class="dormant-goal-item" data-goal-id="${goal.id}">
          <div class="dormant-goal-info">
            <span class="dormant-goal-level">${levelLabel}</span>
            <span class="dormant-goal-title">${goal.title}</span>
          </div>
          <div class="dormant-goal-actions">
            <button class="btn btn-xs btn-ghost dormant-rest-btn" data-goal-id="${goal.id}" title="Archive this goal">
              Rest officially
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="review-section review-dormant">
      <h3>Dormant goals</h3>
      <p class="review-dormant-intro">These haven't had activity in 30+ days. Want to rest any of them officially?</p>
      <div class="dormant-goals-list">
        ${dormantItems}
      </div>
    </div>
  `;
}

/**
 * Build HTML for alignment reflection question
 */
function buildAlignmentReflection(): string {
  return `
    <div class="review-section">
      <h3>Alignment reflection</h3>
      <label for="reviewAlignment" class="review-label">How did your work this week connect to your visions?</label>
      <textarea id="reviewAlignment" placeholder="Reflect on whether your daily actions moved you toward your bigger goals..."></textarea>
    </div>
  `;
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
  const modal = document.createElement("div");
  modal.className = "modal-overlay active";

  // Build dynamic sections
  const alignmentSection = buildAlignmentSection();
  const dormantSection = buildDormantGoalsSection();
  const alignmentReflection = buildAlignmentReflection();

  modal.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-header">
        <h2 class="modal-title">Weekly review</h2>
        <button class="modal-close" id="closeReview">×</button>
      </div>
      <div class="modal-body">
        ${alignmentSection}

        <div class="review-section">
          <h3>This week's wins</h3>
          <textarea id="reviewWins" placeholder="What went well? What are you proud of?"></textarea>
        </div>

        <div class="review-section">
          <h3>Challenges faced</h3>
          <textarea id="reviewChallenges" placeholder="What was difficult? What got in the way?"></textarea>
        </div>

        <div class="review-section">
          <h3>Key learnings</h3>
          <textarea id="reviewLearnings" placeholder="What did you learn? What would you do differently?"></textarea>
        </div>

        ${alignmentReflection}

        <div class="review-section">
          <h3>Next week's priorities</h3>
          <textarea id="reviewPriorities" placeholder="What matters most for next week?"></textarea>
        </div>

        ${dormantSection}
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cancelReview">Skip review</button>
        <button class="btn btn-primary" id="saveReview">Save review</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.remove();
  };

  const saveButton = modal.querySelector(
    "#saveReview",
  ) as HTMLButtonElement | null;
  const saveButtonOriginalLabel = saveButton?.textContent ?? "Save Review";
  const closeBtns = [
    modal.querySelector("#closeReview"),
    modal.querySelector("#cancelReview"),
  ];
  let selectedMood = 3;

  closeBtns.forEach((btn) => {
    btn?.addEventListener("click", () => closeModal());
  });

  const setSaveLoading = (loading: boolean, label = "Saving review…") => {
    if (!saveButton) return;
    saveButton.disabled = loading;
    if (loading) {
      saveButton.setAttribute("aria-busy", "true");
      saveButton.dataset.loading = "true";
      saveButton.textContent = label;
    } else {
      saveButton.removeAttribute("aria-busy");
      delete saveButton.dataset.loading;
      saveButton.textContent = saveButtonOriginalLabel;
    }
  };

  modal.querySelectorAll(".mood-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      modal
        .querySelectorAll(".mood-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedMood = parseInt((btn as HTMLElement).dataset.mood ?? "3", 10);
    });
  });

  // Handle "Rest officially" buttons for dormant goals
  modal.querySelectorAll(".dormant-rest-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const goalId = (btn as HTMLElement).dataset.goalId;
      if (!goalId) return;

      try {
        // Archive the goal
        await Goals.update(goalId, { archivedAt: new Date().toISOString() });

        // Remove the item from the list
        const item = btn.closest(".dormant-goal-item");
        if (item) {
          item.remove();
        }

        // Check if list is now empty
        const list = modal.querySelector(".dormant-goals-list");
        if (list && list.children.length === 0) {
          const section = modal.querySelector(".review-dormant");
          if (section) {
            section.innerHTML = `
              <h3>Dormant goals</h3>
              <p class="review-dormant-done">All dormant goals have been addressed.</p>
            `;
          }
        }

        ctx.showToast("", "Goal archived successfully.");
      } catch (err) {
        console.error("Failed to archive goal", err);
        ctx.showToast("", "Couldn't archive goal. Please try again.");
      }
    });
  });

  const buildReviewPayload = () => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: now.toISOString(),
      wins: (
        (modal.querySelector("#reviewWins") as HTMLTextAreaElement | null)
          ?.value ?? ""
      )
        .split("\n")
        .filter(Boolean),
      challenges: (
        (modal.querySelector("#reviewChallenges") as HTMLTextAreaElement | null)
          ?.value ?? ""
      )
        .split("\n")
        .filter(Boolean),
      learnings:
        (modal.querySelector("#reviewLearnings") as HTMLTextAreaElement | null)
          ?.value ?? "",
      alignmentReflection:
        (modal.querySelector("#reviewAlignment") as HTMLTextAreaElement | null)
          ?.value ?? "",
      nextWeekPriorities: (
        (modal.querySelector("#reviewPriorities") as HTMLTextAreaElement | null)
          ?.value ?? ""
      )
        .split("\n")
        .filter(Boolean),
      mood: selectedMood,
    };
  };

  saveButton?.addEventListener("click", async () => {
    if (!saveButton || saveButton.disabled) return;
    setSaveLoading(true);
    try {
      await Planning.createWeeklyReview(buildReviewPayload());
      closeModal();
      ctx.showToast("", "Weekly review saved.");
      ctx.render();
    } catch (err) {
      console.error("Weekly review save failed", err);
      ctx.showToast("", "Couldn’t save your review. Please try again.");
      setSaveLoading(false);
    }
  });
}
