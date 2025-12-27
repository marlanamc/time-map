import type { TimeSlot } from "./types";
import { TimeSlotCalculator } from "./TimeSlotCalculator";

export class TimelineGrid {
  private calculator: TimeSlotCalculator;

  constructor(calculator: TimeSlotCalculator) {
    this.calculator = calculator;
  }

  /**
   * Render the time grid as HTML string
   */
  render(): string {
    const slots = this.calculator.generateTimeSlots();
    const currentTimeVisible = this.calculator.isCurrentTimeVisible();
    const currentTimePosition = this.calculator.getCurrentTimePosition();

    const hoursHtml = slots
      .map((slot, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === slots.length - 1;
        const posClass = isFirst ? " is-first" : isLast ? " is-last" : "";

        return `
          <div class="bed-hour${posClass}"
               style="--at:${slot.position.toFixed(4)}"
               data-hour="${slot.hour}">
            <span class="bed-hour-label">${slot.label12h}</span>
            <div class="bed-hour-line"></div>
          </div>
        `;
      })
      .join("");

    const currentTimeIndicator = currentTimeVisible
      ? `<div class="current-time-indicator" style="--at:${currentTimePosition.toFixed(4)}">
           <div class="current-time-line"></div>
           <div class="current-time-dot"></div>
         </div>`
      : "";

    return `
      <div class="day-bed-grid" aria-hidden="true">
        ${hoursHtml}
        ${currentTimeIndicator}
      </div>
    `;
  }

  /**
   * Create a DOM element from the rendered grid HTML
   */
  createElement(): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = this.render().trim();
    return template.content.firstChild as HTMLElement;
  }

  /**
   * Update an existing grid element
   */
  updateElement(element: HTMLElement): void {
    const currentTimeVisible = this.calculator.isCurrentTimeVisible();
    const currentTimePosition = this.calculator.getCurrentTimePosition();

    let indicator = element.querySelector(".current-time-indicator") as HTMLElement | null;

    if (currentTimeVisible) {
      if (!indicator) {
        // Create indicator if it doesn't exist
        indicator = document.createElement("div");
        indicator.className = "current-time-indicator";
        indicator.innerHTML = `
          <div class="current-time-line"></div>
          <div class="current-time-dot"></div>
        `;
        element.appendChild(indicator);
      }
      // Update position
      indicator.style.setProperty("--at", currentTimePosition.toFixed(4));
    } else if (indicator) {
      // Remove indicator if time is not visible
      indicator.remove();
    }
  }

  /**
   * Get the time at a specific Y position within the grid
   */
  getTimeAtY(y: number, gridHeight: number): { minutes: number; formatted: string } {
    const minutes = this.calculator.yToMinutes(y, gridHeight);
    const formatted = this.calculator.format12h(minutes);
    return { minutes, formatted };
  }

  /**
   * Get the Y position for a specific time (in minutes)
   */
  getYForTime(minutes: number, gridHeight: number): number {
    const pct = this.calculator.minutesToPercent(minutes) / 100;
    return pct * gridHeight;
  }

  /**
   * Find the nearest snap point for a given Y position
   */
  snapY(y: number, gridHeight: number): { y: number; minutes: number; formatted: string } {
    const minutes = this.calculator.yToMinutes(y, gridHeight);
    const snappedY = this.getYForTime(minutes, gridHeight);
    const formatted = this.calculator.format12h(minutes);
    return { y: snappedY, minutes, formatted };
  }
}
