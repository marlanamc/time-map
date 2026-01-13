// Achievement Service
import { getSupabaseClient } from './client';
import { AuthenticationError, DatabaseError } from '../errors';
import { authService } from './AuthService';

interface AchievementRecord {
  achievement_id: string;
  user_id: string;
  unlocked_at: string;
}

export class AchievementService {
  async getAchievements(): Promise<AchievementRecord[]> {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.from('achievements').select('*');
      
      if (error) {
        console.error('[AchievementService] Failed to get achievements:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to load achievements: ${error.message}`, error);
      }

      if (!data) {
        console.warn('[AchievementService] getAchievements returned null data');
        return [];
      }

      console.log(`✓ Loaded ${data.length} achievements from database`);
      return data;
    } catch (err) {
      console.error('[AchievementService] Error in getAchievements:', err);
      throw err;
    }
  }

  async saveAchievement(achievementId: string): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      throw new AuthenticationError('Cannot save achievement: User not authenticated');
    }

    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.from('achievements').upsert({
        user_id: user.id,
        achievement_id: achievementId,
        unlocked_at: new Date().toISOString()
      });
      
      if (error) {
        console.error('[AchievementService] Failed to save achievement:', {
          userId: user.id,
          achievementId,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to save achievement: ${error.message}`, error);
      }

      console.log(`✓ Saved achievement: ${achievementId}`);
    } catch (err) {
      console.error('[AchievementService] Error in saveAchievement:', err);
      throw err;
    }
  }
}

export const achievementService = new AchievementService();
