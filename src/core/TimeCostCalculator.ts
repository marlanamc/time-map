import type { Goal, EnergyType } from "../types";

/** Default weekly available time in minutes (40 hours/week) */
export const DEFAULT_WEEKLY_AVAILABLE_MINUTES = 40 * 60;

export interface TimeCommitmentSummary {
  totalMinutes: number;
  byGoal: Map<string, number>;
  byEnergyType: Map<EnergyType, number>;
}

export interface OvercommitmentWarning {
  excessMinutes: number;
  availableMinutes: number;
  totalPlannedMinutes: number;
  message: string;
}

export function calculateWeeklyTimeCommitment(
  goals: Goal[],
): TimeCommitmentSummary {
  const byGoal = new Map<string, number>();
  const byEnergyType = new Map<EnergyType, number>();
  let totalMinutes = 0;

  for (const goal of goals) {
    const plan = goal.commitment;
    if (!plan) continue;

    const minutes = plan.frequency * plan.duration;
    totalMinutes += minutes;
    byGoal.set(goal.id, minutes);

    const existing = byEnergyType.get(plan.energyType) ?? 0;
    byEnergyType.set(plan.energyType, existing + minutes);
  }

  return {
    totalMinutes,
    byGoal,
    byEnergyType,
  };
}

export function detectOvercommitment(
  existingMinutes: number,
  proposedMinutes: number,
  availableMinutes: number = DEFAULT_WEEKLY_AVAILABLE_MINUTES,
): OvercommitmentWarning | null {
  const totalPlannedMinutes = existingMinutes + proposedMinutes;
  if (totalPlannedMinutes <= availableMinutes) {
    return null;
  }

  const excessMinutes = totalPlannedMinutes - availableMinutes;
  const message = `This exceeds your weekly budget of ${Math.round(
    availableMinutes / 60,
  )}h by ${excessMinutes} minutes.`;

  return {
    excessMinutes,
    availableMinutes,
    totalPlannedMinutes,
    message,
  };
}
