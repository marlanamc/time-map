/**
 * TouchInteractions - Mobile touch gesture handlers
 * @remarks Provides tap, long-press, and swipe gestures for mobile
 */

/**
 * Detect if device is touch-capable
 */
export function isTouchDevice(): boolean {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

/**
 * Detect if device is mobile (small screen + touch)
 */
export function isMobileDevice(): boolean {
  return isTouchDevice() && window.innerWidth <= 900;
}

/**
 * Long-press configuration
 */
interface LongPressConfig {
  threshold?: number; // milliseconds to trigger long-press (default 500ms)
  moveThreshold?: number; // pixels allowed before canceling (default 10px)
  onLongPress: (event: TouchEvent) => void;
  onTap?: (event: TouchEvent) => void; // Optional tap handler if long-press doesn't trigger
}

/**
 * Enable long-press detection on an element
 * @param element - Element to attach long-press to
 * @param config - Long-press configuration
 * @returns Cleanup function
 */
export function enableLongPress(
  element: HTMLElement,
  config: LongPressConfig
): () => void {
  const threshold = config.threshold || 500;
  const moveThreshold = config.moveThreshold || 10;

  let longPressTimer: number | null = null;
  let startX = 0;
  let startY = 0;
  let isLongPressed = false;

  const handleTouchStart = (e: TouchEvent) => {
    isLongPressed = false;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;

    longPressTimer = window.setTimeout(() => {
      isLongPressed = true;
      config.onLongPress(e);

      // Add haptic feedback if available
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }
    }, threshold);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!longPressTimer) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - startX);
    const deltaY = Math.abs(touch.clientY - startY);

    // Cancel long-press if moved too much
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // If it was a tap (not a long-press), call onTap if provided
    if (!isLongPressed && config.onTap) {
      config.onTap(e);
    }

    isLongPressed = false;
  };

  const handleTouchCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    isLongPressed = false;
  };

  element.addEventListener("touchstart", handleTouchStart, { passive: true });
  element.addEventListener("touchmove", handleTouchMove, { passive: true });
  element.addEventListener("touchend", handleTouchEnd);
  element.addEventListener("touchcancel", handleTouchCancel);

  return () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    element.removeEventListener("touchstart", handleTouchStart);
    element.removeEventListener("touchmove", handleTouchMove);
    element.removeEventListener("touchend", handleTouchEnd);
    element.removeEventListener("touchcancel", handleTouchCancel);
  };
}

/**
 * Swipe direction
 */
export type SwipeDirection = "left" | "right" | "up" | "down";

/**
 * Swipe configuration
 */
interface SwipeConfig {
  threshold?: number; // minimum distance to trigger swipe (default 50px)
  timeThreshold?: number; // maximum time for swipe (default 300ms)
  onSwipe: (direction: SwipeDirection, event: TouchEvent) => void;
}

/**
 * Enable swipe detection on an element
 * @param element - Element to attach swipe to
 * @param config - Swipe configuration
 * @returns Cleanup function
 */
export function enableSwipe(
  element: HTMLElement,
  config: SwipeConfig
): () => void {
  const threshold = config.threshold || 50;
  const timeThreshold = config.timeThreshold || 300;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const deltaTime = Date.now() - startTime;

    // Check if swipe was fast enough
    if (deltaTime > timeThreshold) return;

    // Determine swipe direction
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaX > threshold || absDeltaY > threshold) {
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        config.onSwipe(deltaX > 0 ? "right" : "left", e);
      } else {
        // Vertical swipe
        config.onSwipe(deltaY > 0 ? "down" : "up", e);
      }
    }
  };

  element.addEventListener("touchstart", handleTouchStart, { passive: true });
  element.addEventListener("touchend", handleTouchEnd, { passive: true });

  return () => {
    element.removeEventListener("touchstart", handleTouchStart);
    element.removeEventListener("touchend", handleTouchEnd);
  };
}

/**
 * Tap configuration
 */
interface TapConfig {
  onTap: (event: TouchEvent) => void;
  onDoubleTap?: (event: TouchEvent) => void;
  doubleTapThreshold?: number; // time between taps for double-tap (default 300ms)
}

/**
 * Enable tap detection with optional double-tap
 * @param element - Element to attach tap to
 * @param config - Tap configuration
 * @returns Cleanup function
 */
export function enableTap(element: HTMLElement, config: TapConfig): () => void {
  const doubleTapThreshold = config.doubleTapThreshold || 300;

  let lastTapTime = 0;

  const handleTouchEnd = (e: TouchEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime;

    if (config.onDoubleTap && timeSinceLastTap < doubleTapThreshold) {
      // Double tap
      e.preventDefault();
      config.onDoubleTap(e);
      lastTapTime = 0; // Reset
    } else {
      // Single tap
      config.onTap(e);
      lastTapTime = now;
    }
  };

  element.addEventListener("touchend", handleTouchEnd);

  return () => {
    element.removeEventListener("touchend", handleTouchEnd);
  };
}

/**
 * Prevent body scroll when touching element (useful for modals)
 * @param element - Element to prevent scroll on
 * @returns Cleanup function
 */
export function preventBodyScroll(element: HTMLElement): () => void {
  const handleTouchMove = (e: TouchEvent) => {
    // Allow scrolling within the element itself
    const target = e.target as HTMLElement;
    if (element.contains(target)) {
      // Check if element is scrollable
      const isScrollable = element.scrollHeight > element.clientHeight;
      if (!isScrollable) {
        e.preventDefault();
      }
    } else {
      e.preventDefault();
    }
  };

  document.body.addEventListener("touchmove", handleTouchMove, {
    passive: false,
  });

  return () => {
    document.body.removeEventListener("touchmove", handleTouchMove);
  };
}

/**
 * Add momentum scrolling (iOS-style smooth scroll)
 * @param element - Element to add momentum scrolling to
 */
export function enableMomentumScrolling(element: HTMLElement): void {
  (element.style as any).webkitOverflowScrolling = "touch";
  element.style.overflowY = "auto";
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
