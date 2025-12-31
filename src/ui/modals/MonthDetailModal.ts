/**
 * MonthDetailModal - Month overview and goal management modal
 *
 * Responsibilities:
 * - Display month overview with statistics
 * - Show goals grouped by status
 * - Allow quick milestone creation for the month
 * - Navigate to goal detail modal
 */

import { Goals } from '../../core/Goals';
import { CONFIG } from '../../config';
import type { Goal, GoalStatus, Category } from '../../types';

export interface MonthDetailModalCallbacks {
  escapeHtml: (text: string) => string;
  onRender: () => void;
  onToast: (icon: string, message: string) => void;
  onShowGoalDetail: (goalId: string) => void;
}

class MonthDetailModalManager {
  private callbacks: MonthDetailModalCallbacks | null = null;

  /**
   * Set callbacks for modal interactions
   */
  setCallbacks(callbacks: MonthDetailModalCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Show month detail modal
   */
  show(monthIndex: number, year: number = new Date().getFullYear()): void {
    if (!this.callbacks) {
      console.error('MonthDetailModal callbacks not set');
      return;
    }

    const monthGoals = Goals.getByMonth(monthIndex, year).filter(
      (g) => g.level !== "intention" && g.level !== "vision",
    );
    const monthName = CONFIG.MONTHS[monthIndex];

    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "monthDetailModal";
    modal.innerHTML = `
                <div class="modal modal-xl">
                    <div class="modal-header">
                        <h2 class="modal-title">${monthName} ${year}</h2>
                        <button class="modal-close" id="closeMonthDetail">×</button>
                    </div>
                    <div class="modal-body">
                        <!-- Month Overview -->
                        <div class="month-overview">
                            <div class="overview-stat">
                                <div class="stat-value">${monthGoals.length}</div>
                                <div class="stat-label">Total Anchors</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-value">${monthGoals.filter((g) => g.status === "done").length}</div>
                                <div class="stat-label">Completed</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-value">${monthGoals.filter((g) => g.status === "in-progress").length}</div>
                                <div class="stat-label">In Progress</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-value">${Math.round(monthGoals.reduce((s, g) => s + g.progress, 0) / (monthGoals.length || 1))}%</div>
                                <div class="stat-label">Avg Progress</div>
                            </div>
                        </div>

                        <!-- Milestones by Status -->
                        <div class="goals-by-status">
                            ${this.renderGoalsByStatus(monthGoals)}
                        </div>

                        <!-- Add Milestone for this month -->
                        <div class="quick-add-goal">
                            <input type="text" placeholder="Quick add a milestone for ${monthName}..." id="quickGoalInput">
                            <select id="quickGoalCategory">
                                <option value="">No category</option>
                                ${Object.entries(CONFIG.CATEGORIES)
        .map(
          ([id, cat]) => `
                                    <option value="${id}">${cat.emoji} ${cat.label}</option>
                                `
        )
        .join("")}
                            </select>
                            <button class="btn btn-primary" id="quickAddGoalBtn">Add</button>
                        </div>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);

    // Bind events
    modal
      .querySelector("#closeMonthDetail")
      ?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    // Quick add goal
    modal.querySelector("#quickAddGoalBtn")?.addEventListener("click", () => {
      const input = modal.querySelector("#quickGoalInput") as HTMLInputElement | null;
      const categorySelect = modal.querySelector("#quickGoalCategory") as HTMLSelectElement | null;
      const title = input?.value.trim() ?? "";
      const categoryRaw = categorySelect?.value;
      const category: Category =
        categoryRaw && categoryRaw in CONFIG.CATEGORIES
          ? (categoryRaw as Exclude<Category, null>)
          : null;

      if (!title) return;

      Goals.create({
        title,
        level: "milestone",
        month: monthIndex,
        year,
        category,
      });

      if (input) input.value = "";
      modal.remove();
      this.callbacks!.onRender();
      this.callbacks!.onToast("✨", "Milestone placed.");
    });

    // Clicking on goal items opens detail
    modal.querySelectorAll(".goal-item").forEach((el) => {
      el.addEventListener("click", () => {
        modal.remove();
        this.callbacks!.onShowGoalDetail((el as HTMLElement).dataset.goalId!);
      });
    });
  }

  /**
   * Render goals grouped by status
   */
  private renderGoalsByStatus(goals: Goal[]): string {
    if (!this.callbacks) return '';

    const grouped: Record<GoalStatus, Goal[]> = {
      "not-started": goals.filter((g) => g.status === "not-started"),
      "in-progress": goals.filter((g) => g.status === "in-progress"),
      blocked: goals.filter((g) => g.status === "blocked"),
      done: goals.filter((g) => g.status === "done"),
    };

    return (Object.entries(grouped) as [GoalStatus, Goal[]][])
      .map(([status, statusGoals]) => {
        const statusConfig = CONFIG.STATUSES[status];
        return `
                    <div class="status-column">
                        <h3 class="status-header" style="color: ${statusConfig.color}">
                            ${statusConfig.emoji} ${statusConfig.label} (${statusGoals.length})
                        </h3>
                        <div class="status-goals">
                            ${statusGoals
            .map((goal) => {
              const cat = goal.category ? CONFIG.CATEGORIES[goal.category] : null;
              const level = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.milestone;
              return `
                                    <div class="goal-item" data-goal-id="${goal.id}">
                                        <div class="goal-content">
                                            <div class="goal-title">
                                                <span class="goal-level-emoji">${level.emoji}</span>
                                                ${this.callbacks!.escapeHtml(goal.title)}
                                            </div>
                                            <div class="goal-meta">
                                                ${cat ? `<span style="color: ${cat.color}">${cat.emoji}</span>` : ""}
                                                <span>${goal.progress}%</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
            })
            .join("") || ""
          }
                        </div>
                    </div>
                `;
      })
      .join("");
  }
}

// Export singleton instance
export const monthDetailModal = new MonthDetailModalManager();
export default monthDetailModal;
