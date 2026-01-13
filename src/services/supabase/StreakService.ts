// Streak Service
import { getSupabaseClient } from './client';
import { AuthenticationError, DatabaseError } from '../errors';
import { authService } from './AuthService';
import type { Streak } from '../../types';
import type { StreakRow } from '../../types/database';

export class StreakService {
  async getStreak(): Promise<{ streak: Streak; bestStreak: number } | null> {
    const user = await authService.getUser();
    if (!user) return null;

    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[StreakService] Failed to get streak:', {
          userId: user.id,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to load streak: ${error.message}`, error);
      }

      if (!data) return null;

      const row = data as StreakRow;
      const lastDate = row.last_date ? String(row.last_date).split('T')[0] : null;
      return {
        streak: {
          count: row.count ?? 0,
          lastDate
        },
        bestStreak: row.best_streak ?? 0
      };
    } catch (err) {
      console.error('[StreakService] Error in getStreak:', err);
      throw err;
    }
  }

  async saveStreak(streak: Streak, bestStreak?: number): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      throw new AuthenticationError('Cannot save streak: User not authenticated');
    }

    try {
      const supabase = await getSupabaseClient();
      const payload: Record<string, unknown> = {
        user_id: user.id,
        count: streak.count ?? 0,
        last_date: streak.lastDate ?? null,
        updated_at: new Date().toISOString()
      };
      if (bestStreak !== undefined) {
        payload.best_streak = bestStreak;
      }

      const { error } = await supabase
        .from('streaks')
        .upsert(payload);

      if (error) {
        console.error('[StreakService] Failed to save streak:', {
          userId: user.id,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to save streak: ${error.message}`, error);
      }
    } catch (err) {
      console.error('[StreakService] Error in saveStreak:', err);
      throw err;
    }
  }
}

export const streakService = new StreakService();
