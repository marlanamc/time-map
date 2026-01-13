import { SupabaseService } from "./supabase";

export async function warmCache(userId: string): Promise<void> {
  console.log(`🔥 Warming cache for user: ${userId}`);

  try {
    await Promise.allSettled([
      SupabaseService.getGoals(),
      SupabaseService.getEvents(),
      SupabaseService.getPreferences(),
      SupabaseService.getAchievements(),
    ]);
    console.log("✓ Cache warmed successfully");
  } catch (error) {
    console.warn("Cache warming failed (non-critical):", error);
  }
}
