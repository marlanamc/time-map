/**
 * KeyboardNavigation - Accessibility utilities for keyboard interactions
 * @remarks Provides focus management, arrow navigation, and keyboard shortcuts
 */

/**
 * Focusable element selector
 */
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS));
  return elements.filter((el) => {
    const htmlEl = el as HTMLElement;
    return (
      htmlEl.offsetWidth > 0 &&
      htmlEl.offsetHeight > 0 &&
      !htmlEl.hasAttribute('aria-hidden')
    );
  }) as HTMLElement[];
}

/**
 * Focus trap configuration
 */
interface FocusTrapConfig {
  initialFocus?: HTMLElement;
  onEscape?: () => void;
  allowOutsideClick?: boolean;
}

/**
 * Create a focus trap for modal dialogs
 * @param container - Container element (modal, panel, dialog)
 * @param config - Configuration options
 * @returns Cleanup function
 */
export function createFocusTrap(
  container: HTMLElement,
  config: FocusTrapConfig = {}
): () => void {
  const focusableElements = getFocusableElements(container);
  const firstFocusable = config.initialFocus || focusableElements[0];

  // Store the element that had focus before opening
  const previouslyFocused = document.activeElement as HTMLElement;

  // Focus the first focusable element or specified initial element
  if (firstFocusable) {
    setTimeout(() => {
      firstFocusable.focus();
    }, 100); // Delay to ensure DOM is ready
  }

  // Handle Tab and Shift+Tab
  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const currentFocusables = getFocusableElements(container);
    if (currentFocusables.length === 0) return;

    const currentIndex = currentFocusables.indexOf(
      document.activeElement as HTMLElement
    );

    if (e.shiftKey) {
      // Shift+Tab: Move backwards
      if (currentIndex === 0 || currentIndex === -1) {
        e.preventDefault();
        currentFocusables[currentFocusables.length - 1]?.focus();
      }
    } else {
      // Tab: Move forwards
      if (currentIndex === currentFocusables.length - 1) {
        e.preventDefault();
        currentFocusables[0]?.focus();
      }
    }
  };

  // Handle Escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && config.onEscape) {
      e.preventDefault();
      config.onEscape();
    }
  };

  // Prevent clicks outside the container from stealing focus
  const handleClickOutside = (e: MouseEvent) => {
    if (
      !config.allowOutsideClick &&
      !container.contains(e.target as Node)
    ) {
      e.preventDefault();
      e.stopPropagation();
      firstFocusable?.focus();
    }
  };

  container.addEventListener('keydown', handleTab);
  container.addEventListener('keydown', handleEscape);
  document.addEventListener('mousedown', handleClickOutside, true);

  // Cleanup function
  return () => {
    container.removeEventListener('keydown', handleTab);
    container.removeEventListener('keydown', handleEscape);
    document.removeEventListener('mousedown', handleClickOutside, true);

    // Restore focus to previously focused element
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
    }
  };
}

/**
 * Arrow navigation configuration
 */
interface ArrowNavConfig {
  items: HTMLElement[];
  currentIndex: number;
  orientation?: 'vertical' | 'horizontal' | 'grid';
  loop?: boolean; // Loop from last to first
  gridColumns?: number; // For grid orientation
  onNavigate?: (newIndex: number, item: HTMLElement) => void;
}

/**
 * Enable arrow key navigation for a list of items
 * @param config - Arrow navigation configuration
 * @returns Cleanup function
 */
export function enableArrowNavigation(
  config: ArrowNavConfig
): () => void {
  const { items, currentIndex, orientation = 'vertical', loop = true } = config;

  let activeIndex = currentIndex;

  const handleArrowKeys = (e: KeyboardEvent) => {
    let newIndex = activeIndex;

    // Vertical navigation (up/down)
    if (orientation === 'vertical' || orientation === 'grid') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = activeIndex + 1;
        if (newIndex >= items.length) {
          newIndex = loop ? 0 : items.length - 1;
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = activeIndex - 1;
        if (newIndex < 0) {
          newIndex = loop ? items.length - 1 : 0;
        }
      }
    }

    // Horizontal navigation (left/right)
    if (orientation === 'horizontal' || orientation === 'grid') {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        newIndex = activeIndex + 1;
        if (newIndex >= items.length) {
          newIndex = loop ? 0 : items.length - 1;
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        newIndex = activeIndex - 1;
        if (newIndex < 0) {
          newIndex = loop ? items.length - 1 : 0;
        }
      }
    }

    // Grid navigation (2D)
    if (orientation === 'grid' && config.gridColumns) {
      const cols = config.gridColumns;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = activeIndex + cols;
        if (newIndex >= items.length) {
          newIndex = loop ? newIndex % cols : activeIndex;
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = activeIndex - cols;
        if (newIndex < 0) {
          newIndex = loop ? items.length - cols + (activeIndex % cols) : activeIndex;
        }
      }
    }

    // Update focus if index changed
    if (newIndex !== activeIndex && items[newIndex]) {
      activeIndex = newIndex;
      items[newIndex].focus();

      if (config.onNavigate) {
        config.onNavigate(newIndex, items[newIndex]);
      }
    }

    // Home/End keys
    if (e.key === 'Home') {
      e.preventDefault();
      activeIndex = 0;
      items[0]?.focus();
      if (config.onNavigate) {
        config.onNavigate(0, items[0]);
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      activeIndex = items.length - 1;
      items[activeIndex]?.focus();
      if (config.onNavigate) {
        config.onNavigate(activeIndex, items[activeIndex]);
      }
    }
  };

  // Attach to each item
  items.forEach((item) => {
    item.addEventListener('keydown', handleArrowKeys);
  });

  // Cleanup function
  return () => {
    items.forEach((item) => {
      item.removeEventListener('keydown', handleArrowKeys);
    });
  };
}

