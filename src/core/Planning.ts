// ===================================
// Planning & Reviews
// ===================================
import type { WeeklyReview, Goal } from '../types';
import { State } from './State';
import { Goals } from './Goals';

export const Planning = {
  createWeeklyReview(reviewData: Partial<WeeklyReview> & { weekStart: string; weekEnd: string }): WeeklyReview {
    if (!State.data) {
      State.init();
      if (!State.data) throw new Error("State not initialized");
    }
    const review: WeeklyReview = {
      id: Goals.generateId(),
      weekStart: reviewData.weekStart,
      weekEnd: reviewData.weekEnd,
      goalsCompleted: reviewData.goalsCompleted || 0,
      timeSpent: reviewData.timeSpent || 0,
      notes: reviewData.notes || "",
      createdAt: new Date().toISOString(),
    };

    State.data.weeklyReviews.push(review);
    State.save();

    // Check for planner achievement
    if (!State.data.achievements.includes("planner")) {
      Goals.unlockAchievement("planner");
    }

    return review;
  },

  getWeeklyReviews(): WeeklyReview[] {
    if (!State.data) return [];
    return State.data.weeklyReviews.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  getLastReview(): WeeklyReview | null {
    const reviews = this.getWeeklyReviews();
    return reviews[0] || null;
  },

  shouldPromptReview(): boolean {
    const lastReview = this.getLastReview();
    if (!lastReview) return true;

    const lastDate = new Date(lastReview.createdAt);
    const daysSince = Math.floor(
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSince >= 7;
  },

  getWeekGoals(): Goal[] {
    if (!State.data) return [];
    const now = new Date();
    const weekYear = State.getWeekYear(now);
    const weekNum = State.getWeekNumber(now);
    const weekStart = State.getWeekStart(weekYear, weekNum);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Canonical "active in range" definition via Goals.getForRange().
    return Goals.getForRange(weekStart, weekEnd);
  },

  getPriorityMatrix(): {
    urgentImportant: Goal[];
    importantNotUrgent: Goal[];
    urgentNotImportant: Goal[];
    neitherUrgentNorImportant: Goal[];
  } {
    if (!State.data) {
      return {
        urgentImportant: [],
        importantNotUrgent: [],
        urgentNotImportant: [],
        neitherUrgentNorImportant: [],
      };
    }
    const active = State.data.goals.filter((g) => g.status !== "done");
    return {
      urgentImportant: active.filter((g) => g.priority === "urgent"),
      importantNotUrgent: active.filter((g) => g.priority === "high"),
      urgentNotImportant: active.filter((g) => g.priority === "medium"),
      neitherUrgentNorImportant: active.filter((g) => g.priority === "low"),
    };
  },
};
