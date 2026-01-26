/**
 * Zod validation schemas for Time Map application
 * @remarks Runtime validation to ensure data integrity and prevent malformed data
 */

import { z } from "zod";

// =============================================================================
// Enums and Literals
// =============================================================================

export const ViewTypeSchema = z.enum([
  "year",
  "month",
  "week",
  "day",
  "home",
  "garden",
]);

export const GoalLevelSchema = z.enum([
  "vision",
  "milestone",
  "focus",
  "intention",
]);

export const GoalStatusSchema = z.enum([
  "not-started",
  "in-progress",
  "done",
  "blocked",
  "cancelled",
  "archived",
]);

export const PrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const CategorySchema = z
  .enum(["career", "health", "finance", "personal", "creative"])
  .nullable();

export const AccentThemeSchema = z.enum([
  "rose",
  "coral",
  "amber",
  "mint",
  "sage",
  "sky",
  "teal",
  "indigo",
  "violet",
  "lime",
  "emerald",
  "fuchsia",
  "pink",
  "cyan",
  "yellow",
  "orange",
  "rainbow",
  "dawn",
  "morning",
  "afternoon",
  "evening",
  "night",
]);

export const BreakReminderSchema = z.enum([
  "pomodoro",
  "gentle",
  "hyperfocus",
  "off",
]);

export const FeedbackStyleSchema = z.enum([
  "subtle",
  "moderate",
  "celebration",
  "minimal",
]);

export const MaxVisibleTasksSchema = z.enum([
  "overwhelmed",
  "low_energy",
  "normal",
  "high_energy",
]);

export const FontChoiceSchema = z.enum([
  "default",
  "dyslexia",
  "mono",
  "readable",
]);

export const TextSpacingSchema = z.enum([
  "compact",
  "normal",
  "relaxed",
  "dyslexia",
]);

export const ColorBlindModeSchema = z.enum([
  "none",
  "deuteranopia",
  "protanopia",
  "tritanopia",
]);

// =============================================================================
// Helper Schemas
// =============================================================================

/** ISO date string (YYYY-MM-DD or full ISO 8601) */
const IsoDateStringSchema = z.string().refine(
  (val) => {
    if (!val) return true; // Allow empty strings to be caught by optional()
    // Accept YYYY-MM-DD or full ISO 8601
    // Using simpler validation to avoid regex complexity warnings
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
    const isoFull = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    return dateOnly.test(val) || isoFull.test(val);
  },
  { message: "Invalid date format. Expected YYYY-MM-DD or ISO 8601" },
);

/** Time string (HH:MM format) */
const TimeStringSchema = z.string().refine(
  (val) => {
    if (!val) return true; // Allow empty strings to be caught by optional()
    // Accept HH:MM format (24-hour time)
    const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timePattern.test(val);
  },
  { message: "Invalid time format. Expected HH:MM (24-hour format)" },
);

/** Non-empty trimmed string with max length */
const SafeStringSchema = (maxLength: number = 1000) =>
  z
    .string()
    .max(maxLength, `String exceeds maximum length of ${maxLength}`)
    .transform((val) => val.trim());

/** Title string - non-empty, reasonable length */
const TitleSchema = z
  .string()
  .min(1, "Title is required")
  .max(500, "Title exceeds maximum length of 500 characters")
  .transform((val) => val.trim());

/** Description string - can be empty, reasonable length */
const DescriptionSchema = z
  .string()
  .max(10000, "Description exceeds maximum length of 10000 characters")
  .transform((val) => val.trim());

/** UUID or nanoid-style ID */
const IdSchema = z
  .string()
  .min(1, "ID is required")
  .max(50, "ID exceeds maximum length");

/** Month number (0-11) */
const MonthSchema = z
  .number()
  .int("Month must be an integer")
  .min(0, "Month must be between 0 and 11")
  .max(11, "Month must be between 0 and 11");

/** Year number (reasonable range) */
const YearSchema = z
  .number()
  .int("Year must be an integer")
  .min(1900, "Year must be 1900 or later")
  .max(2100, "Year must be 2100 or earlier");

/** Progress percentage (0-100) */
const ProgressSchema = z
  .number()
  .min(0, "Progress must be between 0 and 100")
  .max(100, "Progress must be between 0 and 100");

/** Duration in minutes (positive) */
const DurationMinutesSchema = z
  .number()
  .int("Duration must be an integer")
  .min(0, "Duration must be non-negative")
  .max(1440, "Duration cannot exceed 24 hours");

