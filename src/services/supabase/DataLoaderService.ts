// Data Loader Service - Orchestrates loading all app data
import { goalsService } from './GoalsService';
import { eventsService } from './EventsService';
import { brainDumpService } from './BrainDumpService';
import { preferencesService } from './PreferencesService';
import { achievementService } from './AchievementService';
import { weeklyReviewService } from './WeeklyReviewService';
import { bodyDoubleService } from './BodyDoubleService';
import { streakService } from './StreakService';
import { authService } from './AuthService';
import type { AppData } from '../../types';

interface AchievementRecord {
  achievement_id: string;
  user_id: string;
  unlocked_at: string;
}

export class DataLoaderService {
  async loadAllData(): Promise<Partial<AppData> | null> {
    const user = await authService.getUser();
    if (!user) return null;

    // Use Promise.allSettled for error-resilient parallel loading
    // If one query fails, others still succeed
    const results = await Promise.allSettled([
      goalsService.getGoals(),
      eventsService.getEvents(),
      brainDumpService.getBrainDump(),
      preferencesService.getPreferencesAndAnalytics(),
      achievementService.getAchievements(),
      weeklyReviewService.getWeeklyReviews(),
      bodyDoubleService.getBodyDoubleHistory(),
      streakService.getStreak()
    ]);

    const [
      goalsResult,
      eventsResult,
      brainDumpResult,
      preferencesResult,
      achievementsResult,
      weeklyReviewsResult,
      bodyDoubleResult,
      streakResult
    ] = results;

    // Extract successful results, use empty arrays for failures
    const goals = goalsResult.status === 'fulfilled' ? goalsResult.value : [];
    const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
    const brainDump = brainDumpResult.status === 'fulfilled' ? brainDumpResult.value : [];
    const preferencesAndAnalytics = preferencesResult.status === 'fulfilled'
      ? preferencesResult.value
      : { preferences: null, analytics: null };
    const achievements = achievementsResult.status === 'fulfilled'
      ? achievementsResult.value.map((a: AchievementRecord) => a.achievement_id)
      : [];
    const weeklyReviews = weeklyReviewsResult.status === 'fulfilled' ? weeklyReviewsResult.value : [];
    const bodyDoubleHistory = bodyDoubleResult.status === 'fulfilled' ? bodyDoubleResult.value : [];
    const streakData = streakResult.status === 'fulfilled' ? streakResult.value : null;

    // Log any failures (non-critical, app still works with partial data)
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const entities = ['goals', 'events', 'brainDump', 'preferences+analytics', 'achievements', 'weeklyReviews', 'bodyDoubleHistory', 'streak'];
        console.warn(`Failed to load ${entities[index]}:`, result.reason);
      }
    });

    return {
      goals,
      events,
      brainDump,
      preferences: preferencesAndAnalytics.preferences || undefined,
      achievements,
      weeklyReviews,
      bodyDoubleHistory,
      ...(preferencesAndAnalytics.analytics ? { analytics: preferencesAndAnalytics.analytics } : {}),
      ...(streakData?.streak ? { streak: streakData.streak } : {})
    };
  }
}

export const dataLoaderService = new DataLoaderService();
