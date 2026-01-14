# Data Model Stabilization Plan

Goal: make the product’s mental model (Vision/ Milestone/ Focus/ Intention + Events) match the implementation, so UI stays consistent as the dataset grows.

Companion doc: `datastructure.md`.

---

## Product model (canonical)

### Goals (one entity)
- **Vision** = year direction
- **Milestone** = monthly chapter (can span multiple months)
- **Focus** = weekly emphasis (can span multiple weeks)
- **Intention** = daily touch (linkage optional; “life task” allowed)

### Events (separate entity)
- **CalendarEvent** = appointments/vacations/obligations (calendar items, not evaluated as goals)

---

## PR sequence (recommended)

### PR 1 — One canonical “active in scope”

**Target:** eliminate “where did my goal go?” issues by using `Goals.getForRange()` + `getGoalDateRange()` everywhere we mean “active during X”.

**Known shortcut implementations to remove/replace:**
- `src/ui/UIManager.ts#getContextGoalsForDate` (currently uses start-month and dueDate-only checks; breaks multi-month milestones + multi-week focuses).
- `src/core/Planning.ts#getWeekGoals` (manual weekStart/weekEnd + month/year fallback; should use `Goals.getForRange()` for consistency).

**Potential follow-ups (optional but recommended):**
- Consolidate date membership logic for intentions (several components duplicate `dueDate.toDateString() === date.toDateString()`).

**Definition to standardize on:**
- A goal is “active in a range” if `getGoalDateRange(goal)` overlaps `[rangeStart, rangeEnd]`.

**Outcome checks:**
- A 2-week Focus appears in week 1 *and* week 2 context.
- A 3-month Milestone appears in all months it overlaps.
- Context stacks/banners show the same “active” set that views show.

---

### PR 2 — Terminology cleanup (UI copy + labels)

**Target:** reduce cognitive collisions in modals and navigation.

- Rename template UI strings:
  - “Common intentions” → “Intention templates” or “Quick intentions”
  - Keep “Intention” reserved for saved day goals (`Goal.level="intention"`).
- Rename “Focus mode” feature label:
  - “Focus Mode” → “Zen Mode” / “Deep Mode” / “Spotlight” (so “Focus” means weekly goal level).

**Scope:** copy only (no data changes).

---

### PR 3 — Add `Goal.meta` and migrate write-paths

**Target:** stop leaking structured meaning into `description` and internal state into `tags`.

#### 3A) Data shape changes
- Add `Goal.meta?: GoalMeta` in `src/types.ts`.
- Add Supabase `goals.meta JSONB` column (nullable, default `{}`).
- Update `src/types/database.ts` and `src/services/supabase/GoalsService.ts` mappings to read/write `meta`.
- IndexedDB: no schema requirement; storing extra field is fine. (Only bump DB version if you add indexes on meta.)

#### 3B) Backward compatibility (read legacy, write meta)
On load (cloud + localStorage), interpret legacy fields into `meta` without breaking existing data:
- `description` prefixes:
  - `Tiny version: ...` → `meta.tinyVersion`
  - `Low-energy version: ...` → `meta.lowEnergyVersion`
- `tags` internal keys:
  - `__tm:start=YYYY-MM-DD` → `meta.startDate`
  - `__tm:easymode=1` → `meta.easyMode`
  - `__tm:accent=<theme>` → `meta.accentTheme`

Write-path rules:
- New edits should update `meta` only.
- Keep rendering legacy values if `meta` is absent to avoid data loss during migration period.

**Outcome checks:**
- Modals no longer need string formatting/parsing for “tiny/low energy”.
- Scope math for focus start no longer relies on `__tm:start=...` once migrated.
- Internal tags become optional legacy-only.

---

### PR 4 — Separate “domain category” from “activity/emoji”

**Result:** `category` now strictly covers the domain hierarchy (`career/health/finance/personal/creative`), while `Goal.activityId` owns activity-specific emoji/presentation.

- Data model change: added `Goal.activityId` plus the corresponding Supabase `activity_id` column; existing categories remain untouched.
- Rendering change: `getGoalEmoji()` prefers `activityId`, then domain category, then a fallback (legacy category values that matched activity IDs continue to render through the helper without affecting the domain filters).
- Write path change: no new data writes place activities into `category`; future activity selectors can populate `activityId` instead.

Migration strategy remains passive – legacy category strings that look like activities stay where they are but are treated as activity IDs when rendering, so there’s no destructive rewrite.

---

## Notes / known sharp edges

### Storage layers
- Cloud load comes from `SupabaseService.loadAllData()` (`src/services/supabase/DataLoaderService.ts`), with localStorage fallback.
- IndexedDB is used for per-entity persistence and cloud sync batching, but it is not currently hydrated from cloud on login.

### `parentLevel`
- Treat as cache only if we enforce it at write time and optionally correct it on load.
- For strict hierarchy, it’s safer to compute `parentLevel` from `parentId` whenever possible.
