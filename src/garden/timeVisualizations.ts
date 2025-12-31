/**
 * Time Visualizations - Visual representations of time passage
 * Helps with ADHD time blindness by showing time in concrete, spatial ways
 */

interface TimeRangePreferences {
  startHour: number;
  endHour: number;
}

export class TimeVisualizations {
  /**
   * Get time range preferences from localStorage
   */
  private static getTimeRangePreferences(): TimeRangePreferences {
    try {
      const saved = localStorage.getItem('time-range-preferences');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load time range preferences', e);
    }
    return { startHour: 8, endHour: 22 }; // Default: 8 AM to 10 PM
  }

  /**
   * Save time range preferences to localStorage
   */
  public static saveTimeRangePreferences(startHour: number, endHour: number): void {
    try {
      localStorage.setItem('time-range-preferences', JSON.stringify({ startHour, endHour }));
    } catch (e) {
      console.warn('Failed to save time range preferences', e);
    }
  }

  /**
   * Create hour blocks visualization for time remaining today
   * Each hour is represented as a plant/flower
   */
  public static createHourBlocks(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'hour-blocks-container';
    container.setAttribute('role', 'meter');
    container.setAttribute('aria-label', 'Hours remaining today');

    const now = new Date();
    const currentHour = now.getHours();
    const prefs = this.getTimeRangePreferences();
    const endOfDay = prefs.endHour;
    const startOfDay = prefs.startHour;

    // If before start of day, show full day
    const displayStart = currentHour < startOfDay ? startOfDay : currentHour;
    const hoursRemaining = Math.max(0, endOfDay - displayStart);

    container.setAttribute('aria-valuenow', hoursRemaining.toString());
    container.setAttribute('aria-valuemin', '0');
    container.setAttribute('aria-valuemax', (endOfDay - startOfDay).toString());

    for (let hour = startOfDay; hour < endOfDay; hour++) {
      const block = document.createElement('div');
      block.className = 'hour-block';
      block.dataset.hour = hour.toString();

      // Determine state: past, current, or future
      if (hour < currentHour) {
        block.classList.add('hour-past');
        block.innerHTML = '🌸'; // Fully bloomed
        block.setAttribute('aria-label', `${this.formatHour(hour)} - completed`);
      } else if (hour === currentHour) {
        block.classList.add('hour-current');
        block.innerHTML = '🌼'; // Half bloomed
        block.setAttribute('aria-label', `${this.formatHour(hour)} - current hour`);
      } else {
        block.classList.add('hour-future');
        block.innerHTML = '🌱'; // Bud
        block.setAttribute('aria-label', `${this.formatHour(hour)} - upcoming`);
      }

      container.appendChild(block);
    }

    return container;
  }

  /**
   * Update hour blocks (call this every minute)
   */
  public static updateHourBlocks(container: HTMLElement): void {
    const now = new Date();
    const currentHour = now.getHours();
    const prefs = this.getTimeRangePreferences();

    const blocks = container.querySelectorAll<HTMLElement>('.hour-block');
    blocks.forEach(block => {
      const hour = parseInt(block.dataset.hour || '0');

      // Remove all state classes
      block.classList.remove('hour-past', 'hour-current', 'hour-future');

      // Apply new state
      if (hour < currentHour) {
        block.classList.add('hour-past');
        block.innerHTML = '🌸';
        block.setAttribute('aria-label', `${this.formatHour(hour)} - completed`);
      } else if (hour === currentHour) {
        block.classList.add('hour-current');
        block.innerHTML = '🌼';
        block.setAttribute('aria-label', `${this.formatHour(hour)} - current hour`);
      } else {
        block.classList.add('hour-future');
        block.innerHTML = '🌱';
        block.setAttribute('aria-label', `${this.formatHour(hour)} - upcoming`);
      }
    });

    // Update aria-valuenow
    const displayStart = currentHour < prefs.startHour ? prefs.startHour : currentHour;
    const hoursRemaining = Math.max(0, prefs.endHour - displayStart);
    container.setAttribute('aria-valuenow', hoursRemaining.toString());
  }

