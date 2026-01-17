/**
 * LiquidEffects - Animation utilities for liquid productivity aesthetic
 * @remarks Provides shimmer, ripple, and time-based theming effects
 */

import { State } from "../../core/State";

/**
 * Time of day periods for gradient theming
 */
export type TimeOfDay = "dawn" | "morning" | "afternoon" | "evening" | "night";

/**
 * Get current time of day
 * @returns Time period based on current hour
 */
export function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

/**
 * Time-based color gradients for each period
 */
const TIME_GRADIENTS = {
  dawn: {
    primary: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
    accent: "#a78bfa",
    glow: "rgba(167, 139, 250, 0.15)",
  },
  morning: {
    primary: "linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #43e97b 100%)",
    accent: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.15)",
  },
  afternoon: {
    primary: "linear-gradient(135deg, #fa709a 0%, #fee140 50%, #ffd89b 100%)",
    accent: "#fb923c",
    glow: "rgba(251, 146, 60, 0.15)",
  },
  evening: {
    primary: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
    accent: "#c084fc",
    glow: "rgba(192, 132, 252, 0.15)",
  },
  night: {
    primary: "linear-gradient(135deg, #2e3192 0%, #1bffff 50%, #a8c0ff 100%)",
    accent: "#60a5fa",
    glow: "rgba(96, 165, 250, 0.15)",
  },
};

/**
 * LiquidEffects class providing animation utilities
 */
export class LiquidEffects {
  /**
   * Apply shimmer effect to element
   * @param element - DOM element to apply shimmer to
   * @param intensity - Shimmer intensity (0-1), default 1
   */
  static shimmer(element: HTMLElement, intensity: number = 1): void {
    if (!element) return;

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Add shimmer class
    element.classList.add("has-shimmer");

    // Set intensity as CSS variable
    element.style.setProperty("--shimmer-intensity", intensity.toString());

    // Create shimmer overlay if it doesn't exist
    if (!element.querySelector(".shimmer-overlay")) {
      const overlay = document.createElement("div");
      overlay.className = "shimmer-overlay";
      overlay.setAttribute("aria-hidden", "true");
      element.appendChild(overlay);
    }
  }

  /**
   * Remove shimmer effect from element
   * @param element - DOM element to remove shimmer from
   */
  static removeShimmer(element: HTMLElement): void {
    if (!element) return;

    element.classList.remove("has-shimmer");

    const overlay = element.querySelector(".shimmer-overlay");
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Create ripple effect from point
   * @param element - Container element
   * @param x - X coordinate (relative to element)
   * @param y - Y coordinate (relative to element)
   * @param color - Optional ripple color
   */
  static ripple(
    element: HTMLElement,
    x: number,
    y: number,
    color: string = "rgba(255, 255, 255, 0.5)",
  ): void {
    if (!element) return;

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Create ripple element
    const ripple = document.createElement("div");
    ripple.className = "liquid-ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.setProperty("--ripple-color", color);

    // Add to container
    element.appendChild(ripple);

    // Remove after animation completes
    setTimeout(() => {
      ripple.remove();
    }, 600); // Match --liquid-ripple-duration
  }

  /**
   * Create ripple effect from mouse/touch event
   * @param event - Mouse or touch event
   * @param color - Optional ripple color
   */
  static rippleFromEvent(event: MouseEvent | TouchEvent, color?: string): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;

    const rect = target.getBoundingClientRect();

    let x: number;
    let y: number;

    if (event instanceof MouseEvent) {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    } else {
      const touch = event.touches[0] || event.changedTouches[0];
      x = touch.clientX - rect.left;
      y = touch.clientY - rect.top;
    }

    this.ripple(target, x, y, color);
  }

  /**
   * Apply time-based gradient theme to root
   * @param forceTime - Optional time to force (for testing)
   */
  static applyTimeTheme(forceTime?: TimeOfDay): void {
    // Check if user has manually set a theme preference
    const storedTheme = localStorage.getItem("gardenFence.theme");

    // Also check State.preferences.theme if available
    let hasManualTheme = storedTheme;
    if (State.data?.preferences?.theme) {
      hasManualTheme = State.data.preferences.theme;
    }

    if (hasManualTheme) {
      // User has manually set a theme, don't override with time-based theme
      return;
    }

    const root = document.documentElement;
    const timeOfDay = forceTime || getCurrentTimeOfDay();

    // Remove all time classes
    root.classList.remove(
      "time-dawn",
      "time-morning",
      "time-afternoon",
      "time-evening",
      "time-night",
    );

    // Add current time class
    root.classList.add(`time-${timeOfDay}`);

    // Set CSS variables for gradients
    const gradient = TIME_GRADIENTS[timeOfDay];
    root.style.setProperty("--liquid-gradient-primary", gradient.primary);
    root.style.setProperty("--liquid-accent", gradient.accent);
    root.style.setProperty("--liquid-glow", gradient.glow);

    // Store current time for debugging
    root.dataset.timeOfDay = timeOfDay;
  }

