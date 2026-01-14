/**
 * GoalDetailModal - Comprehensive goal editing and viewing modal
 *
 * Responsibilities:
 * - Display full goal details with metadata
 * - Edit progress, status, subtasks, and notes
 * - Log time spent on goal
 * - Delete goals
 * - Real-time updates with progress slider
 */

import { Goals } from "../../core/Goals";
import { State } from "../../core/State";
import { CONFIG } from "../../config";
import { TimeBreakdown } from "../../utils/TimeBreakdown";
import { ND_CONFIG } from "../../config/ndConfig";
import { getVisionAccent } from "../../utils/goalLinkage";
import type { AccentTheme, Goal, GoalStatus } from "../../types";

export interface GoalDetailModalCallbacks {
  escapeHtml: (text: string) => string;
  formatDate: (dateString: string) => string;
  formatMinutes: (minutes: number) => string;
  spawnPollenSparkles: (x: number, y: number) => void;
  onRender: () => void;
  onToast: (icon: string, message: string) => void;
}

class GoalDetailModalManager {
  private callbacks: GoalDetailModalCallbacks | null = null;

  private getLevelLabel(level: string): string {
    switch (level) {
      case "vision":
        return "Vision";
      case "milestone":
        return "Milestone";
      case "focus":
        return "Focus";
      case "intention":
        return "Intention";
      default:
        return "Intention";
    }
  }

