import type { DayViewController } from "../../components/dayView/DayViewController";
import { VIEWS } from "../../config";
import type { FilterDocListeners, GoalLevel, ViewType } from "../../types";

type DayViewControllerCtor = new (...args: any[]) => DayViewController;

export class UIStateManager {
  dayViewControllerCtor: DayViewControllerCtor | null = null;
  dayViewControllerLoading: Promise<void> | null = null;
  lastTimeRange: { start: number; end: number } | null = null;
  rendererEventListenersSetup = false;
  filterDocListeners: FilterDocListeners | null = null;
  homeProgressScopeIndex = 3; // 0=day,1=week,2=month,3=year
  focusRevealSetup = false;
  focusRevealHideTimer: ReturnType<typeof setTimeout> | null = null;
  goalModalYear: number | null = null;
  goalModalLevel: GoalLevel = "milestone";
  lastNonHomeView: ViewType = VIEWS.YEAR;
  lastViewBeforeDetail: ViewType | null = null;

  saveView(view: ViewType) {
    if (view === VIEWS.HOME) return;
    this.lastNonHomeView = view;
    try {
      localStorage.setItem("gardenFence.lastView", view);
    } catch (_e) {
      // Ignore
    }
  }

  loadView(): ViewType | null {
    try {
      const saved = localStorage.getItem(
        "gardenFence.lastView",
      ) as ViewType | null;
      if (saved && Object.values(VIEWS).includes(saved)) {
        this.lastNonHomeView = saved;
        return saved;
      }
    } catch (_e) {
      // Ignore
    }
    return null;
  }
}
