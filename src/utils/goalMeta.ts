import type { AccentTheme, Goal, GoalMeta } from "../types";

const INTERNAL_TAG_PREFIX = "__tm:";

function parseLegacyDescriptionField(description: string | undefined, label: string): string | undefined {
  if (!description) return undefined;

  const normalizedLabel = label.toLowerCase();
  for (const rawLine of description.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const lower = line.toLowerCase();
    if (!lower.startsWith(normalizedLabel)) continue;

    const remainder = line.slice(normalizedLabel.length).trim();
    const value = remainder.replace(/^[\s:-]+/, "").trim();
    if (value) return value;
  }
  return undefined;
}

export function getInternalTagValue(tags: string[] | undefined, key: string): string | undefined {
  if (!tags || tags.length === 0) return undefined;
  const prefix = `${INTERNAL_TAG_PREFIX}${key}=`;
  const tag = tags.find((value) => value.startsWith(prefix));
  return tag ? tag.slice(prefix.length) : undefined;
}

export function parseYmdLocal(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(year, monthIndex, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function extractMetaFromLegacy(goal: Goal): GoalMeta {
  const baseMeta: GoalMeta = goal.meta ? { ...goal.meta } : {};

  const tinyLegacy = parseLegacyDescriptionField(goal.description, "tiny version");
  if (tinyLegacy && !baseMeta.tinyVersion) {
    baseMeta.tinyVersion = tinyLegacy;
  }

  const lowEnergyLegacy = parseLegacyDescriptionField(goal.description, "low-energy version");
  if (lowEnergyLegacy && !baseMeta.lowEnergyVersion) {
    baseMeta.lowEnergyVersion = lowEnergyLegacy;
  }

  const startTag = getInternalTagValue(goal.tags, "start");
  if (startTag && !baseMeta.startDate) {
    baseMeta.startDate = startTag;
  }

  const accentTag = getInternalTagValue(goal.tags, "accent");
  if (accentTag && !baseMeta.accentTheme) {
    baseMeta.accentTheme = accentTag as AccentTheme;
  }

  const easyModeTag = getInternalTagValue(goal.tags, "easymode");
  if (easyModeTag === "1" && baseMeta.easyMode === undefined) {
    baseMeta.easyMode = true;
  }

  return baseMeta;
}

export function getFocusStartDate(goal: Goal): Date | null {
  const meta = extractMetaFromLegacy(goal);
  if (meta.startDate) {
    const parsed = parseYmdLocal(meta.startDate);
    if (parsed) return parsed;
  }

  const legacyStart = getInternalTagValue(goal.tags, "start");
  if (legacyStart) {
    const parsed = parseYmdLocal(legacyStart);
    if (parsed) return parsed;
  }

  return null;
}

export function getAccentTheme(goal: Goal): AccentTheme | undefined {
  const meta = extractMetaFromLegacy(goal);
  if (meta.accentTheme) return meta.accentTheme;
  const legacyAccent = getInternalTagValue(goal.tags, "accent");
  return legacyAccent ? (legacyAccent as AccentTheme) : undefined;
}

export function isEasyModeEnabled(goal: Goal): boolean {
  const meta = extractMetaFromLegacy(goal);
  if (typeof meta.easyMode === "boolean") return meta.easyMode;
  const legacyEasy = getInternalTagValue(goal.tags, "easymode");
  return legacyEasy === "1";
}
