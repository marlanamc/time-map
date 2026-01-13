// Weekly Review Service
import { getSupabaseClient } from './client';
import { AuthenticationError, DatabaseError } from '../errors';
import { authService } from './AuthService';
import type { WeeklyReview } from '../../types';
import type { WeeklyReviewRow } from '../../types/database';

export class WeeklyReviewService {
  async getWeeklyReviews(): Promise<WeeklyReview[]> {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.from('weekly_reviews').select('*');
      
      if (error) {
        console.error('[WeeklyReviewService] Failed to get weekly reviews:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to load weekly reviews: ${error.message}`, error);
      }

      if (!data) {
        console.warn('[WeeklyReviewService] getWeeklyReviews returned null data');
        return [];
      }

      const reviews = data.map((w: WeeklyReviewRow) => ({
        id: w.id,
        weekStart: w.week_start,
        weekEnd: w.week_end,
        goalsCompleted: w.goals_completed,
        timeSpent: w.time_spent,
        notes: w.notes,
        createdAt: w.created_at,
        wins: w.wins,
        challenges: w.challenges,
        learnings: w.learnings,
        nextWeekPriorities: w.next_week_priorities,
        mood: w.mood,
        energyAvg: w.energy_avg
      }));

      console.log(`✓ Loaded ${reviews.length} weekly reviews from database`);
      return reviews;
    } catch (err) {
      console.error('[WeeklyReviewService] Error in getWeeklyReviews:', err);
      throw err;
    }
  }

  async saveWeeklyReview(review: WeeklyReview): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      throw new AuthenticationError('Cannot save weekly review: User not authenticated');
    }

    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.from('weekly_reviews').upsert({
        id: review.id,
        user_id: user.id,
        week_start: review.weekStart,
        week_end: review.weekEnd,
        goals_completed: review.goalsCompleted,
        time_spent: review.timeSpent,
        notes: review.notes,
        created_at: review.createdAt,
        wins: review.wins,
        challenges: review.challenges,
        learnings: review.learnings,
        next_week_priorities: review.nextWeekPriorities,
        mood: review.mood,
        energy_avg: review.energyAvg
      });
      
      if (error) {
        console.error('[WeeklyReviewService] Failed to save weekly review:', {
          reviewId: review.id,
          weekStart: review.weekStart,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to save weekly review: ${error.message}`, error);
      }

      console.log(`✓ Saved weekly review: ${review.id}`);
    } catch (err) {
      console.error('[WeeklyReviewService] Error in saveWeeklyReview:', err);
      throw err;
    }
  }
}

export const weeklyReviewService = new WeeklyReviewService();
