import { getGoalEmoji } from "../../src/utils/goalVisuals";
import { Goal } from "../../src/types";

describe("goalVisuals.getGoalEmoji", () => {
  const baseGoal: Goal = {
    id: "1",
    title: "Test Goal",
    level: "vision",
    description: "",
    month: 0,
    year: 2024,
    category: null,
    priority: "medium",
    status: "not-started",
    progress: 0,
    subtasks: [],
    notes: [],
    timeLog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    lastWorkedOn: null,
    dueDate: null,
    tags: [],
  };

  it("prioritizes goal.icon over everything else", () => {
    const goal: Goal = {
      ...baseGoal,
      icon: "⭐",
      category: "career", // Default emoji is 💼
      activityId: "workout", // Default emoji is 🏋️
    };
    expect(getGoalEmoji(goal)).toBe("⭐");
  });

  it("falls back to activity emoji if no icon is set", () => {
    const goal: Goal = {
      ...baseGoal,
      category: "career",
      activityId: "workout",
    };
    expect(getGoalEmoji(goal)).toBe("🏋️");
  });

  it("falls back to category emoji if no icon or activity emoji is set", () => {
    const goal: Goal = {
      ...baseGoal,
      category: "career",
    };
    expect(getGoalEmoji(goal)).toBe("💼");
  });

  it("uses fallback emoji if nothing else is set", () => {
    const goal: Goal = {
      ...baseGoal,
      category: null,
    };
    expect(getGoalEmoji(goal)).toBe("📍");
    expect(getGoalEmoji(goal, "⭐")).toBe("⭐");
  });
});
