/**
 * Capacity Check Service
 *
 * Handles persistence of capacity check results to Supabase.
 * Stores one check per user per day (upserts on re-check).
 */

import { getSupabaseClient } from "./client";
import { authService } from "./AuthService";
import { DatabaseError, AuthenticationError } from "../errors";

export interface CapacityCheckRecord {
  id?: string;
  userId?: string;
  checkDate: string; // YYYY-MM-DD format
  capacityLevel: "high" | "medium" | "low" | "rest";
  energyType: "focus" | "creative" | "rest" | "admin";
  availableMinutes: number;
  summary: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CapacityCheckRow {
  id: string;
  user_id: string;
  check_date: string;
  capacity_level: string;
  energy_type: string;
  available_minutes: number;
  summary: string;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to app record
 */
function rowToRecord(row: CapacityCheckRow): CapacityCheckRecord {
  return {
    id: row.id,
    userId: row.user_id,
    checkDate: row.check_date,
    capacityLevel: row.capacity_level as CapacityCheckRecord["capacityLevel"],
    energyType: row.energy_type as CapacityCheckRecord["energyType"],
    availableMinutes: row.available_minutes,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert app record to database row for insert/update
 */
function recordToRow(
  record: CapacityCheckRecord,
  userId: string,
): Partial<CapacityCheckRow> {
  return {
    user_id: userId,
    check_date: record.checkDate,
    capacity_level: record.capacityLevel,
    energy_type: record.energyType,
    available_minutes: record.availableMinutes,
    summary: record.summary,
  };
}

class CapacityCheckService {
  /**
   * Save or update today's capacity check
   * Uses upsert to replace any existing check for today
   */
  async saveCheck(record: CapacityCheckRecord): Promise<void> {
    const supabase = await getSupabaseClient();
    const user = await authService.getUser();

    if (!user) {
      throw new AuthenticationError("Must be logged in to save capacity check");
    }

    const row = recordToRow(record, user.id);

    const { error } = await supabase.from("capacity_checks").upsert(row, {
      onConflict: "user_id,check_date",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("[CapacityCheckService] Save error:", error);
      throw new DatabaseError(
        `Failed to save capacity check: ${error.message}`,
      );
    }
  }

  /**
   * Get today's capacity check for the current user
   */
  async getTodayCheck(): Promise<CapacityCheckRecord | null> {
    const supabase = await getSupabaseClient();
    const user = await authService.getUser();

    if (!user) {
      return null; // Not logged in, no remote data
    }

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("capacity_checks")
      .select("*")
      .eq("user_id", user.id)
      .eq("check_date", today)
      .maybeSingle();

    if (error) {
      console.error("[CapacityCheckService] Fetch error:", error);
      return null; // Fail gracefully
    }

    if (!data) {
      return null;
    }

    return rowToRecord(data as CapacityCheckRow);
  }

  /**
   * Get recent capacity checks for the current user (for future analytics)
   */
  async getRecentChecks(days: number = 7): Promise<CapacityCheckRecord[]> {
    const supabase = await getSupabaseClient();
    const user = await authService.getUser();

    if (!user) {
      return [];
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("capacity_checks")
      .select("*")
      .eq("user_id", user.id)
      .gte("check_date", startDateStr)
      .order("check_date", { ascending: false });

    if (error) {
      console.error("[CapacityCheckService] Fetch recent error:", error);
      return [];
    }

    return (data as CapacityCheckRow[]).map(rowToRecord);
  }
}

export const capacityCheckService = new CapacityCheckService();
