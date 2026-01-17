import { State } from "../../core/State";
import { VIEWS } from "../../config";
import { haptics } from "../../utils/haptics";
import { SwipeNavigator } from "../gestures/SwipeNavigator";
import { viewportManager } from "../viewport/ViewportManager";
import type { UIElements, ViewType } from "../../types";

type TouchHandlerOptions = {
  elements: UIElements;
  onRender: () => void;
  onShowToast: (icon: string, message: string) => void;
};

export class TouchHandler {
  private elements: UIElements;
  private onRender: () => void;
  private onShowToast: (icon: string, message: string) => void;
  private swipeNavigator: SwipeNavigator | null = null;
  private pullToRefreshCleanup: (() => void) | null = null;

  constructor(options: TouchHandlerOptions) {
    this.elements = options.elements;
    this.onRender = options.onRender;
    this.onShowToast = options.onShowToast;
  }

  setupSwipeNavigation() {
    const isMobile = viewportManager.isMobileViewport();
    const el = this.elements.canvasContainer;
    if (!isMobile || !el) {
      this.swipeNavigator?.detach();
      this.swipeNavigator = null;
      return;
    }

    if (!this.swipeNavigator) {
      const shouldHandleStart = (target: Element | null) => {
        if (!target) return true;
        return !(
          target.closest("input") ||
          target.closest("textarea") ||
          target.closest("select") ||
          target.closest("button") ||
          target.closest("a") ||
          target.closest(".modal") ||
          target.closest(".modal-overlay") ||
          target.closest(".support-panel") ||
          target.closest("[data-disable-swipe]")
        );
      };

      const viewOrder: ViewType[] = [
        VIEWS.GARDEN,
        VIEWS.DAY,
        VIEWS.WEEK,
        VIEWS.MONTH,
        VIEWS.YEAR,
      ];
      const navigate = (dir: "left" | "right") => {
        const idx = viewOrder.indexOf(State.currentView);
        if (idx === -1) return;
        const nextIdx = dir === "left" ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= viewOrder.length) return;
        State.setView(viewOrder[nextIdx]);
      };

      this.swipeNavigator = new SwipeNavigator({
        onSwipe: (direction) => navigate(direction),
        shouldHandleStart,
      });
    }

    this.swipeNavigator.attach(el);
  }

  setupPullToRefresh() {
    const isMobile = viewportManager.isMobileViewport();
    const container = this.elements.canvasContainer;
    const indicator = document.getElementById("pullToRefresh");
    const labelEl = document.getElementById("pullToRefreshLabel");

    if (!isMobile || !container || !indicator) {
      this.pullToRefreshCleanup?.();
      this.pullToRefreshCleanup = null;
      return;
    }

    // Already attached
    if (this.pullToRefreshCleanup) return;

    const thresholdPx = 72;
    const maxPullPx = 140;

    let startX = 0;
    let startY = 0;
    let pulling = false;
    let locked = false;
    let pullPx = 0;

    const canStart = (target: Element | null) => {
      if (!target) return true;
      return !(
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("select") ||
        target.closest("button") ||
        target.closest("a") ||
        target.closest(".modal") ||
        target.closest(".modal-overlay") ||
        target.closest(".support-panel") ||
        target.closest("[data-disable-pull-to-refresh]")
      );
    };

    const setIndicator = (opts: {
      active: boolean;
      pull?: number;
      ready?: boolean;
      loading?: boolean;
      label?: string;
    }) => {
      indicator.classList.toggle("active", !!opts.active);
      indicator.classList.toggle("ready", !!opts.ready);
      indicator.classList.toggle("loading", !!opts.loading);
      if (typeof opts.pull === "number") {
        indicator.style.setProperty("--ptr-pull", `${opts.pull}px`);
      }
      if (labelEl && typeof opts.label === "string") {
        labelEl.textContent = opts.label;
      }
    };

    const reset = () => {
      pulling = false;
      locked = false;
      pullPx = 0;
      setIndicator({
        active: false,
        pull: 0,
        ready: false,
        loading: false,
        label: "Pull to refresh",
      });
    };

    const doRefresh = async () => {
      if (!navigator.onLine) {
        this.onShowToast("📴", "Offline — can’t refresh");
        haptics.impact("light");
        return;
      }

      const prevData = State.data;
      try {
        await State.load();
        if (!State.data && prevData) State.data = prevData;
        this.onRender();
        this.onShowToast("🔄", "Refreshed");
        haptics.impact("medium");
      } catch (e) {
        console.error("Pull-to-refresh failed:", e);
        if (!State.data && prevData) State.data = prevData;
        this.onShowToast("⚠️", "Refresh failed");
        haptics.impact("light");
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!canStart(e.target as Element | null)) return;
      if (container.scrollTop > 0) return;
      if (e.touches.length !== 1) return;

      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      pulling = true;
      locked = false;
      pullPx = 0;
      setIndicator({
        active: true,
        pull: 0,
        ready: false,
        loading: false,
        label: "Pull to refresh",
      });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling) return;
      if (container.scrollTop > 0) return reset();
      if (e.touches.length !== 1) return reset();

      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dy <= 0) return reset();

      // Only handle if it is mostly vertical. If the user is swiping horizontally, bail.
      if (!locked) {
        if (Math.abs(dx) > Math.abs(dy) * 0.75) return reset();
        locked = true;
      }

      // We are handling the gesture: prevent scroll bounce and take control.
      e.preventDefault();
      pullPx = Math.min(maxPullPx, dy * 0.9);
      const ready = pullPx >= thresholdPx;
      setIndicator({
        active: true,
        pull: pullPx,
        ready,
        loading: false,
        label: ready ? "Release to refresh" : "Pull to refresh",
      });
    };

    const onTouchEnd = async () => {
      if (!pulling) return;
      const shouldRefresh = pullPx >= thresholdPx;
      pulling = false;
      locked = false;

      if (!shouldRefresh) return reset();

      setIndicator({
        active: true,
        pull: thresholdPx,
        ready: true,
        loading: true,
        label: "Refreshing…",
      });
      await doRefresh();
      window.setTimeout(reset, 450);
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", reset, { passive: true });

    this.pullToRefreshCleanup = () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", reset);
      reset();
    };
  }
}
