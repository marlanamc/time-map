// ============================================
// Modal Manager - Event Listener Cleanup
// ============================================

/**
 * Manages modal lifecycle and event listener cleanup to prevent memory leaks
 */
export class ModalManager {
    private listeners: Array<{
        element: Element | Document | Window;
        event: string;
        handler: EventListener;
        options?: AddEventListenerOptions | boolean;
    }> = [];
    private modal: HTMLElement | null = null;

    /**
     * Create and append a modal to the document
     */
    create(className: string, innerHTML: string): HTMLElement {
        const modal = document.createElement("div");
        modal.className = className;
        modal.innerHTML = innerHTML;
        this.modal = modal;
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Add an event listener and track it for cleanup
     */
    addEventListener(
        element: Element | Document | Window,
        event: string,
        handler: EventListener,
        options?: AddEventListenerOptions | boolean
    ): void {
        element.addEventListener(event, handler, options);
        this.listeners.push({ element, event, handler, options });
    }

    /**
     * Add event listener to an element within the modal (with null check)
     */
    addModalListener(
        selector: string,
        event: string,
        handler: EventListener,
        options?: AddEventListenerOptions | boolean
    ): void {
        if (!this.modal) return;
        const element = this.modal.querySelector(selector);
        if (element) {
            this.addEventListener(element, event, handler, options);
        }
    }

    /**
     * Add event listeners to all matching elements within the modal
     */
    addModalListeners(
        selector: string,
        event: string,
        handler: (e: Event, element: Element) => void,
        options?: AddEventListenerOptions | boolean
    ): void {
        if (!this.modal) return;
        const elements = this.modal.querySelectorAll(selector);
        elements.forEach((element) => {
            const wrappedHandler = (e: Event) => handler(e, element);
            this.addEventListener(element, event, wrappedHandler as EventListener, options);
        });
    }

    /**
     * Clean up all event listeners
     */
    cleanup(): void {
        this.listeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        this.listeners = [];
    }

    /**
     * Remove modal from DOM and clean up all listeners
     */
    remove(): void {
        this.cleanup();
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }

    /**
     * Get the modal element
     */
    getModal(): HTMLElement | null {
        return this.modal;
    }
}

/**
 * Helper function to create a self-cleaning modal
 * Usage:
 * const modal = createModal('modal-overlay active', '<div>...</div>');
 * modal.addEventListener(modal.getModal()!, 'click', (e) => {
 *   if (e.target === modal.getModal()) modal.remove();
 * });
 */
export function createModal(className: string, innerHTML: string): ModalManager {
    const manager = new ModalManager();
    manager.create(className, innerHTML);
    return manager;
}
