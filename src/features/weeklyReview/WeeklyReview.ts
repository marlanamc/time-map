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
      <span class="review-emoji">📝</span>
      <span class="review-text">Time for your weekly review!</span>
      <button class="btn btn-sm btn-primary" id="startReviewBtn">Start Review</button>
      <button class="btn btn-sm btn-ghost" id="dismissReviewBtn">Later</button>
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
        <h2 class="modal-title">📝 Weekly Review</h2>
        <button class="modal-close" id="closeReview">×</button>
      </div>
      <div class="modal-body">
        <div class="review-section">
          <h3>🎉 This Week's Wins</h3>
          <textarea id="reviewWins"></textarea>
        </div>

        <div class="review-section">
          <h3>🧗 Challenges Faced</h3>
          <textarea id="reviewChallenges"></textarea>
        </div>

        <div class="review-section">
          <h3>💡 Key Learnings</h3>
          <textarea id="reviewLearnings"></textarea>
        </div>

        <div class="review-section">
          <h3>🎯 Next Week's Priorities</h3>
          <textarea id="reviewPriorities"></textarea>
        </div>

        <div class="review-section">
          <h3>How are you feeling?</h3>
          <div class="mood-selector">
            <button class="mood-btn" data-mood="1">😫</button>
            <button class="mood-btn" data-mood="2">😕</button>
            <button class="mood-btn" data-mood="3">😐</button>
            <button class="mood-btn" data-mood="4">🙂</button>
            <button class="mood-btn" data-mood="5">😊</button>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cancelReview">Skip</button>
        <button class="btn btn-primary" id="saveReview">Save Review ✨</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let selectedMood = 3;

  modal.querySelector("#closeReview")?.addEventListener("click", () => modal.remove());
  modal.querySelector("#cancelReview")?.addEventListener("click", () => modal.remove());

  modal.querySelectorAll(".mood-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedMood = parseInt((btn as HTMLElement).dataset.mood ?? "3", 10);
    });
  });

  modal.querySelector("#saveReview")?.addEventListener("click", () => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());

    Planning.createWeeklyReview({
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
    });

    modal.remove();
    ctx.showToast("📝", "Weekly review saved!");
    ctx.render();
  });
}

