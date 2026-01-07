/**
 * Improved ClickToScheduleModal - Using BaseModal for consistency
 * Mobile-friendly time picker for scheduling with proper accessibility
 */

import { UI } from '../../../ui/UIManager';
import { BaseModal, ModalOptions, ModalA11yOptions } from '../../../ui/modals/BaseModal';

export interface ScheduleData {
  title: string;
  category: string;
  duration: number;
  date: string;
  startTime: string;
}

export class ClickToScheduleModal extends BaseModal {
  private intention: { title: string; category: string; duration: number };
  private currentDate: string;
  private onSchedule: (data: ScheduleData) => void;

  constructor(
    intention: { title: string; category: string; duration: number },
    currentDate: string,
    onSchedule: (data: ScheduleData) => void
  ) {
    const options: ModalOptions = {
      title: `Schedule: ${intention.title}`,
      size: 'md',
      ariaLabel: 'Schedule intention modal'
    };

    const a11yOptions: ModalA11yOptions = {
      announceOnOpen: 'Scheduling modal opened',
      announceOnClose: 'Scheduling modal closed',
      restoreFocus: true,
      trapFocus: true
    };

    super(options, a11yOptions);

    this.intention = intention;
    this.currentDate = currentDate;
    this.onSchedule = onSchedule;
  }

  protected renderContent(): string {
    // Generate time options (8am - 8pm in 30min increments)
    const timeOptions: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (const min of [0, 30]) {
        if (hour === 20 && min === 30) break; // Stop at 8:00pm
        const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        timeOptions.push(time);
      }
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const suggestedTime = `${currentHour.toString().padStart(2, '0')}:${Math.round(currentMin / 30) * 30 === 60 ? '00' : (Math.round(currentMin / 30) * 30).toString().padStart(2, '0')}`;

    return `
      <div class="schedule-form">
        <div class="form-group">
          <label for="schedule-date">Date</label>
          <input
            type="date"
            id="schedule-date"
            class="form-input"
            value="${this.currentDate}"
            aria-describedby="date-help"
          />
          <div id="date-help" class="field-help">Select the date for this task</div>
        </div>

        <div class="form-group">
          <label for="schedule-time">Start Time</label>
          <select id="schedule-time" class="form-select" aria-describedby="time-help">
            ${timeOptions
              .map(
                (time) => `
                <option value="${time}" ${time === suggestedTime ? 'selected' : ''}>
                  ${this.formatTime(time)}
                </option>
              `
              )
              .join('')}
          </select>
          <div id="time-help" class="field-help">Choose when to start</div>
        </div>

        <div class="form-group">
          <label for="schedule-duration">Duration</label>
          <div class="duration-control" role="group" aria-labelledby="duration-label">
            <button type="button" class="duration-btn" data-action="decrease" aria-label="Decrease duration">−</button>
            <input
              type="number"
              id="schedule-duration"
              class="duration-input"
              value="${this.intention.duration}"
              min="5"
              max="480"
              step="5"
              aria-label="Duration in minutes"
            />
            <span class="duration-unit" aria-hidden="true">min</span>
            <button type="button" class="duration-btn" data-action="increase" aria-label="Increase duration">+</button>
          </div>
          <div id="duration-label" class="field-help">How long will this take?</div>
        </div>

        <div class="schedule-preview" role="status" aria-live="polite">
          <div class="preview-label">Preview</div>
          <div class="preview-content">
            <div class="preview-time" id="schedule-preview-time">
              ${this.formatTime(suggestedTime)} - ${this.calculateEndTime(suggestedTime, this.intention.duration)}
            </div>
            <div class="preview-duration">${this.intention.duration} minutes</div>
          </div>
        </div>
      </div>
    `;
  }

  protected bindEvents(): void {
    if (!this.element) return;

    const dateInput = this.element.querySelector('#schedule-date') as HTMLInputElement;
    const timeSelect = this.element.querySelector('#schedule-time') as HTMLSelectElement;
    const durationInput = this.element.querySelector('#schedule-duration') as HTMLInputElement;
    const decreaseBtn = this.element.querySelector('[data-action="decrease"]') as HTMLButtonElement;
    const increaseBtn = this.element.querySelector('[data-action="increase"]') as HTMLButtonElement;
    const previewTime = this.element.querySelector('#schedule-preview-time') as HTMLElement;

    // Update preview function
    const updatePreview = (announceChange: boolean = false) => {
      const startTime = timeSelect.value;
      const duration = parseInt(durationInput.value) || 30;
      const endTime = this.calculateEndTime(startTime, duration);

      if (previewTime) {
        previewTime.textContent = `${this.formatTime(startTime)} - ${endTime}`;
      }

      const previewDuration = this.element?.querySelector('.preview-duration') as HTMLElement;
      if (previewDuration) {
        previewDuration.textContent = `${duration} minutes`;
      }

      // Announce changes to screen readers
      if (announceChange) {
        this.announce(
          `Scheduled from ${this.formatTime(startTime)} to ${endTime}, ${duration} minutes`,
          'polite'
        );
      }
    };

    // Duration controls
    decreaseBtn?.addEventListener('click', () => {
      const current = parseInt(durationInput.value) || 30;
      durationInput.value = Math.max(5, current - 5).toString();
      updatePreview(true);
    });

    increaseBtn?.addEventListener('click', () => {
      const current = parseInt(durationInput.value) || 30;
      durationInput.value = Math.min(480, current + 5).toString();
      updatePreview(true);
    });

    durationInput?.addEventListener('input', () => updatePreview(true));
    timeSelect?.addEventListener('change', () => updatePreview(true));

    // Add schedule button
    this.addActionButton('Schedule', 'btn-primary', () => {
      const date = dateInput.value;
      const startTime = timeSelect.value;
      const duration = parseInt(durationInput.value) || 30;

      if (!date || !startTime) {
        UI.showToast('⚠️ Please select date and time', 'error');
        return;
      }

      this.onSchedule({
        title: this.intention.title,
        category: this.intention.category,
        duration,
        date,
        startTime,
      });

      UI.showToast('✅ Scheduled!', 'success');
      this.close();
    });
  }

  private formatTime(time: string): string {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
  }

  private calculateEndTime(startTime: string, duration: number): string {
    const [hour, minute] = startTime.split(':').map(Number);
    const totalMinutes = hour * 60 + minute + duration;
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    return this.formatTime(endTime);
  }
}

// Legacy function for backward compatibility
export function openClickToScheduleModal(
  intention: { title: string; category: string; duration: number },
  currentDate: string,
  onSchedule: (data: ScheduleData) => void
): void {
  const modal = new ClickToScheduleModal(intention, currentDate, onSchedule);
  modal.open();
}

export function closeClickToScheduleModal(): void {
  // This will be handled by the modal instance itself
  // Keeping for backward compatibility
}
