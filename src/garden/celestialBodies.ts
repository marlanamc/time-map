/**
 * Celestial Bodies - Sun and Moon position animation
 * Provides visual time passage for ADHD time blindness
 */

import { getSunPosition, getMoonPosition } from './timeSystem';

export class CelestialBodies {
  private sunElement: HTMLElement | null;
  private moonElement: HTMLElement | null;
  private containerWidth: number = 0;
  private containerHeight: number = 0;

  constructor() {
    this.sunElement = document.getElementById('sun');
    this.moonElement = document.getElementById('moon');
    this.updateContainerDimensions();

    // Update dimensions on resize
    window.addEventListener('resize', () => {
      this.updateContainerDimensions();
      this.update();
    });

    // Listen to visual viewport changes (mobile URL bar show/hide)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        this.updateContainerDimensions();
        this.update();
      });
    }
  }

  private updateContainerDimensions(): void {
    // Use visualViewport if available (better mobile support)
    if (window.visualViewport) {
      this.containerWidth = window.visualViewport.width;
      this.containerHeight = window.visualViewport.height;
    } else {
      // Fallback for older browsers
      this.containerWidth = document.documentElement.clientWidth || window.innerWidth;
      this.containerHeight = document.documentElement.clientHeight || window.innerHeight;
    }
  }

  /**
   * Update sun and moon positions based on current time
   */
  public update(): void {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const sunPos = getSunPosition(hour, minute);
    const moonPos = getMoonPosition(hour, minute);

    this.positionCelestialBody(this.sunElement, sunPos, hour, 6, 18);
    this.positionCelestialBody(this.moonElement, moonPos, hour, 18, 6);
  }

  /**
   * Position a celestial body along an arc
   * @param element - The DOM element to position
   * @param position - Position value (0-100)
   * @param currentHour - Current hour
   * @param startHour - When this body rises
   * @param endHour - When this body sets
   */
  private positionCelestialBody(
    element: HTMLElement | null,
    position: number,
    currentHour: number,
    startHour: number,
    endHour: number
  ): void {
    if (!element) return;

    // Calculate hours since rise
    let hoursActive: number;
    if (startHour < endHour) {
      hoursActive = currentHour - startHour;
    } else {
      // Handle midnight crossing (moon)
      const adjustedHour = currentHour < endHour ? currentHour + 24 : currentHour;
      hoursActive = adjustedHour - startHour;
    }

    if (hoursActive < 0 || hoursActive > 12) {
      element.style.opacity = '0';
      return;
    }

    // Progress across the sky (0 = east, 1 = west)
    const progress = hoursActive / 12;

    // Horizontal position (10% to 90% of width)
    const xPercent = 10 + (progress * 80);

    // Vertical position (create arc)
    // Use parabolic curve: highest at midpoint
    const yPercent = 70 - (position * 0.6); // Top of sky is 10%, bottom is 70%

    const scale = 0.8 + (position / 100) * 0.4; // Scale from 0.8 to 1.2

    // Convert to pixel positions (visualViewport-aware) to avoid mobile URL bar jank.
    const xPx = (xPercent / 100) * this.containerWidth;
    const yPx = (yPercent / 100) * this.containerHeight;

    // Apply transform with a safe-area offset for mobile (CSS variable)
    element.style.transform = `translate3d(${xPx}px, calc(${yPx}px + var(--celestial-offset, 0px)), 0) scale(${scale})`;
    element.style.opacity = '1';
  }

  /**
   * Get current celestial info for accessibility
   */
  public getCelestialInfo(): {
    sunVisible: boolean;
    moonVisible: boolean;
    sunPosition: number;
    moonPosition: number;
  } {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const sunPos = getSunPosition(hour, minute);
    const moonPos = getMoonPosition(hour, minute);

    return {
      sunVisible: hour >= 6 && hour < 18,
      moonVisible: hour < 6 || hour >= 18,
      sunPosition: sunPos,
      moonPosition: moonPos
    };
  }
}
