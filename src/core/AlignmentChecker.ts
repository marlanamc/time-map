/**
 * Alignment Checker Module
 * Analyzes vision-to-action alignment by checking if visions have
 * active milestones, focuses, and recent activity.
 */

import type { Goal, GoalLevel, GoalState } from "../types";
import { Goals } from "./Goals";
import { computeGoalState } from "./GoalStateComputation";

/** Types of alignment gaps that can be detected */
export type AlignmentGapType =
  | "none"
  | "no-milestone"
  | "no-focus"
  | "no-activity"
  | "all-dormant";

/**
 * Alignment status for a single vision
 */
export interface AlignmentStatus {
  visionId: string;
  visionTitle: string;
  visionState: GoalState;
  hasActiveMilestone: boolean;
  hasActiveFocus: boolean;
  hasRecentActivity: boolean;
  gapType: AlignmentGapType;
  /** Milestones under this vision */
  milestones: Goal[];
  /** Focuses under this vision (via milestones) */
  focuses: Goal[];
  /** Intentions under this vision (via focuses) */
  intentions: Goal[];
  /** Count of dormant goals in the hierarchy */
  dormantCount: number;
}

/**
 * Summary of overall alignment across all visions
 */
export interface AlignmentSummary {
  totalVisions: number;
  alignedVisions: number;
  visionsWithGaps: number;
  dormantVisions: number;
  commonGaps: AlignmentGapType[];
}

/**
 * Get all children of a goal at a specific level
 */
function getChildrenAtLevel(parentId: string, level: GoalLevel): Goal[] {
  const allGoals = Goals.getAll();
  return allGoals.filter(
    (g) => g.parentId === parentId && g.level === level && !g.archivedAt
  );
}

/**
 * Get all descendants of a goal organized by level
 */
function getDescendantsByLevel(visionId: string): {
  milestones: Goal[];
  focuses: Goal[];
  intentions: Goal[];
} {
  const milestones = getChildrenAtLevel(visionId, "milestone");
  const focuses: Goal[] = [];
  const intentions: Goal[] = [];

  for (const milestone of milestones) {
    const milestoneFocuses = getChildrenAtLevel(milestone.id, "focus");
    focuses.push(...milestoneFocuses);

    for (const focus of milestoneFocuses) {
      const focusIntentions = getChildrenAtLevel(focus.id, "intention");
      intentions.push(...focusIntentions);
    }
  }

  return { milestones, focuses, intentions };
}

/**
 * Check if any goals in an array are active
 */
function hasActiveGoal(goals: Goal[]): boolean {
  return goals.some((g) => computeGoalState(g) === "active");
}

/**
 * Check if any goals in an array have recent activity (active or resting)
 */
function hasRecentActivityGoal(goals: Goal[]): boolean {
  return goals.some((g) => {
    const state = computeGoalState(g);
    return state === "active" || state === "resting";
  });
}

/**
 * Count dormant goals in an array
 */
function countDormant(goals: Goal[]): number {
  return goals.filter((g) => computeGoalState(g) === "dormant").length;
}

/**
 * Determine the gap type for a vision based on its hierarchy
 */
function determineGapType(
  visionState: GoalState,
  _hasActiveMilestone: boolean,
  _hasActiveFocus: boolean,
  hasRecentActivity: boolean,
  milestones: Goal[],
  focuses: Goal[]
): AlignmentGapType {
  // If vision itself is dormant and all children are dormant
  if (visionState === "dormant") {
    const allDormant =
      milestones.every((m) => computeGoalState(m) === "dormant") &&
      focuses.every((f) => computeGoalState(f) === "dormant");
    if (allDormant && milestones.length > 0) {
      return "all-dormant";
    }
  }

  // No milestones at all
  if (milestones.length === 0) {
    return "no-milestone";
  }

  // Has milestones but no focuses
  if (focuses.length === 0) {
    return "no-focus";
  }

  // Has structure but no recent activity
  if (!hasRecentActivity) {
    return "no-activity";
  }

  return "none";
}

/**
 * Check alignment for a single vision
 */
export function checkVisionAlignment(vision: Goal): AlignmentStatus {
  if (vision.level !== "vision") {
    throw new Error(
      `checkVisionAlignment requires a vision-level goal, got: ${vision.level}`
    );
  }

  const visionState = computeGoalState(vision);
  const { milestones, focuses, intentions } = getDescendantsByLevel(vision.id);

  const hasActiveMilestone = hasActiveGoal(milestones);
  const hasActiveFocus = hasActiveGoal(focuses);
  const hasRecentActivity =
    hasRecentActivityGoal(milestones) ||
    hasRecentActivityGoal(focuses) ||
    hasRecentActivityGoal(intentions);

  const dormantCount =
    countDormant(milestones) + countDormant(focuses) + countDormant(intentions);

  const gapType = determineGapType(
    visionState,
    hasActiveMilestone,
    hasActiveFocus,
    hasRecentActivity,
    milestones,
    focuses
  );

  return {
    visionId: vision.id,
    visionTitle: vision.title,
    visionState,
    hasActiveMilestone,
    hasActiveFocus,
    hasRecentActivity,
    gapType,
    milestones,
    focuses,
    intentions,
    dormantCount,
  };
}

