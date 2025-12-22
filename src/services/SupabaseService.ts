
import { supabase } from '../supabaseClient';
import {
    Goal,
    BrainDumpEntry,
    WeeklyReview,
    BodyDoubleSession,
    AppData,
    Preferences
} from '../types';

export const SupabaseService = {
    // --- Auth ---
    async getUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
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

        const [
            goals,
            brainDump,
            preferences,
            achievements,
            weeklyReviews,
            bodyDoubleHistory
        ] = await Promise.all([
            this.getGoals(),
            this.getBrainDump(),
            this.getPreferences(),
            this.getAchievements(),
            this.getWeeklyReviews(),
            this.getBodyDoubleHistory()
        ]);

        return {
            goals,
            brainDump,
            preferences: preferences || undefined,
            achievements: achievements.map((a: any) => a.achievement_id),
            weeklyReviews,
            bodyDoubleHistory
        };
    },

    // --- Goals ---
    async getGoals(): Promise<Goal[]> {
        const { data, error } = await supabase
            .from('goals')
            .select('*');

        if (error) throw error;

        // Transform snake_case to camelCase and parse JSON fields if needed
        return data.map(g => ({
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
                tags: goal.tags
            });

        if (error) throw error;
    },

    async deleteGoal(goalId: string) {
        const { error } = await supabase
            .from('goals')
            .delete()
            .eq('id', goalId);
        if (error) throw error;
    },

    // --- Brain Dump ---
    async getBrainDump(): Promise<BrainDumpEntry[]> {
        const { data, error } = await supabase
            .from('brain_dump')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map(b => ({
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
        if (!user) return;

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

        if (error) throw error;
    },

    async deleteBrainDump(id: string) {
        const { error } = await supabase.from('brain_dump').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Preferences ---
    async getPreferences(): Promise<Preferences | null> {
        const user = await this.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('preferences')
            .select('data')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
        return data ? data.data : null;
    },

    async savePreferences(prefs: Preferences) {
        const user = await this.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('preferences')
            .upsert({
                user_id: user.id,
                data: prefs,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    },

    // --- Achievements ---
    async getAchievements(): Promise<any[]> {
        const { data, error } = await supabase.from('achievements').select('*');
        if (error) throw error;
        return data;
    },

    async saveAchievement(achievementId: string) {
        const user = await this.getUser();
        if (!user) return;

        const { error } = await supabase.from('achievements').upsert({
            user_id: user.id,
            achievement_id: achievementId,
            unlocked_at: new Date().toISOString()
        });
        if (error) throw error;
    },

    // --- Weekly Reviews ---
    async getWeeklyReviews(): Promise<WeeklyReview[]> {
        const { data, error } = await supabase.from('weekly_reviews').select('*');
        if (error) throw error;

        return data.map(w => ({
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
        if (!user) return;

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
        if (error) throw error;
    },

    // --- Body Double ---
    async getBodyDoubleHistory(): Promise<BodyDoubleSession[]> {
        const { data, error } = await supabase.from('body_double_sessions').select('*');
        if (error) throw error;

        return data.map(s => ({
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
        if (!user) return;

        const { error } = await supabase.from('body_double_sessions').upsert({
            id: session.id,
            user_id: user.id,
            duration: session.duration,
            started_at: session.startedAt,
            completed_at: session.completedAt,
            goal_id: session.goalId,
            completed: session.completed
        });
        if (error) throw error;
    }
};
