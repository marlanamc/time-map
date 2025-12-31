/**
 * QuickAdd - Fast intention creation overlay
 *
 * Responsibilities:
 * - Display lightweight overlay for quick intention entry
 * - Create intention goals with minimal friction
 * - Provide keyboard shortcuts (Enter to save, Esc to cancel)
 */

import { Goals } from '../core/Goals';

export interface QuickAddCallbacks {
  onRender: () => void;
  onToast: (icon: string, message: string) => void;
  onCelebrate: (icon: string, title: string, message: string) => void;
}

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
  show(): void {
    if (!this.callbacks) {
      console.error('QuickAdd callbacks not set');
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "quick-add-overlay";
    overlay.innerHTML = `
      <div class="quick-add-container">
        <div class="quick-add-header">
          <span class="quick-add-emoji">🌱</span>
          <span class="quick-add-label">Quick Intention</span>
        </div>
        <input type="text" id="quickAddInput" placeholder="What's one small thing for today?" autofocus>
        <div class="quick-add-tip">Press Enter to save • Esc to cancel</div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector("#quickAddInput") as HTMLInputElement;
    input.focus();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        this.save(input.value.trim());
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
  private save(title: string): void {
    if (!this.callbacks) return;

    Goals.create({
      title,
      level: "intention",
      category: "personal",
      priority: "medium",
      month: new Date().getMonth(),
      year: new Date().getFullYear()
    });

    this.callbacks.onRender();
    this.callbacks.onToast("🌱", "Intention captured. Go for it!");
    this.callbacks.onCelebrate("✨", "Captured!", "Focus on this one thing.");
  }
}

// Export singleton instance
export const quickAdd = new QuickAddManager();
export default quickAdd;
