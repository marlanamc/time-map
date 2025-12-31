
import { supabase } from '../supabaseClient';
import { cacheService } from './CacheService';
import { AuthenticationError, DatabaseError } from './errors';
import {
    Goal,
    BrainDumpEntry,
    WeeklyReview,
    BodyDoubleSession,
    AppData,
    Preferences
} from '../types';
import type {
    GoalRow,
    BrainDumpRow,
    WeeklyReviewRow,
    BodyDoubleSessionRow
} from '../types/database';

interface AchievementRecord {
    achievement_id: string;
    user_id: string;
    unlocked_at: string;
}

export const SupabaseService = {
    // --- Auth ---
    async getUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            // If there's an error or no user, also check session to ensure it's valid
            if (error || !user) {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    return null;
                }
            }
            return user;
        } catch (err) {
            console.error('Error getting user:', err);
            return null;
        }
    },

    async signIn(email: string, password?: string) {
        if (password) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            return { data, error };
        } else {
            // Magic link login
            const { data, error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin,
                },
            });
            return { data, error };
        }
    },

    async signUp(email: string, password?: string) {
        if (password) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });
            return { data, error };
        } else {
            // Magic link can also be used for signup
            return this.signIn(email);
        }
    },

    async signOut() {
        return await supabase.auth.signOut();
    },

    // --- Data Loading ---
    async loadAllData(): Promise<Partial<AppData> | null> {
        const user = await this.getUser();
        if (!user) return null;

        // Use Promise.allSettled for error-resilient parallel loading
        // If one query fails, others still succeed
        const results = await Promise.allSettled([
            this.getGoals(),
            this.getBrainDump(),
            this.getPreferences(),
            this.getAchievements(),
            this.getWeeklyReviews(),
            this.getBodyDoubleHistory()
        ]);

        const [
            goalsResult,
            brainDumpResult,
            preferencesResult,
            achievementsResult,
            weeklyReviewsResult,
            bodyDoubleResult
        ] = results;

        // Extract successful results, use empty arrays for failures
        const goals = goalsResult.status === 'fulfilled' ? goalsResult.value : [];
        const brainDump = brainDumpResult.status === 'fulfilled' ? brainDumpResult.value : [];
        const preferences = preferencesResult.status === 'fulfilled' ? preferencesResult.value : undefined;
        const achievements = achievementsResult.status === 'fulfilled'
            ? achievementsResult.value.map((a: AchievementRecord) => a.achievement_id)
            : [];
        const weeklyReviews = weeklyReviewsResult.status === 'fulfilled' ? weeklyReviewsResult.value : [];
        const bodyDoubleHistory = bodyDoubleResult.status === 'fulfilled' ? bodyDoubleResult.value : [];

        // Log any failures (non-critical, app still works with partial data)
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const entities = ['goals', 'brainDump', 'preferences', 'achievements', 'weeklyReviews', 'bodyDoubleHistory'];
                console.warn(`Failed to load ${entities[index]}:`, result.reason);
            }
        });

        return {
            goals,
            brainDump,
            preferences: preferences || undefined,
            achievements,
            weeklyReviews,
            bodyDoubleHistory
        };
    },

    // --- Goals ---
    async getGoals(): Promise<Goal[]> {
        const cacheKey = 'goals:all';
        const cached = cacheService.get<Goal[]>(cacheKey);

        if (cached) {
            console.log('✓ Goals loaded from cache');
            return cached;
        }

        const { data, error } = await supabase
            .from('goals')
            .select('*');

        if (error) throw error;

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
            notes: g.notes || []
        }));

        cacheService.set(cacheKey, goals, cacheService.TTL.GOALS);
        return goals;
    },

    async saveGoal(goal: Goal) {
        const user = await this.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('goals')
            .upsert({
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
                subtasks: goal.subtasks, // JSONB
                notes: goal.notes, // JSONB
                time_log: goal.timeLog, // JSONB
                created_at: goal.createdAt,
                updated_at: goal.updatedAt,
                completed_at: goal.completedAt,
                last_worked_on: goal.lastWorkedOn,
                due_date: goal.dueDate,
                start_time: goal.startTime,
                end_time: goal.endTime,
                tags: goal.tags
            });

        if (error) throw error;

        // Invalidate goals cache after save
        cacheService.invalidate(/^goals:/);
    },

    async deleteGoal(goalId: string) {
        const { error } = await supabase
            .from('goals')
            .delete()
            .eq('id', goalId);
        if (error) throw error;

        // Invalidate goals cache after delete
        cacheService.invalidate(/^goals:/);
    },

    // Batch operations for performance
    async saveGoals(goals: Goal[]) {
        const user = await this.getUser();
        if (!user) throw new Error('Not authenticated');

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
            created_at: goal.createdAt,
            updated_at: goal.updatedAt,
            completed_at: goal.completedAt,
            last_worked_on: goal.lastWorkedOn,
            due_date: goal.dueDate,
            start_time: goal.startTime,
            end_time: goal.endTime,
            tags: goal.tags
        }));

        const { error } = await supabase
            .from('goals')
            .upsert(goalsData, {
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (error) throw error;

        // Invalidate goals cache after batch save
        cacheService.invalidate(/^goals:/);
        console.log(`✓ Batch synced ${goals.length} goals to cloud`);
    },

    // --- Brain Dump ---
    async getBrainDump(): Promise<BrainDumpEntry[]> {
        const { data, error } = await supabase
            .from('brain_dump')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map((b: BrainDumpRow) => ({
            id: b.id,
            text: b.text,
            createdAt: b.created_at,
            processed: b.processed,
            archived: b.archived,
            processedAction: b.processed_action,
            processedAt: b.processed_at
        }));
    },

    async saveBrainDump(entry: BrainDumpEntry) {
        const user = await this.getUser();
        if (!user) {
            throw new AuthenticationError('Cannot save brain dump: User not authenticated');
        }

        const { error } = await supabase
            .from('brain_dump')
            .upsert({
                id: entry.id,
                user_id: user.id,
                text: entry.text,
                created_at: entry.createdAt,
                processed: entry.processed,
                archived: entry.archived,
                processed_action: entry.processedAction,
                processed_at: entry.processedAt
            });

        if (error) {
            throw new DatabaseError(`Failed to save brain dump: ${error.message}`, error);
        }
    },

    async deleteBrainDump(id: string) {
        const { error } = await supabase.from('brain_dump').delete().eq('id', id);
        if (error) throw error;
    },

    async saveBrainDumpBatch(entries: BrainDumpEntry[]) {
        const user = await this.getUser();
        if (!user) {
            throw new AuthenticationError('Cannot save brain dump batch: User not authenticated');
        }

        const entriesData = entries.map(entry => ({
            id: entry.id,
            user_id: user.id,
            text: entry.text,
            created_at: entry.createdAt,
            processed: entry.processed,
            archived: entry.archived,
            processed_action: entry.processedAction,
            processed_at: entry.processedAt
        }));

        const { error } = await supabase
            .from('brain_dump')
            .upsert(entriesData);

        if (error) {
            throw new DatabaseError(`Failed to save brain dump batch: ${error.message}`, error);
        }
        console.log(`✓ Batch synced ${entries.length} brain dump entries to cloud`);
    },

    // --- Preferences ---
    async getPreferences(): Promise<Preferences | null> {
        const user = await this.getUser();
        if (!user) return null;

        const cacheKey = `preferences:${user.id}`;
        const cached = cacheService.get<Preferences>(cacheKey);

        if (cached) {
            console.log('✓ Preferences loaded from cache');
            return cached;
        }

        const { data, error } = await supabase
            .from('preferences')
            .select('data')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"

        const prefs = data ? data.data : null;
        if (prefs) {
            cacheService.set(cacheKey, prefs, cacheService.TTL.PREFERENCES);
        }

        return prefs;
    },

    async savePreferences(prefs: Preferences) {
        const user = await this.getUser();
        if (!user) {
            throw new AuthenticationError('Cannot save preferences: User not authenticated');
        }

        const { error } = await supabase
            .from('preferences')
            .upsert({
                user_id: user.id,
                data: prefs,
                updated_at: new Date().toISOString()
            });

        if (error) {
            throw new DatabaseError(`Failed to save preferences: ${error.message}`, error);
        }

        // Invalidate preferences cache after save
        cacheService.invalidate(/^preferences:/);
    },

    // --- Achievements ---
    async getAchievements(): Promise<AchievementRecord[]> {
        const { data, error } = await supabase.from('achievements').select('*');
        if (error) throw error;
        return data;
    },

    async saveAchievement(achievementId: string) {
        const user = await this.getUser();
        if (!user) {
            throw new AuthenticationError('Cannot save achievement: User not authenticated');
        }

        const { error } = await supabase.from('achievements').upsert({
            user_id: user.id,
            achievement_id: achievementId,
            unlocked_at: new Date().toISOString()
        });
        if (error) {
            throw new DatabaseError(`Failed to save achievement: ${error.message}`, error);
        }
    },

    // --- Weekly Reviews ---
    async getWeeklyReviews(): Promise<WeeklyReview[]> {
        const { data, error } = await supabase.from('weekly_reviews').select('*');
        if (error) throw error;

        return data.map((w: WeeklyReviewRow) => ({
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
    },

    async saveWeeklyReview(review: WeeklyReview) {
        const user = await this.getUser();
        if (!user) {
            throw new AuthenticationError('Cannot save weekly review: User not authenticated');
        }

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
            throw new DatabaseError(`Failed to save weekly review: ${error.message}`, error);
        }
    },

    // --- Body Double ---
    async getBodyDoubleHistory(): Promise<BodyDoubleSession[]> {
        const { data, error } = await supabase.from('body_double_sessions').select('*');
        if (error) throw error;

        return data.map((s: BodyDoubleSessionRow) => ({
            id: s.id,
            duration: s.duration,
            startedAt: s.started_at,
            completedAt: s.completed_at,
            goalId: s.goal_id,
            completed: s.completed,
            endedAt: s.completed_at // Map legacy field if needed
        }));
    },

    async saveBodyDoubleSession(session: BodyDoubleSession) {
        const user = await this.getUser();
        if (!user) {
            throw new AuthenticationError('Cannot save body double session: User not authenticated');
        }

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
            throw new DatabaseError(`Failed to save body double session: ${error.message}`, error);
        }
    }
};
