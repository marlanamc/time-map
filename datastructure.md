# Data Structure & Terminology Audit

This doc is a “stand back and evaluate” snapshot of the current data model and the language used across the app. It’s written to help you de-confuse goal terminology before you keep building more modals and UI.

The short version: the app has one primary persisted entity (`Goal`) that is used for **vision/milestone/focus/intention**, but we also have **intention templates**, **events**, and several “metadata channels” (`description`, `tags`, `category`, `parentId/parentLevel`) that are currently overloaded in ways that make the UI feel inconsistent.

---

## 1) Canonical Terms (What We *Want* Them To Mean)

### Goal horizons (time-based levels)

These are encoded as `Goal.level` (`GoalLevel`) in `src/types.ts`.

| Term in product language | Stored as | Intended time horizon | Typical view |
|---|---|---|---|
| Vision | `Goal.level = "vision"` | Year goal | Year view |
| Milestone | `Goal.level = "milestone"` | Month goal (often multi‑month) | Month view / Year month cards |
| Focus | `Goal.level = "focus"` | Week goal (often multi‑week) | Week view / Month week rows |
| Intention | `Goal.level = "intention"` | Day goal | Day view / Week day columns |

**Important:** “Goal” is the database object for all of these. “Vision/Milestone/Focus/Intention” are *modes* of a `Goal`.

### Categories (domain-based grouping)

Conceptually: “Area of life” or “Domain” (career/health/finance/personal/creative).

In code: `Goal.category` is *supposed* to be those values (`Category` in `src/types.ts`, `CONFIG.CATEGORIES` in `src/config/constants.ts`).

### Connections (alignment-based linking)

Conceptually: “What this supports / is aligned to”.

In code: `Goal.parentId` + `Goal.parentLevel` are used as a single “parent link” from one goal to another.

### Scheduling (time-of-day placement)

Conceptually: “This intention is on my calendar/timeline today.”

In code: `Goal.startTime`/`Goal.endTime` (plus `Goal.level === "intention"`) drive day planning. Separately, calendar `events` are their own entity.

---

## 2) The Current Persisted Entities

## 2.0 Where data actually lives (storage layers)

Today the same concepts can exist in multiple storage systems:

- **LocalStorage (app state)**: full `AppData` is persisted under `CONFIG.STORAGE_KEY` (currently `"visionboard_data"` in `src/config/constants.ts`) via `State.save()` (`src/core/State.ts`).
- **IndexedDB (offline + performance)**: goals/events/etc are also mirrored into an IndexedDB database named `"adhd-visionboard"` (`src/db.js`), using stores like `goals`, `events`, `weekReflections`, etc.
- **Supabase (cloud sync)**: goals live in the `goals` table (`supabase/migrations/*` + `src/services/supabase/GoalsService.ts`), events in `events`, preferences in `preferences`, etc.
- **LocalStorage (templates)**: intention templates use a different key (`"gardenFence.customIntentions"` in `src/core/IntentionsManager.ts`) and are not synced.

This is fine architecturally, but it increases the need for clear terminology because “saving” might mean “local only”, “local + IndexedDB”, “synced to Supabase”, or “template saved”.

### 2.1 `Goal` (the core, heavily overloaded entity)

Defined in `src/types.ts` and persisted in Supabase `goals` table (`supabase/migrations/001_initial_schema.sql`).

Key fields and what they currently mean:

- **Identity**: `id`, `createdAt`, `updatedAt`
- **Horizon**: `level` (`"vision" | "milestone" | "focus" | "intention"`)
- **Text**: `title`, `description`
- **Status**: `status`, `progress`, `completedAt`, `lastWorkedOn`
- **Domain**: `category`, `priority`
- **Scope/time**: `month`, `year`, `dueDate`
- **Day scheduling**: `startTime`, `endTime`
- **Structure**: `subtasks`, `notes`, `timeLog`
- **Metadata**: `tags`
- **Connection**: `parentId`, `parentLevel`
- **Visual**: `icon` (currently used most consistently for visions)

Where scope is derived today (this is critical):
- `src/core/Goals.ts` implements `getGoalDateRange(goal)` which defines the “real scope window”:
  - Vision: start/end of year
  - Milestone: start = first day of `month/year`, end = `dueDate` (or month end fallback)
  - Focus: start = internal tag `__tm:start=YYYY-MM-DD` (or inferred), end = `dueDate`
  - Intention: start/end of `dueDate`’s day (or month fallback)

That `getGoalDateRange()` function is the closest thing to a canonical “scope definition”.

### 2.2 `CalendarEvent` (calendar events)

