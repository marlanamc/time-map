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
import {
  renderAccordionSection,
  setupAccordionSectionToggles,
} from "./shared/AccordionSection";
import { renderEnergyMetaPanel, setupEnergyMetaPanel } from "./shared/EnergyMetaPanel";
import { renderActivityPicker, setupActivityPicker } from "./shared/ActivityPicker";
import { setupModalA11y, type ModalA11yCleanup } from "./shared/modalA11y";
import type { AccentTheme, Category, Goal, GoalMeta, GoalStatus } from "../../types";

export interface GoalDetailModalCallbacks {
  escapeHtml: (text: string) => string;
  formatDate: (dateString: string) => string;
  formatMinutes: (minutes: number) => string;
  spawnPollenSparkles: (x: number, y: number) => void;
  onRender: () => void;
  onToast: (icon: string, message: string) => void;
}

type DetailSectionKey = "context" | "energy" | "link" | "details" | "advanced";

const DETAIL_SECTION_IDS: Record<DetailSectionKey, string> = {
  context: "goalDetailContextSection",
  energy: "goalDetailEnergySection",
  link: "goalDetailLinkSection",
  details: "goalDetailDetailsSection",
  advanced: "goalDetailAdvancedSection",
};

const DETAIL_SECTION_TITLES: Record<DetailSectionKey, { title: string; subtitle: string }> = {
  context: {
    title: "Context & orientation (optional)",
    subtitle: "A quiet orientation to your time",
  },
  energy: {
    title: "Make this easier (optional)",
    subtitle: "Tiny + low-energy helpers",
  },
  link: {
    title: "Link it up (optional)",
    subtitle: "See what this connects to",
  },
  details: {
    title: "Details & planning (optional)",
    subtitle: "Track your progress",
  },
  advanced: {
    title: "Advanced (optional)",
    subtitle: "Subtasks, notes, time log, and meta",
  },
};

type DetailModalState = {
  getMeta: () => GoalMeta;
  setMeta: (next: GoalMeta) => void;
  getCategory: () => Category | null;
  setCategory: (next: Category | null) => void;
  getActivityId: () => string | null;
  setActivityId: (next: string | null) => void;
};

function renderDetailAccordionSections(modal: HTMLElement): void {
  const container = modal.querySelector("#goalDetailAccordionContainer");
  if (!container) return;
  container.innerHTML = [
    renderAccordionSection({
      id: DETAIL_SECTION_IDS.context,
      title: DETAIL_SECTION_TITLES.context.title,
      subtitle: DETAIL_SECTION_TITLES.context.subtitle,
      bodyHtml: `<div id="goalDetailContextBody"></div>`,
    }),
    renderAccordionSection({
      id: DETAIL_SECTION_IDS.energy,
      title: DETAIL_SECTION_TITLES.energy.title,
      subtitle: DETAIL_SECTION_TITLES.energy.subtitle,
      bodyHtml: `<div id="goalDetailEnergyBody"></div>`,
    }),
    renderAccordionSection({
      id: DETAIL_SECTION_IDS.link,
      title: DETAIL_SECTION_TITLES.link.title,
      subtitle: DETAIL_SECTION_TITLES.link.subtitle,
      bodyHtml: `<div id="goalDetailLinkBody"></div>`,
    }),
    renderAccordionSection({
      id: DETAIL_SECTION_IDS.details,
      title: DETAIL_SECTION_TITLES.details.title,
      subtitle: DETAIL_SECTION_TITLES.details.subtitle,
      bodyHtml: `<div id="goalDetailDetailsBody"></div>`,
    }),
    renderAccordionSection({
      id: DETAIL_SECTION_IDS.advanced,
      title: DETAIL_SECTION_TITLES.advanced.title,
      subtitle: DETAIL_SECTION_TITLES.advanced.subtitle,
      bodyHtml: `<div id="goalDetailAdvancedBody"></div>`,
    }),
  ].join("");
}

function populateContextSection(modal: HTMLElement, goal: Goal): void {
  const container = modal.querySelector("#goalDetailContextBody");
  if (!container) return;
  container.innerHTML = `
    <div class="detail-section time-section">
      <h3>⏰ Time You Have</h3>
      ${TimeBreakdown.generateHTML(goal.month, goal.year, false, goal.level)}
    </div>
  `;
}