/**
 * Enable Enter/Space activation for custom buttons
 * @param element - Element to make activatable
 * @param onClick - Click handler
 * @returns Cleanup function
 */
export function enableActivation(
  element: HTMLElement,
  onClick: (e: Event) => void
): () => void {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  element.addEventListener('keypress', handleKeyPress);

  return () => {
    element.removeEventListener('keypress', handleKeyPress);
  };
}

/**
 * Skip link for keyboard users
 */
export function createSkipLink(
  targetId: string,
  label: string = 'Skip to main content'
): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = label;
  skipLink.className = 'skip-link';
  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView();
    }
  });
  return skipLink;
}

/**
 * Announce to screen readers via live region
 */
export function announce(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  // Find or create live region
  let liveRegion = document.getElementById('aria-live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }

  // Update priority if different
  if (liveRegion.getAttribute('aria-live') !== priority) {
    liveRegion.setAttribute('aria-live', priority);
  }

  // Clear and announce
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion!.textContent = message;
  }, 100);
}

/**
 * Collapsible section keyboard controls
 */
export function enableCollapsibleSection(
  header: HTMLElement,
  content: HTMLElement,
  onToggle: (expanded: boolean) => void
): () => void {
  let isExpanded = content.getAttribute('aria-hidden') !== 'true';

  // Set up ARIA
  const headerId = header.id || `section-header-${Math.random().toString(36).substr(2, 9)}`;
  const contentId = content.id || `section-content-${Math.random().toString(36).substr(2, 9)}`;

  header.id = headerId;
  content.id = contentId;

  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', String(isExpanded));
  header.setAttribute('aria-controls', contentId);
  header.setAttribute('tabindex', '0');

  content.setAttribute('aria-labelledby', headerId);

  const handleToggle = (e: Event) => {
    if (
      e instanceof KeyboardEvent &&
      e.key !== 'Enter' &&
      e.key !== ' '
    ) {
      return;
    }

    e.preventDefault();
    isExpanded = !isExpanded;
    header.setAttribute('aria-expanded', String(isExpanded));
    content.setAttribute('aria-hidden', String(!isExpanded));
    onToggle(isExpanded);

    announce(
      `${header.textContent?.trim()} ${isExpanded ? 'expanded' : 'collapsed'}`,
      'polite'
    );
  };

  header.addEventListener('click', handleToggle);
  header.addEventListener('keypress', handleToggle);

  return () => {
    header.removeEventListener('click', handleToggle);
    header.removeEventListener('keypress', handleToggle);
  };
}

/**
 * Keyboard shortcut manager
 */
interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
}

export class KeyboardShortcuts {
  private shortcuts: Map<string, ShortcutConfig> = new Map();

  /**
   * Register a keyboard shortcut
   */
  register(config: ShortcutConfig): void {
    const key = this.getShortcutKey(config);
    this.shortcuts.set(key, config);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(config: Partial<ShortcutConfig>): void {
    const key = this.getShortcutKey(config);
    this.shortcuts.delete(key);
  }

  /**
   * Start listening for shortcuts
   */
  start(): () => void {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = this.getShortcutKey({
        key: e.key.toLowerCase(),
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        handler: () => {},
      });

      const shortcut = this.shortcuts.get(key);
      if (shortcut) {
        e.preventDefault();
        shortcut.handler(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Get all registered shortcuts (for help dialog)
   */
  getAll(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Generate unique key for shortcut
   */
  private getShortcutKey(config: Partial<ShortcutConfig>): string {
    const parts: string[] = [];
    if (config.ctrl) parts.push('ctrl');
    if (config.alt) parts.push('alt');
    if (config.shift) parts.push('shift');
    if (config.meta) parts.push('meta');
    parts.push(config.key?.toLowerCase() || '');
    return parts.join('+');
  }
}

/**
 * Global keyboard shortcuts instance
 */
export const globalShortcuts = new KeyboardShortcuts();
