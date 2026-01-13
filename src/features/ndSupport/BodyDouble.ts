// Body Doubling Timer - Focus buddy feature
import { State } from '../../core/State';
import { ND_CONFIG } from '../../config';
import type { BodyDoubleSession, NDSupportCallbacks } from './types';

export class BodyDouble {
  private callbacks: NDSupportCallbacks = {};
  private timer: ReturnType<typeof setInterval> | null = null;
  private endTime: number | null = null;

  setCallbacks(callbacks: NDSupportCallbacks): void {
    this.callbacks = callbacks;
  }

  start(minutes: number): BodyDoubleSession {
    if (!State.data) {
      State.init();
      if (!State.data) throw new Error("State not initialized");
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.endTime = Date.now() + minutes * 60 * 1000;

    const session: BodyDoubleSession = {
      id: Date.now().toString(36),
      startedAt: new Date().toISOString(),
      duration: minutes,
      completedAt: null,
      goalId: null,
      completed: false,
    };
    State.data.bodyDoubleHistory.push(session);
    State.save();

    this.timer = setInterval(() => {
      if (this.endTime) {
        const remaining = this.endTime - Date.now();
        if (remaining <= 0) {
          this.end(session.id, true);
        }
      }
    }, 1000) as ReturnType<typeof setInterval>;

    return session;
  }

  getRemaining(): number | null {
    if (!this.endTime) return null;
    const remaining = this.endTime - Date.now();
    if (remaining <= 0) return null;
    return Math.ceil(remaining / 1000);
  }

  end(sessionId: string, completed: boolean = false): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.endTime = null;

    if (!State.data) return;
    const session = State.data.bodyDoubleHistory.find(
      (s) => s.id === sessionId,
    );
    if (session) {
      session.completed = completed;
      session.completedAt = completed ? new Date().toISOString() : null;
      session.endedAt = new Date().toISOString();
      State.save();
    }

    if (completed) {
      this.callbacks.onShowToast?.(
        "Body double session complete! Great focus! 🎉",
        "success",
      );
    }
  }

  showModal(): void {
    const remaining = this.getRemaining();

    if (remaining) {
      // Show active timer
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      this.callbacks.onShowToast?.(
        `Body double active: ${mins}:${secs.toString().padStart(2, "0")} remaining`,
        "info",
      );
      return;
    }

    const modal = document.createElement("div");
    modal.className = "modal-overlay active body-double-modal";
    modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Body Double Timer</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="modal-body">
            <p class="body-double-intro">Body doubling helps with focus! Pick a duration and work alongside the timer.</p>
            <div class="body-double-options">
              ${ND_CONFIG.BODY_DOUBLE_DURATIONS.map(
      (mins) => `
                <button class="body-double-option" data-minutes="${mins}">
                  <span class="bd-time">${mins}</span>
                  <span class="bd-label">minutes</span>
                </button>
              `,
    ).join("")}
            </div>
            <div class="body-double-tip">
              <p><strong>Tip:</strong> Tell someone you're starting, or imagine a supportive friend working beside you.</p>
            </div>
          </div>
        </div>
      `;

    document.body.appendChild(modal);

    modal.querySelectorAll(".body-double-option").forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        if (!target) return;
        const minutes = parseInt(target.dataset.minutes || '0');
        this.start(minutes);
        modal.remove();
        this.callbacks.onShowToast?.(
          `Body double started! ${minutes} minutes of focus time.`,
          "success",
        );
      });
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}
