import type { Goal } from "../../types";
import { DayViewState } from "./DayViewState";
import type { PlannerDayViewRenderer } from "./PlannerDayViewRenderer";

export type RendererDeps = {
  plannerRenderer: PlannerDayViewRenderer;
  state: DayViewState;
};

export function renderCurrent(deps: RendererDeps): void {
  const currentDate = deps.state.currentDate;
  if (!currentDate) return;
  deps.plannerRenderer.renderInitial(
    currentDate,
    deps.state.currentGoals,
    deps.state.contextGoals,
  );
}

export function updateCurrent(deps: RendererDeps): void {
  const currentDate = deps.state.currentDate;
  if (!currentDate) return;
  deps.plannerRenderer.update(
    currentDate,
    deps.state.currentGoals,
    deps.state.contextGoals,
  );
}

export function updateGoal(deps: RendererDeps, goalId: string, goal: Goal): void {
  deps.plannerRenderer.updateCard(goalId, goal);
  deps.state.updateGoal(goalId, goal);
}
