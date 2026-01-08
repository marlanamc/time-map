import type { DayViewController } from "../../components/dayView/DayViewController";
import type { FilterDocListeners } from "../../types";

type DayViewControllerCtor = new (...args: any[]) => DayViewController;

export class UIStateManager {
  dayViewControllerCtor: DayViewControllerCtor | null = null;
  dayViewControllerLoading: Promise<void> | null = null;
  lastTimeRange: { start: number; end: number } | null = null;
  rendererEventListenersSetup = false;
  filterDocListeners: FilterDocListeners | null = null;
  homeProgressScopeIndex = 3; // 0=day,1=week,2=month,3=year
}
