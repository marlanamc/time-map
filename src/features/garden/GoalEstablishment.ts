import { Goals } from "../../core/Goals";
import { State } from "../../core/State";
import { Goal, GoalLevel } from "../../types";

export type MissingGoalType =
  | "morning-of" // Intention for today
  | "day-ahead" // Intention for tomorrow
  | "week-ahead" // Focus for current week
  | "month-ahead" // Milestone for current month
  | "year-ahead" // Vision for current year
  | null; // All set

export interface GoalEstablishmentStatus {
  missingType: MissingGoalType;
  contextFact: string;
}

export const GoalEstablishment = {
  checkMissingGoals(): GoalEstablishmentStatus {
    const today = new Date();
    const headers = Goals.getAll();

    // 1. Year Ahead (Vision)
    // simplistic check: do we have ANY active vision for this year?
    const hasVision = headers.some(
      (g) =>
        g.level === "vision" && g.status !== "archived" && g.status !== "done",
    );

    if (!hasVision) {
      return {
        missingType: "year-ahead",
        contextFact: getTimeBlindnessFact("year"),
      };
    }

    // 2. Month Ahead (Milestone)
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const hasMonthMilestone = headers.some(
      (g) =>
        g.level === "milestone" &&
        g.status !== "archived" &&
        g.status !== "done" &&
        // Ideally we check due date or month/year field, but for now simple existence is a start.
        // Let's be more specific if possible. If month/year is stored on goal:
        (g.month === currentMonth ||
          (g.dueDate && new Date(g.dueDate).getMonth() === currentMonth)),
    );

    if (!hasMonthMilestone) {
      return {
        missingType: "month-ahead",
        contextFact: getTimeBlindnessFact("month"),
      };
    }

    // 3. Week Ahead (Focus)
    const weekNum = State.getWeekNumber(today);
    // In a real app we'd check if the focus is actually for *this* week.
    // Assuming 'in-progress' focuses are relevant for now.
    const hasWeekFocus = headers.some(
      (g) => g.level === "focus" && g.status === "in-progress",
    );

    if (!hasWeekFocus) {
      return {
        missingType: "week-ahead",
        contextFact: getTimeBlindnessFact("week"),
      };
    }

    // 4. Day Ahead (Intention for Tomorrow)
    // Only urge this if it's evening? Or maybe always good to have?
    // User requested: "establish the goals of the day ahead"
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toDateString();

    const hasTomorrowIntention = headers.some(
      (g) =>
        g.level === "intention" &&
        g.status !== "archived" &&
        (g.scheduledAt
          ? new Date(g.scheduledAt).toDateString() === tomorrowString
          : false),
    );

    // We might not BLOCK on this unless it's late in the day, but let's follow the prompt order.
    // The prompt listed: Day Ahead, Morning Of (Day of), Week, Month, Year.
    // I am implementing reverse order of granularity for "missing" checks usually (Big -> Small),
    // but the user might want to plan tomorrow BEFORE today if it's late?
    // Let's stick to the standard hierarchy: Year -> Month -> Week -> Day.

    // Actually, "establish the goals of the day the morning of" suggests checking TODAY's intention.
    const todayString = today.toDateString();
    const hasTodayIntention = headers.some(
      (g) =>
        g.level === "intention" &&
        g.status !== "done" &&
        g.status !== "archived" &&
        // Matches today either by scheduled date or just being "in-progress" created recently?
        // Let's look for scheduledAt or just "in-progress" if valid.
        (g.scheduledAt
          ? new Date(g.scheduledAt).toDateString() === todayString
          : g.status === "in-progress"),
    );

    if (!hasTodayIntention) {
      return {
        missingType: "morning-of",
        contextFact: getTimeBlindnessFact("day"),
      };
    }

    // If today is set, maybe check tomorrow?
    // Only suggest tomorrow if it's after separate threshold, e.g. 5PM?
    // For now, let's keep it simple. If they have today sorted, we good.
    // But user explicitly asked for "establish the goals of the day ahead".
    // Maybe we return that if everything else is done?
    if (!hasTomorrowIntention && today.getHours() >= 16) {
      return {
        missingType: "day-ahead",
        contextFact: getTimeBlindnessFact("tomorrow"),
      };
    }

    return {
      missingType: null,
      contextFact: "",
    };
  },
};

function getTimeBlindnessFact(
  scope: "year" | "month" | "week" | "day" | "tomorrow",
): string {
  const now = new Date();

  if (scope === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const percent = Math.floor((dayOfYear / 365) * 100);
    const monthsLeft = 12 - (now.getMonth() + 1);
    return `The year is ${percent}% complete. There are only ${monthsLeft} months left.`;
  }

  if (scope === "month") {
    const totalDays = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const daysLeft = totalDays - now.getDate();
    const percent = Math.floor((now.getDate() / totalDays) * 100);
    return `${percent}% of ${now.toLocaleString("default", { month: "long" })} is gone. ${daysLeft} days remain.`;
  }

  if (scope === "week") {
    const day = now.getDay(); // 0 is Sunday
    const dayName = now.toLocaleString("default", { weekday: "long" });

    // More encouraging and context-aware messages
    if (day === 6) {
      // Saturday
      return `It's ${dayName}. Perfect time to reflect and plan for the week ahead.`;
    } else if (day === 0) {
      // Sunday
      return `It's ${dayName}. A fresh week begins tomorrow - what's your main focus?`;
    } else {
      const daysLeft = 6 - day; // days until Saturday
      return `It's ${dayName}. You have ${daysLeft} day${daysLeft !== 1 ? "s" : ""} to make progress this week.`;
    }
  }

  if (scope === "day") {
    const hoursLeft = 24 - now.getHours();
    return `It's already ${now.getHours()}:00. You have ${hoursLeft} hours of potential today.`;
  }

  if (scope === "tomorrow") {
    return `Tomorrow is a fresh start. Planting seeds now helps them grow overnight.`;
  }

  return "";
}
