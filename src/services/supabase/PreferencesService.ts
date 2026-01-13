// Preferences and Analytics Service
import { getSupabaseClient } from './client';
import { cacheService } from '../CacheService';
import { AuthenticationError, DatabaseError } from '../errors';
import { authService } from './AuthService';
import type { Preferences, Analytics } from '../../types';

export class PreferencesService {
  async getPreferencesAndAnalytics(): Promise<{ preferences: Preferences | null; analytics: Analytics | null }> {
    const user = await authService.getUser();
    if (!user) return { preferences: null, analytics: null };

    const cacheKey = `preferences:${user.id}`;
    const cached = cacheService.get<{ preferences: Preferences | null; analytics: Analytics | null }>(cacheKey);

    if (cached) {
      console.log('✓ Preferences loaded from cache');
      return cached;
    }

    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('preferences')
        .select('data')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows found" - this is expected for new users
        console.error('[PreferencesService] Failed to get preferences:', {
          userId: user.id,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to load preferences: ${error.message}`, error);
      }

      const blob = data ? (data.data as Record<string, unknown>) : null;
      const preferences = blob ? (blob as unknown as Preferences) : null;
      const analyticsCandidate =
        blob && typeof (blob as Record<string, unknown>)['_analytics'] === 'object'
          ? ((blob as Record<string, unknown>)['_analytics'] as Analytics)
          : null;

      // Strip non-preference properties
      const { _analytics: _ignored, ...prefsWithoutAnalytics } = (blob || {}) as Record<string, unknown>;
      const safePreferences = preferences ? (prefsWithoutAnalytics as unknown as Preferences) : null;

      const result = { preferences: safePreferences, analytics: analyticsCandidate };
      if (safePreferences) {
        cacheService.set(cacheKey, result, cacheService.TTL.PREFERENCES);
        console.log('✓ Loaded preferences from database');
      } else {
        console.log('✓ No preferences found (new user)');
      }

      return result;
    } catch (err) {
      console.error('[PreferencesService] Error in getPreferences:', err);
      throw err;
    }
  }

  async getPreferences(): Promise<Preferences | null> {
    const { preferences } = await this.getPreferencesAndAnalytics();
    return preferences;
  }

  async savePreferences(prefs: Preferences, analytics?: Analytics): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      throw new AuthenticationError('Cannot save preferences: User not authenticated');
    }

    try {
      const supabase = await getSupabaseClient();
      const data = analytics ? { ...prefs, _analytics: analytics } : prefs;
      const { error } = await supabase
        .from('preferences')
        .upsert({
          user_id: user.id,
          data,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('[PreferencesService] Failed to save preferences:', {
          userId: user.id,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to save preferences: ${error.message}`, error);
      }

      // Invalidate preferences cache after save
      cacheService.invalidate(/^preferences:/);
      console.log('✓ Saved preferences to database');
    } catch (err) {
      console.error('[PreferencesService] Error in savePreferences:', err);
      throw err;
    }
  }
}

export const preferencesService = new PreferencesService();
