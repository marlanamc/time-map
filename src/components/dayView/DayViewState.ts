import type { Goal } from "../../types";

export type ContextGoals = { vision: Goal[]; milestone: Goal[]; focus: Goal[] };

export class DayViewState {
  private _currentDate: Date | null = null;
  private _currentGoals: Goal[] = [];
  private _contextGoals: ContextGoals | undefined;

  setGoals(date: Date, goals: Goal[], contextGoals?: ContextGoals): void {
    this._currentDate = date;
    this._currentGoals = goals;
    this._contextGoals = contextGoals;
  }

  get currentDate(): Date | null {
    return this._currentDate;
  }

  get currentGoals(): Goal[] {
    return this._currentGoals;
  }

  get contextGoals(): ContextGoals | undefined {
    return this._contextGoals;
  }

  updateGoal(goalId: string, goal: Goal): void {
    const index = this._currentGoals.findIndex((g) => g.id === goalId);
    if (index >= 0) {
      this._currentGoals[index] = goal;
    }
  }
}
