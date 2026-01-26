import { TimeSlotCalculator } from "./TimeSlotCalculator";

export class TimelineGrid {
  private calculator: TimeSlotCalculator;

  constructor(calculator: TimeSlotCalculator) {
    this.calculator = calculator;
  }

  /**
   * Render the time grid as HTML string
   * @param currentDate - Optional current date to determine which hours have passed
   */
  render(currentDate?: Date | null, pastHoursExpanded: boolean = false): string {
    const slots = this.calculator.generateTimeSlots();

    // Determine current hour if date is provided
    const currentHour = currentDate ? currentDate.getHours() : null;
    const isToday = currentDate ? this.isToday(currentDate) : false;

    const hoursHtml = slots
      .map((slot, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === slots.length - 1;
        const posClass = isFirst ? " is-first" : isLast ? " is-last" : "";

        // Check if this hour should be collapsed (only for today)
        // Show one hour before current time, so collapse hours that are before (currentHour - 1)
        const isPast = isToday && currentHour !== null && slot.hour < currentHour - 1;
        const pastClass = isPast && !pastHoursExpanded ? " is-past" : "";

        return `
          <div class="bed-hour${posClass}${pastClass}"
               style="--at:${slot.position.toFixed(4)}"
               data-hour="${slot.hour}">
            <span class="bed-hour-label">${slot.label12h}</span>
            <div class="bed-hour-line"></div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="day-bed-grid" aria-hidden="true">
        ${hoursHtml}
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
   * @param element - The grid element to update
   * @param currentDate - Optional current date to determine which hours have passed
   * @param pastHoursExpanded - Whether past hours should be expanded
   */
  updateElement(element: HTMLElement, currentDate?: Date | null, pastHoursExpanded: boolean = false): void {
    // Update past hours classes
    const isToday = currentDate ? this.isToday(currentDate) : false;
    const currentHour = currentDate ? currentDate.getHours() : null;

    if (isToday && currentHour !== null) {
      const hourElements = element.querySelectorAll(".bed-hour");
      hourElements.forEach((hourEl) => {
        const hour = Number.parseInt(
          (hourEl as HTMLElement).dataset.hour ?? "",
          10
        );
        if (!Number.isNaN(hour)) {
          // Collapse hours that are completely in the past (before current hour)
          // Show one hour before current time, so collapse hours before (currentHour - 1)
          const isPast = hour < currentHour - 1;
          hourEl.classList.toggle("is-past", isPast && !pastHoursExpanded);
        }
      });
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
   * Check if a date is today
   */
  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
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
