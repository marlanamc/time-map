const defaultData = {
  goals: [],
  events: [],
  streak: { count: 0, lastDate: null },
  achievements: [],
  weeklyReviews: [],
  brainDump: [],
  bodyDoubleHistory: [],
  preferences: {
    focusMode: false,
    reducedMotion: false,
    theme: "day",
    defaultView: "year",
    layout: {
      showHeader: true,
      showControlBar: true,
      showSidebar: true,
      showNowPanel: true,
    },
    sidebar: {
      showAffirmation: false,
      showWhatsNext: false,
      showAchievements: false,
    },
    sidebarSections: {
      affirmation: false,
      upcoming: true,
      achievements: false,
    },
    nd: {
      accentTheme: "sage",
      breakReminder: "gentle",
      feedbackStyle: "moderate",
      maxVisibleTasks: "normal",
      showInitiationPrompts: true,
      fontChoice: "default",
      textSpacing: "normal",
      hideCompletedTasks: false,
      autoBodyDouble: false,
      transitionWarnings: true,
      simplifiedView: false,
      colorBlindMode: "none",
      showTimeInMultipleFormats: true,
      taskStartReminders: true,
      allowPartialProgress: true,
      reduceEmojis: false,
      contextBarCollapsed: false,
      customIntentions: [],
      checkInDay: 0,
      checkInTime: "09:00",
    },
  },
  analytics: {
    goalsCreated: 0,
    goalsCompleted: 0,
    totalTimeSpent: 0,
    streakBest: 0,
  },
  createdAt: "",
  version: 2,
};

const mockGoals: Goal[] = [];
const mockEvents: CalendarEvent[] = [];

jest.mock("../../../src/core/State", () => {
  const mockState = {
    data: null as any,
    currentView: "garden",
    viewingDate: new Date("2024-06-15T12:00:00Z"),
    viewingYear: 2024,
    viewingMonth: 5,
    viewingWeek: 24,
    goToDate(date: Date | string) {
      this.viewingDate = new Date(date);
      this.viewingYear = this.viewingDate.getFullYear();
      this.viewingMonth = this.viewingDate.getMonth();
    },
    getWeekNumber: () => 24,
    getDefaultData: () => JSON.parse(JSON.stringify(defaultData)),
    setView: () => {},
  };
  return { State: mockState };
});

jest.mock("../../../src/core/Goals", () => ({
  Goals: {
    getForRange: () => mockGoals,
    getAll: () => mockGoals,
    getById: (id: string) => mockGoals.find((g) => g.id === id) || null,
    update: jest.fn(),
  },
  ensurePlanningFocusForGoal: async (goal: Goal) => goal,
}));

jest.mock("../../../src/core/Events", () => ({
  Events: {
    getForRange: () => mockEvents,
  },
}));

import { GardenHorizonRenderer } from "../../../src/ui/renderers/GardenHorizonRenderer";
import { State } from "../../../src/core/State";
import { VIEWS } from "../../../src/config";
import { eventBus } from "../../../src/core/EventBus";
import type { CalendarEvent, Goal, UIElements } from "../../../src/types";

const viewDate = new Date("2024-06-15T12:00:00Z");

const buildGoal = (overrides: Partial<Goal>): Goal => ({
  id: "goal-id",
  title: "Sample",
  level: "vision",
  description: "",
  month: viewDate.getMonth(),
  year: viewDate.getFullYear(),
  category: null,
  priority: "medium",
  status: "in-progress",
  progress: 0,
  subtasks: [],
  notes: [],
  timeLog: [],
  createdAt: viewDate.toISOString(),
  updatedAt: viewDate.toISOString(),
  completedAt: null,
  lastWorkedOn: null,
  dueDate: null,
  parentId: null,
  parentLevel: null,
  archivedAt: null,
  tags: [],
  ...overrides,
});

const sampleEvent: CalendarEvent = {
  id: "event-1",
  title: "Weekly Jam",
  description: "",
  startAt: "2024-06-17T15:00:00.000Z",
  endAt: "2024-06-17T16:00:00.000Z",
  allDay: false,
  recurrence: null,
  createdAt: viewDate.toISOString(),
  updatedAt: viewDate.toISOString(),
};

describe("GardenHorizonRenderer", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="calendarGrid"></div>`;
    const data = State.getDefaultData();
    data.goals = [];
    data.events = [];
    State.data = data;
    State.currentView = VIEWS.GARDEN;
    State.goToDate(viewDate);
    mockGoals.length = 0;
    mockEvents.length = 0;
    // JSDOM lacks CSS.escape; provide a minimal shim for selection styling.
    if (!(global as any).CSS) {
      (global as any).CSS = { escape: (val: string) => val };
    } else if (!(global as any).CSS.escape) {
      (global as any).CSS.escape = (val: string) => val;
    }
  });

  afterEach(() => {
    State.data = null;
    document.body.innerHTML = "";
  });

  it("renders the Garden timeline and emits plan requests with the selected vision", () => {
    const vision = buildGoal({
      id: "vision-1",
      level: "vision",
      title: "North Star",
      icon: "✨",
    });
    const milestone = buildGoal({
      id: "milestone-1",
      level: "milestone",
      title: "Q2 Milestone",
      parentId: "vision-1",
      parentLevel: "vision",
      month: 5,
      dueDate: "2024-06-30",
    });
    const focus = buildGoal({
      id: "focus-1",
      level: "focus",
      title: "Weekly Focus",
      parentId: "milestone-1",
      parentLevel: "milestone",
      month: 5,
      dueDate: "2024-06-21",
      commitment: {
        frequency: 2,
        duration: 60,
        energyType: "focus",
        horizon: "week",
        createdAt: viewDate.toISOString(),
        updatedAt: viewDate.toISOString(),
      },
    });
    const intention = buildGoal({
      id: "intention-1",
      level: "intention",
      title: "Today step",
      parentId: "focus-1",
      parentLevel: "focus",
      month: 5,
      dueDate: "2024-06-15",
    });

    mockGoals.push(vision, milestone, focus, intention);
    mockEvents.push(sampleEvent);

    const goalClickSpy = jest.fn();
    const addGoalSpy = jest.fn();
    const elements = {
      calendarGrid: document.getElementById("calendarGrid"),
    } as unknown as UIElements;

    expect(() =>
      GardenHorizonRenderer.render(
        elements,
        (text: string) => text,
        goalClickSpy,
        addGoalSpy,
      ),
    ).not.toThrow();

    expect(
      document.querySelector(".spine-vision-title")?.textContent,
    ).toContain("North Star");
    expect(
      document.querySelector(".time-band-week .time-band-value"),
    ).not.toBeNull();
    expect(
      document.querySelector(".time-band-month .time-band-value")?.textContent,
    ).toContain("June");
    expect(document.querySelector(".now-intention")?.textContent).toContain(
      "Today step",
    );

    const weekMarker = document.querySelector(
      ".time-band-week .time-band-marker",
    ) as HTMLElement;
    weekMarker.click();
    expect(goalClickSpy).toHaveBeenCalledWith("focus-1");

    const planSpy = jest.fn();
    const unsubscribe = eventBus.on("garden:plan-requested", (payload) =>
      planSpy(payload),
    );
    const visionItem = document.querySelector(".spine-vision-item") as HTMLElement;
    visionItem.click();
    const planButton = document.querySelector(
      '.utility-rail-btn[data-action="plan"]',
    ) as HTMLElement;
    planButton.click();
    expect(planSpy).toHaveBeenCalledWith({ goalId: "vision-1" });
    unsubscribe();

    expect(document.querySelector(".time-band-events")).not.toBeNull();
  });
});
