import { Planning }  from "../../core/Planning";

export type WeeklyReviewContext = {
  showToast: (iconOrMessage: string, messageOrType?: string) => void;
  render: () => void;
};

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
  modal.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-header">
        <h2 class="modal-title">Weekly review</h2>
        <button class="modal-close" id="closeReview">×</button>
      </div>
      <div class="modal-body">
        <div class="review-section">
          <h3>This week's wins</h3>
          <textarea id="reviewWins"></textarea>
        </div>

        <div class="review-section">
          <h3>Challenges faced</h3>
          <textarea id="reviewChallenges"></textarea>
        </div>

        <div class="review-section">
          <h3>Key learnings</h3>
          <textarea id="reviewLearnings"></textarea>
        </div>

        <div class="review-section">
          <h3>Next week's priorities</h3>
          <textarea id="reviewPriorities"></textarea>
        </div>

        <div class="review-section">
          <h3>How are you feeling?</h3>
          <div class="mood-selector">
            <button class="mood-btn" data-mood="1">Overwhelmed</button>
            <button class="mood-btn" data-mood="2">Unsettled</button>
            <button class="mood-btn" data-mood="3">Steady</button>
            <button class="mood-btn" data-mood="4">Focused</button>
            <button class="mood-btn" data-mood="5">Energized</button>
          </div>
        </div>
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

  const saveButton = modal.querySelector("#saveReview") as HTMLButtonElement | null;
  const saveButtonOriginalLabel = saveButton?.textContent ?? "Save Review";
  const closeBtns = [modal.querySelector("#closeReview"), modal.querySelector("#cancelReview")];
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
      modal.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedMood = parseInt((btn as HTMLElement).dataset.mood ?? "3", 10);
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
        (modal.querySelector("#reviewWins") as HTMLTextAreaElement | null)?.value ??
        ""
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
