// ===================================
// Analytics
// ===================================
import { State } from './State';
import { CONFIG } from '../config';

export const Analytics = {
  getOverview() {
    if (!State.data) {
      return {
        totalGoals: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        blocked: 0,
        completionRate: 0,
        totalTimeSpent: 0,
        currentStreak: 0,
        bestStreak: 0,
      };
    }
    const goals = State.data.goals;

    return {
      totalGoals: goals.length,
      completed: goals.filter((g) => g.status === "done").length,
      inProgress: goals.filter((g) => g.status === "in-progress").length,
      notStarted: goals.filter((g) => g.status === "not-started").length,
      blocked: goals.filter((g) => g.status === "blocked").length,
      completionRate:
        goals.length > 0
          ? Math.round(
            (goals.filter((g) => g.status === "done").length /
              goals.length) *
            100,
          )
          : 0,
      totalTimeSpent: State.data.analytics.totalTimeSpent,
      currentStreak: State.data.streak.count,
      bestStreak: State.data.analytics.streakBest,
    };
  },

  getByCategory(): Record<string, { total: number; completed: number; progress: number }> {
    if (!State.data) return {};
    const stats: Record<string, { total: number; completed: number; progress: number }> = {};
    Object.keys(CONFIG.CATEGORIES).forEach((cat) => {
      if (!State.data) return;
      const catGoals = State.data.goals.filter((g) => g.category === cat);
      stats[cat] = {
        total: catGoals.length,
        completed: catGoals.filter((g) => g.status === "done").length,
        progress:
          catGoals.length > 0
            ? Math.round(
              catGoals.reduce((sum, g) => sum + g.progress, 0) /
              catGoals.length,
            )
            : 0,
      };
    });
    return stats;
  },

  getByMonth(): Record<number, { total: number; completed: number }> {
    if (!State.data) return {};
    const stats: Record<number, { total: number; completed: number }> = {};
    const year = new Date().getFullYear();

    CONFIG.MONTHS.forEach((_, idx) => {
      if (!State.data) return;
      const monthGoals = State.data.goals.filter(
        (g) => g.month === idx && g.year === year,
      );
      stats[idx] = {
        total: monthGoals.length,
        completed: monthGoals.filter((g) => g.status === "done").length,
      };
    });
    return stats;
  },

  getProductivityTrend(): Array<{ date: string; goalsCompleted: number; timeLogged: number }> {
    if (!State.data) return [];
    const last30Days: Array<{ date: string; goalsCompleted: number; timeLogged: number }> = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      // Count activities on this day
      const goalsCompleted = State.data.goals.filter(
        (g) => g.completedAt && g.completedAt.startsWith(dateStr),
      ).length;

      const timeLogged = State.data.goals.reduce((sum, g) => {
        return (
          sum +
          g.timeLog
            .filter((log) => log.date.startsWith(dateStr))
            .reduce((s, log) => s + log.minutes, 0)
        );
      }, 0);

      last30Days.push({ date: dateStr, goalsCompleted, timeLogged });
    }

    return last30Days;
  },
};
