// Break Reminders for hyperfocus protection
import { State } from '../../core/State';
import { ND_CONFIG } from '../../config';
import type { NDSupportCallbacks } from './types';

export class BreakReminders {
  private callbacks: NDSupportCallbacks = {};
  private timer: ReturnType<typeof setInterval> | null = null;

  setCallbacks(callbacks: NDSupportCallbacks): void {
    this.callbacks = callbacks;
  }

  start(): void {
    if (!State.data) return;
    const interval =
      ND_CONFIG.BREAK_INTERVALS[State.data.preferences.nd.breakReminder];
    if (!interval) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.timer = setInterval(
      () => {
        this.showReminder();
      },
      interval * 60 * 1000,
    ) as ReturnType<typeof setInterval>;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private showReminder(): void {
    const messages = [
      "Time for a break! Stretch, hydrate, or look at something far away.",
      "Break time! Your brain needs a reset. Step away for 5 minutes.",
      "Pause check: Have you moved your body recently?",
      "Hydration check! Grab some water.",
      "Screen break time. Rest your eyes for a moment.",
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];
    this.callbacks.onShowToast?.(message, "info");
  }
}
