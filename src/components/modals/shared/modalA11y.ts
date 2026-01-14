/**
 * Shared modal accessibility helpers
 *
 * Provides consistent keyboard navigation and focus management across all modals:
 * - ESC to close
 * - Tab trapping within modal
 * - Focus on first meaningful input on open
 * - Restore focus to trigger element on close
 */

export type ModalA11yCleanup = () => void;

export type ModalA11yOptions = {
  /** The modal overlay element (receives outside-click handler) */
  overlay: HTMLElement;
  /** The modal container element (receives focus trap) */
  modal: HTMLElement;
  /** Callback to close the modal */
  onClose: () => void;
  /** Optional: selector for the first element to focus (defaults to first input/button) */
  initialFocusSelector?: string;
  /** Whether to trap focus within the modal (default: true) */
  trapFocus?: boolean;
  /** Whether to restore focus on close (default: true) */
  restoreFocus?: boolean;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Setup modal accessibility: ESC key, focus trap, initial focus, restore focus.
 * Returns a cleanup function to remove event listeners.
 */
export function setupModalA11y(options: ModalA11yOptions): ModalA11yCleanup {
  const {
    // overlay is available for future use (e.g., click-outside handling)
    overlay: _overlay,
    modal,
    onClose,
    initialFocusSelector,
    trapFocus = true,
    restoreFocus = true,
  } = options;

  // Store the element that opened the modal
  const previousActiveElement = document.activeElement as HTMLElement | null;

  // ESC key handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }

    // Tab trap
    if (trapFocus && e.key === "Tab") {
      const focusable = modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab from first element -> go to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab from last element -> go to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  document.addEventListener("keydown", handleKeyDown);

  // Set initial focus
  requestAnimationFrame(() => {
    let target: HTMLElement | null = null;

    if (initialFocusSelector) {
      target = modal.querySelector<HTMLElement>(initialFocusSelector);
    }

    if (!target) {
      // Default: first input, then first button
      target =
        modal.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled])") ||
        modal.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    }

    if (target) {
      target.focus();
    } else {
      // Fallback: focus the modal itself if nothing else is focusable
      modal.setAttribute("tabindex", "-1");
      modal.focus();
    }
  });

  // Cleanup function
  return () => {
    document.removeEventListener("keydown", handleKeyDown);

    // Restore focus
    if (restoreFocus && previousActiveElement) {
      try {
        previousActiveElement.focus();
      } catch {
        // Element may no longer be in the DOM
      }
    }
  };
}

/**
 * Ensure modal overlay has proper ARIA attributes
 */
export function ensureModalAria(
  overlay: HTMLElement,
  titleId?: string,
): void {
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  if (titleId) {
    overlay.setAttribute("aria-labelledby", titleId);
  }
}