function populateEnergySection(
  modal: HTMLElement,
  level: Goal["level"],
  state: DetailModalState,
): void {
  const container = modal.querySelector("#goalDetailEnergyBody");
  if (!container) return;
  const categoryOptions = Object.entries(CONFIG.CATEGORIES)
    .map(([key, meta]) => `<option value="${key}">${meta.label}</option>`)
    .join("");
  container.innerHTML = `
    <div id="goalDetailEnergyMeta">
      ${renderEnergyMetaPanel({ level, meta: state.getMeta() })}
    </div>
    <div class="form-group">
      <label for="goalDetailCategory">Area of life (optional)</label>
      <select id="goalDetailCategory" class="modal-select">
        <option value="">No category</option>
        ${categoryOptions}
      </select>
    </div>
    <div class="form-group" id="goalDetailActivitySlot"></div>
  `;
  const metaSlot = container.querySelector("#goalDetailEnergyMeta") as HTMLElement | null;
  setupEnergyMetaPanel(metaSlot, {
    level,
    meta: state.getMeta(),
    getMeta: () => state.getMeta(),
    onChange: (nextMeta) => state.setMeta(nextMeta),
  });
  const categorySelect = container.querySelector(
    "#goalDetailCategory",
  ) as HTMLSelectElement | null;
  if (categorySelect) {
    categorySelect.value = state.getCategory() ?? "";
    categorySelect.onchange = () => {
      const raw = categorySelect.value;
      state.setCategory(
        raw && raw in CONFIG.CATEGORIES ? (raw as Category) : null,
      );
    };
  }
  const activitySlot = container.querySelector("#goalDetailActivitySlot") as HTMLElement | null;
  if (activitySlot) {
    activitySlot.innerHTML = renderActivityPicker({ value: state.getActivityId() });
    setupActivityPicker(activitySlot, {
      value: state.getActivityId(),
      onChange: (next) => state.setActivityId(next),
    });
  }
}

function populateLinkSection(
  modal: HTMLElement,
  goal: Goal,
  escapeHtml: (value: string) => string,
  getLevelLabel: (level: string) => string,
): void {
  const container = modal.querySelector("#goalDetailLinkBody");
  if (!container) return;
  let linkHtml = '<p class="field-help">None (life task)</p>';
  if (goal.parentId) {
    const parent = Goals.getById(goal.parentId);
    if (parent) {
      linkHtml = `<p class="field-help">${getLevelLabel(
        parent.level,
      )}: ${escapeHtml(parent.title)}</p>`;
    } else {
      linkHtml = `<p class="field-help">Linked to unknown goal</p>`;
    }
  }
  container.innerHTML = `
    <div class="form-group">
      <label>Connection</label>
      ${linkHtml}
    </div>
  `;
}

function populateDetailsSection(modal: HTMLElement, progress: number): void {
  const container = modal.querySelector("#goalDetailDetailsBody");
  if (!container) return;
  container.innerHTML = `
    <div class="detail-section">
      <h3>Progress</h3>
      <div class="progress-control">
        <div class="progress-bar-lg">
          <div class="progress-fill-lg" style="width: ${progress}%"></div>
        </div>
        <span class="progress-value">${progress}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value="${progress}"
        class="progress-slider"
        id="progressSlider"
      />
    </div>
  `;
}

