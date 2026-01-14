## Goal & Event Modal Evaluation

Documented the current goal/event flows and highlighted UX debt before proposing a cleanup plan:

- **Flows inventoried**: Vision/Milestone/Focus/Intention creation via `GoalModal`, goal editing via `GoalDetailModal`, event creation/editing via `EventModal`, the Quick Add overlay, quick-intention customization panel, and the month-detail quick-add shortcut.
- **Fields & UX**: Captured each modal’s trigger points, default fields, helper sections (time context, suggestions, linkage, meta extras), what they write (goal fields, `Goal.meta`, `activityId`, event recurrence), and the pain points (bloat, inconsistent copy, requirement timing).
- **Inconsistencies flagged**: Banners and disclosures varied per flow (e.g., linkage rules for milestones vs intentions, legacy tag handling limited to `goalMeta.ts`, bespoke “More options” drawer for intentions, duplication of time context copy).
- **Progressive disclosure proposal**: Created a single skeleton (hero title + reassurance + save) plus consistent accordions for context, meta/energy, linkage, and details; specified default collapsed state per level and outlined where the shared components belong.
- **Refactor roadmap**: Split into three phases (calm hero, shared components + wiring, optional polish) with targeted files and acceptance checks per PR.

Next steps:
1. Apply Phase 1 so each goal modal shows only the hero row by default.
2. Build the shared accordions/components and wire them into Quick Add / quick-intention flows (Phase 2).
3. Finish with GoalDetail/Event modal parity (Phase 3) and run `npm test`/`npm run lint`.
