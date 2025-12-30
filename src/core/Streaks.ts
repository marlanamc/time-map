// ===================================
// Streak Management
// ===================================
import { State } from './State';
import { Goals } from './Goals';

export const Streaks = {
  check() {
    if (!State.data) return;
    const today = new Date().toISOString().split("T")[0];
    const lastDate = State.data.streak.lastDate;

    if (lastDate === today) {
      return; // Already checked in today
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (lastDate === yesterdayStr) {
      // Continuing streak
      State.data.streak.count++;
    } else if (lastDate !== today) {
      // Streak broken or first time
      State.data.streak.count = 1;
    }

    State.data.streak.lastDate = today;

    // Update best streak
    if (State.data.streak.count > State.data.analytics.streakBest) {
      State.data.analytics.streakBest = State.data.streak.count;
    }

    // Check streak achievements
    if (
      State.data.streak.count >= 7 &&
      !State.data.achievements.includes("weekStreak")
    ) {
      Goals.unlockAchievement("weekStreak");
    }
    if (
      State.data.streak.count >= 30 &&
      !State.data.achievements.includes("monthStreak")
    ) {
      Goals.unlockAchievement("monthStreak");
    }

    State.save();
  },

  getCount() {
    return State.data?.streak.count ?? 0;
  },
};
