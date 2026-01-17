/**
 * IntentionsManager - CRUD operations for customizable intention templates
 * @remarks Manages user-defined intention templates stored in localStorage
 */

import type { CustomIntention, Category } from "../types";
import { State } from "./State";

const STORAGE_KEY = "gardenFence.customIntentions";

/**
 * Default intention templates (fallback when no custom intentions exist)
 * @remarks Based on the hardcoded common intentions from PlannerDayViewRenderer
 */
const DEFAULT_INTENTIONS: Omit<CustomIntention, "id" | "createdAt">[] = [
  {
    title: "Deep work",
    category: "career",
    duration: 90,
    emoji: "💼",
    order: 0,
  },
  {
    title: "Email + admin",
    category: "career",
    duration: 45,
    emoji: "📧",
    order: 1,
  },
  { title: "Workout", category: "health", duration: 60, emoji: "💪", order: 2 },
  {
    title: "Meal prep",
    category: "health",
    duration: 60,
    emoji: "🍳",
    order: 3,
  },
  {
    title: "Budget check-in",
    category: "finance",
    duration: 30,
    emoji: "💰",
    order: 4,
  },
  {
    title: "Creative session",
    category: "creative",
    duration: 60,
    emoji: "🎨",
    order: 5,
  },
  {
    title: "Journal + reflect",
    category: "personal",
    duration: 20,
    emoji: "📝",
    order: 6,
  },
];

/**
 * Generate a unique ID for a custom intention
 * @returns UUID v4 string
 */
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * IntentionsManager class
 * @remarks Singleton manager for custom intention CRUD operations
 */
export class IntentionsManager {
  /**
   * Load custom intentions from localStorage
   * @returns Array of custom intentions, or defaults if none exist
   */
  static load(): CustomIntention[] {
    try {
      // Use State as the source of truth
      const intentions = State.data?.preferences?.nd?.customIntentions;

      if (!intentions || intentions.length === 0) {
        // If no intentions in state, check if we need to initialize with defaults
        // (State.migrateDataIfNeeded already handles migration from old localStorage)
        const defaults = this.getDefaults();
        this.save(defaults);
        return defaults;
      }

      // Validate and sanitize
      return intentions.filter((item): item is CustomIntention => {
        return (
          typeof item === "object" &&
          item !== null &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          item.title.trim().length > 0 &&
          typeof item.duration === "number" &&
          item.duration >= 5 &&
          item.duration <= 480
        );
      });
    } catch (error) {
      console.error("Failed to load custom intentions:", error);
      return this.getDefaults();
    }
  }

  /**
   * Save custom intentions to localStorage
   * @param intentions - Array of custom intentions to save
   * @returns True if save succeeded, false otherwise
   */
  static save(intentions: CustomIntention[]): boolean {
    try {
      // Validate before saving
      const valid = intentions.every((item) => {
        return (
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          item.title.trim().length > 0 &&
          typeof item.duration === "number" &&
          item.duration >= 5 &&
          item.duration <= 480
        );
      });

      if (!valid) {
        console.error("Invalid intentions data, refusing to save");
        return false;
      }

      // Update State
      if (State.data && State.data.preferences && State.data.preferences.nd) {
        State.data.preferences.nd.customIntentions = intentions;
        State.save(); // Triggers both localStorage and cloud sync
      }

      // Keep legacy localStorage for fallback/migration safety for now
      localStorage.setItem(STORAGE_KEY, JSON.stringify(intentions));

      return true;
    } catch (error) {
      console.error("Failed to save custom intentions:", error);
      return false;
    }
  }

  /**
   * Get default intention templates
   * @returns Array of default custom intentions with generated IDs
   */
  static getDefaults(): CustomIntention[] {
    const now = new Date().toISOString();
    return DEFAULT_INTENTIONS.map((template) => ({
      ...template,
      id: generateId(),
      createdAt: now,
    }));
  }

