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
    // Verify authentication first
    const user = await authService.getUser();
    if (!user) {
      const error = new AuthenticationError('Cannot save goal: User not authenticated');
      console.error('[GoalsService] saveGoal failed:', error.message);
      throw error;
    }

    // Verify user ID matches (additional safety check)
    if (!user.id || typeof user.id !== 'string') {
      const error = new AuthenticationError('Invalid user ID: user authentication is invalid');
      console.error('[GoalsService] saveGoal failed:', error.message, { userId: user.id });
      throw error;
    }

    // Validate required fields
    if (typeof goal.month !== 'number' || !Number.isFinite(goal.month)) {
      throw new DatabaseError(`Invalid month value: ${goal.month}. Month must be a valid number.`, null);
    }
    if (typeof goal.year !== 'number' || !Number.isFinite(goal.year)) {
      throw new DatabaseError(`Invalid year value: ${goal.year}. Year must be a valid number.`, null);
    }
    if (goal.year < 1900 || goal.year > 2100) {
      throw new DatabaseError(`Invalid year value: ${goal.year}. Year must be between 1900 and 2100.`, null);
    }
    if (goal.month < 0 || goal.month > 11) {
      throw new DatabaseError(`Invalid month value: ${goal.month}. Month must be between 0 (January) and 11 (December).`, null);
    }

    try {
      const supabase = await getSupabaseClient();
      
      // Verify schema before attempting save (only log warning, don't block)
      // This helps diagnose issues but doesn't prevent saves if schema is partially correct
      try {
        const schemaCheck = await this.verifySchema();
        if (!schemaCheck.success && schemaCheck.missingColumns && schemaCheck.missingColumns.length > 0) {
          console.warn('[GoalsService] Schema verification found missing columns:', schemaCheck.missingColumns);
          console.warn('[GoalsService] This may cause save failures. Please run migrations 009_add_goal_meta.sql and 010_add_goal_activity_id.sql');
        }
      } catch (schemaErr) {
        // Don't fail the save if schema check fails, just log it
        console.warn('[GoalsService] Schema verification failed (non-blocking):', schemaErr);
      }
      
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
        level: goal.level,
        month: goal.month,
        year: goal.year,
        hasMeta: !!goal.meta,
        hasActivityId: !!goal.activityId
      });

      const { data, error } = await supabase
        .from('goals')
        .upsert(goalData, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        // Enhanced error logging with full context
        const errorContext = {
          goalId: goal.id,
          goalTitle: goal.title,
          userId: user.id,
          level: goal.level,
          month: goal.month,
          year: goal.year,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          // Include schema-related fields that might be missing
          hasMeta: 'meta' in goalData,
          hasActivityId: 'activity_id' in goalData,
          // Log a subset of goalData (avoid logging large JSONB fields)
          goalDataSummary: {
            id: goalData.id,
            user_id: goalData.user_id,
            title: goalData.title,
            level: goalData.level,
            month: goalData.month,
            year: goalData.year,
            meta: goalData.meta ? (typeof goalData.meta === 'object' ? Object.keys(goalData.meta) : goalData.meta) : null,
            activity_id: goalData.activity_id
          }
        };
        
        console.error('[GoalsService] Failed to save goal:', errorContext);
        
        // Provide more helpful error messages based on error code
        let userFriendlyMessage = error.message;
        if (error.code === '42703' || error.message.includes('column') || error.message.includes('does not exist')) {
          userFriendlyMessage = `Database schema mismatch: ${error.message}. Please ensure migrations 009_add_goal_meta.sql and 010_add_goal_activity_id.sql have been run.`;
        } else if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
          userFriendlyMessage = `Permission denied: ${error.message}. Please check Row Level Security policies.`;
        } else if (error.code === '23502' || error.message.includes('null value')) {
          userFriendlyMessage = `Missing required field: ${error.message}`;
        }
        
        throw new DatabaseError(`Failed to save goal "${goal.title}": ${userFriendlyMessage}`, error);
      }

      // Verify the save was successful
      if (!data || data.length === 0) {
        console.warn('[GoalsService] Upsert returned no data - goal may not have been saved:', {
          goalId: goal.id,
          goalTitle: goal.title,
          level: goal.level,
          userId: user.id
        });
        // This could indicate RLS policy blocking the return, even if insert succeeded
        // Log a warning but don't throw - the goal might still be saved
      } else {
        console.log(`✓ Saved goal: "${goal.title}" (${goal.id}) - Database confirmed`, {
          level: goal.level,
          returnedData: data.length > 0 ? { id: data[0].id, level: data[0].level } : null
        });
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
   * Diagnostic function to verify database schema matches expected columns
   */
  async verifySchema(): Promise<{ success: boolean; missingColumns?: string[]; error?: string }> {
    try {
      const user = await authService.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const supabase = await getSupabaseClient();
      
      // Try to query with all expected columns to see which ones exist
      // We'll use a SELECT query with a limit of 0 to just check schema
      const expectedColumns = [
        'id', 'user_id', 'title', 'level', 'description', 'month', 'year',
        'category', 'priority', 'status', 'progress', 'due_date',
        'start_time', 'end_time', 'completed_at', 'last_worked_on',
        'created_at', 'updated_at', 'subtasks', 'notes', 'time_log',
        'tags', 'parent_id', 'parent_level', 'meta', 'activity_id'
      ];

      // Try selecting all columns - if a column doesn't exist, we'll get an error
      const { error } = await supabase
        .from('goals')
        .select(expectedColumns.join(', '))
        .limit(0);

      if (error) {
        // Parse error to see which columns are missing
        const missingColumns: string[] = [];
        
        // Check for specific column errors
        if (error.message.includes('meta') || error.code === '42703') {
          // Try to determine which specific column is missing
          if (error.message.includes('meta')) missingColumns.push('meta');
          if (error.message.includes('activity_id')) missingColumns.push('activity_id');
        }

        // If we can't determine specific columns, return the error
        if (missingColumns.length === 0) {
          return {
            success: false,
            error: error.message,
            missingColumns: error.message.includes('column') ? ['unknown'] : []
          };
        }

        return {
          success: false,
          missingColumns
        };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[GoalsService] Schema verification error:', err);
      return {
        success: false,
        error: err.message || 'Unknown error'
      };
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
