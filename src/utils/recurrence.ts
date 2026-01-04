import type { CalendarEvent, EventRecurrence } from "../types";

export type EventInstance = {
  originalId: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  title: string;
  description?: string;
  recurrence?: EventRecurrence | null;
};

function clampToRange(date: Date, min: Date): Date {
  return date < min ? new Date(min) : date;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function getDurationMs(event: CalendarEvent): number {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : start;
  return Math.max(0, end.getTime() - start.getTime());
}

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return start <= rangeEnd && end >= rangeStart;
}

function normalizeRecurrence(rec: EventRecurrence): Required<Pick<EventRecurrence, "freq">> &
  Pick<EventRecurrence, "until" | "count" | "byWeekday"> & { interval: number } {
  return {
    freq: rec.freq,
    interval: Math.max(1, Math.floor(rec.interval ?? 1)),
    byWeekday: rec.byWeekday,
    until: rec.until,
    count: rec.count,
  };
}

/**
 * Expand a list of events into instances for a given visible range.
 * Recurring expansion is intentionally simple (no external deps).
 */
export function expandEventsForRange(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): EventInstance[] {
  const instances: EventInstance[] = [];

  for (const event of events) {
    const baseStart = new Date(event.startAt);
    const baseDuration = getDurationMs(event);
    const baseEnd = new Date(baseStart.getTime() + baseDuration);

    if (!event.recurrence) {
      if (overlaps(baseStart, baseEnd, rangeStart, rangeEnd)) {
        instances.push({
          originalId: event.id,
          startAt: event.startAt,
          endAt: event.endAt ?? null,
          allDay: event.allDay,
          title: event.title,
          description: event.description,
          recurrence: null,
        });
      }
      continue;
    }

    const rec = normalizeRecurrence(event.recurrence);
    const until = rec.until ? new Date(rec.until) : null;
    const maxCount = rec.count ? Math.max(1, Math.floor(rec.count)) : null;

    let produced = 0;
    const addInstance = (start: Date) => {
      if (maxCount !== null && produced >= maxCount) return false;
      if (until && start > until) return false;
      const end = new Date(start.getTime() + baseDuration);
      if (overlaps(start, end, rangeStart, rangeEnd)) {
        instances.push({
          originalId: event.id,
          startAt: start.toISOString(),
          endAt: event.endAt ? end.toISOString() : null,
          allDay: event.allDay,
          title: event.title,
          description: event.description,
          recurrence: event.recurrence ?? null,
        });
      }
      produced++;
      return true;
    };

    // Generate occurrences. We keep this bounded by jumping near rangeStart.
    switch (rec.freq) {
      case "daily": {
        const daysBetween = Math.floor((rangeStart.getTime() - baseStart.getTime()) / 86400000);
        const steps = daysBetween > 0 ? Math.floor(daysBetween / rec.interval) * rec.interval : 0;
        let cursor = addDays(baseStart, steps);
        cursor = clampToRange(cursor, baseStart);
        while (cursor <= rangeEnd) {
          if (!addInstance(cursor)) break;
          cursor = addDays(cursor, rec.interval);
        }
        break;
      }

      case "weekly": {
        const weekdays = (rec.byWeekday && rec.byWeekday.length > 0)
          ? Array.from(new Set(rec.byWeekday.map((d) => ((d % 7) + 7) % 7))).sort()
          : [baseStart.getDay()];

        // Align to the start of the recurrence week for the base event.
        const baseWeekStart = addDays(baseStart, -baseStart.getDay()); // Sunday-based week anchor
        const rangeWeekStart = addDays(rangeStart, -rangeStart.getDay());
        const weeksBetween = Math.floor((rangeWeekStart.getTime() - baseWeekStart.getTime()) / (7 * 86400000));
        const weekSteps = weeksBetween > 0 ? Math.floor(weeksBetween / rec.interval) * rec.interval : 0;
        let weekCursor = addDays(baseWeekStart, weekSteps * 7);
        weekCursor = clampToRange(weekCursor, baseWeekStart);

        while (weekCursor <= rangeEnd) {
          for (const weekday of weekdays) {
            const start = addDays(weekCursor, weekday);
            // Keep original time-of-day from baseStart.
            start.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds(), baseStart.getMilliseconds());
            if (start < baseStart) continue;
            if (!addInstance(start)) return instances;
          }
          weekCursor = addDays(weekCursor, rec.interval * 7);
        }
        break;
      }

      case "monthly": {
        // Jump close to rangeStart by month difference.
        const monthDiff =
          (rangeStart.getFullYear() - baseStart.getFullYear()) * 12 +
          (rangeStart.getMonth() - baseStart.getMonth());
        const steps = monthDiff > 0 ? Math.floor(monthDiff / rec.interval) * rec.interval : 0;
        let cursor = addMonths(baseStart, steps);
        cursor = clampToRange(cursor, baseStart);
        while (cursor <= rangeEnd) {
          if (!addInstance(cursor)) break;
          cursor = addMonths(cursor, rec.interval);
        }
        break;
      }

      case "yearly": {
        const yearDiff = rangeStart.getFullYear() - baseStart.getFullYear();
        const steps = yearDiff > 0 ? Math.floor(yearDiff / rec.interval) * rec.interval : 0;
        let cursor = addYears(baseStart, steps);
        cursor = clampToRange(cursor, baseStart);
        while (cursor <= rangeEnd) {
          if (!addInstance(cursor)) break;
          cursor = addYears(cursor, rec.interval);
        }
        break;
      }
    }
  }

  instances.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return instances;
}