  /**
   * Add a new custom intention
   * @param title - Intention title
   * @param category - Category type
   * @param duration - Duration in minutes (5-480)
   * @param emoji - Optional emoji icon
   * @returns The newly created intention, or null if failed
   */
  static add(
    title: string,
    category: Category,
    duration: number,
    emoji?: string,
  ): CustomIntention | null {
    // Validation
    if (!title || title.trim().length === 0) {
      console.error("Intention title is required");
      return null;
    }

    if (duration < 5 || duration > 480) {
      console.error("Duration must be between 5 and 480 minutes");
      return null;
    }

    const intentions = this.load();
    const maxOrder = intentions.reduce(
      (max, item) => Math.max(max, item.order),
      -1,
    );

    const newIntention: CustomIntention = {
      id: generateId(),
      title: title.trim(),
      category,
      duration: Math.floor(duration),
      emoji: emoji?.trim() || undefined,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };

    intentions.push(newIntention);

    if (this.save(intentions)) {
      return newIntention;
    }

    return null;
  }

  /**
   * Update an existing custom intention
   * @param id - Intention ID to update
   * @param updates - Partial intention data to update
   * @returns True if update succeeded, false otherwise
   */
  static update(
    id: string,
    updates: Partial<Omit<CustomIntention, "id" | "createdAt">>,
  ): boolean {
    const intentions = this.load();
    const index = intentions.findIndex((item) => item.id === id);

    if (index === -1) {
      console.error(`Intention with id ${id} not found`);
      return false;
    }

    // Validate updates
    if (updates.title !== undefined && updates.title.trim().length === 0) {
      console.error("Intention title cannot be empty");
      return false;
    }

    if (
      updates.duration !== undefined &&
      (updates.duration < 5 || updates.duration > 480)
    ) {
      console.error("Duration must be between 5 and 480 minutes");
      return false;
    }

    // Apply updates
    intentions[index] = {
      ...intentions[index],
      ...updates,
      title: updates.title?.trim() ?? intentions[index].title,
      emoji: updates.emoji?.trim() ?? intentions[index].emoji,
      duration:
        updates.duration !== undefined
          ? Math.floor(updates.duration)
          : intentions[index].duration,
    };

    return this.save(intentions);
  }

  /**
   * Delete a custom intention
   * @param id - Intention ID to delete
   * @returns True if deletion succeeded, false otherwise
   */
  static delete(id: string): boolean {
    const intentions = this.load();
    const filtered = intentions.filter((item) => item.id !== id);

    if (filtered.length === intentions.length) {
      console.error(`Intention with id ${id} not found`);
      return false;
    }

    // Reorder remaining intentions
    filtered.sort((a, b) => a.order - b.order);
    filtered.forEach((item, index) => {
      item.order = index;
    });

    return this.save(filtered);
  }

  /**
   * Reorder custom intentions
   * @param orderedIds - Array of intention IDs in desired order
   * @returns True if reorder succeeded, false otherwise
   */
  static reorder(orderedIds: string[]): boolean {
    const intentions = this.load();

    // Validate that all IDs exist
    const allIdsExist = orderedIds.every((id) =>
      intentions.some((item) => item.id === id),
    );

    if (!allIdsExist || orderedIds.length !== intentions.length) {
      console.error("Invalid reorder: ID mismatch");
      return false;
    }

    // Create new order
    const reordered = orderedIds.map((id, index) => {
      const intention = intentions.find((item) => item.id === id)!;
      return {
        ...intention,
        order: index,
      };
    });

    return this.save(reordered);
  }

  /**
   * Reset to default intentions
   * @returns Array of default intentions
   */
  static reset(): CustomIntention[] {
    const defaults = this.getDefaults();
    this.save(defaults);
    return defaults;
  }

  /**
   * Get a single intention by ID
   * @param id - Intention ID
   * @returns The intention, or null if not found
   */
  static getById(id: string): CustomIntention | null {
    const intentions = this.load();
    return intentions.find((item) => item.id === id) || null;
  }

  /**
   * Get intentions sorted by order
   * @returns Array of intentions sorted by order field
   */
  static getSorted(): CustomIntention[] {
    const intentions = this.load();
    return intentions.sort((a, b) => a.order - b.order);
  }

  /**
   * Check if custom intentions exist (not defaults)
   * @returns True if user has customized intentions
   */
  static hasCustomized(): boolean {
    try {
      // Check if State has any custom intentions beyond the count of defaults
      // or if the legacy key exists
      const intentions = State.data?.preferences?.nd?.customIntentions;
      if (intentions && intentions.length > 0) return true;

      const raw = localStorage.getItem(STORAGE_KEY);
      return raw !== null;
    } catch {
      return false;
    }
  }
}
