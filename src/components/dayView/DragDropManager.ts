import type { DragData, DragOptions, DropZoneConfig, Command } from "./types";

interface DragState {
  data: DragData;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  pointerId: number | null;
  ghostElement: HTMLElement | null;
  sourceElement: HTMLElement;
  activeDropZone: DropZoneConfig | null;
}

export class DragDropManager {
  private options: DragOptions;
  private dragState: DragState | null = null;
  private dropZones: Map<HTMLElement, DropZoneConfig> = new Map();
  private commandHistory: Command[] = [];
  private commandHistoryIndex: number = -1;
  private maxHistorySize: number = 50;

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private dragThresholdPx: number;

  // Bound event handlers for cleanup
  private boundHandlers: Map<string, EventListener> = new Map();

  constructor(options: DragOptions = {}) {
    this.options = {
      longPressMs: options.longPressMs ?? 200,
      moveCancelPx: options.moveCancelPx ?? 12,
      ...options,
    };
    this.dragThresholdPx = this.options.moveCancelPx ?? 12;
  }

  /**
   * Enable dragging on an element
   */
  enableDraggable(element: HTMLElement, data: DragData): void {
    element.setAttribute("draggable", "true");
    element.setAttribute("data-drag-id", data.goalId);

    // Use PointerEvent for unified touch/mouse handling
    if ("PointerEvent" in window) {
      this.addPointerDrag(element, data);
    } else {
      // Fallback to mouse/touch events
      this.addLegacyDrag(element, data);
    }
  }

  /**
   * Register a drop zone
   */
  enableDropZone(element: HTMLElement, config: DropZoneConfig): void {
    this.dropZones.set(element, { ...config, element });

    // Visual feedback for drop zones
    element.setAttribute("data-drop-zone", "true");
  }

  /**
   * Remove dragging capability
   */
  disableDraggable(element: HTMLElement): void {
    element.removeAttribute("draggable");
    element.removeAttribute("data-drag-id");
    // Remove all event listeners
    // Note: Would need to track listeners to properly remove them
  }

  /**
   * Remove drop zone
   */
  disableDropZone(element: HTMLElement): void {
    this.dropZones.delete(element);
    element.removeAttribute("data-drop-zone");
  }

  /**
   * Clear all registered drop zones (useful when the DOM is replaced)
   */
  clearDropZones(): void {
    this.dropZones.forEach((zone) => {
      zone.element.classList.remove("is-drop-target", "is-drop-over");
      zone.onDragLeave?.();
      zone.element.removeAttribute("data-drop-zone");
    });
    this.dropZones.clear();
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this.dragState !== null;
  }

  /**
   * Get current drag data
   */
  getDragData(): DragData | null {
    return this.dragState?.data ?? null;
  }

