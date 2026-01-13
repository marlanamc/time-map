// Analytics Service (delegates to PreferencesService since analytics are stored with preferences)
import { preferencesService } from './PreferencesService';
import type { Analytics } from '../../types';

export class AnalyticsService {
  async getAnalytics(): Promise<Analytics | null> {
    const { analytics } = await preferencesService.getPreferencesAndAnalytics();
    return analytics;
  }

  async saveAnalytics(analytics: Analytics): Promise<void> {
    const preferences = await preferencesService.getPreferences();
    await preferencesService.savePreferences(preferences || {} as any, analytics);
  }
}

export const analyticsService = new AnalyticsService();
