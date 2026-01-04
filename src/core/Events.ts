// ===================================
// Calendar Event Management
// ===================================
import type { CalendarEvent, EventRecurrence } from "../types";
import { State } from "./State";
import { SupabaseService } from "../services/SupabaseService";
import { dirtyTracker } from "../services/DirtyTracker";
import { debouncedEventSync } from "../utils/syncHelpers";
import DB, { DB_STORES } from "../db";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function overlapsRange(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): boolean {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : start;
  return start <= rangeEnd && end >= rangeStart;
}

function persistToIndexedDb(event: CalendarEvent): void {
  void DB.update(DB_STORES.EVENTS, event).catch((err: unknown) => {
    console.warn("[Events] Failed to persist event to IndexedDB:", err);
  });
}

function deleteFromIndexedDb(eventId: string): void {
  void DB.delete(DB_STORES.EVENTS, eventId).catch((err: unknown) => {
    console.warn("[Events] Failed to delete event from IndexedDB:", err);
  });
}

export const Events = {
  getAll(): CalendarEvent[] {
    if (!State.data) return [];
    return State.data.events ?? [];
  },

  getForRange(rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
    if (!State.data) return [];
    const start = startOfDay(rangeStart);
    const end = endOfDay(rangeEnd);
    return (State.data.events ?? []).filter((e) => overlapsRange(e, start, end));
  },

  create(input: {
    title: string;
    startAt: string;
    endAt?: string | null;
    allDay?: boolean;
    description?: string;
    recurrence?: EventRecurrence | null;
  }): CalendarEvent {
    const nowIso = new Date().toISOString();
    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description || "",
      startAt: input.startAt,
      endAt: input.endAt ?? null,
      allDay: !!input.allDay,
      recurrence: input.recurrence ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (!State.data) return event;
    State.data.events.push(event);
    State.save();
    persistToIndexedDb(event);

    (async () => {
      try {
        await SupabaseService.saveEvent(event);
        dirtyTracker.markClean("event", event.id);
      } catch (error) {
        console.error("Failed to sync new event:", error);
        dirtyTracker.markDirty("event", event.id);
        debouncedEventSync(event);
      }
    })();

    return event;
  },

  update(eventId: string, updates: Partial<CalendarEvent>): CalendarEvent | null {
    if (!State.data) return null;
    const event = State.data.events.find((e) => e.id === eventId);
    if (!event) return null;

    Object.assign(event, updates, { updatedAt: new Date().toISOString() });
    State.save();
    persistToIndexedDb(event);
    dirtyTracker.markDirty("event", eventId);
    debouncedEventSync(event);
    return event;
  },

  delete(eventId: string): void {
    if (!State.data) return;
    State.data.events = State.data.events.filter((e) => e.id !== eventId);
    State.save();
    deleteFromIndexedDb(eventId);
    SupabaseService.deleteEvent(eventId).catch((err) =>
      console.error("Failed to delete event from cloud", err),
    );
  },
};

