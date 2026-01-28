/**
 * QuickAdd - Fast intention creation overlay
 *
 * Responsibilities:
 * - Display lightweight overlay for quick intention entry
 * - Create intention goals with minimal friction
 * - Provide keyboard shortcuts (Enter to save, Esc to cancel)
 */

import { Goals } from "../../core/Goals";
import { State } from "../../core/State";
import type { GoalLevel } from "../../types";

export interface QuickAddCallbacks {
  onRender: () => void;
  onToast: (icon: string, message: string) => void;
  onCelebrate: (icon: string, title: string, message: string) => void;
}

export type QuickAddOptions = {
  /** Defaults to today (local). */
  startDate?: string;
  /** Optional linkage for the created intention. */
  parentId?: string | null;
  parentLevel?: GoalLevel | null;
  /** Optional helper text shown beneath the heading. */
  label?: string;
  /** Placeholder text for the title field. */
  placeholder?: string;
  /** Prefill the title input for share targets and similar flows. */
  prefillTitle?: string;
};

class QuickAddManager {
  private callbacks: QuickAddCallbacks | null = null;
  private quickAddLinkSelection:
    | {
        parentId: string;
        parentLevel: GoalLevel;
      }
    | null = null;

  /**
   * Set callbacks for QuickAdd interactions
   */
  setCallbacks(callbacks: QuickAddCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Show the Quick Add overlay
   */
  show(opts?: QuickAddOptions): void {
    if (!this.callbacks) {
      console.error("QuickAdd callbacks not set");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "quick-add-overlay";

    overlay.innerHTML = `
      <div class="quick-add-container" role="dialog" aria-modal="true" aria-labelledby="quickAddHeading">
        <div class="quick-add-header">
          <div class="quick-add-header-text">
            <span class="quick-add-emoji">🌱</span>
            <div>
              <span id="quickAddHeading" class="quick-add-label">Quick Add</span>
              <p id="quickAddSubtitle" class="quick-add-subtitle"></p>
            </div>
          </div>
          <button type="button" class="quick-add-close" id="quickAddClose" aria-label="Close Quick Add">×</button>
        </div>
        <form class="quick-add-form" novalidate>
          <div class="quick-add-field">
            <label for="quickAddTitleInput" class="quick-add-field-label">Title</label>
            <input type="text" id="quickAddTitleInput" autocomplete="off" autocapitalize="sentences" spellcheck="true">
          </div>
          <div class="quick-add-field quick-add-time-grid">
            <div class="quick-add-time-field">
              <label for="quickAddStartTime" class="quick-add-field-label">Start (optional)</label>
              <input type="time" id="quickAddStartTime" class="quick-add-time-input">
            </div>
            <div class="quick-add-time-field">
              <label for="quickAddEndTime" class="quick-add-field-label">End (optional)</label>
              <input type="time" id="quickAddEndTime" class="quick-add-time-input">
            </div>
          </div>
          <div class="quick-add-vision-section">
            <label for="quickAddVisionSelect" class="quick-add-field-label quick-add-vision-label">Connect to Vision (optional)</label>
            <select id="quickAddVisionSelect" class="modal-select">
              <option value="">No vision</option>
            </select>
          </div>
          <div class="quick-add-actions">
            <button type="button" class="btn btn-secondary" id="quickAddCancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="quickAddSave">Add intention</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const getVisions = () => {
      const year = State.viewingYear ?? new Date().getFullYear();
      return Goals.getForRange(new Date(year, 0, 1), new Date(year, 11, 31))
        .filter((g) => g.level === "vision" && g.status !== "done")
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((g) => ({ id: g.id, title: g.title }));
    };

    const resolveLinkForVision = (visionId: string) => {
      const activeFocus = Goals.findActiveFocusForVision(visionId);
      if (activeFocus) {
        return {
          parentId: activeFocus.id,
          parentLevel: "focus" as GoalLevel,
        };
      }
      const activeMilestone = Goals.getAll().find(
        (g) =>
          g.level === "milestone" &&
          g.parentId === visionId &&
          g.status !== "done" &&
          g.status !== "archived",
      );
      if (activeMilestone) {
        return {
          parentId: activeMilestone.id,
          parentLevel: "milestone" as GoalLevel,
        };
      }
      return {
        parentId: visionId,
        parentLevel: "vision" as GoalLevel,
      };
    };

    this.quickAddLinkSelection =
      opts?.parentId && opts.parentLevel
        ? { parentId: opts.parentId, parentLevel: opts.parentLevel }
        : null;

    const titleInput = overlay.querySelector(
      "#quickAddTitleInput",
    ) as HTMLInputElement | null;
    const startTimeInput = overlay.querySelector(
      "#quickAddStartTime",
    ) as HTMLInputElement | null;
    const endTimeInput = overlay.querySelector(
      "#quickAddEndTime",
    ) as HTMLInputElement | null;
    const visionSelect = overlay.querySelector(
      "#quickAddVisionSelect",
    ) as HTMLSelectElement | null;
    const subtitle = overlay.querySelector("#quickAddSubtitle");
    const closeButton = overlay.querySelector(
      "#quickAddClose",
    ) as HTMLButtonElement | null;
    const cancelButton = overlay.querySelector(
      "#quickAddCancel",
    ) as HTMLButtonElement | null;
    const saveButton = overlay.querySelector(
      "#quickAddSave",
    ) as HTMLButtonElement | null;

    const closeOverlay = () => overlay.remove();

    if (subtitle) {
      subtitle.textContent =
        opts?.label ?? "Create a one off intention for today.";
    }

    if (titleInput) {
      titleInput.placeholder =
        opts?.placeholder ?? "Describe what you'd like to do today";
      if (opts?.prefillTitle) titleInput.value = opts.prefillTitle;
      titleInput.focus();
    }

    if (visionSelect) {
      getVisions().forEach((vision) => {
        const option = document.createElement("option");
        option.value = vision.id;
        option.textContent = vision.title;
        visionSelect.appendChild(option);
      });

      visionSelect.addEventListener("change", () => {
        const selectedVisionId = visionSelect.value;
        if (selectedVisionId) {
          this.quickAddLinkSelection = resolveLinkForVision(
            selectedVisionId,
          );
        } else {
          this.quickAddLinkSelection = null;
        }
      });
    }

    const handleSubmit = () => {
      if (!titleInput) return;
      const title = titleInput.value.trim();
      if (!title) {
        titleInput.focus();
        return;
      }
      const startTimeValue = startTimeInput?.value.trim() ?? "";
      const endTimeValue = endTimeInput?.value.trim() ?? "";
      this.save(title, {
        startDate: opts?.startDate,
        parentId: opts?.parentId ?? null,
        parentLevel: opts?.parentLevel ?? null,
        startTime: startTimeValue || null,
        endTime: endTimeValue || null,
      });
      closeOverlay();
    };

    saveButton?.addEventListener("click", handleSubmit);
    titleInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSubmit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
      }
    });

    cancelButton?.addEventListener("click", (event) => {
      event.preventDefault();
      closeOverlay();
    });
    closeButton?.addEventListener("click", closeOverlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeOverlay();
    });
  }

  /**
   * Save a quick intention
   */
  private save(
    title: string,
    opts?: {
      startDate?: string;
      parentId?: string | null;
      parentLevel?: GoalLevel | null;
      startTime?: string | null;
      endTime?: string | null;
    },
  ): void {
    if (!this.callbacks) return;

    const selectedLink =
      this.quickAddLinkSelection ??
      (opts?.parentId
        ? { parentId: opts.parentId, parentLevel: opts.parentLevel ?? null }
        : null);

    Goals.create({
      title,
      level: "intention",
      description: "",
      startDate: opts?.startDate,
      parentId: selectedLink?.parentId ?? null,
      parentLevel: selectedLink?.parentLevel ?? null,
      startTime: opts?.startTime ?? null,
      endTime: opts?.endTime ?? null,
    });

    this.callbacks.onRender();
    this.callbacks.onToast("🌱", "Saved.");
    this.callbacks.onCelebrate(
      "✨",
      "Intention set.",
      "One small step is enough.",
    );
  }
}

// Export singleton instance
export const quickAdd = new QuickAddManager();
export default quickAdd;
