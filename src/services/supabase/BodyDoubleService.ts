// Body Double Session Service
import { getSupabaseClient } from './client';
import { AuthenticationError, DatabaseError } from '../errors';
import { authService } from './AuthService';
import type { BodyDoubleSession } from '../../types';
import type { BodyDoubleSessionRow } from '../../types/database';

export class BodyDoubleService {
  async getBodyDoubleHistory(): Promise<BodyDoubleSession[]> {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.from('body_double_sessions').select('*');
      
      if (error) {
        console.error('[BodyDoubleService] Failed to get body double sessions:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to load body double sessions: ${error.message}`, error);
      }

      if (!data) {
        console.warn('[BodyDoubleService] getBodyDoubleHistory returned null data');
        return [];
      }

      const sessions = data.map((s: BodyDoubleSessionRow) => ({
        id: s.id,
        duration: s.duration,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        goalId: s.goal_id,
        completed: s.completed,
        endedAt: s.completed_at // Map legacy field if needed
      }));

      console.log(`✓ Loaded ${sessions.length} body double sessions from database`);
      return sessions;
    } catch (err) {
      console.error('[BodyDoubleService] Error in getBodyDoubleHistory:', err);
      throw err;
    }
  }

  async saveBodyDoubleSession(session: BodyDoubleSession): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      throw new AuthenticationError('Cannot save body double session: User not authenticated');
    }

    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.from('body_double_sessions').upsert({
        id: session.id,
        user_id: user.id,
        duration: session.duration,
        started_at: session.startedAt,
        completed_at: session.completedAt,
        goal_id: session.goalId,
        completed: session.completed
      });
      
      if (error) {
        console.error('[BodyDoubleService] Failed to save body double session:', {
          sessionId: session.id,
          goalId: session.goalId,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to save body double session: ${error.message}`, error);
      }

      console.log(`✓ Saved body double session: ${session.id}`);
    } catch (err) {
      console.error('[BodyDoubleService] Error in saveBodyDoubleSession:', err);
      throw err;
    }
  }
}

export const bodyDoubleService = new BodyDoubleService();