  /**
   * Execute a command and add to history
   */
  executeCommand(command: Command): void {
    command.execute();

    // Clear any commands after current index (if we're not at the end)
    if (this.commandHistoryIndex < this.commandHistory.length - 1) {
      this.commandHistory.splice(this.commandHistoryIndex + 1);
    }

    // Add new command
    this.commandHistory.push(command);
    this.commandHistoryIndex++;

    // Trim history if too large
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift();
      this.commandHistoryIndex--;
    }
  }

  /**
   * Undo last command
   */
  undo(): boolean {
    if (this.commandHistoryIndex < 0) return false;

    const command = this.commandHistory[this.commandHistoryIndex];
    command.undo();
    this.commandHistoryIndex--;
    return true;
  }

  /**
   * Redo last undone command
   */
  redo(): boolean {
    if (this.commandHistoryIndex >= this.commandHistory.length - 1) return false;

    this.commandHistoryIndex++;
    const command = this.commandHistory[this.commandHistoryIndex];
    command.execute();
    return true;
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
    this.commandHistoryIndex = -1;
  }

  /**
   * Cancel current drag
   */
  cancel(): void {
    if (!this.dragState) return;

    this.endDrag();
  }

  /**
   * Cleanup and remove all event listeners
   */
  destroy(): void {
    this.cancel();
    this.dropZones.clear();
    this.boundHandlers.clear();
  }

  // --- Private Methods: Pointer Events (Modern) ---

  private addPointerDrag(element: HTMLElement, data: DragData): void {
    const onPointerDown = (e: PointerEvent) => {
      // Only handle primary button (left mouse, primary touch)
      if (e.button !== 0 && e.button !== -1) return;

      // Prevent if already dragging
      if (this.dragState) return;

      // Ignore if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (this.isInteractiveElement(target)) return;

      if (this.isTouchPointerEvent(e)) {
        this.startLongPress(e, element, data);
      } else {
        this.startMouseDrag(e, element, data);
      }
    };

    element.addEventListener("pointerdown", onPointerDown as EventListener);
    this.boundHandlers.set(`${data.goalId}-pointerdown`, onPointerDown as EventListener);
  }

  private isTouchPointerEvent(e: PointerEvent): boolean {
    return e.pointerType === "touch" || e.pointerType === "pen";
  }

  private startMouseDrag(
    e: PointerEvent,
    element: HTMLElement,
    data: DragData,
  ): void {
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);
      if (dx > this.dragThresholdPx || dy > this.dragThresholdPx) {
        cleanup();
        this.startDrag(moveEvent, element, data);
      }
    };

    const onPointerUp = () => {
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener("pointermove", onPointerMove as EventListener);
      document.removeEventListener("pointerup", onPointerUp as EventListener);
      document.removeEventListener("pointercancel", onPointerUp as EventListener);
    };

    document.addEventListener("pointermove", onPointerMove as EventListener);
    document.addEventListener("pointerup", onPointerUp as EventListener);
    document.addEventListener("pointercancel", onPointerUp as EventListener);
  }

  private startLongPress(e: PointerEvent, element: HTMLElement, data: DragData): void {
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;

    // Set capture to receive all pointer events
    element.setPointerCapture(pointerId);

    const checkMove = (moveEvent: PointerEvent) => {
      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);

      if (dx > this.dragThresholdPx || dy > this.dragThresholdPx) {
        // Moved too much, cancel long press
        cleanup();
      }
    };

    const cleanup = () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      element.removeEventListener("pointermove", checkMove as EventListener);
      element.removeEventListener("pointerup", onCancel as EventListener);
      element.removeEventListener("pointercancel", onCancel as EventListener);
    };

    const onCancel = () => {
      cleanup();
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    };

    element.addEventListener("pointermove", checkMove as EventListener);
    element.addEventListener("pointerup", onCancel as EventListener);
    element.addEventListener("pointercancel", onCancel as EventListener);

    this.longPressTimer = setTimeout(() => {
      cleanup();
      this.startDrag(e, element, data);
    }, this.options.longPressMs);
  }

  private startDrag(e: PointerEvent, element: HTMLElement, data: DragData): void {
    // Vibrate on mobile
    if ("vibrate" in navigator) {
      navigator.vibrate(10);
    }

    // Create drag state
    this.dragState = {
      data,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      pointerId: e.pointerId,
      ghostElement: null,
      sourceElement: element,
      activeDropZone: null,
    };

    // Create ghost element
    this.createGhostElement(element);

    // Add visual classes
    document.body.classList.add("is-dragging", `is-dragging-${data.type}`);
    element.setAttribute("aria-grabbed", "true");

    // Set up move and end handlers
    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== e.pointerId) return;
      this.onDragMove(moveEvent);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== e.pointerId) return;
      this.onDragEnd(upEvent);
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener("pointermove", onPointerMove as EventListener);
      document.removeEventListener("pointerup", onPointerUp as EventListener);
      document.removeEventListener("pointercancel", onPointerCancel as EventListener);
    };

    const onPointerCancel = () => {
      this.cancel();
      cleanup();
    };

    document.addEventListener("pointermove", onPointerMove as EventListener);
    document.addEventListener("pointerup", onPointerUp as EventListener);
    document.addEventListener("pointercancel", onPointerCancel as EventListener);

    // Callback
    this.options.onDragStart?.(data);
  }

  private onDragMove(e: PointerEvent): void {
    if (!this.dragState) return;

    this.dragState.currentX = e.clientX;
    this.dragState.currentY = e.clientY;

    // Update ghost position
    if (this.dragState.ghostElement) {
      this.dragState.ghostElement.style.left = `${e.clientX}px`;
      this.dragState.ghostElement.style.top = `${e.clientY}px`;
    }

    // Check drop zones
    const previousDropZone = this.dragState.activeDropZone;
    this.dragState.activeDropZone = this.findDropZone(e.clientX, e.clientY);

    if (previousDropZone !== this.dragState.activeDropZone) {
      // Left previous zone
      if (previousDropZone) {
        previousDropZone.element.classList.remove("is-drop-over");
        previousDropZone.onDragLeave?.();
      }

      // Entered new zone
      if (this.dragState.activeDropZone) {
        this.dragState.activeDropZone.element.classList.add("is-drop-over");
        this.dragState.activeDropZone.onDragOver?.();
      }
    }

    // Callback
    this.options.onDragMove?.(this.dragState.data, e.clientX, e.clientY);
  }

  private onDragEnd(e: PointerEvent): void {
    if (!this.dragState) return;

    // Resolve drop zone from release position (critical for touch: last pointermove
    // may be throttled or not reflect where the user released)
    const dropZone =
      this.findDropZone(e.clientX, e.clientY) ?? this.dragState.activeDropZone;

    if (dropZone) {
      // Valid drop
      dropZone.onDrop(this.dragState.data, e.clientX, e.clientY);
      this.options.onDragEnd?.(this.dragState.data, e.clientX, e.clientY);
      this.endDrag();
    } else {
      // Invalid drop - cancel
      this.options.onDragCancel?.(this.dragState.data);
      this.endDrag();
    }
  }

  private endDrag(): void {
    if (!this.dragState) return;

    // Remove ghost
    if (this.dragState.ghostElement) {
      this.dragState.ghostElement.remove();
    }

    // Clean up classes
    document.body.classList.remove("is-dragging", `is-dragging-${this.dragState.data.type}`);
    this.dragState.sourceElement.setAttribute("aria-grabbed", "false");

    // Clean up drop zones
    this.dropZones.forEach((zone) => {
      zone.element.classList.remove("is-drop-target", "is-drop-over");
      zone.onDragLeave?.();
    });

    // Clear state
    this.dragState = null;
  }

  // --- Private Methods: Legacy (Fallback) ---

  private addLegacyDrag(element: HTMLElement, data: DragData): void {
    // HTML5 drag and drop for desktop
    element.addEventListener("dragstart", (e) => {
      if (!(e instanceof DragEvent)) return;
      e.dataTransfer?.setData("text/plain", data.goalId);
      e.dataTransfer?.setData("application/x-goal-drag", JSON.stringify(data));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";

      this.dragState = {
        data,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        pointerId: null,
        ghostElement: null,
        sourceElement: element,
        activeDropZone: null,
      };

      document.body.classList.add("is-dragging", `is-dragging-${data.type}`);
      element.setAttribute("aria-grabbed", "true");

      this.options.onDragStart?.(data);
    });

    element.addEventListener("dragend", () => {
      this.endDrag();
    });
  }

  // --- Private Helpers ---

  private createGhostElement(sourceElement: HTMLElement): void {
    if (!this.dragState) return;

    const ghost = sourceElement.cloneNode(true) as HTMLElement;
    ghost.classList.add("drag-ghost");
    ghost.style.position = "fixed";
    ghost.style.left = `${this.dragState.currentX}px`;
    ghost.style.top = `${this.dragState.currentY}px`;
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "3000";
    ghost.style.opacity = "0.92";
    ghost.style.transform = "translate(-50%, -50%) rotate(-1deg)";

    document.body.appendChild(ghost);
    this.dragState.ghostElement = ghost;
  }

  private findDropZone(x: number, y: number): DropZoneConfig | null {
    for (const [element, config] of this.dropZones) {
      const rect = element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return config;
      }
    }
    return null;
  }

  private isInteractiveElement(el: HTMLElement): boolean {
    const tagName = el.tagName.toLowerCase();
    return (
      tagName === "button" ||
      tagName === "a" ||
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      el.classList.contains("day-goal-checkbox") ||
      el.classList.contains("btn-zen-focus") ||
      el.classList.contains("planter-resize-handle")
    );
  }
}