/**
 * Check alignment for all visions
 * Returns a Map of vision ID to AlignmentStatus
 */
export function checkAllVisions(
  visions?: Goal[]
): Map<string, AlignmentStatus> {
  const allVisions =
    visions ?? Goals.getAll().filter((g) => g.level === "vision");
  const results = new Map<string, AlignmentStatus>();

  for (const vision of allVisions) {
    if (vision.level === "vision" && !vision.archivedAt) {
      results.set(vision.id, checkVisionAlignment(vision));
    }
  }

  return results;
}

/**
 * Get a summary of alignment across all visions
 */
export function getAlignmentSummary(
  alignmentMap?: Map<string, AlignmentStatus>
): AlignmentSummary {
  const map = alignmentMap ?? checkAllVisions();

  let alignedVisions = 0;
  let visionsWithGaps = 0;
  let dormantVisions = 0;
  const gapCounts: Record<AlignmentGapType, number> = {
    none: 0,
    "no-milestone": 0,
    "no-focus": 0,
    "no-activity": 0,
    "all-dormant": 0,
  };

  for (const status of map.values()) {
    if (status.gapType === "none") {
      alignedVisions++;
    } else {
      visionsWithGaps++;
    }

    if (status.visionState === "dormant") {
      dormantVisions++;
    }

    gapCounts[status.gapType]++;
  }

  // Find the most common gaps (excluding "none")
  const commonGaps = (
    Object.entries(gapCounts) as [AlignmentGapType, number][]
  )
    .filter(([type, count]) => type !== "none" && count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  return {
    totalVisions: map.size,
    alignedVisions,
    visionsWithGaps,
    dormantVisions,
    commonGaps,
  };
}

/**
 * Get visions that need attention (have gaps or are dormant)
 */
export function getVisionsNeedingAttention(): AlignmentStatus[] {
  const alignmentMap = checkAllVisions();
  const needsAttention: AlignmentStatus[] = [];

  for (const status of alignmentMap.values()) {
    if (status.gapType !== "none" || status.visionState === "dormant") {
      needsAttention.push(status);
    }
  }

  // Sort by severity: dormant first, then by gap type
  return needsAttention.sort((a, b) => {
    // Dormant visions first
    if (a.visionState === "dormant" && b.visionState !== "dormant") return -1;
    if (b.visionState === "dormant" && a.visionState !== "dormant") return 1;

    // Then by gap severity
    const gapPriority: Record<AlignmentGapType, number> = {
      "all-dormant": 0,
      "no-milestone": 1,
      "no-focus": 2,
      "no-activity": 3,
      none: 4,
    };
    return gapPriority[a.gapType] - gapPriority[b.gapType];
  });
}

/**
 * Get all dormant goals across the hierarchy (for Weekly Review)
 */
export function getAllDormantGoals(): Goal[] {
  const allGoals = Goals.getAll();
  return allGoals.filter(
    (g) => !g.archivedAt && computeGoalState(g) === "dormant"
  );
}

/**
 * Get dormant goals grouped by vision
 */
export function getDormantGoalsByVision(): Map<string, Goal[]> {
  const result = new Map<string, Goal[]>();
  const dormantGoals = getAllDormantGoals();

  for (const goal of dormantGoals) {
    // Find the vision ancestor
    let current: Goal | undefined = goal;
    let visionId: string | null = null;

    while (current) {
      if (current.level === "vision") {
        visionId = current.id;
        break;
      }
      if (current.parentId) {
        current = Goals.getAll().find((g) => g.id === current!.parentId);
      } else {
        break;
      }
    }

    if (visionId) {
      const existing = result.get(visionId) ?? [];
      existing.push(goal);
      result.set(visionId, existing);
    } else if (goal.level === "vision") {
      // The vision itself is dormant
      const existing = result.get(goal.id) ?? [];
      existing.push(goal);
      result.set(goal.id, existing);
    }
  }

  return result;
}

/**
 * Get a human-readable description of an alignment gap
 */
export function describeGap(status: AlignmentStatus): string {
  switch (status.gapType) {
    case "none":
      return "Well aligned with active work";
    case "no-milestone":
      return "No milestones yet — consider breaking this vision into monthly milestones";
    case "no-focus":
      return "Has milestones but no weekly focuses — what could you work on this week?";
    case "no-activity":
      return "Has structure but no recent activity — ready to re-engage?";
    case "all-dormant":
      return "All goals under this vision are dormant — want to rest it officially?";
  }
}

/**
 * Get a suggested action for an alignment gap
 */
export function suggestAction(status: AlignmentStatus): string {
  switch (status.gapType) {
    case "none":
      return "Keep up the good work";
    case "no-milestone":
      return "Add a milestone for this month";
    case "no-focus":
      return "Create a focus for this week";
    case "no-activity":
      return "Schedule some time this week";
    case "all-dormant":
      return "Rest officially or revive";
  }
}
