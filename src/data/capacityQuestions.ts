/**
 * Capacity Check Question Data
 * @remarks Defines the branching questionnaire flow adapted from youfeellikeshit.com
 * for assessing daily planning capacity in a gentle, neurodivergent-friendly way.
 */

import type { EnergyType } from "../types";

/** Capacity level result from the check-in */
export type CapacityLevel = "high" | "medium" | "low" | "rest";

/** State accumulated as user answers questions */
export interface CapacityState {
  capacityLevel: CapacityLevel;
  energyType: EnergyType;
  availableMinutes: number;
  notes: string[];
  needsGrounding: boolean;
}

/** A single answer option for a question */
export interface CapacityOption {
  id: string;
  label: string;
  /** State changes to apply when selected */
  effect?: Partial<CapacityState>;
  /** Optional supportive guidance to show */
  guidance?: string;
  /** Next question ID, 'next' for sequential, or 'end' to finish */
  nextId: string | "next" | "end";
}

/** A single question in the flow */
export interface CapacityQuestion {
  id: string;
  category: "physical" | "mental" | "energy";
  text: string;
  subtext?: string;
  options: CapacityOption[];
}

/** Initial state before answering questions */
export const DEFAULT_CAPACITY_STATE: CapacityState = {
  capacityLevel: "medium",
  energyType: "focus",
  availableMinutes: 60,
  notes: [],
  needsGrounding: false,
};

/**
 * The full question flow for the Capacity Check
 * Adapted from youfeellikeshit.com patterns for goal-planning context
 */
