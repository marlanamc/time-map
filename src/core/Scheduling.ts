import { Goals } from "./Goals";
import { parseYmdLocal } from "../utils/goalMeta";
import type { Goal } from "../types";

export type IntentionInstance = {
  id: string;
  goalId: string;
  date: string;
  time: string | null;
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseGoalStartDate(goal: Goal): Date | null {
  const candidate = goal.startDate ?? goal.commitment?.startDate ?? null;
  if (!candidate) return null;
  const parsed = parseYmdLocal(candidate);
  if (!parsed) return null;
  return startOfDay(parsed);
}

function makeInstance(goal: Goal, dateKey: string): IntentionInstance {
  return {
    id: `${goal.id}:${dateKey}`,
    goalId: goal.id,
    date: dateKey,
    time: goal.startTime?.trim() ? goal.startTime : null,
  };
}

export function getIntentionInstancesForRange(
  start: Date,
  end: Date,
): IntentionInstance[] {
  const rangeStart = startOfDay(start);
  const rangeEnd = endOfDay(end);
  const items: IntentionInstance[] = [];

  const intentions = Goals.getAll().filter(
    (goal) =>
      goal.level === "intention" &&
      !goal.archivedAt &&
      goal.status !== "done" &&
      goal.status !== "cancelled",
  );

  for (const goal of intentions) {
    const goalStart = parseGoalStartDate(goal);
    const anchor = goalStart ?? rangeStart;
    const effectiveStart = anchor.getTime() > rangeStart.getTime()
      ? anchor
      : rangeStart;
    const goalDue = goal.dueDate ? endOfDay(new Date(goal.dueDate)) : rangeEnd;
    const effectiveEnd = goalDue < rangeEnd ? goalDue : rangeEnd;
    if (effectiveEnd < effectiveStart) continue;

    const candidateSpecificDays = goal.commitment?.specificDays;
    const normalizedDays = Array.isArray(candidateSpecificDays)
      ? Array.from(new Set(candidateSpecificDays))
        .map((day) => ((day % 7) + 7) % 7)
        .filter((day) => Number.isFinite(day) && day >= 0 && day <= 6)
      : [];

    if (normalizedDays.length > 0) {
      let cursor = startOfDay(effectiveStart);
      while (cursor <= effectiveEnd) {
        if (rangeStart <= cursor && cursor <= rangeEnd) {
          if (normalizedDays.includes(cursor.getDay())) {
            const dateKey = formatYmd(cursor);
            items.push(makeInstance(goal, dateKey));
          }
        }
        cursor = addDays(cursor, 1);
      }
      continue;
    }

    if (goalStart && goalStart >= rangeStart && goalStart <= rangeEnd) {
      const dateKey = formatYmd(goalStart);
      items.push(makeInstance(goal, dateKey));
      continue;
    }

    if (goal.dueDate) {
      const due = startOfDay(new Date(goal.dueDate));
      if (due >= rangeStart && due <= rangeEnd) {
        const dateKey = formatYmd(due);
        items.push(makeInstance(goal, dateKey));
      }
    }
  }

  return items;
}

export function getIntentionInstancesForDate(date: Date): IntentionInstance[] {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  return getIntentionInstancesForRange(dayStart, dayEnd);
}
