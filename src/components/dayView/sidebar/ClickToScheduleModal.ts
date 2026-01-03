/**
 * ClickToScheduleModal - Mobile-friendly time picker for scheduling
 * @remarks Alternative to drag-drop for mobile devices
 */

import { UI } from '../../../ui/UIManager';
import { createFocusTrap, announce } from './KeyboardNavigation';

/**
 * Schedule data
 */
export interface ScheduleData {
  title: string;
  category: string;
  duration: number;
  date: string;
  startTime: string;
}

/**
 * Render the click-to-schedule modal
 * @param intention - Intention to schedule
 * @param currentDate - Current date (YYYY-MM-DD)
 * @param onSchedule - Callback when scheduled
 * @returns HTML string
 */
export function renderClickToScheduleModal(
  intention: { title: string; category: string; duration: number },
  currentDate: string,
  _onSchedule: (data: ScheduleData) => void
): string {
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
    <div class="click-schedule-overlay" data-modal="click-schedule" role="dialog" aria-modal="true">
      <div class="click-schedule-modal" role="document">
        <div class="click-schedule-header">
          <h3 class="click-schedule-title" id="schedule-modal-title">Schedule: ${escapeHtml(intention.title)}</h3>
          <button type="button" class="click-schedule-close" aria-label="Close scheduling modal">×</button>
        </div>

        <div class="click-schedule-body">
          <div class="click-schedule-field">
            <label for="schedule-date" class="click-schedule-label">Date</label>
            <input
              type="date"
              id="schedule-date"
              class="click-schedule-input"
              value="${currentDate}"
            />
          </div>

          <div class="click-schedule-field">
            <label for="schedule-time" class="click-schedule-label">Start Time</label>
            <select id="schedule-time" class="click-schedule-select">
              ${timeOptions
                .map(
                  (time) => `
                <option value="${time}" ${time === suggestedTime ? 'selected' : ''}>
                  ${formatTime(time)}
                </option>
              `
                )
                .join('')}
            </select>
          </div>

          <div class="click-schedule-field">
            <label for="schedule-duration" class="click-schedule-label">Duration</label>
            <div class="click-schedule-duration-group" role="group" aria-labelledby="schedule-duration">
              <button type="button" class="click-schedule-duration-btn" data-action="decrease" aria-label="Decrease duration">−</button>
              <input
                type="number"
                id="schedule-duration"
                class="click-schedule-duration-input"
                value="${intention.duration}"
                min="5"
                max="480"
                step="5"
                aria-label="Duration in minutes"
              />
              <span class="click-schedule-duration-unit" aria-hidden="true">min</span>
              <button type="button" class="click-schedule-duration-btn" data-action="increase" aria-label="Increase duration">+</button>
            </div>
          </div>

          <div class="click-schedule-preview">
            <div class="click-schedule-preview-label">Preview</div>
            <div class="click-schedule-preview-content">
              <div class="click-schedule-preview-time" id="schedule-preview-time">
                ${formatTime(suggestedTime)} - ${calculateEndTime(suggestedTime, intention.duration)}
              </div>
              <div class="click-schedule-preview-duration">${intention.duration} minutes</div>
            </div>
          </div>
        </div>

        <div class="click-schedule-footer">
          <button type="button" class="click-schedule-btn click-schedule-btn-cancel">
            Cancel
          </button>
          <button type="button" class="click-schedule-btn click-schedule-btn-schedule">
            Schedule
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Open the click-to-schedule modal
 * @param intention - Intention to schedule
 * @param currentDate - Current date (YYYY-MM-DD)
 * @param onSchedule - Callback when scheduled
 */
export function openClickToScheduleModal(
  intention: { title: string; category: string; duration: number },
  currentDate: string,
  onSchedule: (data: ScheduleData) => void
): void {
  // Remove existing modal if any
  closeClickToScheduleModal();

  // Render modal
  const modalHtml = renderClickToScheduleModal(intention, currentDate, onSchedule);
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Get elements
  const overlay = document.querySelector('.click-schedule-overlay') as HTMLElement;
  const modal = overlay?.querySelector('.click-schedule-modal') as HTMLElement;
  const closeBtn = modal?.querySelector('.click-schedule-close') as HTMLButtonElement;
  const cancelBtn = modal?.querySelector('.click-schedule-btn-cancel') as HTMLButtonElement;
  const scheduleBtn = modal?.querySelector('.click-schedule-btn-schedule') as HTMLButtonElement;
  const dateInput = modal?.querySelector('#schedule-date') as HTMLInputElement;
  const timeSelect = modal?.querySelector('#schedule-time') as HTMLSelectElement;
  const durationInput = modal?.querySelector('#schedule-duration') as HTMLInputElement;
  const decreaseBtn = modal?.querySelector('[data-action="decrease"]') as HTMLButtonElement;
  const increaseBtn = modal?.querySelector('[data-action="increase"]') as HTMLButtonElement;
  const previewTime = modal?.querySelector('#schedule-preview-time') as HTMLElement;

  if (!overlay || !modal) return;

  // Set up focus trap for keyboard accessibility
  const cleanupFocusTrap = createFocusTrap(modal, {
    initialFocus: dateInput,
    onEscape: () => {
      close();
    },
  });

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });

  // Update preview
  const updatePreview = (announceChange: boolean = false) => {
    const startTime = timeSelect.value;
    const duration = parseInt(durationInput.value) || 30;
    const endTime = calculateEndTime(startTime, duration);

    if (previewTime) {
      previewTime.textContent = `${formatTime(startTime)} - ${endTime}`;
    }

    const previewDuration = modal.querySelector('.click-schedule-preview-duration') as HTMLElement;
    if (previewDuration) {
      previewDuration.textContent = `${duration} minutes`;
    }

    // Announce changes to screen readers
    if (announceChange) {
      announce(
        `Scheduled from ${formatTime(startTime)} to ${endTime}, ${duration} minutes`,
        'polite'
      );
    }
  };

  // Event listeners
  const close = () => {
    overlay.classList.remove('visible');
    cleanupFocusTrap();
    setTimeout(() => {
      overlay.remove();
    }, 300);
  };

  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

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

  // Schedule button
  scheduleBtn?.addEventListener('click', () => {
    const date = dateInput.value;
    const startTime = timeSelect.value;
    const duration = parseInt(durationInput.value) || 30;

    if (!date || !startTime) {
      UI.showToast('⚠️ Please select date and time', 'error');
      return;
    }

    onSchedule({
      title: intention.title,
      category: intention.category,
      duration,
      date,
      startTime,
    });

    UI.showToast('✅ Scheduled!', 'success');
    close();
  });

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Cleanup on close
  overlay.addEventListener('transitionend', (e) => {
    if (e.target === overlay && !overlay.classList.contains('visible')) {
      document.body.style.overflow = '';
    }
  });
}

/**
 * Close the click-to-schedule modal
 */
export function closeClickToScheduleModal(): void {
  const overlay = document.querySelector('.click-schedule-overlay') as HTMLElement;
  if (!overlay) return;

  overlay.classList.remove('visible');
  setTimeout(() => {
    overlay.remove();
    document.body.style.overflow = '';
  }, 300);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format time (HH:MM) to 12-hour format
 */
function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

/**
 * Calculate end time given start time and duration
 */
function calculateEndTime(startTime: string, duration: number): string {
  const [hour, minute] = startTime.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + duration;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = totalMinutes % 60;
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  return formatTime(endTime);
}
