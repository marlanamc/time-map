import DB, { DB_STORES } from "../db";
import type { WeekReflection } from "../types";

function getReflectionId(weekYear: number, weekNum: number): string {
  return `${weekYear}-W${String(weekNum).padStart(2, "0")}`;
}

export const WeekReflections = {
  getId: getReflectionId,

  async get(weekYear: number, weekNum: number): Promise<WeekReflection | null> {
    try {
      const id = getReflectionId(weekYear, weekNum);
      const existing = await DB.get<WeekReflection>(DB_STORES.WEEK_REFLECTIONS, id);
      return existing ?? null;
    } catch (err) {
      console.warn("[WeekReflections] Failed to load reflection:", err);
      return null;
    }
  },

  async upsert(
    weekYear: number,
    weekNum: number,
    answers: WeekReflection["answers"],
  ): Promise<WeekReflection | null> {
    const now = Date.now();
    const id = getReflectionId(weekYear, weekNum);
    const record: WeekReflection = { id, weekYear, weekNum, createdAt: now, answers };
    try {
      await DB.update(DB_STORES.WEEK_REFLECTIONS, record);
      return record;
    } catch (err) {
      console.warn("[WeekReflections] Failed to save reflection:", err);
      return null;
    }
  },

  async clear(weekYear: number, weekNum: number): Promise<boolean> {
    try {
      const id = getReflectionId(weekYear, weekNum);
      await DB.delete(DB_STORES.WEEK_REFLECTIONS, id);
      return true;
    } catch (err) {
      console.warn("[WeekReflections] Failed to clear reflection:", err);
      return false;
    }
  },
};

