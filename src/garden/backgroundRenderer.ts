/**
 * Background Renderer - Manages garden background layers and parallax
 */

import { DeviceCapabilities } from './performanceMonitor';

export class BackgroundRenderer {
  private backdropElement: HTMLElement | null;
  private midgroundElement: HTMLElement | null;
  private scrollY: number = 0;
  private parallaxEnabled: boolean = true;
  private rafId?: number;

  constructor() {
    this.backdropElement = document.getElementById('gardenBackdrop');
    this.midgroundElement = document.getElementById('gardenMidground');

    this.initializeParallax();
  }

  /**
   * Initialize parallax scrolling
   */
  private initializeParallax(): void {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.parallaxEnabled = false;
      return;
    }

    // Check mobile ONCE on initialization (not on every scroll)
    const isMobile = DeviceCapabilities.isMobile();
    if (isMobile) {
      this.parallaxEnabled = false;
      return;
    }

    // Listen to scroll events
    window.addEventListener('scroll', () => {
      this.scrollY = window.scrollY;

      // Use requestAnimationFrame for smooth updates
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          this.updateParallax();
          this.rafId = undefined;
        });
      }
    }, { passive: true });

    // Initial update
    this.updateParallax();
  }

  /**
   * Update parallax effect
   */
  private updateParallax(): void {
    if (!this.parallaxEnabled) return;

    // Background moves slower than foreground (depth illusion)
    if (this.backdropElement) {
      const backdropSpeed = 0.3;
      this.backdropElement.style.transform = `translateY(${this.scrollY * backdropSpeed}px)`;
    }

    if (this.midgroundElement) {
      const midgroundSpeed = 0.6;
      this.midgroundElement.style.transform = `translateY(${this.scrollY * midgroundSpeed}px)`;
    }
  }

  /**
   * Enable parallax
   */
  public enableParallax(): void {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion) {
      this.parallaxEnabled = true;
      this.updateParallax();
    }
  }

  /**
   * Disable parallax (for performance)
   */
  public disableParallax(): void {
    this.parallaxEnabled = false;

    // Reset transforms
    if (this.backdropElement) {
      this.backdropElement.style.transform = '';
    }
    if (this.midgroundElement) {
      this.midgroundElement.style.transform = '';
    }
  }

  /**
   * Load background image based on season and time
   * Note: Images should be placed in /public/assets/garden/backgrounds/
   */
  public loadBackground(season: string, timeOfDay: string): void {
    if (!this.backdropElement) return;

    // Determine which background to load
    const backgroundKey = `${season}-${timeOfDay}`;
    const backgroundPath = `/assets/garden/backgrounds/${backgroundKey}.jpg`;

    // Check if we should load this background
    // For now, we'll use CSS gradients as placeholders
    // In production, you'd load actual images:
    // this.backdropElement.style.backgroundImage = `url('${backgroundPath}')`;

    // For now, keep using the seasonal gradients from CSS
    console.log(`Background hint: ${backgroundKey} (using CSS gradients)`);
  }

  /**
   * Crossfade to new background
   */
  public async crossfadeBackground(newSeason: string, newTimeOfDay: string): Promise<void> {
    if (!this.backdropElement) return;

    // Fade out
    this.backdropElement.style.opacity = '0';

    // Wait for fade
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Load new background
    this.loadBackground(newSeason, newTimeOfDay);

    // Fade in
    this.backdropElement.style.opacity = '0.15';
  }
}
