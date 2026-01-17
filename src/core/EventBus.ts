/**
 * EventBus - Lightweight event system for decoupled communication
 *
 * Resolves circular dependencies by allowing modules to communicate
 * without direct imports. State can emit events, UI can listen.
 *
 * Benefits:
 * - Breaks State ↔ UI circular dependency
 * - Loose coupling between modules
 * - Easy to test and debug
 * - Type-safe event handling
 */

type EventHandler<T = any> = (data: T) => void;

/**
 * Event registry for type safety
 * Add new events here to get TypeScript autocomplete
 */
export interface EventRegistry {
  // View change events
  "view:changed": { view?: string; transition?: boolean };
  "view:sync-buttons": void;

  // Navigation events
  "navigation:forward": void;
  "navigation:backward": void;

  // Data events
  "data:loaded": void;
  "data:saved": void;
  "data:sync-started": void;
  "data:sync-completed": void;
  "data:sync-failed": { error: Error };

  // Goal events
  "goal:created": { goalId: string };
  "goal:updated": { goalId: string };
  "goal:deleted": { goalId: string };

  // UI events
  "ui:render": { transition?: boolean };
  "ui:toast": { icon: string; message: string; onClick?: () => void };
  "ui:celebrate": { icon: string; title: string; message: string };
  "ui:checkin-due": { weekNum: number; weekYear: number; message: string };

  // Auth events
  "auth:login": { userId: string };
  "auth:logout": void;

  // Error events
  "error:authentication": { message: string };
  "error:database": { message: string; cause?: any };
  "error:storage": { message: string };
}

class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private debugMode: boolean = false;

  /**
   * Enable debug mode to log all events
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Subscribe to an event
   * @param event - Event name from EventRegistry
   * @param handler - Callback function to handle the event
   * @returns Unsubscribe function
   */
  on<K extends keyof EventRegistry>(
    event: K,
    handler: EventHandler<EventRegistry[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler as EventHandler);

    if (this.debugMode) {
      console.log(`📡 EventBus: Subscribed to '${event}'`);
    }

    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Subscribe to an event that fires only once
   * @param event - Event name from EventRegistry
   * @param handler - Callback function to handle the event
   */
  once<K extends keyof EventRegistry>(
    event: K,
    handler: EventHandler<EventRegistry[K]>,
  ): void {
    const onceHandler = (data: EventRegistry[K]) => {
      handler(data);
      this.off(event, onceHandler as EventHandler<EventRegistry[K]>);
    };

    this.on(event, onceHandler as EventHandler<EventRegistry[K]>);
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name from EventRegistry
   * @param handler - The handler to remove
   */
  off<K extends keyof EventRegistry>(
    event: K,
    handler: EventHandler<EventRegistry[K]>,
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);

      if (this.debugMode) {
        console.log(`📡 EventBus: Unsubscribed from '${event}'`);
      }

      // Clean up empty listener sets
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event name from EventRegistry
   * @param data - Event data
   */
  emit<K extends keyof EventRegistry>(event: K, data?: EventRegistry[K]): void {
    const handlers = this.listeners.get(event);

    if (this.debugMode) {
      console.log(`📡 EventBus: Emitting '${event}'`, data);
    }

    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for '${event}':`, error);
        }
      });
    } else if (this.debugMode) {
      console.warn(`📡 EventBus: No listeners for '${event}'`);
    }
  }

  /**
   * Remove all listeners for a specific event
   * @param event - Event name from EventRegistry
   */
  clear<K extends keyof EventRegistry>(event: K): void {
    this.listeners.delete(event);

    if (this.debugMode) {
      console.log(`📡 EventBus: Cleared all listeners for '${event}'`);
    }
  }

  /**
   * Remove all listeners for all events
   */
  clearAll(): void {
    this.listeners.clear();

    if (this.debugMode) {
      console.log("📡 EventBus: Cleared all listeners");
    }
  }

  /**
   * Get count of listeners for an event
   * @param event - Event name from EventRegistry
   */
  listenerCount<K extends keyof EventRegistry>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get all active event names
   */
  getActiveEvents(): string[] {
    return Array.from(this.listeners.keys());
  }
}

// Export singleton instance
export const eventBus = new EventBus();
export default eventBus;