  /**
   * Format hour for display (12-hour format)
   */
  private static formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  }

  /**
   * Create and position the "Now" beam in day view
   */
  public static updateNowBeam(): void {
    const nowBeam = document.getElementById('nowBeam');
    if (!nowBeam) return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Use configured time range
    const prefs = this.getTimeRangePreferences();
    const dayViewStart = prefs.startHour;
    const dayViewEnd = prefs.endHour;

    // If outside day view hours, hide beam
    if (hour < dayViewStart || hour >= dayViewEnd) {
      nowBeam.style.display = 'none';
      return;
    }

    nowBeam.style.display = 'block';

    // Calculate position
    const totalMinutes = (hour - dayViewStart) * 60 + minute;
    const totalDayMinutes = (dayViewEnd - dayViewStart) * 60;
    const percentage = (totalMinutes / totalDayMinutes) * 100;

    // Position beam
    nowBeam.style.top = `${percentage}%`;

    // Update aria label
    const timeString = this.formatHour(hour) + `:${minute.toString().padStart(2, '0')}`;
    nowBeam.setAttribute('aria-label', `Current time: ${timeString}`);
  }

  /**
   * Enhance the garden bloom flower with time-based growth
   */
  public static updateGardenBloom(progressPercentage: number): void {
    const petals = document.querySelectorAll<SVGElement>('.petal');
    const flowerStem = document.querySelector<SVGElement>('.flower-stem');
    const flowerCenter = document.querySelector<SVGElement>('.flower-center');

    // Scale petals based on progress (0.5 to 1.2)
    const petalScale = 0.5 + (progressPercentage / 100) * 0.7;
    petals.forEach((petal, index) => {
      const delay = index * 50; // Stagger animation
      setTimeout(() => {
        petal.style.transform = `scale(${petalScale})`;
        petal.style.opacity = (0.6 + (progressPercentage / 100) * 0.4).toString();
      }, delay);
    });

    // Grow stem height based on week progress
    if (flowerStem) {
      const stemHeight = 35 + (progressPercentage / 100) * 15; // 35 to 50
      flowerStem.setAttribute('d', `M50 95 Q50 ${95 - stemHeight} 50 60`);
    }

    // Brighten center based on month progress
    if (flowerCenter) {
      const brightness = 1 + (progressPercentage / 100) * 0.5;
      flowerCenter.style.filter = `brightness(${brightness})`;
    }
  }

  /**
   * Create transition effect between time blocks
   */
  public static createTimeTransition(fromTime: string, toTime: string): void {
    const transitionEl = document.createElement('div');
    transitionEl.className = 'time-transition';
    transitionEl.setAttribute('aria-live', 'polite');

    // Choose transition effect based on time
    if (fromTime === 'morning' && toTime === 'afternoon') {
      transitionEl.innerHTML = '☀️ Sun rising higher...';
      transitionEl.classList.add('transition-sun-intensifies');
    } else if (fromTime === 'afternoon' && toTime === 'evening') {
      transitionEl.innerHTML = '🌅 Golden hour begins...';
      transitionEl.classList.add('transition-golden-hour');
    } else if (fromTime === 'evening' && toTime === 'night') {
      transitionEl.innerHTML = '🌙 Moon rising...';
      transitionEl.classList.add('transition-moonrise');
    } else if (fromTime === 'night' && toTime === 'dawn') {
      transitionEl.innerHTML = '🌄 Dawn breaking...';
      transitionEl.classList.add('transition-dawn');
    } else if (fromTime === 'dawn' && toTime === 'morning') {
      transitionEl.innerHTML = '🌞 Day awakening...';
      transitionEl.classList.add('transition-day-awakening');
    }

    document.body.appendChild(transitionEl);

    // Animate in
    requestAnimationFrame(() => {
      transitionEl.style.opacity = '1';
    });

    // Remove after 3 seconds
    setTimeout(() => {
      transitionEl.style.opacity = '0';
      setTimeout(() => {
        transitionEl.remove();
      }, 500);
    }, 3000);
  }

  /**
   * Add visual time marker points (markers for "now", upcoming events)
   */
  public static addTimeAnchor(
    element: HTMLElement,
    type: 'now' | 'upcoming' | 'past',
    label: string
  ): void {
    element.classList.add(`time-marker-${type}`);

    // Add glow effect for "now"
    if (type === 'now') {
      element.style.boxShadow = '0 0 20px rgba(255, 223, 128, 0.6), 0 4px 12px rgba(0, 0, 0, 0.1)';
      element.style.borderColor = 'rgba(255, 223, 128, 0.8)';

      // Add pulsing animation
      element.style.animation = 'time-marker-pulse 2s ease-in-out infinite';
    }

    // Add subtle highlight for upcoming
    if (type === 'upcoming') {
      element.style.borderLeft = '3px solid var(--seasonal-accent)';
    }

    // Dim past items
    if (type === 'past') {
      element.style.opacity = '0.6';
      element.style.filter = 'saturate(0.7)';
    }

    // Add aria label
    element.setAttribute('aria-label', `${label} (${type})`);
  }
}
