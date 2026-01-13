import type { DayViewCallbacks } from "./types";
import { DayViewState } from "./DayViewState";

export class DayViewEvents {
  private container: HTMLElement;
  private callbacks: DayViewCallbacks;
  private state: DayViewState;
  private undo: () => boolean;
  private redo: () => boolean;

  constructor(
    container: HTMLElement,
    callbacks: DayViewCallbacks,
    state: DayViewState,
    undo: () => boolean,
    redo: () => boolean
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.state = state;
    this.undo = undo;
    this.redo = redo;
  }

  handleClick(e: Event): void {
    const target = e.target as HTMLElement;

    const contextGoalBtn = target.closest(".year-vision-icon-only[data-goal-id]") as
      | HTMLElement
      | null;
    if (contextGoalBtn) {
      e.preventDefault();
      e.stopPropagation();
      const goalId = contextGoalBtn.dataset.goalId;
      if (goalId) this.callbacks.onGoalClick(goalId);
      return;
    }

    // Add more event handling logic here from events.ts
    // This is a placeholder - would need to extract all event handlers
  }

  handleKeyDown(_e: KeyboardEvent): void {
    // Extract keyboard handling logic from events.ts
    // This is a placeholder - would need to extract all keyboard handlers
  }

  attachEventListeners(): void {
    // Attach all event listeners
    this.container.addEventListener("click", this.handleClick.bind(this));
    this.container.addEventListener("keydown", this.handleKeyDown.bind(this));
    // Add other event listeners as needed
  }

  detachEventListeners(): void {
    // Remove all event listeners
    this.container.removeEventListener("click", this.handleClick.bind(this));
    this.container.removeEventListener("keydown", this.handleKeyDown.bind(this));
    // Remove other event listeners as needed
  }
}