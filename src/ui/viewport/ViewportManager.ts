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
    "(max-width: 767px), ((max-width: 932px) and (max-height: 440px) and (pointer: coarse))";

  /**
   * Check if current viewport is mobile (Phone or small handheld)
   */
  isMobileViewport(): boolean {
    if (this._mobileMql) return this._mobileMql.matches;
    return window.matchMedia(this.mobileQuery).matches;
  }

  /**
   * Check if current viewport is tablet
   */
  isTabletViewport(): boolean {
    return window.matchMedia("(min-width: 768px) and (max-width: 1024px)")
      .matches;
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

      // Show/hide mobile support panel button - keep it in body (fixed positioned)
      const mobileSupportBtn = document.getElementById(
        "supportPanelToggleBtnMobile",
      );
      
      if (mobileSupportBtn) {
        if (isMobile) {
          mobileSupportBtn.removeAttribute("hidden");
          // Keep button in body for fixed positioning (not in header)
          if (mobileSupportBtn.parentElement !== document.body) {
            document.body.appendChild(mobileSupportBtn);
          }
        } else {
          mobileSupportBtn.setAttribute("hidden", "");
        }
      }

      // Move logo button out of header to body for fixed positioning on mobile
      const logoBtn = document.getElementById("appLogo");
      if (logoBtn) {
        if (isMobile) {
          // Move logo to body if it's still in the hidden header
          if (logoBtn.parentElement?.classList.contains("mobile-header") || 
              logoBtn.parentElement?.classList.contains("header")) {
            document.body.appendChild(logoBtn);
          }
        } else {
          // Move logo back to header on desktop if needed
          const mobileHeader = document.getElementById("mobileHeader");
          if (mobileHeader && logoBtn.parentElement === document.body) {
            mobileHeader.insertBefore(logoBtn, mobileHeader.firstChild);
          }
        }
      }

      // On first mobile load, align layout classes with the active view.
      if (isMobile && !this._initialMobileDefaultsApplied) {
        this._initialMobileDefaultsApplied = true;
        document.body.classList.toggle(
          "mobile-home-view",
          State.currentView === VIEWS.HOME,
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
      ".control-center",
    ) as HTMLElement | null;
    const headerSlot = document.getElementById(
      "headerMobileNav",
    ) as HTMLElement | null;

    if (!dateNav || !controlCenter || !headerSlot) return;

    document.body.classList.toggle("mobile-date-nav-in-header", isMobile);
    headerSlot.setAttribute("aria-hidden", String(!isMobile));

    if (isMobile) {
      // Move headerSlot out of hidden header to body for fixed positioning
      if (headerSlot.parentElement?.classList.contains("mobile-header") || 
          headerSlot.parentElement?.classList.contains("header")) {
        document.body.appendChild(headerSlot);
      }
      headerSlot.appendChild(dateNav);
    } else {
      // Move headerSlot back to header on desktop
      const mobileHeader = document.getElementById("mobileHeader");
      if (mobileHeader && headerSlot.parentElement === document.body) {
        mobileHeader.appendChild(headerSlot);
      }
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
      const tabBarRect = tabBar?.getBoundingClientRect();
      const tabBarHeight =
        tabBarRect && tabBarRect.height > 0 ? tabBarRect.height : 0;
      const tabBarOccupiedBottomSpace =
        tabBarRect && tabBarHeight > 0
          ? Math.round(window.innerHeight - tabBarRect.top)
          : 68; // Fallback height matching CSS
      root.style.setProperty(
        "--mobile-tab-bar-height",
        `${tabBarOccupiedBottomSpace}px`,
      );

      const isMobileHomeView =
        document.body.classList.contains("mobile-home-view");
      const timeStats = document.querySelector(
        ".time-stats",
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
