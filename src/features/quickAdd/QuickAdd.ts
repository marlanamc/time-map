/**
 * QuickAdd - Fast intention creation overlay
 *
 * Responsibilities:
 * - Display lightweight overlay for quick intention entry
 * - Create intention goals with minimal friction
 * - Provide keyboard shortcuts (Enter to save, Esc to cancel)
 */

import { Goals } from '../../core/Goals';
import type { GoalLevel }  from "../../types";

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
  /** UI copy overrides (kept lightweight). */
  label?: string;
  placeholder?: string;
  prefillTitle?: string;
  showTinyField?: boolean;
  tinyLabel?: string;
  tinyPlaceholder?: string;
};

class QuickAddManager {
  private callbacks: QuickAddCallbacks | null = null;

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
      console.error('QuickAdd callbacks not set');
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "quick-add-overlay";

    const label = opts?.label ?? "Quick Intention";
    const placeholder = opts?.placeholder ?? "What's one small thing?";
    const showTiny = !!opts?.showTinyField;
    const tinyLabel = opts?.tinyLabel ?? "Tiny version (optional)";
    const tinyPlaceholder = opts?.tinyPlaceholder ?? "If energy is low, what’s the smallest version that still counts?";

    overlay.innerHTML = `
      <div class="quick-add-container">
        <div class="quick-add-header">
          <span class="quick-add-emoji">🌱</span>
          <span class="quick-add-label">${label}</span>
        </div>
        <input type="text" id="quickAddInput" placeholder="${placeholder}" autocomplete="off" autocapitalize="sentences" spellcheck="true" autofocus>
        ${showTiny ? `
          <label class="quick-add-secondary-label" for="quickAddTiny">${tinyLabel}</label>
          <input type="text" id="quickAddTiny" placeholder="${tinyPlaceholder}" autocomplete="off" autocapitalize="sentences" spellcheck="true">
        ` : ""}
        <div class="quick-add-tip">Press Enter to save • Esc to cancel</div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector("#quickAddInput") as HTMLInputElement;
    const tinyInput = overlay.querySelector("#quickAddTiny") as HTMLInputElement | null;
    if (opts?.prefillTitle) input.value = opts.prefillTitle;
    input.focus();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        this.save(input.value.trim(), {
          startDate: opts?.startDate,
          parentId: opts?.parentId,
          parentLevel: opts?.parentLevel,
          tinyText: tinyInput?.value?.trim() ?? "",
        });
        overlay.remove();
      }
      if (e.key === "Escape") {
        overlay.remove();
      }
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
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
      tinyText?: string;
    },
  ): void {
    if (!this.callbacks) return;

    Goals.create({
      title,
      level: "intention",
      description: opts?.tinyText ? opts.tinyText : "",
      startDate: opts?.startDate,
      parentId: opts?.parentId ?? null,
      parentLevel: opts?.parentLevel ?? null,
    });

    this.callbacks.onRender();
    this.callbacks.onToast("🌱", "Saved.");
    this.callbacks.onCelebrate("✨", "Captured", "One small step is enough.");
  }
}

// Export singleton instance
export const quickAdd = new QuickAddManager();
export default quickAdd;
