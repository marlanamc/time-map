import { ND_CONFIG } from "../config/ndConfig";
import type { AccentTheme, Goal } from "../types";
import { getAccentTheme } from "./goalMeta";

export type LinkAccent = { color: string; gradient?: string; key: AccentTheme };

export function resolveVisionForGoal(goal: Goal, goalsById: Map<string, Goal>): Goal | null {
  if (goal.level === "vision") return goal;
  let cursor: Goal | undefined = goal;
  const seen = new Set<string>();
  while (cursor && cursor.parentId) {
    if (seen.has(cursor.id)) break;
    seen.add(cursor.id);
    const parent = goalsById.get(cursor.parentId);
    if (!parent) break;
    if (parent.level === "vision") return parent;
    cursor = parent;
  }
  return null;
}

export function getVisionAccent(vision: Goal): LinkAccent | null {
  const raw = getAccentTheme(vision);
  if (!raw) return null;
  const theme = (ND_CONFIG.ACCENT_THEMES as Record<string, { color: string }>)[raw];
  if (!theme || typeof theme.color !== "string") return null;
  const color = theme.color.trim();
  if (color.startsWith("linear-gradient")) {
    const fallback = (ND_CONFIG.ACCENT_THEMES.sky as any)?.color ?? "#0EA5E9";
    return { key: raw, color: String(fallback), gradient: color };
  }
  return { key: raw, color };
}

export function getInheritedAccent(goal: Goal, goalsById: Map<string, Goal>): LinkAccent | null {
  const vision = resolveVisionForGoal(goal, goalsById);
  if (!vision) return null;
  return getVisionAccent(vision);
}

export function buildAccentAttributes(accent: LinkAccent | null): { dataAttr: string; styleAttr: string } {
  if (!accent) return { dataAttr: "", styleAttr: "" };
  const style = accent.gradient
    ? ` style="--link-accent: ${accent.color}; --link-accent-gradient: ${accent.gradient};"`
    : ` style="--link-accent: ${accent.color};"`;
  return { dataAttr: ` data-link-accent="1"`, styleAttr: style };
}