function populateAdvancedSection(
  modal: HTMLElement,
  goal: Goal,
  callbacks: GoalDetailModalCallbacks,
): void {
  const container = modal.querySelector("#goalDetailAdvancedBody");
  if (!container) return;
  container.innerHTML = `
    <div class="detail-section">
      <h3>Subtasks <span class="count">(${
        goal.subtasks.filter((s) => s.done).length
      }/${goal.subtasks.length})</span></h3>
      <div class="subtasks-list" id="subtasksList">
        ${goal.subtasks
          .map(
            (s) => `
            <div class="subtask-item ${s.done ? "done" : ""}" data-subtask-id="${
              s.id
            }">
              <div class="subtask-checkbox ${s.done ? "checked" : ""}"></div>
              <span class="subtask-title">${callbacks.escapeHtml(s.title)}</span>
              <button class="btn btn-icon btn-ghost subtask-delete">×</button>
            </div>
          `,
          )
          .join("")}
      </div>
      <div class="add-subtask">
        <input type="text" id="newSubtaskInput">
        <button class="btn btn-sm btn-primary" id="addSubtaskBtn">Add</button>
      </div>
    </div>
    <div class="detail-section">
      <h3>Notes & Reflections</h3>
      <div class="notes-list" id="notesList">
        ${goal.notes
          .map(
            (n) => `
            <div class="note-item">
              <p>${callbacks.escapeHtml(n.text)}</p>
              <span class="note-date">${callbacks.formatDate(n.createdAt)}</span>
            </div>
          `,
          )
          .join("")}
      </div>
      <div class="add-note">
        <textarea id="newNoteInput"></textarea>
        <button class="btn btn-sm btn-primary" id="addNoteBtn">Add Note</button>
      </div>
    </div>
    <div class="detail-section">
      <h3>Time Spent</h3>
      <div class="time-summary">
        <span class="time-total">${callbacks.formatMinutes(
          Goals.getTotalTime(goal.id),
        )}</span>
        <button class="btn btn-sm btn-ghost" id="logTimeBtn">+ Log Time</button>
      </div>
      ${
        goal.lastWorkedOn
          ? `<p class="last-worked">Last worked on: ${callbacks.formatDate(
              goal.lastWorkedOn,
            )}</p>`
          : ""
      }
    </div>
    <div class="detail-meta">
      <span>Created: ${callbacks.formatDate(goal.createdAt)}</span>
      ${
        goal.completedAt
          ? `<span>Completed: ${callbacks.formatDate(goal.completedAt)}</span>`
          : ""
      }
    </div>
  `;
}

class GoalDetailModalManager {
  private callbacks: GoalDetailModalCallbacks | null = null;
  private a11yCleanup: ModalA11yCleanup | null = null;

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
   * Close and clean up the modal
   */
  private closeModal(modal: HTMLElement): void {
    if (this.a11yCleanup) {
      this.a11yCleanup();
      this.a11yCleanup = null;
    }
    modal.remove();
    State.selectedGoal = null;
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

    let detailMetaDraft: GoalMeta = { ...(goal.meta ?? {}) };
    let detailActivityId: string | null = goal.activityId ?? null;
    let detailCategory: Category | null = goal.category ?? null;

    const detailState: DetailModalState = {
      getMeta: () => detailMetaDraft,
      setMeta: (nextMeta) => {
        detailMetaDraft = nextMeta;
      },
      getCategory: () => detailCategory,
      setCategory: (nextCategory) => {
        detailCategory = nextCategory;
      },
      getActivityId: () => detailActivityId,
      setActivityId: (next) => {
        detailActivityId = next;
      },
    };

    const statusButtonsHtml = Object.entries(CONFIG.STATUSES)
      .map(
        ([id, s]) => `
          <button class="status-btn ${goal.status === id ? "active" : ""}"
                  data-status="${id}"
                  style="--status-color: ${s.color}">
            ${s.emoji} ${s.label}
          </button>
        `,
      )
      .join("");

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
          <div class="goal-detail-hero">
            <div class="form-group">
              <label for="goalTitleInput">${levelLabel} title</label>
              <input
                id="goalTitleInput"
                type="text"
                value="${callbacks.escapeHtml(goal.title)}"
              />
            </div>
            <div class="form-group">
              <label for="goalDescInput">Description (optional)</label>
              <textarea
                id="goalDescInput"
                rows="2"
                placeholder="A short note to keep it grounded."
              >${callbacks.escapeHtml(goal.description ?? "")}</textarea>
            </div>
            <div id="goalHeroReassurance" class="goal-title-help">
              Take your time—this can evolve.
            </div>
            <div class="detail-section hero-status">
              <h3>Status</h3>
              <div class="status-buttons">
                ${statusButtonsHtml}
              </div>
            </div>
          </div>
          <div id="goalDetailAccordionContainer" class="goal-detail-accordion"></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-danger" id="deleteGoalBtn">Remove ${levelLabel}</button>
          <button class="btn btn-primary" id="saveGoalBtn">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    renderDetailAccordionSections(modal);
    const accordionContainer = modal.querySelector(
      "#goalDetailAccordionContainer",
    ) as HTMLElement | null;
    setupAccordionSectionToggles(accordionContainer);
    const getLevelLabel = this.getLevelLabel.bind(this);
    populateContextSection(modal, goal);
    populateEnergySection(modal, goal.level, detailState);
    populateLinkSection(modal, goal, callbacks.escapeHtml, getLevelLabel);
    populateDetailsSection(modal, goal.progress);
    populateAdvancedSection(modal, goal, callbacks);
    this.bindEvents(modal, goalId, detailState);

    // Setup accessibility: ESC to close, focus trap, initial focus
    const modalContainer = modal.querySelector(".modal") as HTMLElement | null;
    if (modalContainer) {
      // Clean up previous setup if showing again
      if (this.a11yCleanup) {
        this.a11yCleanup();
        this.a11yCleanup = null;
      }
      this.a11yCleanup = setupModalA11y({
        overlay: modal,
        modal: modalContainer,
        onClose: () => this.closeModal(modal),
        initialFocusSelector: "#goalTitleInput",
      });
    }
  }