export const CAPACITY_QUESTIONS: CapacityQuestion[] = [
  // ─────────────────────────────────────────────────────────────
  // Category 1: Physical Foundation
  // ─────────────────────────────────────────────────────────────
  {
    id: "food",
    category: "physical",
    text: "Have you had something to eat in the last few hours?",
    options: [
      {
        id: "food-yes",
        label: "Yes, I've eaten",
        nextId: "next",
      },
      {
        id: "food-no",
        label: "Not yet",
        guidance:
          "That's okay! Grab something quick first—your brain needs fuel to plan. Even a small snack helps.",
        nextId: "next",
      },
    ],
  },
  {
    id: "rest",
    category: "physical",
    text: "Did you get enough sleep last night?",
    options: [
      {
        id: "rest-yes",
        label: "Yes, I'm rested",
        nextId: "next",
      },
      {
        id: "rest-no",
        label: "Not really",
        effect: { capacityLevel: "low" },
        guidance:
          "Low energy day noted. We'll keep today's plans light. That's totally okay.",
        nextId: "next",
      },
    ],
  },
  {
    id: "discomfort",
    category: "physical",
    text: "Are you in any physical discomfort right now?",
    subtext: "Pain, illness, sensory overload, etc.",
    options: [
      {
        id: "discomfort-no",
        label: "No, I'm comfortable",
        nextId: "next",
      },
      {
        id: "discomfort-yes",
        label: "Yes, something's off",
        effect: { capacityLevel: "low" },
        guidance:
          "Take a moment to address that first if you can. You can come back anytime.",
        nextId: "next",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // Category 2: Mental State
  // ─────────────────────────────────────────────────────────────
  {
    id: "bandwidth",
    category: "mental",
    text: "How's your mental bandwidth feeling today?",
    options: [
      {
        id: "bandwidth-high",
        label: "Good — ready to focus",
        effect: { capacityLevel: "high" },
        nextId: "next",
      },
      {
        id: "bandwidth-medium",
        label: "Moderate — can do some things",
        effect: { capacityLevel: "medium" },
        nextId: "next",
      },
      {
        id: "bandwidth-low",
        label: "Low — struggling today",
        effect: { capacityLevel: "low" },
        guidance: "That's okay. We'll keep things simple.",
        nextId: "next",
      },
    ],
  },
  {
    id: "obligations",
    category: "mental",
    text: "Do you have time-sensitive obligations today?",
    subtext: "Work, appointments, deadlines, etc.",
    options: [
      {
        id: "obligations-none",
        label: "No, pretty open",
        effect: { availableMinutes: 120 },
        nextId: "next",
      },
      {
        id: "obligations-some",
        label: "A few things",
        effect: { availableMinutes: 60 },
        nextId: "next",
      },
      {
        id: "obligations-busy",
        label: "Very busy day",
        effect: { availableMinutes: 30, capacityLevel: "low" },
        guidance: "Busy day noted. We'll focus on what's essential.",
        nextId: "next",
      },
    ],
  },
  {
    id: "overwhelmed",
    category: "mental",
    text: "Are you feeling overwhelmed or anxious right now?",
    options: [
      {
        id: "overwhelmed-no",
        label: "No, I'm okay",
        nextId: "next",
      },
      {
        id: "overwhelmed-little",
        label: "A little",
        effect: { capacityLevel: "medium" },
        guidance: "Let's keep things simple today.",
        nextId: "next",
      },
      {
        id: "overwhelmed-yes",
        label: "Yes, significantly",
        effect: { capacityLevel: "rest", needsGrounding: true },
        guidance:
          "It's okay to feel this way. Would you like to try a quick grounding exercise first?",
        nextId: "grounding",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // Optional: Grounding Exercise
  // ─────────────────────────────────────────────────────────────
  {
    id: "grounding",
    category: "mental",
    text: "Let's try a quick grounding moment",
    subtext:
      "Take a slow breath. Notice 3 things you can see. Feel your feet on the floor.",
    options: [
      {
        id: "grounding-done",
        label: "Okay, I did that",
        guidance: "Well done. Let's continue gently.",
        nextId: "next",
      },
      {
        id: "grounding-skip",
        label: "I'll skip for now",
        nextId: "next",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // Category 3: Energy Assessment
  // ─────────────────────────────────────────────────────────────
  {
    id: "energy-type",
    category: "energy",
    text: "What kind of energy do you have available?",
    options: [
      {
        id: "energy-focus",
        label: "Focus energy — can concentrate",
        effect: { energyType: "focus" },
        nextId: "next",
      },
      {
        id: "energy-creative",
        label: "Creative energy — scattered but inspired",
        effect: { energyType: "creative" },
        nextId: "next",
      },
      {
        id: "energy-rest",
        label: "Rest energy — maintenance mode only",
        effect: { energyType: "rest", capacityLevel: "low" },
        nextId: "next",
      },
      {
        id: "energy-recharge",
        label: "Recharge needed — survival only",
        effect: { energyType: "admin", capacityLevel: "rest" },
        guidance: "Today is for essentials only. Be gentle with yourself.",
        nextId: "next",
      },
    ],
  },
  {
    id: "time-available",
    category: "energy",
    text: "How much time do you realistically have for goals today?",
    options: [
      {
        id: "time-plenty",
        label: "2+ hours",
        effect: { availableMinutes: 120 },
        nextId: "end",
      },
      {
        id: "time-some",
        label: "30–60 minutes",
        effect: { availableMinutes: 45 },
        nextId: "end",
      },
      {
        id: "time-little",
        label: "15–30 minutes",
        effect: { availableMinutes: 20 },
        nextId: "end",
      },
      {
        id: "time-minimal",
        label: "Just a few minutes",
        effect: { availableMinutes: 10, capacityLevel: "rest" },
        guidance: "Even a few minutes count. Every small step matters.",
        nextId: "end",
      },
    ],
  },
];

/**
 * Get the next question in the flow
 * @param currentId Current question ID
 * @param nextId The nextId value from the selected option
 * @returns The next question or null if at end
 */
export function getNextQuestion(
  currentId: string,
  nextId: string | "next" | "end",
): CapacityQuestion | null {
  if (nextId === "end") {
    return null;
  }

  const questions = CAPACITY_QUESTIONS;
  const currentIndex = questions.findIndex((q) => q.id === currentId);

  if (nextId === "next") {
    // Skip grounding if we didn't branch to it
    let nextIndex = currentIndex + 1;
    while (nextIndex < questions.length) {
      // eslint-disable-next-line security/detect-object-injection
      const next = questions[nextIndex];
      // Skip grounding question if we're just going "next" (not explicitly branched)
      if (next.id === "grounding" && currentId !== "overwhelmed") {
        nextIndex++;
        continue;
      }
      return next;
    }
    return null;
  }

  // Specific question ID
  return questions.find((q) => q.id === nextId) ?? null;
}

/**
 * Get the first question to start the flow
 */
export function getFirstQuestion(): CapacityQuestion {
  return CAPACITY_QUESTIONS[0];
}

/**
 * Apply an option's effect to the current state
 * @param state Current capacity state
 * @param effect Effect to apply
 * @returns New state with effect applied
 */
export function applyEffect(
  state: CapacityState,
  effect?: Partial<CapacityState>,
): CapacityState {
  if (!effect) return state;

  const newState = { ...state };

  // Capacity level: only downgrade, never upgrade
  if (effect.capacityLevel) {
    const levels: CapacityLevel[] = ["high", "medium", "low", "rest"];
    const currentIdx = levels.indexOf(state.capacityLevel);
    const effectIdx = levels.indexOf(effect.capacityLevel);
    if (effectIdx > currentIdx) {
      newState.capacityLevel = effect.capacityLevel;
    }
  }

  // Available minutes: take the minimum
  if (effect.availableMinutes !== undefined) {
    newState.availableMinutes = Math.min(
      state.availableMinutes,
      effect.availableMinutes,
    );
  }

  // Energy type: overwrite
  if (effect.energyType) {
    newState.energyType = effect.energyType;
  }

  // Needs grounding: set if true
  if (effect.needsGrounding) {
    newState.needsGrounding = true;
  }

  // Notes: append
  if (effect.notes) {
    newState.notes = [...state.notes, ...effect.notes];
  }

  return newState;
}

/**
 * Get a human-readable summary of the capacity result
 */
export function getCapacitySummary(state: CapacityState): string {
  const levelDescriptions: Record<CapacityLevel, string> = {
    high: "a high-capacity day",
    medium: "a moderate-capacity day",
    low: "a low-capacity day",
    rest: "a rest and recharge day",
  };

  const energyDescriptions: Record<string, string> = {
    focus: "Focus energy",
    creative: "Creative energy",
    rest: "Rest energy",
    admin: "Light admin energy",
  };

  const timeDescription =
    state.availableMinutes >= 90
      ? "plenty of time"
      : state.availableMinutes >= 45
        ? "some time"
        : state.availableMinutes >= 20
          ? "a bit of time"
          : "a few minutes";

  return `Today looks like ${levelDescriptions[state.capacityLevel]}. You have ${timeDescription} available and ${energyDescriptions[state.energyType] || "mixed energy"} to work with.`;
}