Defined in `src/types.ts`, persisted in Supabase `events` table (added via later migrations), and used in day/week/month renderers.

Events are *not* goals:
- They have recurrence, all-day flags, etc.
- They’re displayed alongside intentions in the day planner timeline.

### 2.3 `CustomIntention` (intention templates)

Defined in `src/types.ts` and stored in localStorage (not synced) via `src/core/IntentionsManager.ts`.

This is a **second meaning** of “intention”:
- “Intention” as a *day goal* (`Goal.level = "intention"`)
- “Intention” as a *template pill* (title + category + duration + emoji)

This is one of the biggest sources of terminology/UI confusion.

---

## 3) Where Terminology and Structure Currently Drift

### 3.1 “Intention” is two different nouns

Places that reinforce the split:
- “Common intentions” UI is powered by templates (`CustomIntention`) and drag‑creates real day goals.
- Modals and views call day goals “intentions” as well.

This tends to cause UX questions like:
- “Am I editing the real thing or the template?”
- “Why does a template have duration/category/emoji but my saved intention doesn’t?”

**Suggestion:** in UI copy (and maybe type names later), consider calling templates **“Intention templates”** or **“Quick intentions”** and the real entity **“Intention (day goal)”**.

### 3.2 “Focus” is both a goal level and an app mode

The app has:
- Focus goals (`Goal.level="focus"`) = “week goal”
- “Focus mode” and “ZenFocus” features that also use “focus” as a UI concept

Even if the code is correct, the language adds cognitive overhead when building modals (“Focus” can mean a week goal, or a distraction-free overlay, or both).

**Suggestion:** reserve “Focus” for the week goal, and call the feature “Zen mode / Spotlight / Deep mode” in UI copy.

### 3.3 Scope (time range) is not computed consistently everywhere

There’s a “right” implementation and a “shortcut” implementation.

**Canonical-ish scope logic**
- `src/core/Goals.ts#getGoalDateRange()` and `Goals.getForRange()` handle multi‑week focuses and multi‑month milestones correctly via `dueDate` + internal tags.

**Shortcut scope logic (likely to create “where did my focus go?” moments)**
- `src/ui/UIManager.ts#getContextGoalsForDate()` computes the Day view context banner using:
  - Vision: `g.year === viewingYear`
  - Milestone: `g.year === viewingYear && g.month === viewingMonth` (start month only)
  - Focus: `dueDate` must be inside the current week window (end date only)

This means:
- A **2‑week focus** starting this week will *not* show as context for the first week (because its `dueDate` is in week 2).
- A **3‑month milestone** will only show for its start month (because it matches only the start `month`).

You’ll feel this drift most strongly in:
- Context bars (“what am I oriented around right now?”)
- Modals that try to preselect context automatically (“connections”)

**Suggestion:** treat `Goals.getForRange()` as the single way to decide “active in this scope” and remove/avoid bespoke re-implementations.

### 3.4 `description` is used as a structured field (but inconsistently)

There are at least three semantics competing inside `Goal.description`:
- A real, freeform description
- “Low-energy version: …” (Focus creation in `GoalModal`)
- “Tiny version: …” (Intention creation in `GoalModal`)
- QuickAdd stores tiny text without the “Tiny version:” prefix (`src/features/quickAdd/QuickAdd.ts`)

So, the same UI field is being used as:
- Narrative description
- Structured subfields
- A place to stash “alternate versions”

This is a major source of “modal complexity”, because it forces each modal to know which semantics it’s supposed to apply.

**Suggestion:** move these into dedicated fields (e.g., `tinyVersion`, `lowEnergyVersion`) or a small `meta` object (e.g., `meta.tiny`, `meta.lowEnergy`) that can be persisted in Supabase/IndexedDB cleanly.

### 3.5 `tags` is both user tags and internal system metadata

Internal tags currently look like `__tm:<key>=<value>` and are used for:
- Focus start date: `__tm:start=YYYY-MM-DD` (scope math)
- Vision accent: `__tm:accent=<theme>` (theming)
- Focus easy mode: `__tm:easymode=1` (behavior/UI)

Concerns:
- There’s no hard separation between “user tags” and “internal tags”.
- Some flows overwrite tags entirely (e.g., focus easy mode creation sets `tags = ["__tm:easymode=1"]`).
- When tags become a user-facing feature, internal tags will become confusing unless filtered/hidden everywhere.

**Suggestion:** reserve `tags` for user-facing tags and introduce `meta` (JSON) for internal state, or at least centralize helpers and enforce “don’t clobber other internal keys”.

### 3.6 `category` is used as “domain” *and* as “activity label”

