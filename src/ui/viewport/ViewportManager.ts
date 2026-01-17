/**
 * ViewportManager - Manages mobile viewport detection and responsive behavior
 *
 * Responsibilities:
 * - Detects mobile vs desktop viewport
 * - Applies appropriate CSS classes and layout adjustments
 * - Manages date navigation placement (mobile vs desktop)
 * - Updates CSS custom properties for mobile layouts
 */

import { State } from "../../core/State";
import { VIEWS } from "../../config";

export interface ViewportChangeCallbacks {
  onViewportChange?: () => void;
  onRenderRequired?: () => void;
}

class ViewportManager {
  private _mobileMql: MediaQueryList | null = null;
  private _mobileModeSetup: boolean = false;
  private _initialMobileDefaultsApplied: boolean = false;
  private _mobileLayoutRaf: number | null = null;
  private callbacks: ViewportChangeCallbacks = {};
  private readonly mobileQuery =
    "(max-width: 600px), ((max-width: 900px) and (max-height: 500px) and (pointer: coarse))";

  /**
   * Check if current viewport is mobile
   */
  isMobileViewport(): boolean {
    if (this._mobileMql) return this._mobileMql.matches;
    return window.matchMedia(this.mobileQuery).matches;
  }

  /**
   * Set callbacks for viewport changes
   */
  setCallbacks(callbacks: ViewportChangeCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Initialize viewport mode detection and responsive behavior
   */
  setupViewportMode(): void {
    if (this._mobileModeSetup) return;
    this._mobileModeSetup = true;

    this._mobileMql = window.matchMedia(this.mobileQuery);

    const apply = () => {
      const isMobile = this.isMobileViewport();
      document.body.classList.toggle("is-mobile", isMobile);
      document.body.classList.toggle("is-desktop", !isMobile);
      this.syncMobileDateNavPlacement(isMobile);

      // Show/hide mobile support panel button
      const mobileSupportBtn = document.getElementById(
        "supportPanelToggleBtnMobile"
      );
      if (mobileSupportBtn) {
        if (isMobile) {
          mobileSupportBtn.removeAttribute("hidden");
        } else {
          mobileSupportBtn.setAttribute("hidden", "");
        }
      }

      // On first mobile load, align layout classes with the active view.
      if (isMobile && !this._initialMobileDefaultsApplied) {
        this._initialMobileDefaultsApplied = true;
        document.body.classList.toggle(
          "mobile-home-view",
          State.currentView === VIEWS.HOME
        );
      }

      // Notify callback that viewport changed (for canvas/render updates)
      if (this.callbacks.onViewportChange) {
        this.callbacks.onViewportChange();
      }

      // Trigger render if needed
      if (this.callbacks.onRenderRequired) {
        this.callbacks.onRenderRequired();
      }

      this.updateMobileLayoutVars();
    };

    apply();

    // Keep body class in sync on resize/orientation change.
    const mql = this._mobileMql;
    if (mql) {
      const onChange = () => apply();
      try {
        mql.addEventListener("change", onChange);
      } catch {
        // Safari < 14
        mql.addListener(onChange);
      }
    }

    // Handle orientation changes explicitly
    window.addEventListener("orientationchange", () => {
      // Delay to allow browser to update viewport
      setTimeout(() => {
        apply();
      }, 100);
    });

    // Also handle resize events as fallback
    window.addEventListener("resize", () => {
      apply();
    });
  }

  /**
   * Move date navigation between header and control center based on viewport
   */
  syncMobileDateNavPlacement(isMobile: boolean): void {
    const dateNav = document.querySelector(".date-nav") as HTMLElement | null;
    const controlCenter = document.querySelector(
      ".control-center"
    ) as HTMLElement | null;
    const headerSlot = document.getElementById(
      "headerMobileNav"
    ) as HTMLElement | null;

    if (!dateNav || !controlCenter || !headerSlot) return;

    document.body.classList.toggle("mobile-date-nav-in-header", isMobile);
    headerSlot.setAttribute("aria-hidden", String(!isMobile));

    if (isMobile) {
      headerSlot.appendChild(dateNav);
    } else {
      controlCenter.appendChild(dateNav);
    }
  }

  /**
   * Update CSS custom properties for mobile layout measurements
   */
  updateMobileLayoutVars(): void {
    if (this._mobileLayoutRaf !== null) {
      cancelAnimationFrame(this._mobileLayoutRaf);
    }

    this._mobileLayoutRaf = requestAnimationFrame(() => {
      this._mobileLayoutRaf = null;

      const root = document.documentElement;
      const isMobile = this.isMobileViewport();

      if (!isMobile) {
        root.style.removeProperty("--mobile-tab-bar-height");
        root.style.removeProperty("--mobile-home-stats-height");
        return;
      }

      const tabBar = document.getElementById("mobileTabBar");
      // Use fallback height if tab bar is not visible or has no height
      const tabBarHeight =
        tabBar && tabBar.getBoundingClientRect().height > 0
          ? Math.round(tabBar.getBoundingClientRect().height)
          : 68; // Fallback height matching CSS
      root.style.setProperty("--mobile-tab-bar-height", `${tabBarHeight}px`);

      const isMobileHomeView =
        document.body.classList.contains("mobile-home-view");
      const timeStats = document.querySelector(
        ".time-stats"
      ) as HTMLElement | null;
      const statsHeight =
        isMobileHomeView && timeStats
          ? Math.round(timeStats.getBoundingClientRect().height)
          : 0;
      root.style.setProperty("--mobile-home-stats-height", `${statsHeight}px`);
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this._mobileLayoutRaf !== null) {
      cancelAnimationFrame(this._mobileLayoutRaf);
      this._mobileLayoutRaf = null;
    }
  }
}

// Export singleton instance
export const viewportManager = new ViewportManager();
export default viewportManager;
