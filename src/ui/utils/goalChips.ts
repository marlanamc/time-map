import { Goals } from "../../core/Goals";
import { escapeHtml } from "./DOMUtils";
import type { Goal } from "../../types";

export type GoalChip = {
  id: string;
  emoji: string;
  label: string;
  level: Goal["level"];
};

const CHIP_ORDER: Goal["level"][] = ["vision", "milestone", "focus"];

export function getLinkedGoalChips(intention: Goal): GoalChip[] {
  if (intention.level !== "intention") return [];

  const linked: Goal[] = [];
  let current = Goals.getById(intention.parentId ?? "");
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.level === "focus" || current.level === "milestone" || current.level === "vision") {
      linked.push(current);
    }
    if (!current.parentId) break;
    current = Goals.getById(current.parentId);
  }

  const chips: GoalChip[] = [];
  for (const goal of linked) {
    const emoji = goal.icon?.trim() ?? "";
    if (!emoji) continue;
    chips.push({
      id: goal.id,
      emoji,
      label: goal.title,
      level: goal.level,
    });
  }

  chips.sort((a, b) => {
    const aIndex = CHIP_ORDER.indexOf(a.level);
    const bIndex = CHIP_ORDER.indexOf(b.level);
    return aIndex - bIndex;
  });

  return chips.slice(0, 3);
}

export function renderGoalChips(
  chips: GoalChip[],
  options?: { compact?: boolean },
): string {
  if (!chips.length) return "";

  const compact = options?.compact ?? false;

  const chipHtml = chips
    .map((chip) => {
      const emoji = escapeHtml(chip.emoji);
      const label = escapeHtml(chip.label);
      const id = escapeHtml(chip.id);
      const level = escapeHtml(chip.level);
      if (compact) {
        return `<span class="goal-chip goal-chip-compact" data-goal-id="${id}" data-goal-level="${level}" title="${label}">${emoji}</span>`;
      }
      return `
        <span class="goal-chip" data-goal-id="${id}" data-goal-level="${level}" title="${label}">
          <span class="goal-chip-emoji">${emoji}</span>
          <span class="goal-chip-label">${label}</span>
        </span>
      `;
    })
    .join("");

  return `<div class="goal-chip-row">${chipHtml}</div>`;
}