  /**
   * Bind all event handlers for the modal
   */
  private bindEvents(
    modal: HTMLElement,
    goalId: string,
    detailState: DetailModalState,
  ): void {
    if (!this.callbacks) return;

    // Store callbacks in local const to satisfy TypeScript null checks
    const callbacks = this.callbacks;

    // Close button
    modal.querySelector("#closeGoalDetail")?.addEventListener("click", () => {
      this.closeModal(modal);
    });

    // Click outside to close
    modal.addEventListener("click", (e: MouseEvent) => {
      if (e.target === modal) {
        this.closeModal(modal);
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
          this.closeModal(modal);
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
        this.closeModal(modal);
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

        // Persist category and activityId from detailState
        const nextCategory = detailState.getCategory();
        if (nextCategory !== goal.category) {
          updates.category = nextCategory;
        }
        const nextActivityId = detailState.getActivityId();
        if (nextActivityId !== goal.activityId) {
          updates.activityId = nextActivityId ?? undefined;
        }

        // Persist meta from detailState (merges level-specific fields)
        const nextMeta = detailState.getMeta();
        if (goal.level === "vision") {
          const accentRaw =
            (
              modal.querySelector(
                "#visionAccent"
              ) as HTMLSelectElement | null
            )?.value?.trim() ?? "";
          const accentValue = accentRaw as AccentTheme;
          const metaClone = { ...nextMeta };
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
            // Allow empty string to clear icon, only use default if not specified
            const iconValue = iconInput.value.trim();
            updates.icon = iconValue || undefined;
          }
        } else {
          // For non-vision levels, apply the meta from detailState
          updates.meta =
            Object.keys(nextMeta).length > 0 ? nextMeta : undefined;

          // Handle icon for milestones and focuses
          if (goal.level === "milestone" || goal.level === "focus") {
            const iconInputId = goal.level === "milestone" ? "#milestoneIcon" : "#focusIcon";
            const iconInput = modal.querySelector(iconInputId) as HTMLInputElement | null;
            if (iconInput) {
              const iconValue = iconInput.value.trim();
              updates.icon = iconValue || undefined;
            }
          }
        }

        Goals.update(goalId, updates);
      }
      this.closeModal(modal);
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
   * Note: We don't restore focus here since we're immediately re-showing
   */
  private refresh(modal: HTMLElement, goalId: string): void {
    // Just remove modal without restoring focus since we're re-showing
    if (this.a11yCleanup) {
      // Don't call cleanup since we're immediately re-showing
      this.a11yCleanup = null;
    }
    modal.remove();
    this.show(goalId);
  }
}

// Export singleton instance
export const goalDetailModal = new GoalDetailModalManager();
export default goalDetailModal;
