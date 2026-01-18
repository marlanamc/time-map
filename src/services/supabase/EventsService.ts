// Events Service
import { getSupabaseClient } from "./client";
import { cacheService } from "../CacheService";
import { AuthenticationError, DatabaseError } from "../errors";
import { authService } from "./AuthService";
import type { CalendarEvent } from "../../types";
import type { EventRow } from "../../types/database";

export class EventsService {
  async getEvents(): Promise<CalendarEvent[]> {
    const user = await authService.getUser();
    const cacheKey = user ? `events:${user.id}` : "events:anonymous";
    const cached = cacheService.get<CalendarEvent[]>(cacheKey);
    if (cached) return cached;

    if (!user) {
      console.warn(
        "[EventsService] getEvents called without authenticated user; returning empty array",
      );
      return [];
    }

    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_at", { ascending: true });

      if (error) {
        console.error("[EventsService] Failed to get events:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw new DatabaseError(
          `Failed to load events: ${error.message}`,
          error,
        );
      }

      const events = (data || []).map((e: EventRow) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startAt: e.start_at,
        endAt: e.end_at ?? null,
        allDay: !!e.all_day,
        recurrence: (e.recurrence as any) ?? null,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        archivedAt: e.archived_at ?? null,
      }));

      cacheService.set(cacheKey, events, cacheService.TTL.GOALS);
      return events;
    } catch (err) {
      console.error("[EventsService] Error in getEvents:", err);
      throw err;
    }
  }

  async saveEvent(event: CalendarEvent): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      throw new AuthenticationError(
        "Cannot save event: User not authenticated",
      );
    }

    try {
      const supabase = await getSupabaseClient();
      const payload = {
        id: event.id,
        user_id: user.id,
        title: event.title,
        description: event.description || null,
        start_at: event.startAt,
        end_at: event.endAt ?? null,
        all_day: !!event.allDay,
        recurrence: event.recurrence ?? null,
        created_at: event.createdAt,
        updated_at: event.updatedAt,
        archived_at: event.archivedAt ?? null,
      };

      const { error } = await supabase
        .from("events")
        .upsert(payload, { onConflict: "id", ignoreDuplicates: false });

      if (error) {
        console.error("[EventsService] Failed to save event:", {
          eventId: event.id,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw new DatabaseError(
          `Failed to save event "${event.title}": ${error.message}`,
          error,
        );
      }

      cacheService.invalidate(/^events:/);
    } catch (err) {
      console.error("[EventsService] Error in saveEvent:", err);
      throw err;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (error) {
        console.error("[EventsService] Failed to delete event:", {
          eventId,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw new DatabaseError(
          `Failed to delete event: ${error.message}`,
          error,
        );
      }

      cacheService.invalidate(/^events:/);
    } catch (err) {
      console.error("[EventsService] Error in deleteEvent:", err);
      throw err;
    }
  }

  async saveEvents(events: CalendarEvent[]): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      throw new AuthenticationError(
        "Cannot batch save events: User not authenticated",
      );
    }

    try {
      const supabase = await getSupabaseClient();
      const payload = events.map((event) => ({
        id: event.id,
        user_id: user.id,
        title: event.title,
        description: event.description || null,
        start_at: event.startAt,
        end_at: event.endAt ?? null,
        all_day: !!event.allDay,
        recurrence: event.recurrence ?? null,
        created_at: event.createdAt,
        updated_at: event.updatedAt,
        archived_at: event.archivedAt ?? null,
      }));

      const { error } = await supabase
        .from("events")
        .upsert(payload, { onConflict: "id", ignoreDuplicates: false });

      if (error) {
        console.error("[EventsService] Failed to batch save events:", {
          count: events.length,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw new DatabaseError(
          `Failed to batch save events: ${error.message}`,
          error,
        );
      }

      cacheService.invalidate(/^events:/);
    } catch (err) {
      console.error("[EventsService] Error in saveEvents:", err);
      throw err;
    }
  }
}

export const eventsService = new EventsService();
