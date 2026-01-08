import { State } from "../../core/State";
import type { ViewType } from "../../types";

type ViewNavigatorCallbacks = {
  onSyncViewButtons: () => void;
  onUpdateMobileLayoutVars: () => void;
};

export const ViewNavigator = {
  bindViewSwitchers(callbacks: ViewNavigatorCallbacks) {
    // View switcher (desktop)
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.body.classList.remove("mobile-home-view");
        State.setView((btn as HTMLElement).dataset.view as ViewType);
        callbacks.onSyncViewButtons();
      });
    });

    // Mobile tab bar
    document.querySelectorAll(".mobile-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const view = (tab as HTMLElement).dataset.view;
        State.setView(view as ViewType);
        callbacks.onSyncViewButtons();
        callbacks.onUpdateMobileLayoutVars();
      });
    });
  },

  syncViewButtons() {
    // Sync desktop view buttons
    document.querySelectorAll(".view-btn").forEach((btn) => {
      const isActive = (btn as HTMLElement).dataset.view === State.currentView;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    // Sync mobile tab bar
    const isMobileHomeView =
      document.body.classList.contains("mobile-home-view");
    const isMobileGardenView =
      document.body.classList.contains("mobile-garden-view");
    document.querySelectorAll(".mobile-tab").forEach((tab) => {
      const tabView = (tab as HTMLElement).dataset.view;
      let isActive = false;
      if (tabView === "home") {
        isActive = isMobileHomeView;
      } else if (tabView === "garden") {
        isActive = isMobileGardenView;
      } else {
        isActive =
          !isMobileHomeView &&
          !isMobileGardenView &&
          tabView === State.currentView;
      }
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
  },
};
