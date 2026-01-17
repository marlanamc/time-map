// Goals Service
import { getSupabaseClient } from './client';
import { cacheService } from '../CacheService';
import { AuthenticationError, DatabaseError } from '../errors';
import { authService } from './AuthService';
import type { Goal } from '../../types';
import type { GoalRow } from '../../types/database';

export class GoalsService {
  async getGoals(): Promise<Goal[]> {
    const user = await authService.getUser();
    const cacheKey = user ? `goals:${user.id}` : 'goals:anonymous';
    const cached = cacheService.get<Goal[]>(cacheKey);

    if (cached) {
      console.log('✓ Goals loaded from cache');
      return cached;
    }

    if (!user) {
      console.warn('[GoalsService] getGoals called without authenticated user; returning empty array');
      return [];
    }

    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('goals')
        .select('*');

      if (error) {
        console.error('[GoalsService] Failed to get goals:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to load goals: ${error.message}`, error);
      }

      if (!data) {
        console.warn('[GoalsService] getGoals returned null data');
        return [];
      }

      // Transform snake_case to camelCase and parse JSON fields if needed
      const goals = data.map((g: GoalRow) => ({
        ...g,
        level: g.level || 'milestone',
        createdAt: g.created_at,
        updatedAt: g.updated_at,
        completedAt: g.completed_at,
        lastWorkedOn: g.last_worked_on,
        dueDate: g.due_date,
        timeLog: g.time_log || [], // JSONB auto-parsed
        subtasks: g.subtasks || [],
        notes: g.notes || [],
        parentId: g.parent_id ?? null,
        parentLevel: (g.parent_level as unknown as Goal['parentLevel']) ?? null,
        meta: g.meta ?? undefined,
        activityId: g.activity_id ?? undefined,
      }));

      cacheService.set(cacheKey, goals, cacheService.TTL.GOALS);
      console.log(`✓ Loaded ${goals.length} goals from database`);
      return goals;
    } catch (err) {
      console.error('[GoalsService] Error in getGoals:', err);
      throw err;
    }
  }

