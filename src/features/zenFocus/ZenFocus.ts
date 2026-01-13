/**
 * ZenFocus - Distraction-free goal focus mode
 *
 * Responsibilities:
 * - Display full-screen focused view of a single goal
 * - Show goal metadata, description, and subtasks
 * - Allow toggling subtask completion
 * - Allow marking goal as complete
 */

import { Goals } from '../core/Goals';
import { State } from '../core/State';
import { CONFIG } from '../config';

export interface ZenFocusCallbacks {
  escapeHtml: (text: string) => string;
  onRender: () => void;
  onToast: (icon: string, message: string) => void;
  onCelebrate: (icon: string, title: string, message: string) => void;
}

class ZenFocusManager {
  private callbacks: ZenFocusCallbacks | null = null;

  /**
   * Set callbacks for ZenFocus interactions
   */
  setCallbacks(callbacks: ZenFocusCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Open Zen Focus mode for a specific goal
   */
  open(goalId: string): void {
    if (!this.callbacks) {
      console.error('ZenFocus callbacks not set');
      return;
    }

    // Store callbacks in local const to satisfy TypeScript null checks
    const callbacks = this.callbacks;

    const goal = Goals.getById(goalId);
    if (!goal) return;

    const overlay = document.createElement("div");
    overlay.className = "zen-focus-overlay";

    const cat = goal.category ? CONFIG.CATEGORIES[goal.category] : null;
    const levelInfo = CONFIG.LEVELS[goal.level] || CONFIG.LEVELS.intention;

    overlay.innerHTML = `
      <div class="zen-focus-container">
        <button class="zen-close-btn">×</button>

        <div class="zen-header">
          <div class="zen-level-badge">
            <span class="zen-emoji">${levelInfo.emoji}</span>
            <span class="zen-label">${levelInfo.label}</span>
          </div>
          ${cat ? `<div class="zen-category" style="color: ${cat.color}">${cat.emoji} ${cat.label}</div>` : ""}
        </div>

        <h1 class="zen-title">${callbacks.escapeHtml(goal.title)}</h1>
        ${goal.description ? `<p class="zen-desc">${callbacks.escapeHtml(goal.description)}</p>` : ""}

        <div class="zen-subtasks">
          ${goal.subtasks.length > 0 ? `
            <h3>Action Steps</h3>
            <div class="zen-subtask-list">
              ${goal.subtasks.map((s, idx) => `
                <div class="zen-subtask-item ${s.done ? 'done' : ''}" data-idx="${idx}">
                  <div class="zen-subtask-checkbox ${s.done ? 'checked' : ''}"></div>
                  <span>${callbacks.escapeHtml(s.title)}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="zen-empty-subtasks">Focus on the big picture.</div>
          `}
        </div>

        <div class="zen-footer">
          <button class="zen-complete-btn ${goal.status === 'done' ? 'completed' : ''}">
            ${goal.status === 'done' ? '✅ Completed' : '✨ Mark as Done'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event handlers
    overlay.querySelector(".zen-close-btn")?.addEventListener("click", () => overlay.remove());

    overlay.querySelectorAll(".zen-subtask-item").forEach(item => {
      item.addEventListener("click", () => {
        const idx = parseInt((item as HTMLElement).dataset.idx || "0");
        goal.subtasks[idx].done = !goal.subtasks[idx].done;
        State.save();
        callbacks.onRender();
        this.open(goalId); // Re-render zen view
        overlay.remove();
        callbacks.onToast("💎", "Step completed!");
      });
    });

    overlay.querySelector(".zen-complete-btn")?.addEventListener("click", () => {
      goal.status = goal.status === 'done' ? 'in-progress' : 'done';
      State.save();
      callbacks.onRender();
      overlay.remove();
      if (goal.status === 'done') {
        callbacks.onCelebrate("🏆", "Level Up!", `Finished: ${goal.title}`);
      }
    });
  }
}

// Export singleton instance
export const zenFocus = new ZenFocusManager();
export default zenFocus;
