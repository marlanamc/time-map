type SwipeDirection = "left" | "right";

export class SwipeNavigator {
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private tracking = false;
  private element: HTMLElement | null = null;

  constructor(
    private readonly opts: {
      minDistancePx?: number;
      minVelocityPxPerMs?: number;
      maxDurationMs?: number;
      onSwipe: (direction: SwipeDirection, e: TouchEvent) => void;
      shouldHandleStart?: (target: Element | null) => boolean;
    },
  ) {}

  attach(element: HTMLElement) {
    if (this.element === element) return;
    this.detach();
    this.element = element;
    element.addEventListener("touchstart", this.onTouchStart, { passive: true });
    element.addEventListener("touchend", this.onTouchEnd, { passive: true });
    element.addEventListener("touchcancel", this.onTouchCancel, { passive: true });
  }

  detach() {
    if (!this.element) return;
    this.element.removeEventListener("touchstart", this.onTouchStart);
    this.element.removeEventListener("touchend", this.onTouchEnd);
    this.element.removeEventListener("touchcancel", this.onTouchCancel);
    this.element = null;
    this.tracking = false;
  }

  private onTouchStart = (e: TouchEvent) => {
    const touch = e.touches?.[0];
    if (!touch) return;

    const target = e.target as Element | null;
    if (this.opts.shouldHandleStart && !this.opts.shouldHandleStart(target)) {
      this.tracking = false;
      return;
    }

    this.tracking = true;
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startT = performance.now();
  };

  private onTouchCancel = () => {
    this.tracking = false;
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (!this.tracking) return;
    this.tracking = false;

    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const dt = performance.now() - this.startT;
    const maxDurationMs = this.opts.maxDurationMs ?? 600;
    if (dt <= 0 || dt > maxDurationMs) return;

    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const minDistancePx = this.opts.minDistancePx ?? 70;
    if (absX < minDistancePx) return;

    // Only trigger if horizontal swipe clearly dominates.
    if (absX <= absY * 1.8) return;

    const v = absX / dt;
    const minVelocityPxPerMs = this.opts.minVelocityPxPerMs ?? 0.25;
    if (v < minVelocityPxPerMs) return;

    this.opts.onSwipe(dx > 0 ? "right" : "left", e);
  };
}