// =============================================================================
// Nested Object Schemas
// =============================================================================

export const GoalMetaSchema = z
  .object({
    tinyVersion: SafeStringSchema(500).optional(),
    lowEnergyVersion: SafeStringSchema(500).optional(),
    startDate: IsoDateStringSchema.optional(),
    easyMode: z.boolean().optional(),
    accentTheme: AccentThemeSchema.optional(),
  })
  .strict();

export const EnergyTypeSchema = z.enum(["focus", "creative", "rest", "admin"]);

export const CommitmentPlanSchema = z
  .object({
    frequency: z.number().int().min(1).max(7),
    duration: z.number().int().min(15).max(120),
    energyType: EnergyTypeSchema,
    energyType: EnergyTypeSchema,
    specificDays: z.array(z.number().int().min(0).max(6)).optional(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
  })
  .strict();

export const SubtaskSchema = z
  .object({
    id: IdSchema,
    title: TitleSchema,
    done: z.boolean(),
    createdAt: IsoDateStringSchema,
  })
  .strict();

export const NoteSchema = z
  .object({
    id: IdSchema,
    text: SafeStringSchema(5000),
    createdAt: IsoDateStringSchema,
  })
  .strict();

export const TimeLogEntrySchema = z
  .object({
    minutes: DurationMinutesSchema,
    description: DescriptionSchema,
    date: IsoDateStringSchema,
  })
  .strict();

export const CustomIntentionSchema = z
  .object({
    id: IdSchema,
    title: TitleSchema,
    category: CategorySchema,
    duration: DurationMinutesSchema,
    emoji: SafeStringSchema(10).optional(),
    visionId: IdSchema.optional(),
    order: z.number().int().min(0),
    createdAt: IsoDateStringSchema,
  })
  .strict();

// =============================================================================
// Main Entity Schemas
// =============================================================================

export const GoalSchema = z
  .object({
    id: IdSchema,
    title: TitleSchema,
    level: GoalLevelSchema,
    description: DescriptionSchema,
    month: MonthSchema,
    year: YearSchema,
    category: CategorySchema,
    priority: PrioritySchema,
    status: GoalStatusSchema,
    progress: ProgressSchema,
    subtasks: z.array(SubtaskSchema),
    notes: z.array(NoteSchema),
    timeLog: z.array(TimeLogEntrySchema),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
    completedAt: IsoDateStringSchema.nullable(),
    lastWorkedOn: IsoDateStringSchema.nullable(),
    dueDate: IsoDateStringSchema.nullable(),
    startTime: IsoDateStringSchema.nullable().optional(),
    endTime: IsoDateStringSchema.nullable().optional(),
    scheduledAt: IsoDateStringSchema.nullable().optional(),
    tags: z.array(SafeStringSchema(100)),
    meta: GoalMetaSchema.optional(),
    commitment: CommitmentPlanSchema.optional(),
    activityId: IdSchema.optional(),
    parentId: IdSchema.nullable().optional(),
    parentLevel: GoalLevelSchema.nullable().optional(),
    icon: SafeStringSchema(10).optional(),
    archivedAt: IsoDateStringSchema.nullable().optional(),
  })
  .strict();

export const GoalDataSchema = z
  .object({
    title: TitleSchema,
    level: GoalLevelSchema,
    description: DescriptionSchema.optional(),
    month: MonthSchema.optional(),
    year: YearSchema.optional(),
    category: CategorySchema.optional(),
    priority: PrioritySchema.optional(),
    dueDate: IsoDateStringSchema.nullable().optional(),
    startTime: TimeStringSchema.nullable().optional(),
    endTime: TimeStringSchema.nullable().optional(),
    scheduledAt: IsoDateStringSchema.nullable().optional(),
    activityId: IdSchema.optional(),
    parentId: IdSchema.nullable().optional(),
    parentLevel: GoalLevelSchema.nullable().optional(),
    startDate: IsoDateStringSchema.optional(),
    durationMonths: z.number().int().min(1).optional(),
    durationWeeks: z.number().int().min(1).optional(),
    tags: z.array(SafeStringSchema(100)).optional(),
    meta: GoalMetaSchema.optional(),
    icon: SafeStringSchema(10).optional(),
    commitment: CommitmentPlanSchema.optional(),
  })
  .strict();

export const EventRecurrenceSchema = z
  .object({
    freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().int().min(1).optional(),
    byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
    until: IsoDateStringSchema.optional(),
    count: z.number().int().min(1).optional(),
  })
  .strict();

export const CalendarEventSchema = z
  .object({
    id: IdSchema,
    title: TitleSchema,
    description: DescriptionSchema.optional(),
    startAt: IsoDateStringSchema,
    endAt: IsoDateStringSchema.nullable().optional(),
    allDay: z.boolean(),
    recurrence: EventRecurrenceSchema.nullable().optional(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
    archivedAt: IsoDateStringSchema.nullable().optional(),
  })
  .strict();

export const BrainDumpEntrySchema = z
  .object({
    id: IdSchema,
    text: SafeStringSchema(5000),
    createdAt: IsoDateStringSchema,
    processed: z.boolean(),
    archived: z.boolean().optional(),
    processedAction: SafeStringSchema(500).optional(),
    processedAt: IsoDateStringSchema.optional(),
    archivedAt: IsoDateStringSchema.nullable().optional(),
  })
  .strict();

export const BodyDoubleSessionSchema = z
  .object({
    id: IdSchema,
    duration: DurationMinutesSchema,
    startedAt: IsoDateStringSchema,
    completedAt: IsoDateStringSchema.nullable(),
    goalId: IdSchema.nullable(),
    completed: z.boolean().optional(),
    endedAt: IsoDateStringSchema.optional(),
  })
  .strict();

export const WeeklyReviewSchema = z
  .object({
    id: IdSchema,
    weekStart: IsoDateStringSchema,
    weekEnd: IsoDateStringSchema,
    goalsCompleted: z.number().int().min(0),
    timeSpent: z.number().min(0),
    notes: SafeStringSchema(10000),
    createdAt: IsoDateStringSchema,
    wins: z.array(SafeStringSchema(500)).optional(),
    challenges: z.array(SafeStringSchema(500)).optional(),
    learnings: SafeStringSchema(2000).optional(),
    nextWeekPriorities: z.array(SafeStringSchema(500)).optional(),
    mood: z.number().min(1).max(5).optional(),
    energyAvg: SafeStringSchema(50).optional(),
    archivedAt: IsoDateStringSchema.nullable().optional(),
  })
  .strict();

export const WeekReflectionSchema = z
  .object({
    id: IdSchema,
    weekYear: YearSchema,
    weekNum: z.number().int().min(1).max(53),
    createdAt: z.number(),
    answers: z
      .object({
        q1: SafeStringSchema(2000).optional(),
        q2: SafeStringSchema(2000).optional(),
        q3: SafeStringSchema(2000).optional(),
        wins: SafeStringSchema(2000).optional(),
        alignmentScore: z.number().min(1).max(5).optional(),
        growthNote: SafeStringSchema(2000).optional(),
        nextWeekPriorities: SafeStringSchema(2000).optional(),
      })
      .strict(),
  })
  .strict();

export const AchievementSchema = z
  .object({
    id: IdSchema,
    unlockedAt: IsoDateStringSchema,
  })
  .strict();

export const StreakSchema = z
  .object({
    count: z.number().int().min(0),
    lastDate: IsoDateStringSchema.nullable(),
  })
  .strict();

// =============================================================================
// Preferences Schemas
// =============================================================================

export const LayoutPreferencesSchema = z
  .object({
    showHeader: z.boolean(),
    showControlBar: z.boolean(),
    showSidebar: z.boolean(),
    showNowPanel: z.boolean(),
  })
  .strict();

export const SidebarPreferencesSchema = z
  .object({
    showAffirmation: z.boolean(),
    showWhatsNext: z.boolean(),
    showAchievements: z.boolean(),
  })
  .strict();

export const SidebarSectionsSchema = z
  .object({
    affirmation: z.boolean(),
    upcoming: z.boolean(),
    achievements: z.boolean(),
  })
  .strict();

export const GardenLevelEmojisSchema = z
  .object({
    milestone: SafeStringSchema(10).optional(),
    focus: SafeStringSchema(10).optional(),
    intention: SafeStringSchema(10).optional(),
  })
  .strict();

export const NDPreferencesSchema = z
  .object({
    accentTheme: AccentThemeSchema,
    breakReminder: BreakReminderSchema,
    feedbackStyle: FeedbackStyleSchema,
    maxVisibleTasks: MaxVisibleTasksSchema,
    showInitiationPrompts: z.boolean(),
    fontChoice: FontChoiceSchema,
    textSpacing: TextSpacingSchema,
    hideCompletedTasks: z.boolean(),
    autoBodyDouble: z.boolean(),
    transitionWarnings: z.boolean(),
    simplifiedView: z.boolean(),
    colorBlindMode: ColorBlindModeSchema,
    showTimeInMultipleFormats: z.boolean(),
    taskStartReminders: z.boolean(),
    allowPartialProgress: z.boolean(),
    reduceEmojis: z.boolean(),
    contextBarCollapsed: z.boolean().optional(),
    customIntentions: z.array(CustomIntentionSchema).optional(),
    checkInDay: z.number().int().min(0).max(6).optional(),
    checkInTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Invalid time format. Expected HH:mm")
      .optional(),
  })
  .strict();

export const PreferencesSchema = z
  .object({
    focusMode: z.boolean(),
    reducedMotion: z.boolean(),
    theme: z.string(),
    defaultView: ViewTypeSchema,
    layout: LayoutPreferencesSchema,
    sidebar: SidebarPreferencesSchema,
    sidebarSections: SidebarSectionsSchema,
    nd: NDPreferencesSchema,
    gardenLevelEmojis: GardenLevelEmojisSchema.optional(),
  })
  .strict();

export const AnalyticsSchema = z
  .object({
    goalsCreated: z.number().int().min(0),
    goalsCompleted: z.number().int().min(0),
    totalTimeSpent: z.number().min(0),
    streakBest: z.number().int().min(0),
  })
  .strict();

// =============================================================================
// Root AppData Schema
// =============================================================================

export const AppDataSchema = z
  .object({
    goals: z.array(GoalSchema),
    events: z.array(CalendarEventSchema),
    streak: StreakSchema,
    achievements: z.array(IdSchema),
    weeklyReviews: z.array(WeeklyReviewSchema),
    brainDump: z.array(BrainDumpEntrySchema),
    bodyDoubleHistory: z.array(BodyDoubleSessionSchema),
    preferences: PreferencesSchema,
    analytics: AnalyticsSchema,
    createdAt: IsoDateStringSchema,
    version: z.number().int().min(1),
  })
  .strict();

// =============================================================================
// Validation Helper Functions
// =============================================================================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
  errors?: never;
}

export interface ValidationFailure {
  success: false;
  data?: never;
  errors: z.ZodError;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validates data against a schema and returns a typed result
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validates a Goal object
 */
export function validateGoal(
  data: unknown,
): ValidationResult<z.infer<typeof GoalSchema>> {
  return validate(GoalSchema, data);
}

/**
 * Validates GoalData (for creation)
 */
export function validateGoalData(
  data: unknown,
): ValidationResult<z.infer<typeof GoalDataSchema>> {
  return validate(GoalDataSchema, data);
}

/**
 * Validates a CalendarEvent object
 */
export function validateCalendarEvent(
  data: unknown,
): ValidationResult<z.infer<typeof CalendarEventSchema>> {
  return validate(CalendarEventSchema, data);
}

/**
 * Validates a BrainDumpEntry object
 */
export function validateBrainDumpEntry(
  data: unknown,
): ValidationResult<z.infer<typeof BrainDumpEntrySchema>> {
  return validate(BrainDumpEntrySchema, data);
}

/**
 * Validates the entire AppData structure
 */
export function validateAppData(
  data: unknown,
): ValidationResult<z.infer<typeof AppDataSchema>> {
  return validate(AppDataSchema, data);
}

/**
 * Formats validation errors into a human-readable string
 */
export function formatValidationErrors(errors: z.ZodError): string {
  return errors.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

/**
 * Validates and throws if invalid (for use in strict contexts)
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  entityName: string = "data",
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMessage = formatValidationErrors(result.error);
    throw new Error(`Invalid ${entityName}: ${errorMessage}`);
  }
  return result.data;
}

/**
 * Partial validation - validates only provided fields (for updates)
 */
export function validatePartialGoal(
  data: unknown,
): ValidationResult<Partial<z.infer<typeof GoalSchema>>> {
  return validate(GoalSchema.partial(), data);
}

/**
 * Sanitizes a string by removing potentially dangerous content
 * Use this for user-generated content before displaying
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validates an array of goals and returns valid ones with error info
 */
export function validateGoalsArray(goals: unknown[]): {
  valid: z.infer<typeof GoalSchema>[];
  invalid: { index: number; errors: string }[];
} {
  const valid: z.infer<typeof GoalSchema>[] = [];
  const invalid: { index: number; errors: string }[] = [];

  goals.forEach((goal, index) => {
    const result = validateGoal(goal);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ index, errors: formatValidationErrors(result.errors) });
    }
  });

  return { valid, invalid };
}
