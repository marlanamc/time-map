
import { getSupabaseClient } from '../supabaseClient';
import { cacheService } from './CacheService';
import { AuthenticationError, DatabaseError } from './errors';
import {
    Goal,
    BrainDumpEntry,
    WeeklyReview,
    BodyDoubleSession,
    AppData,
    Preferences,
    Streak,
    Analytics
} from '../types';
import type {
    GoalRow,
    BrainDumpRow,
    WeeklyReviewRow,
    BodyDoubleSessionRow,
    StreakRow
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
            const supabase = await getSupabaseClient();
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
        const supabase = await getSupabaseClient();
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
        const supabase = await getSupabaseClient();
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
        const supabase = await getSupabaseClient();
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
            this.getPreferencesAndAnalytics(),
            this.getAchievements(),
            this.getWeeklyReviews(),
            this.getBodyDoubleHistory(),
            this.getStreak()
        ]);

        const [
            goalsResult,
            brainDumpResult,
            preferencesResult,
            achievementsResult,
            weeklyReviewsResult,
            bodyDoubleResult,
            streakResult
        ] = results;

        // Extract successful results, use empty arrays for failures
        const goals = goalsResult.status === 'fulfilled' ? goalsResult.value : [];
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
                const entities = ['goals', 'brainDump', 'preferences+analytics', 'achievements', 'weeklyReviews', 'bodyDoubleHistory', 'streak'];
                console.warn(`Failed to load ${entities[index]}:`, result.reason);
            }
        });

        return {
            goals,
            brainDump,
            preferences: preferencesAndAnalytics.preferences || undefined,
            achievements,
            weeklyReviews,
            bodyDoubleHistory,
            ...(preferencesAndAnalytics.analytics ? { analytics: preferencesAndAnalytics.analytics } : {}),
            ...(streakData?.streak ? { streak: streakData.streak } : {})
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

        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase
                .from('goals')
                .select('*');

            if (error) {
                console.error('[SupabaseService] Failed to get goals:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to load goals: ${error.message}`, error);
            }

            if (!data) {
                console.warn('[SupabaseService] getGoals returned null data');
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
                parentLevel: (g.parent_level as unknown as Goal['parentLevel']) ?? null
            }));

            cacheService.set(cacheKey, goals, cacheService.TTL.GOALS);
            console.log(`✓ Loaded ${goals.length} goals from database`);
            return goals;
        } catch (err) {
            console.error('[SupabaseService] Error in getGoals:', err);
            throw err;
        }
    },

    async saveGoal(goal: Goal) {
        const user = await this.getUser();
        if (!user) {
            const error = new AuthenticationError('Cannot save goal: User not authenticated');
            console.error('[SupabaseService] saveGoal failed:', error.message);
            throw error;
        }

        try {
            const supabase = await getSupabaseClient();
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
                tags: goal.tags,
                parent_id: goal.parentId ?? null,
                parent_level: goal.parentLevel ?? null
            });

            if (error) {
                console.error('[SupabaseService] Failed to save goal:', {
                    goalId: goal.id,
                    goalTitle: goal.title,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to save goal "${goal.title}": ${error.message}`, error);
            }

            // Invalidate goals cache after save
            cacheService.invalidate(/^goals:/);
            console.log(`✓ Saved goal: "${goal.title}" (${goal.id})`);
        } catch (err) {
            console.error('[SupabaseService] Error in saveGoal:', err);
            throw err;
        }
    },

    async deleteGoal(goalId: string) {
        try {
            const supabase = await getSupabaseClient();
            const { error } = await supabase
                .from('goals')
                .delete()
                .eq('id', goalId);
            
            if (error) {
                console.error('[SupabaseService] Failed to delete goal:', {
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
            console.error('[SupabaseService] Error in deleteGoal:', err);
            throw err;
        }
    },

    // Batch operations for performance
    async saveGoals(goals: Goal[]) {
        const user = await this.getUser();
        if (!user) {
            const error = new AuthenticationError('Cannot batch save goals: User not authenticated');
            console.error('[SupabaseService] saveGoals failed:', error.message);
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
                created_at: goal.createdAt,
                updated_at: goal.updatedAt,
                completed_at: goal.completedAt,
                last_worked_on: goal.lastWorkedOn,
                due_date: goal.dueDate,
                start_time: goal.startTime,
                end_time: goal.endTime,
                tags: goal.tags,
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
                console.error('[SupabaseService] Failed to batch save goals:', {
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
            console.error('[SupabaseService] Error in saveGoals:', err);
            throw err;
        }
    },

    // --- Brain Dump ---
    async getBrainDump(): Promise<BrainDumpEntry[]> {
        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase
                .from('brain_dump')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[SupabaseService] Failed to get brain dump:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to load brain dump: ${error.message}`, error);
            }

            if (!data) {
                console.warn('[SupabaseService] getBrainDump returned null data');
                return [];
            }

            const entries = data.map((b: BrainDumpRow) => ({
                id: b.id,
                text: b.text,
                createdAt: b.created_at,
                processed: b.processed,
                archived: b.archived,
                processedAction: b.processed_action,
                processedAt: b.processed_at
            }));

            console.log(`✓ Loaded ${entries.length} brain dump entries from database`);
            return entries;
        } catch (err) {
            console.error('[SupabaseService] Error in getBrainDump:', err);
            throw err;
        }
    },

    async saveBrainDump(entry: BrainDumpEntry) {
        const user = await this.getUser();
        if (!user) {
            throw new AuthenticationError('Cannot save brain dump: User not authenticated');
        }

        try {
            const supabase = await getSupabaseClient();
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
                console.error('[SupabaseService] Failed to save brain dump:', {
                    entryId: entry.id,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to save brain dump: ${error.message}`, error);
            }

            console.log(`✓ Saved brain dump entry: ${entry.id}`);
        } catch (err) {
            console.error('[SupabaseService] Error in saveBrainDump:', err);
            throw err;
        }
    },

    async deleteBrainDump(id: string) {
        try {
            const supabase = await getSupabaseClient();
            const { error } = await supabase.from('brain_dump').delete().eq('id', id);
            
            if (error) {
                console.error('[SupabaseService] Failed to delete brain dump:', {
                    entryId: id,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to delete brain dump: ${error.message}`, error);
            }

            console.log(`✓ Deleted brain dump entry: ${id}`);
        } catch (err) {
            console.error('[SupabaseService] Error in deleteBrainDump:', err);
            throw err;
        }
    },

    async saveBrainDumpBatch(entries: BrainDumpEntry[]) {
        const user = await this.getUser();
        if (!user) {
            throw new AuthenticationError('Cannot save brain dump batch: User not authenticated');
        }

        try {
            const supabase = await getSupabaseClient();
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
                console.error('[SupabaseService] Failed to batch save brain dump:', {
                    count: entries.length,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to save brain dump batch: ${error.message}`, error);
            }
            console.log(`✓ Batch synced ${entries.length} brain dump entries to cloud`);
        } catch (err) {
            console.error('[SupabaseService] Error in saveBrainDumpBatch:', err);
            throw err;
        }
    },

    // --- Preferences ---
    async getPreferencesAndAnalytics(): Promise<{ preferences: Preferences | null; analytics: Analytics | null }> {
        const user = await this.getUser();
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
                console.error('[SupabaseService] Failed to get preferences:', {
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
            console.error('[SupabaseService] Error in getPreferences:', err);
            throw err;
        }
    },

    async getPreferences(): Promise<Preferences | null> {
        const { preferences } = await this.getPreferencesAndAnalytics();
        return preferences;
    },

    async savePreferences(prefs: Preferences, analytics?: Analytics) {
        const user = await this.getUser();
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
                console.error('[SupabaseService] Failed to save preferences:', {
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
            console.error('[SupabaseService] Error in savePreferences:', err);
            throw err;
        }
    },

    // --- Streaks ---
    async getStreak(): Promise<{ streak: Streak; bestStreak: number } | null> {
        const user = await this.getUser();
        if (!user) return null;

        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase
                .from('streaks')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('[SupabaseService] Failed to get streak:', {
                    userId: user.id,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to load streak: ${error.message}`, error);
            }

            if (!data) return null;

            const row = data as StreakRow;
            const lastDate = row.last_date ? String(row.last_date).split('T')[0] : null;
            return {
                streak: {
                    count: row.count ?? 0,
                    lastDate
                },
                bestStreak: row.best_streak ?? 0
            };
        } catch (err) {
            console.error('[SupabaseService] Error in getStreak:', err);
            throw err;
        }
    },

    async saveStreak(streak: Streak, bestStreak?: number) {
        const user = await this.getUser();
        if (!user) {
            throw new AuthenticationError('Cannot save streak: User not authenticated');
        }

        try {
            const supabase = await getSupabaseClient();
            const payload: Record<string, unknown> = {
                user_id: user.id,
                count: streak.count ?? 0,
                last_date: streak.lastDate ?? null,
                updated_at: new Date().toISOString()
            };
            if (bestStreak !== undefined) {
                payload.best_streak = bestStreak;
            }

            const { error } = await supabase
                .from('streaks')
                .upsert(payload);

            if (error) {
                console.error('[SupabaseService] Failed to save streak:', {
                    userId: user.id,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to save streak: ${error.message}`, error);
            }
        } catch (err) {
            console.error('[SupabaseService] Error in saveStreak:', err);
            throw err;
        }
    },

    // --- Achievements ---
    async getAchievements(): Promise<AchievementRecord[]> {
        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase.from('achievements').select('*');
            
            if (error) {
                console.error('[SupabaseService] Failed to get achievements:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to load achievements: ${error.message}`, error);
            }

            if (!data) {
                console.warn('[SupabaseService] getAchievements returned null data');
                return [];
            }

            console.log(`✓ Loaded ${data.length} achievements from database`);
            return data;
        } catch (err) {
            console.error('[SupabaseService] Error in getAchievements:', err);
            throw err;
        }
    },

    async saveAchievement(achievementId: string) {
        const user = await this.getUser();
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
                console.error('[SupabaseService] Failed to save achievement:', {
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
            console.error('[SupabaseService] Error in saveAchievement:', err);
            throw err;
        }
    },

    // --- Weekly Reviews ---
    async getWeeklyReviews(): Promise<WeeklyReview[]> {
        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase.from('weekly_reviews').select('*');
            
            if (error) {
                console.error('[SupabaseService] Failed to get weekly reviews:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to load weekly reviews: ${error.message}`, error);
            }

            if (!data) {
                console.warn('[SupabaseService] getWeeklyReviews returned null data');
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
            console.error('[SupabaseService] Error in getWeeklyReviews:', err);
            throw err;
        }
    },

    async saveWeeklyReview(review: WeeklyReview) {
        const user = await this.getUser();
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
                console.error('[SupabaseService] Failed to save weekly review:', {
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
            console.error('[SupabaseService] Error in saveWeeklyReview:', err);
            throw err;
        }
    },

    // --- Body Double ---
    async getBodyDoubleHistory(): Promise<BodyDoubleSession[]> {
        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase.from('body_double_sessions').select('*');
            
            if (error) {
                console.error('[SupabaseService] Failed to get body double sessions:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw new DatabaseError(`Failed to load body double sessions: ${error.message}`, error);
            }

            if (!data) {
                console.warn('[SupabaseService] getBodyDoubleHistory returned null data');
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
            console.error('[SupabaseService] Error in getBodyDoubleHistory:', err);
            throw err;
        }
    },

    async saveBodyDoubleSession(session: BodyDoubleSession) {
        const user = await this.getUser();
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
                console.error('[SupabaseService] Failed to save body double session:', {
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
            console.error('[SupabaseService] Error in saveBodyDoubleSession:', err);
            throw err;
        }
    },

    // --- Diagnostics ---
    /**
     * Test database connectivity and permissions
     * Useful for debugging connection issues
     */
    async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
        try {
            const user = await this.getUser();
            if (!user) {
                return { success: false, error: 'Not authenticated' };
            }

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