  /**
   * Start automatic time theme updates
   * @returns Interval ID for clearing
   */
  static startAutoTimeTheme(): number {
    // Apply immediately
    this.applyTimeTheme();

    // Update every 15 minutes
    return window.setInterval(
      () => {
        this.applyTimeTheme();
      },
      15 * 60 * 1000,
    );
  }

  /**
   * Apply glow effect to element
   * @param element - DOM element to apply glow to
   * @param color - Glow color
   */
  static glow(element: HTMLElement, color?: string): void {
    if (!element) return;

    element.classList.add("has-glow");

    if (color) {
      element.style.setProperty("--glow-color", color);
    }
  }

  /**
   * Remove glow effect from element
   * @param element - DOM element to remove glow from
   */
  static removeGlow(element: HTMLElement): void {
    if (!element) return;

    element.classList.remove("has-glow");
  }

  /**
   * Stagger animation for multiple elements
   * @param elements - Array of elements to animate
   * @param animationClass - CSS class to add for animation
   * @param delayMs - Delay between each element (default 50ms)
   */
  static stagger(
    elements: HTMLElement[],
    animationClass: string,
    delayMs: number = 50,
  ): void {
    if (!elements || elements.length === 0) return;

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Apply immediately without delay
      elements.forEach((el) => el.classList.add(animationClass));
      return;
    }

    elements.forEach((el, index) => {
      setTimeout(() => {
        el.classList.add(animationClass);
      }, index * delayMs);
    });
  }

  /**
   * Apply lift effect on hover (for interactive elements)
   * @param element - DOM element to apply lift to
   */
  static enableLift(element: HTMLElement): void {
    if (!element) return;

    element.classList.add("has-lift");
  }

  /**
   * Create floating particles animation
   * @param container - Container element
   * @param count - Number of particles (default 10)
   */
  static createFloatingParticles(
    container: HTMLElement,
    count: number = 10,
  ): void {
    if (!container) return;

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      particle.className = "floating-particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 5}s`;
      particle.style.animationDuration = `${5 + Math.random() * 5}s`;
      particle.setAttribute("aria-hidden", "true");

      container.appendChild(particle);
    }
  }

  /**
   * Apply liquid glass effect (backdrop blur + transparency)
   * @param element - DOM element to apply glass to
   */
  static glass(element: HTMLElement): void {
    if (!element) return;

    element.classList.add("liquid-glass");
  }

  /**
   * Remove liquid glass effect
   * @param element - DOM element to remove glass from
   */
  static removeGlass(element: HTMLElement): void {
    if (!element) return;

    element.classList.remove("liquid-glass");
  }

  /**
   * Animate element entrance with liquid effect
   * @param element - Element to animate in
   * @param direction - Direction to slide from ('left', 'right', 'top', 'bottom')
   */
  static animateIn(
    element: HTMLElement,
    direction: "left" | "right" | "top" | "bottom" = "right",
  ): void {
    if (!element) return;

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.classList.add("visible");
      return;
    }

    element.classList.add(`slide-in-${direction}`);

    // Remove animation class after it completes
    element.addEventListener(
      "animationend",
      () => {
        element.classList.remove(`slide-in-${direction}`);
        element.classList.add("visible");
      },
      { once: true },
    );
  }

  /**
   * Animate element exit with liquid effect
   * @param element - Element to animate out
   * @param direction - Direction to slide to ('left', 'right', 'top', 'bottom')
   */
  static animateOut(
    element: HTMLElement,
    direction: "left" | "right" | "top" | "bottom" = "right",
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!element) {
        resolve();
        return;
      }

      // Check for reduced motion preference
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        element.classList.remove("visible");
        resolve();
        return;
      }

      element.classList.add(`slide-out-${direction}`);

      element.addEventListener(
        "animationend",
        () => {
          element.classList.remove(`slide-out-${direction}`, "visible");
          resolve();
        },
        { once: true },
      );
    });
  }
}

/**
 * Initialize liquid effects for the application
 */
export function initLiquidEffects(): number {
  // Apply time theme
  LiquidEffects.applyTimeTheme();

  // Start auto-update
  const intervalId = LiquidEffects.startAutoTimeTheme();

  // Add global event listener for ripple on interactive elements
  document.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("has-ripple")) {
      LiquidEffects.rippleFromEvent(e);
    }
  });

  document.addEventListener("touchstart", (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("has-ripple")) {
      LiquidEffects.rippleFromEvent(e);
    }
  });

  return intervalId;
}