  async saveGoal(goal: Goal): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      const error = new AuthenticationError('Cannot save goal: User not authenticated');
      console.error('[GoalsService] saveGoal failed:', error.message);
      throw error;
    }

    try {
      const supabase = await getSupabaseClient();
      
      // Prepare the data object
      const goalData = {
        id: goal.id,
        user_id: user.id,
        title: goal.title,
        level: goal.level,
        description: goal.description || null,
        month: goal.month,
        year: goal.year,
        category: goal.category || null,
        priority: goal.priority,
        status: goal.status,
        progress: goal.progress,
        subtasks: goal.subtasks || [], // JSONB
        notes: goal.notes || [], // JSONB
        time_log: goal.timeLog || [], // JSONB
        created_at: goal.createdAt,
        updated_at: goal.updatedAt,
        completed_at: goal.completedAt || null,
        last_worked_on: goal.lastWorkedOn || null,
        due_date: goal.dueDate || null,
        start_time: goal.startTime || null,
        end_time: goal.endTime || null,
        tags: goal.tags || [],
        meta: goal.meta ?? {},
        activity_id: goal.activityId || null,
        parent_id: goal.parentId ?? null,
        parent_level: goal.parentLevel ?? null
      };

      console.log('[GoalsService] Attempting to save goal:', {
        goalId: goal.id,
        goalTitle: goal.title,
        userId: user.id,
        level: goal.level
      });

      const { data, error } = await supabase
        .from('goals')
        .upsert(goalData, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('[GoalsService] Failed to save goal:', {
          goalId: goal.id,
          goalTitle: goal.title,
          userId: user.id,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          goalData: goalData
        });
        throw new DatabaseError(`Failed to save goal "${goal.title}": ${error.message}`, error);
      }

      // Verify the save was successful
      if (!data || data.length === 0) {
        console.warn('[GoalsService] Upsert returned no data - goal may not have been saved:', {
          goalId: goal.id,
          goalTitle: goal.title
        });
      } else {
        console.log(`✓ Saved goal: "${goal.title}" (${goal.id}) - Database confirmed`);
      }

      // Invalidate goals cache after save
      cacheService.invalidate(/^goals:/);
    } catch (err) {
      console.error('[GoalsService] Error in saveGoal:', err);
      throw err;
    }
  }

  async deleteGoal(goalId: string): Promise<void> {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);
      
      if (error) {
        console.error('[GoalsService] Failed to delete goal:', {
          goalId,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to delete goal: ${error.message}`, error);
      }

      // Invalidate goals cache after delete
      cacheService.invalidate(/^goals:/);
      console.log(`✓ Deleted goal: ${goalId}`);
    } catch (err) {
      console.error('[GoalsService] Error in deleteGoal:', err);
      throw err;
    }
  }

  async saveGoals(goals: Goal[]): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      const error = new AuthenticationError('Cannot batch save goals: User not authenticated');
      console.error('[GoalsService] saveGoals failed:', error.message);
      throw error;
    }

    try {
      const supabase = await getSupabaseClient();
      // Transform to snake_case for batch insert
      const goalsData = goals.map(goal => ({
        id: goal.id,
        user_id: user.id,
        title: goal.title,
        level: goal.level,
        description: goal.description,
        month: goal.month,
        year: goal.year,
        category: goal.category,
        priority: goal.priority,
        status: goal.status,
        progress: goal.progress,
        subtasks: goal.subtasks,
        notes: goal.notes,
        time_log: goal.timeLog,
        meta: goal.meta ?? {},
        created_at: goal.createdAt,
        updated_at: goal.updatedAt,
        completed_at: goal.completedAt,
        last_worked_on: goal.lastWorkedOn,
        due_date: goal.dueDate,
        start_time: goal.startTime,
        end_time: goal.endTime,
        tags: goal.tags,
        activity_id: goal.activityId ?? null,
        parent_id: goal.parentId ?? null,
        parent_level: goal.parentLevel ?? null
      }));

      const { error } = await supabase
        .from('goals')
        .upsert(goalsData, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('[GoalsService] Failed to batch save goals:', {
          count: goals.length,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new DatabaseError(`Failed to batch save goals: ${error.message}`, error);
      }

      // Invalidate goals cache after batch save
      cacheService.invalidate(/^goals:/);
      console.log(`✓ Batch synced ${goals.length} goals to cloud`);
    } catch (err) {
      console.error('[GoalsService] Error in saveGoals:', err);
      throw err;
    }
  }

  /**
   * Diagnostic function to check if goals are being saved correctly
   */
  async diagnosticGetAllGoals(): Promise<{ success: boolean; goals?: Goal[]; error?: string; count?: number }> {
    try {
      const user = await authService.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[GoalsService] Diagnostic query failed:', error);
        return {
          success: false,
          error: error.message,
          count: 0
        };
      }

      const goals = (data || []).map((g: GoalRow) => ({
        ...g,
        level: g.level || 'milestone',
        createdAt: g.created_at,
        updatedAt: g.updated_at,
        completedAt: g.completed_at,
        lastWorkedOn: g.last_worked_on,
        dueDate: g.due_date,
        timeLog: g.time_log || [],
        subtasks: g.subtasks || [],
        notes: g.notes || [],
        parentId: g.parent_id ?? null,
        parentLevel: (g.parent_level as unknown as Goal['parentLevel']) ?? null,
        meta: g.meta ?? undefined,
        activityId: g.activity_id ?? undefined,
      }));

      console.log(`[GoalsService] Diagnostic: Found ${goals.length} goals in database for user ${user.id}`);
      return {
        success: true,
        goals,
        count: goals.length
      };
    } catch (err: any) {
      console.error('[GoalsService] Diagnostic query error:', err);
      return {
        success: false,
        error: err.message || 'Unknown error',
        count: 0
      };
    }
  }
}

export const goalsService = new GoalsService();