  /**
   * Set callbacks for modal interactions
   */
  setCallbacks(callbacks: GoalDetailModalCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Open goal detail modal for a specific goal
   */
  show(goalId?: string): void {
    if (!goalId || !this.callbacks) return;

    // Store callbacks in local const to satisfy TypeScript null checks
    const callbacks = this.callbacks;

    const goal = Goals.getById(goalId);
    if (!goal) return;

    State.selectedGoal = goalId;
    const levelLabel = this.getLevelLabel(goal.level);
    const cat = goal.category ? CONFIG.CATEGORIES[goal.category] ?? null : null;
    const status = CONFIG.STATUSES[goal.status];
    const isVision = goal.level === "vision";
    const currentAccent = isVision ? getVisionAccent(goal)?.key ?? "" : "";
    const accentOptions = isVision
      ? Object.entries(ND_CONFIG.ACCENT_THEMES)
          .filter(([key]) => key !== "rainbow")
          .map(([key, meta]) => `<option value="${key}">${meta.label}</option>`)
          .join("")
      : "";

    const modal = document.createElement("div");
    modal.className = "modal-overlay active";
    modal.id = "goalDetailModal";
    modal.innerHTML = `
                <div class="modal modal-lg">
                    <div class="modal-header">
                        <div class="goal-detail-header">
                            ${
                              cat
                                ? `<span class="goal-category-badge" style="background: ${cat.color}20; color: ${cat.color}">
                                ${cat.emoji} ${cat.label}
                            </span>`
                                : ""
                            }
                            <span class="goal-status-badge" style="background: ${
                              status.color
                            }20; color: ${status.color}">
                                ${status.emoji} ${status.label}
                            </span>
                        </div>
                        <button class="modal-close" id="closeGoalDetail">×</button>
                    </div>
	                    <div class="modal-body">
	                        <div class="detail-section">
	                          <div class="form-group">
	                            <label for="goalTitleInput">${levelLabel} title</label>
	                            <input id="goalTitleInput" type="text" value="${callbacks.escapeHtml(
                                goal.title
                              )}" />
	                          </div>
	                          <div class="form-group">
	                            <label for="goalDescInput">Description (optional)</label>
	                            <textarea id="goalDescInput" rows="2" placeholder="A short note to keep it grounded.">${callbacks.escapeHtml(
                                goal.description ?? ""
                              )}</textarea>
	                          </div>
	                        </div>

	                        ${
                            isVision
                              ? `
	                        <div class="detail-section">
	                          <h3>Visuals</h3>
                              <div class="form-group-row">
                                <div class="form-group">
                                    <label for="visionIconInput">Icon</label>
                                    <div class="icon-input-wrapper">
                                        <input id="visionIconInput" type="text" class="icon-input" value="${
                                          goal.icon || "✨"
                                        }" maxlength="2" />
                                        <div class="icon-presets">
                                            ${[
                                              "✨",
                                              "🚀",
                                              "🏔️",
                                              "🎯",
                                              "💪",
                                              "❤️",
                                              "🧠",
                                              "🦁",
                                              "🌱",
                                              "🌊",
                                            ]
                                              .map(
                                                (icon) =>
                                                  `<button type="button" class="icon-preset-btn" data-icon="${icon}">${icon}</button>`
                                              )
                                              .join("")}
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group flex-grow">
    	                            <label for="visionAccentDetail">Color Theme</label>
    	                            <select id="visionAccentDetail" class="modal-select">
    	                              <option value="">Default</option>
    	                              ${accentOptions}
    	                            </select>
                                </div>
                              </div>
	                        </div>
	                        `
                              : ""
                          }

	                        ${
                            isVision
                              ? ""
                              : `
	                        <!-- Time Breakdown Section -->
	                        <div class="detail-section time-section">
	                            <h3>⏰ Time You Have</h3>
	                            ${TimeBreakdown.generateHTML(
                                goal.month,
                                goal.year,
                                false,
                                goal.level
                              )}
	                        </div>

	                        <!-- Progress Section -->
	                        <div class="detail-section">
	                            <h3>Progress</h3>
	                            <div class="progress-control">
	                                <div class="progress-bar-lg">
	                                    <div class="progress-fill-lg" style="width: ${
                                        goal.progress
                                      }%"></div>
	                                </div>
	                                <span class="progress-value">${
                                    goal.progress
                                  }%</span>
	                            </div>
	                            <input type="range" min="0" max="100" value="${
                                goal.progress
                              }"
	                                   class="progress-slider" id="progressSlider">
	                        </div>
	                        `
                          }

                        <!-- Status Section -->
                        <div class="detail-section">
                            <h3>Status</h3>
                            <div class="status-buttons">
                                ${Object.entries(CONFIG.STATUSES)
                                  .map(
                                    ([id, s]) => `
                                    <button class="status-btn ${
                                      goal.status === id ? "active" : ""
                                    }"
                                            data-status="${id}" style="--status-color: ${
                                      s.color
                                    }">
                                        ${s.emoji} ${s.label}
                                    </button>
                                `
                                  )
                                  .join("")}
                            </div>
                        </div>

                        <!-- Subtasks Section -->
                        <div class="detail-section">
                            <h3>Subtasks <span class="count">(${
                              goal.subtasks.filter((s) => s.done).length
                            }/${goal.subtasks.length})</span></h3>
                            <div class="subtasks-list" id="subtasksList">
                                ${goal.subtasks
                                  .map(
                                    (s) => `
                                    <div class="subtask-item ${
                                      s.done ? "done" : ""
                                    }" data-subtask-id="${s.id}">
                                        <div class="subtask-checkbox ${
                                          s.done ? "checked" : ""
                                        }"></div>
                                        <span class="subtask-title">${callbacks.escapeHtml(
                                          s.title
                                        )}</span>
                                        <button class="btn btn-icon btn-ghost subtask-delete">×</button>
                                    </div>
                                `
                                  )
                                  .join("")}
                            </div>
                            <div class="add-subtask">
                                <input type="text" placeholder="Add a subtask..." id="newSubtaskInput">
                                <button class="btn btn-sm btn-primary" id="addSubtaskBtn">Add</button>
                            </div>
                        </div>

                        <!-- Notes Section -->
                        <div class="detail-section">
                            <h3>Notes & Reflections</h3>
                            <div class="notes-list" id="notesList">
                                ${goal.notes
                                  .map(
                                    (n) => `
                                    <div class="note-item">
                                        <p>${callbacks.escapeHtml(n.text)}</p>
                                        <span class="note-date">${callbacks.formatDate(
                                          n.createdAt
                                        )}</span>
                                    </div>
                                `
                                  )
                                  .join("")}
                            </div>
                            <div class="add-note">
                                <textarea placeholder="Add a note..." id="newNoteInput"></textarea>
                                <button class="btn btn-sm btn-primary" id="addNoteBtn">Add Note</button>
                            </div>
                        </div>

                        <!-- Time Tracking -->
                        <div class="detail-section">
                            <h3>Time Spent</h3>
                            <div class="time-summary">
                                <span class="time-total">${callbacks.formatMinutes(
                                  Goals.getTotalTime(goalId)
                                )}</span>
                                <button class="btn btn-sm btn-ghost" id="logTimeBtn">+ Log Time</button>
                            </div>
                            ${
                              goal.lastWorkedOn
                                ? `<p class="last-worked">Last worked on: ${callbacks.formatDate(
                                    goal.lastWorkedOn
                                  )}</p>`
                                : ""
                            }
                        </div>

                        <!-- Meta Info -->
                        <div class="detail-meta">
                            <span>Created: ${callbacks.formatDate(
                              goal.createdAt
                            )}</span>
                            ${
                              goal.completedAt
                                ? `<span>Completed: ${callbacks.formatDate(
                                    goal.completedAt
                                  )}</span>`
                                : ""
                            }
                        </div>
                    </div>
		                    <div class="modal-actions">
		                        <button class="btn btn-danger" id="deleteGoalBtn">Remove ${levelLabel}</button>
		                        <button class="btn btn-primary" id="saveGoalBtn">Save Changes</button>
		                    </div>
		                </div>
		            `;

    document.body.appendChild(modal);
    if (isVision) {
      const accentEl = modal.querySelector(
        "#visionAccentDetail"
      ) as HTMLSelectElement | null;
      if (accentEl) accentEl.value = currentAccent;
    }
    this.bindEvents(modal, goalId);
  }

  /**
   * Bind all event handlers for the modal
   */
  private bindEvents(modal: HTMLElement, goalId: string): void {
    if (!this.callbacks) return;

    // Store callbacks in local const to satisfy TypeScript null checks
    const callbacks = this.callbacks;

    // Close button
    modal.querySelector("#closeGoalDetail")?.addEventListener("click", () => {
      modal.remove();
      State.selectedGoal = null;
    });

    // Click outside to close
    modal.addEventListener("click", (e: MouseEvent) => {
      if (e.target === modal) {
        modal.remove();
        State.selectedGoal = null;
      }
    });

    // Progress slider: update modal UI on input, persist on change (prevents render/sync churn).
    const progressFill = modal.querySelector(
      ".progress-fill-lg"
    ) as HTMLElement | null;
    const progressValue = modal.querySelector(
      ".progress-value"
    ) as HTMLElement | null;
    const setProgressUI = (progress: number) => {
      if (progressFill) progressFill.style.width = `${progress}%`;
      if (progressValue) progressValue.textContent = `${progress}%`;
    };

    modal
      .querySelector("#progressSlider")
      ?.addEventListener("input", (e: Event) => {
        const target = e.target as HTMLInputElement | null;
        const progress = target ? parseInt(target.value, 10) : NaN;
        if (!Number.isFinite(progress)) return;
        setProgressUI(progress);
      });

    modal
      .querySelector("#progressSlider")
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement | null;
        const progress = target ? parseInt(target.value, 10) : NaN;
        if (!Number.isFinite(progress)) return;
        Goals.update(goalId, { progress });
        setProgressUI(progress);
      });

    // Status buttons
    modal.querySelectorAll(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const status = (btn as HTMLElement).dataset.status;
        if (!status) return;
        Goals.update(goalId, { status: status as GoalStatus });
        modal
          .querySelectorAll(".status-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (status === "done") {
          Goals.complete(goalId);
          modal.remove();
          callbacks.onRender();
        }
      });
    });

    // Add subtask
    const addSubtask = () => {
      const input = modal.querySelector(
        "#newSubtaskInput"
      ) as HTMLInputElement | null;
      const title = input?.value.trim() ?? "";
      if (!title) return;

      Goals.addSubtask(goalId, title);
      if (input) input.value = "";
      this.refresh(modal, goalId);
    };

    modal
      .querySelector("#addSubtaskBtn")
      ?.addEventListener("click", addSubtask);
    (
      modal.querySelector("#newSubtaskInput") as HTMLInputElement | null
    )?.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") addSubtask();
    });

    // Toggle subtasks
    modal.querySelectorAll(".subtask-checkbox").forEach((cb) => {
      cb.addEventListener("click", (e: Event) => {
        const mouseEvent = e as MouseEvent;
        const subtaskItem = cb.closest(".subtask-item") as HTMLElement | null;
        const subtaskId = subtaskItem?.dataset.subtaskId;
        if (!subtaskId) return;

        // If checking (not unchecking), spawn sparkles
        const checkbox = cb as HTMLInputElement;
        if (checkbox.checked) {
          callbacks.spawnPollenSparkles(mouseEvent.clientX, mouseEvent.clientY);
        }

        Goals.toggleSubtask(goalId, subtaskId);
        this.refresh(modal, goalId);
      });
    });

    // Delete subtasks
    modal.querySelectorAll(".subtask-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const subtaskItem = btn.closest(".subtask-item") as HTMLElement | null;
        const subtaskId = subtaskItem?.dataset.subtaskId;
        if (!subtaskId) return;
        Goals.deleteSubtask(goalId, subtaskId);
        this.refresh(modal, goalId);
      });
    });

    // Add note
    modal.querySelector("#addNoteBtn")?.addEventListener("click", () => {
      const input = modal.querySelector(
        "#newNoteInput"
      ) as HTMLInputElement | null;
      const text = input?.value.trim() ?? "";
      if (!text) return;

      Goals.addNote(goalId, text);
      if (input) input.value = "";
      this.refresh(modal, goalId);
    });

    // Log time
    modal.querySelector("#logTimeBtn")?.addEventListener("click", () => {
      const minutesRaw = prompt("How many minutes did you work on this?");
      const minutes = minutesRaw ? parseInt(minutesRaw, 10) : NaN;
      if (Number.isFinite(minutes)) {
        Goals.logTime(goalId, minutes);
        this.refresh(modal, goalId);
        callbacks.onToast("⏱️", "Time logged!");
      }
    });

    // Delete goal
    modal.querySelector("#deleteGoalBtn")?.addEventListener("click", () => {
      const goal = Goals.getById(goalId);
      const levelLabel = goal ? this.getLevelLabel(goal.level) : "Intention";
      const levelLabelLower = levelLabel.toLowerCase();
      if (confirm(`Remove this ${levelLabelLower}?`)) {
        Goals.delete(goalId);
        modal.remove();
        callbacks.onRender();
        callbacks.onToast("🗑️", `${levelLabel} removed`);
      }
    });

    // Save changes
    modal.querySelector("#saveGoalBtn")?.addEventListener("click", () => {
      const goal = Goals.getById(goalId);
      if (goal) {
        const title =
          (
            modal.querySelector("#goalTitleInput") as HTMLInputElement | null
          )?.value?.trim() ?? "";
        const description =
          (
            modal.querySelector("#goalDescInput") as HTMLTextAreaElement | null
          )?.value?.trim() ?? "";

        const updates: Partial<Goal> = {};
        if (title && title !== goal.title) updates.title = title;
        updates.description = description;

        if (goal.level === "vision") {
          const accentRaw =
            (
              modal.querySelector(
                "#visionAccentDetail"
              ) as HTMLSelectElement | null
            )?.value?.trim() ?? "";
          const accentValue = accentRaw as AccentTheme;
          const metaClone = { ...(goal.meta ?? {}) };
          if (accentRaw && (accentValue as any) in ND_CONFIG.ACCENT_THEMES) {
            metaClone.accentTheme = accentRaw as AccentTheme;
          } else {
            delete metaClone.accentTheme;
          }
          updates.meta =
            Object.keys(metaClone).length > 0 ? metaClone : undefined;

          const iconInput = modal.querySelector(
            "#visionIconInput"
          ) as HTMLInputElement | null;
          if (iconInput) {
            updates.icon = iconInput.value || "✨"; // Default if cleared
          }
        }

        Goals.update(goalId, updates);
      }
      modal.remove();
      State.selectedGoal = null;
      callbacks.onRender();
      callbacks.onToast("✅", "Changes saved");
    });

    // Icon preset buttons
    modal.querySelectorAll(".icon-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const icon = (btn as HTMLElement).dataset.icon;
        const input = modal.querySelector(
          "#visionIconInput"
        ) as HTMLInputElement | null;
        if (input && icon) {
          input.value = icon;
          // Optional: trigger input event or visual feedback
        }
      });
    });
  }

  /**
   * Refresh the modal with updated goal data
   */
  private refresh(modal: HTMLElement, goalId: string): void {
    modal.remove();
    this.show(goalId);
  }
}

// Export singleton instance
export const goalDetailModal = new GoalDetailModalManager();
export default goalDetailModal;
