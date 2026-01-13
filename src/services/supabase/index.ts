// Supabase Services Facade - Maintains backward compatibility with SupabaseService
import { authService } from './AuthService';
import { goalsService } from './GoalsService';
import { eventsService } from './EventsService';
import { brainDumpService } from './BrainDumpService';
import { preferencesService } from './PreferencesService';
import { analyticsService } from './AnalyticsService';
import { weeklyReviewService } from './WeeklyReviewService';
import { bodyDoubleService } from './BodyDoubleService';
import { streakService } from './StreakService';
import { achievementService } from './AchievementService';
import { dataLoaderService } from './DataLoaderService';

// Re-export individual services
export { authService } from './AuthService';
export { goalsService } from './GoalsService';
export { eventsService } from './EventsService';
export { brainDumpService } from './BrainDumpService';
export { preferencesService } from './PreferencesService';
export { analyticsService } from './AnalyticsService';
export { weeklyReviewService } from './WeeklyReviewService';
export { bodyDoubleService } from './BodyDoubleService';
export { streakService } from './StreakService';
export { achievementService } from './AchievementService';
export { dataLoaderService } from './DataLoaderService';
export { batchOperationsService } from './BatchOperations';

// Facade for legacy code - maintains exact same API as old SupabaseService
export const SupabaseService = {
  // Auth methods
  getUser: authService.getUser.bind(authService),
  signIn: authService.signIn.bind(authService),
  signUp: authService.signUp.bind(authService),
  signOut: authService.signOut.bind(authService),

  // Data loading
  loadAllData: dataLoaderService.loadAllData.bind(dataLoaderService),

  // Goals methods
  getGoals: goalsService.getGoals.bind(goalsService),
  saveGoal: goalsService.saveGoal.bind(goalsService),
  deleteGoal: goalsService.deleteGoal.bind(goalsService),
  saveGoals: goalsService.saveGoals.bind(goalsService),
  diagnosticGetAllGoals: goalsService.diagnosticGetAllGoals.bind(goalsService),

  // Events methods
  getEvents: eventsService.getEvents.bind(eventsService),
  saveEvent: eventsService.saveEvent.bind(eventsService),
  deleteEvent: eventsService.deleteEvent.bind(eventsService),
  saveEvents: eventsService.saveEvents.bind(eventsService),

  // Brain Dump methods
  getBrainDump: brainDumpService.getBrainDump.bind(brainDumpService),
  saveBrainDump: brainDumpService.saveBrainDump.bind(brainDumpService),
  deleteBrainDump: brainDumpService.deleteBrainDump.bind(brainDumpService),
  saveBrainDumpBatch: brainDumpService.saveBrainDumpBatch.bind(brainDumpService),

  // Preferences methods
  getPreferences: preferencesService.getPreferences.bind(preferencesService),
  getPreferencesAndAnalytics: preferencesService.getPreferencesAndAnalytics.bind(preferencesService),
  savePreferences: preferencesService.savePreferences.bind(preferencesService),

  // Analytics methods (via preferences)
  getAnalytics: analyticsService.getAnalytics.bind(analyticsService),
  saveAnalytics: analyticsService.saveAnalytics.bind(analyticsService),

  // Streak methods
  getStreak: streakService.getStreak.bind(streakService),
  saveStreak: streakService.saveStreak.bind(streakService),

  // Achievement methods
  getAchievements: achievementService.getAchievements.bind(achievementService),
  saveAchievement: achievementService.saveAchievement.bind(achievementService),

  // Weekly Review methods
  getWeeklyReviews: weeklyReviewService.getWeeklyReviews.bind(weeklyReviewService),
  saveWeeklyReview: weeklyReviewService.saveWeeklyReview.bind(weeklyReviewService),

  // Body Double methods
  getBodyDoubleHistory: bodyDoubleService.getBodyDoubleHistory.bind(bodyDoubleService),
  saveBodyDoubleSession: bodyDoubleService.saveBodyDoubleSession.bind(bodyDoubleService),

  // Diagnostic methods
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const user = await authService.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { getSupabaseClient } = await import('./client');
      const supabase = await getSupabaseClient();
      
      // Test a simple query on each table
      const testQueries = [
        { name: 'goals', query: supabase.from('goals').select('id').limit(1) },
        { name: 'preferences', query: supabase.from('preferences').select('user_id').eq('user_id', user.id).limit(1) },
      ];

      const results = await Promise.allSettled(
        testQueries.map(t => t.query)
      );

      const failures = results
        .map((result, idx) => ({ table: testQueries[idx].name, result }))
        .filter(({ result }) => result.status === 'rejected');

      if (failures.length > 0) {
        return {
          success: false,
          error: 'Some tables are not accessible',
          details: failures.map(f => ({
            table: f.table,
            error: f.result.status === 'rejected' ? f.result.reason : null
          }))
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unknown error',
        details: err
      };
    }
  }
};