Evidence:
- CSS includes compatibility category classes like `.cat-cycling`, `.cat-workout`, etc (`styles/dayView/planner.css`).
- Emoji lookup previously relied on `CONFIG.ACTIVITY_EMOJIS` and `PlannerDayViewRenderer.getCategoryEmoji()` being “category or activity identifier”.
- Category filter UI only lists `CONFIG.CATEGORIES` (domain categories), so activity IDs never appear there.
- Supabase loads `category` as an arbitrary string without coercion (`src/services/supabase/GoalsService.ts`).

Realignment:
- Introduce `Goal.activityId` to store activity/emoji intent explicitly.
- Rendering now prefers `activityId` (if present and valid) via `getGoalEmoji()`, falls back to the current domain category emoji, and finally to a default pin.
- Legacy rows where `category` stored a legacy activity ID still resolve to the matching activity emoji but no longer hijack the domain picker.

Recommendation executed in PR4: keep `category` limited to `CONFIG.CATEGORIES` (domains), and use `Goal.activityId` for activity-specific emoji or styling cues.

### 3.7 Connections are modeled as a single parent pointer (but UI language implies richer graphs)

Current model:
- `parentId`/`parentLevel` give you a single “aligned to” link.

But the product language hints at potentially richer meaning:
- “connections”, “alignment”, “supports”, “categories”, “scopes”
- In real life, an intention often supports *multiple* things (a focus + a life domain + a longer vision).

Current consequences:
- You can’t represent “this intention supports both Focus A and Focus B”.
- You can’t represent “this intention is part of Milestone X, and also tagged Personal”.
- Many UIs end up faking additional relationships through `category`, `description`, or `tags`.

**Suggestion (choose one direction):**
1) **Strict hierarchy** (simpler UX): enforce Vision → Milestone → Focus → Intention only; disallow skipping levels; use the parent link as true hierarchy.
2) **Flexible graph** (more expressive): keep a primary parent for navigation, but introduce `connections: GoalLink[]` (or a `goal_links` table) for additional alignment edges.

### 3.8 `parentLevel` is a denormalized cache that can drift

`parentLevel` duplicates information that can be derived from `parentId → parent.level`.

Risks:
- A goal’s stored `parentLevel` can disagree with the actual parent goal’s `level`.
- Some renderers filter based on `parentLevel` and can silently miss linked items if it’s wrong or missing.
- Deleting a parent goal leaves `parentId` nullified in Supabase (`ON DELETE SET NULL`), but local state may not be cleaned up the same way.

**Suggestion:** either (a) remove `parentLevel` and compute it, or (b) treat it as a strict cache and ensure it is always written/updated consistently (including migrations and edit flows).

---

## 4) Practical “What To Fix First” Suggestions (to reduce modal confusion)

These are ordered by impact on mental-model clarity and future UI work.

1) **Write down and enforce one scope function**
   - “Active in this date/week/month/year” should mean one thing everywhere.
   - Prefer routing everything through `Goals.getForRange()` and removing custom filters.

2) **Rename/template the “Intention templates” concept**
   - Even if code remains the same, the UI copy and file naming can reduce confusion dramatically.
   - Treat templates as “quick-add building blocks”, not “goals”.

3) **Stop storing structured meaning in `description`**
   - Add a `meta` object or explicit fields for tiny/low-energy versions.
   - This will make modals simpler because the UI doesn’t have to parse/format strings.

4) **Decide what “connection” means**
   - If it’s a strict hierarchy: enforce it and simplify the linkage selector.
   - If it’s flexible alignment: introduce explicit “connections” separate from parent.

5) **Split “domain category” vs “activity/emoji”**
   - Right now `category` sometimes does both, and the UI only supports one fully.

---

## 5) Reference Map (where to look in code)

- Types: `src/types.ts`
- Goal scope math (most canonical): `src/core/Goals.ts`
- Goal persistence (Supabase): `src/services/supabase/GoalsService.ts`
- Goal creation modal + linkage UI: `src/components/modals/GoalModal/GoalModal.ts`
- Quick intention overlay (separate creation path): `src/features/quickAdd/QuickAdd.ts`
- Day planner renderer (intentions + templates + schedule): `src/components/dayView/PlannerDayViewRenderer.ts`, `src/components/dayView/timeline.ts`
- Intention templates storage: `src/core/IntentionsManager.ts`
- Context goals selection (currently simplified): `src/ui/UIManager.ts#getContextGoalsForDate`
- Domain categories + levels constants: `src/config/constants.ts`
- Internal tag helpers + accent inheritance: `src/utils/goalLinkage.ts`
