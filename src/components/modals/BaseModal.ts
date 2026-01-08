/**
 * BaseModal - Unified foundation for all modal implementations
 * Provides consistent accessibility, focus management, and mobile optimization
 */

export interface ModalOptions {
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOutsideClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
  ariaLabel?: string;
}

export interface ModalA11yOptions {
  announceOnOpen?: string;
  announceOnClose?: string;
  restoreFocus?: boolean;
  trapFocus?: boolean;
}

export abstract class BaseModal {
  protected element: HTMLElement | null = null;
  protected overlay: HTMLElement | null = null;
  private previousActiveElement: Element | null = null;
  private focusTrapCleanup: (() => void) | null = null;

  constructor(
    protected options: ModalOptions,
    protected a11yOptions: ModalA11yOptions = {}
  ) {
    this.options = {
      closeOnOutsideClick: true,
      showCloseButton: true,
      size: 'md',
      ...options
    };

    this.a11yOptions = {
      announceOnOpen: '',
      announceOnClose: '',
      restoreFocus: true,
      trapFocus: true,
      ...a11yOptions
    };
  }

  /**
   * Render modal content - must be implemented by subclasses
   */
  protected abstract renderContent(): string;

  /**
   * Bind event handlers - must be implemented by subclasses
   */
  protected abstract bindEvents(): void;

  /**
   * Open the modal
   */
  open(): void {
    if (this.element) return; // Already open

    // Store current focus
    this.previousActiveElement = document.activeElement;

    // Create modal structure
    this.createModal();
    this.bindBaseEvents();
    this.bindEvents();

    // Add to DOM and animate in
    document.body.appendChild(this.overlay!);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Focus management
    requestAnimationFrame(() => {
      this.setInitialFocus();
      if (this.a11yOptions.trapFocus) {
        this.setupFocusTrap();
      }
    });

    // Announce to screen readers
    if (this.a11yOptions.announceOnOpen) {
      this.announce(this.a11yOptions.announceOnOpen);
    }

    // Animate in
    requestAnimationFrame(() => {
      this.overlay?.classList.add('active');
      this.element?.classList.add('active');
    });
  }

  /**
   * Close the modal
   */
  close(): void {
    if (!this.element) return; // Already closed

    // Announce to screen readers
    if (this.a11yOptions.announceOnClose) {
      this.announce(this.a11yOptions.announceOnClose);
    }

    // Animate out
    this.overlay?.classList.remove('active');
    this.element?.classList.remove('active');

    // Remove after animation
    setTimeout(() => {
      this.cleanup();
    }, 300); // Match animation duration
  }

  /**
   * Create modal DOM structure
   */
  private createModal(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    
    if (this.options.ariaLabel) {
      this.overlay.setAttribute('aria-label', this.options.ariaLabel);
    }

    const sizeClass = this.options.size ? `modal-${this.options.size}` : '';
    const customClass = this.options.className || '';

    this.overlay.innerHTML = `
      <div class="modal ${sizeClass} ${customClass}" role="document">
        <div class="modal-header">
          <h2 class="modal-title" id="modal-title-${this.getModalId()}">${this.escapeHtml(this.options.title)}</h2>
          ${this.options.showCloseButton ? `
            <button type="button" class="modal-close" aria-label="Close modal" data-action="close-modal">
              <span aria-hidden="true">×</span>
            </button>
          ` : ''}
        </div>
        <div class="modal-body">
          ${this.renderContent()}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
        </div>
      </div>
    `;

    this.element = this.overlay.querySelector('.modal') as HTMLElement;
  }

  /**
   * Bind base event handlers
   */
  private bindBaseEvents(): void {
    if (!this.overlay) return;

    // Close buttons
    this.overlay.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Click outside to close
    if (this.options.closeOnOutsideClick) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
    }

    // Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    this.focusTrapCleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Set initial focus to first interactive element
   */
  private setInitialFocus(): void {
    if (!this.element) return;

    const focusableElements = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      this.element.focus();
    }
  }

  /**
   * Setup focus trap within modal
   */
  private setupFocusTrap(): void {
    if (!this.element) return;

    const focusableElements = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    this.element.addEventListener('keydown', handleKeyDown);
    
    // Update cleanup function
    const existingCleanup = this.focusTrapCleanup || (() => {});
    this.focusTrapCleanup = () => {
      existingCleanup();
      this.element?.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Cleanup modal resources
   */
  private cleanup(): void {
    // Restore focus
    if (this.a11yOptions.restoreFocus && this.previousActiveElement) {
      (this.previousActiveElement as HTMLElement).focus();
    }

    // Cleanup focus trap
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
      this.focusTrapCleanup = null;
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Remove from DOM
    this.overlay?.remove();
    this.element = null;
    this.overlay = null;
    this.previousActiveElement = null;
  }

  /**
   * Announce message to screen readers
   */
  protected announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const liveRegionId = `live-region-${priority}`;
    let liveRegion = document.getElementById(liveRegionId);

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = liveRegionId;
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = message;
  }

  /**
   * Generate unique modal ID
   */
  protected getModalId(): string {
    return `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  protected escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Check if modal is currently open
   */
  public isOpen(): boolean {
    return this.element !== null;
  }

  /**
   * Update modal title
   */
  public updateTitle(title: string): void {
    const titleElement = this.element?.querySelector('.modal-title');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Add action button to modal footer
   */
  public addActionButton(text: string, className: string = 'btn-primary', action?: () => void): void {
    const actionsContainer = this.element?.querySelector('.modal-actions');
    if (!actionsContainer) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${className}`;
    button.textContent = text;

    if (action) {
      button.addEventListener('click', action);
    } else {
      button.addEventListener('click', () => this.close());
    }

    actionsContainer.appendChild(button);
  }
}
