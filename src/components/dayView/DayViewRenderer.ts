import type { Goal } from "../../types";
import { DayViewState } from "./DayViewState";
import type { PlannerDayViewRenderer } from "./PlannerDayViewRenderer";

export class DayViewRenderer {
  private plannerRenderer: PlannerDayViewRenderer;
  private state: DayViewState;

  constructor(plannerRenderer: PlannerDayViewRenderer, state: DayViewState) {
    this.plannerRenderer = plannerRenderer;
    this.state = state;
  }

  renderCurrent(): void {
    const currentDate = this.state.currentDate;
    if (!currentDate) return;
    this.plannerRenderer.renderInitial(
      currentDate,
      this.state.currentGoals,
      this.state.contextGoals,
    );
  }

  updateCurrent(): void {
    const currentDate = this.state.currentDate;
    if (!currentDate) return;
    this.plannerRenderer.update(
      currentDate,
      this.state.currentGoals,
      this.state.contextGoals,
    );
  }

  updateGoal(goalId: string, goal: Goal): void {
    const currentDate = this.state.currentDate;
    if (!currentDate) return;
    this.plannerRenderer.updateGoal(currentDate, goalId, goal);
  }
}