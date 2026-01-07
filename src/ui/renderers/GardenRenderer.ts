// ===================================
// Garden View Renderer (Reflection-first, linkage-focused)
// ===================================
import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { WeekReflections } from "../../core/WeekReflections";
import { eventBus } from "../../core/EventBus";
// Unused mobile collapsible section imports (mobile now uses plot-based view)
// import { getSectionState, setSectionState } from "../../components/dayView/sidebar/SidebarSection";

import type { Goal, GoalLevel, UIElements, WeekReflection } from "../../types";
import { buildAccentAttributes, getVisionAccent } from "../../utils/goalLinkage";

type QuickAddIntentOpts = {
  level: "intention";
  startDate: string;
  parentId: string;
  parentLevel: "vision";
  label?: string;
  placeholder?: string;
  showTinyField?: boolean;
  tinyLabel?: string;
  tinyPlaceholder?: string;
};

type AddGoalLinkedOpts = {
  level: Extract<GoalLevel, "milestone" | "focus">;
  parentId: string;
  parentLevel: GoalLevel;
  preselectedMonth?: number | null;
  preselectedYear?: number | null;
};

type GardenSystemState =
  | "NO_VISIONS"
  | "VISIONS_ONLY"
  | "VISIONS_WITH_MILESTONES"
  | "FULL_SYSTEM";

let selectedVisionId: string | null = null;
let selectedMilestoneId: string | null = null;
let selectedFocusId: string | null = null;
let alignmentDetailsOpen = false;
let reflectionOpen = false;
let focusedVisionId: string | null = null;

const reflectionCache = new Map<string, WeekReflection | null>();

function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDefaultTinyIntentionDateYmd(): string {
  const now = new Date();
  const pickToday = now.getHours() < 9; // early morning: allow "today"; otherwise default to tomorrow
  const d = new Date(now);
  if (!pickToday) d.setDate(d.getDate() + 1);
  return toYmdLocal(d);
}

function safeGetGoal(goalId: string | null | undefined): Goal | null {
  if (!goalId) return null;
  return Goals.getById(goalId) ?? null;
}

function getParent(goal: Goal): Goal | null {
  if (!goal.parentId) return null;
  return Goals.getById(goal.parentId) ?? null;
}

function findAncestor(goal: Goal, level: GoalLevel): Goal | null {
  const seen = new Set<string>();
  let cur: Goal | null = goal;
  while (cur && !seen.has(cur.id)) {
    if (cur.level === level) return cur;
    seen.add(cur.id);
    cur = getParent(cur);
  }
  return null;
}

function getVisionIdForGoal(goal: Goal): string | null {
  const vision = findAncestor(goal, "vision");
  return vision?.id ?? null;
}

function getWeekRangeFor(date: Date): { weekStart: Date; weekEnd: Date; weekNum: number; weekYear: number } {
  const weekNum = State.getWeekNumber(date);
  const weekYear = State.getWeekYear(date);
  const weekStart = State.getWeekStart(weekYear, weekNum);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { weekStart, weekEnd, weekNum, weekYear };
}

function formatWeekRangeLong(weekStart: Date, weekEnd: Date): string {
  const startYear = weekStart.getFullYear();
  const endYear = weekEnd.getFullYear();
  const startFormatted = weekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: startYear !== endYear ? "numeric" : undefined,
  });
  const endFormatted = weekEnd.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${startFormatted} - ${endFormatted}`;
}

function renderUnlinkedPill(label: string = "Unlinked (still valid)"): string {
  return `<span class="garden-pill garden-pill--neutral">${label}</span>`;
}

// ===================================
// Mobile Garden Plot Renderer
// Each Vision is its own "plot" with active milestone, focus, and intentions
// ===================================
function renderMobileGardenPlots(
  visions: Goal[],
  milestonesByVisionId: Map<string, Goal[]>,
  focusesByMilestoneId: Map<string, Goal[]>,
  focusesByVisionId: Map<string, Goal[]>,
  visionTouchedThisWeek: Map<string, Goal[]>,
  escapeHtmlFn: (text: string) => string,
  weekRangeLabel: string,
  onAddGoal?: (level: GoalLevel) => void,
): string {
  if (visions.length === 0) {
    return `
      <div class="garden-mobile-plots">
        <div class="garden-mobile-header">
          <h2 class="garden-mobile-title">Garden</h2>
        </div>
        <div class="garden-plot garden-plot--empty">
          <div class="garden-plot-empty">
            <div class="garden-plot-empty-title">Start with one Vision</div>
            <p class="garden-plot-empty-text">A Vision is like planting a seed — one sentence is enough.</p>
            ${onAddGoal ? `<button type="button" class="btn btn-primary" data-action="add-vision">Create a Vision</button>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  const plotsHtml = visions.map((v) => {
    const accent = getVisionAccent(v);
    const accentStyle = accent 
      ? `--plot-accent: ${accent.color};${accent.gradient ? ` --plot-accent-gradient: ${accent.gradient};` : ""}`
      : "";

    const visionIcon = v.icon ? escapeHtmlFn(v.icon) : "";
    
    // Get active milestone for this vision
    const milestones = milestonesByVisionId.get(v.id) ?? [];
    const activeMilestone = milestones[0]; // Take the first active one
    
    // Get weekly focus - either directly linked to vision or via milestone
    let weeklyFocus: Goal | null = null;
    const directFocuses = focusesByVisionId.get(v.id) ?? [];
    if (directFocuses.length > 0) {
      weeklyFocus = directFocuses[0];
    } else if (activeMilestone) {
      const milestoneFocuses = focusesByMilestoneId.get(activeMilestone.id) ?? [];
      if (milestoneFocuses.length > 0) {
        weeklyFocus = milestoneFocuses[0];
      }
    }
    
    // Get intentions linked to this vision this week
    const intentions = visionTouchedThisWeek.get(v.id) ?? [];
    const hasContent = activeMilestone || weeklyFocus || intentions.length > 0;
    
    return `
      <article class="garden-plot" style="${accentStyle}" data-vision-id="${escapeHtmlFn(v.id)}">
        <header class="garden-plot-header">
          <h3 class="garden-plot-title" data-action="open-goal" data-goal-id="${escapeHtmlFn(v.id)}">${visionIcon ? `<span class="garden-emoji" aria-hidden="true">${visionIcon}</span>` : ""}<span class="garden-plot-title-text">${escapeHtmlFn(v.title)}</span></h3>
        </header>
        
        <div class="garden-plot-content">
          ${activeMilestone ? `
            <div class="garden-plot-section garden-plot-milestone">
              <span class="garden-plot-label">Milestone</span>
              <button type="button" class="garden-plot-item" data-action="open-goal" data-goal-id="${escapeHtmlFn(activeMilestone.id)}">
                ${activeMilestone.icon ? `<span class="garden-emoji" aria-hidden="true">${escapeHtmlFn(activeMilestone.icon)}</span>` : ""}<span class="garden-plot-item-text">${escapeHtmlFn(activeMilestone.title)}</span>
              </button>
            </div>
          ` : ""}
          
          ${weeklyFocus ? `
            <div class="garden-plot-section garden-plot-focus">
              <span class="garden-plot-label">Focus</span>
              <button type="button" class="garden-plot-item" data-action="open-goal" data-goal-id="${escapeHtmlFn(weeklyFocus.id)}">
                ${weeklyFocus.icon ? `<span class="garden-emoji" aria-hidden="true">${escapeHtmlFn(weeklyFocus.icon)}</span>` : ""}<span class="garden-plot-item-text">${escapeHtmlFn(weeklyFocus.title)}</span>
              </button>
            </div>
          ` : ""}
          
          ${intentions.length > 0 ? `
            <div class="garden-plot-section garden-plot-intentions">
              <span class="garden-plot-label">Intentions</span>
              <div class="garden-plot-intentions-list">
                ${intentions.slice(0, 5).map((i) => `
                  <button type="button" class="garden-plot-intention" data-action="open-goal" data-goal-id="${escapeHtmlFn(i.id)}">
                    <span class="garden-plot-intention-status ${i.status === "done" ? "is-done" : ""}"></span>
                    ${i.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(i.icon)}</span>` : ""}
                    <span class="garden-plot-intention-title">${escapeHtmlFn(i.title)}</span>
                  </button>
                `).join("")}
                ${intentions.length > 5 ? `<span class="garden-plot-more">+${intentions.length - 5} more</span>` : ""}
              </div>
            </div>
          ` : ""}
          
          ${!hasContent ? `
            <div class="garden-plot-empty-state">
              <p>No activity this week yet</p>
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }).join("");

  return `
    <div class="garden-mobile-plots">
      <div class="garden-mobile-header">
        <h2 class="garden-mobile-title">Garden</h2>
      </div>
      ${plotsHtml}
    </div>
  `;
}

function _renderCollapsibleSection(
  id: string,
  title: string,
  subtitle: string,
  icon: string,
  content: string,
  isCollapsed: boolean = false,
  actions: string = ''
): string {
  const collapsedClass = isCollapsed ? ' collapsed' : '';
  const toggleIcon = isCollapsed ? '›' : '⌄';

  return `
    <section class="garden-section${collapsedClass}" data-section-id="${id}" aria-label="${title}">
      <button
        type="button"
        class="garden-section-toggle"
        data-section-toggle="${id}"
        aria-expanded="${!isCollapsed}"
        aria-controls="section-content-${id}"
      >
        <div>
          <div class="garden-section-title-row">
            <h2 class="garden-section-title">
              <span class="garden-section-icon" aria-hidden="true">${icon}</span>
              ${title}
            </h2>
            <span class="garden-section-toggle-icon" aria-hidden="true">${toggleIcon}</span>
          </div>
          <p class="garden-section-subtitle">${subtitle}</p>
        </div>
        ${actions}
      </button>
      <div
        id="section-content-${id}"
        class="garden-section-content"
        ${isCollapsed ? 'hidden' : ''}
      >
        ${content}
      </div>
    </section>
  `;
}

export const GardenRenderer = {
  render(
    elements: UIElements,
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
    onAddGoal?: (level: GoalLevel) => void,
    onAddGoalLinked?: (opts: AddGoalLinkedOpts) => void,
    onQuickAddIntention?: (opts: QuickAddIntentOpts) => void,
  ) {
    if (!State.data) return;

    const container = elements.calendarGrid;
    if (!container) return;

    const viewDate = State.viewingDate ?? new Date();
    const { weekStart, weekEnd, weekNum, weekYear } = getWeekRangeFor(viewDate);
    const weekRangeLabel = formatWeekRangeLong(weekStart, weekEnd);

    const visions = Goals.getForRange(
      new Date(weekYear, 0, 1),
      new Date(weekYear, 11, 31),
    ).filter((g) => g.level === "vision" && g.status !== "done");

    // Keep focus selection valid.
    if (focusedVisionId && !Goals.getById(focusedVisionId)) focusedVisionId = null;

    const milestonesToday = Goals.getForRange(viewDate, viewDate).filter(
      (g) => g.level === "milestone" && g.status !== "done",
    );
    const focusesInWeek = Goals.getForRange(weekStart, weekEnd).filter(
      (g) => g.level === "focus" && g.status !== "done",
    );
    const intentionsInWeek = Goals.getForRange(weekStart, weekEnd).filter(
      (g) => g.level === "intention",
    );
    const unlinkedIntentionsThisWeek = intentionsInWeek.filter((g) => !g.parentId);

    const milestonesByVisionId = new Map<string, Goal[]>();
    for (const m of milestonesToday) {
      if (m.parentId && (m.parentLevel ?? "vision") === "vision") {
        const list = milestonesByVisionId.get(m.parentId) ?? [];
        list.push(m);
        milestonesByVisionId.set(m.parentId, list);
      }
    }

    const activeMilestoneIds = new Set<string>();
    for (const arr of milestonesByVisionId.values()) {
      for (const m of arr) activeMilestoneIds.add(m.id);
    }

    const focusesByMilestoneId = new Map<string, Goal[]>();
    const focusesByVisionId = new Map<string, Goal[]>();
    for (const f of focusesInWeek) {
      if (f.parentId && f.parentLevel === "milestone") {
        const list = focusesByMilestoneId.get(f.parentId) ?? [];
        list.push(f);
        focusesByMilestoneId.set(f.parentId, list);
      } else if (f.parentId && f.parentLevel === "vision") {
        const list = focusesByVisionId.get(f.parentId) ?? [];
        list.push(f);
        focusesByVisionId.set(f.parentId, list);
      }
    }

    const visionTouchedThisWeek = new Map<string, Goal[]>();
    for (const i of intentionsInWeek) {
      const visionId = getVisionIdForGoal(i);
      if (!visionId) continue;
      const list = visionTouchedThisWeek.get(visionId) ?? [];
      list.push(i);
      visionTouchedThisWeek.set(visionId, list);
    }

    const systemState: GardenSystemState = (() => {
      if (visions.length === 0) return "NO_VISIONS";
      if (activeMilestoneIds.size === 0) return "VISIONS_ONLY";
      const hasWeeklyFocusForActiveMilestones = focusesInWeek.some(
        (f) => !!f.parentId && activeMilestoneIds.has(f.parentId),
      );
      if (!hasWeeklyFocusForActiveMilestones) return "VISIONS_WITH_MILESTONES";
      return "FULL_SYSTEM";
    })();

    // Keep selection valid (never auto-select; stay user-driven).
    if (selectedVisionId && !Goals.getById(selectedVisionId)) selectedVisionId = null;
    if (selectedMilestoneId && !Goals.getById(selectedMilestoneId)) selectedMilestoneId = null;
    if (selectedFocusId && !Goals.getById(selectedFocusId)) selectedFocusId = null;

    const effectiveSelectedVisionId = focusedVisionId ?? selectedVisionId;
    const selectedVision = effectiveSelectedVisionId ? safeGetGoal(effectiveSelectedVisionId) : null;
    const selectedMilestone = selectedMilestoneId ? safeGetGoal(selectedMilestoneId) : null;
    const selectedFocus = selectedFocusId ? safeGetGoal(selectedFocusId) : null;

    const explorerActiveMilestones =
      selectedVision && selectedVision.id
        ? (milestonesByVisionId.get(selectedVision.id) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title))
        : [];

    const explorerFocuses = (() => {
      if (!selectedVision) return [];
      if (selectedMilestone) {
        return (focusesByMilestoneId.get(selectedMilestone.id) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));
      }
      const fromMilestones = explorerActiveMilestones.flatMap((m) => focusesByMilestoneId.get(m.id) ?? []);
      const fromVisionDirect = focusesByVisionId.get(selectedVision.id) ?? [];
      return [...fromMilestones, ...fromVisionDirect]
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title));
    })();

    const explorerIntentions = (() => {
      if (!selectedVision) return [];
      const base = intentionsInWeek.filter((i) => getVisionIdForGoal(i) === selectedVision.id);
      const filteredByMilestone = selectedMilestone
        ? base.filter((i) => findAncestor(i, "milestone")?.id === selectedMilestone.id)
        : base;
      const filteredByFocus = selectedFocus
        ? filteredByMilestone.filter((i) => findAncestor(i, "focus")?.id === selectedFocus.id || i.parentId === selectedFocus.id)
        : filteredByMilestone;
      return filteredByFocus.slice().sort((a, b) => a.title.localeCompare(b.title));
    })();

    const reflectionId = WeekReflections.getId(weekYear, weekNum);
    const cachedReflection = reflectionCache.get(reflectionId);
    if (!reflectionCache.has(reflectionId)) {
      reflectionCache.set(reflectionId, null);
      void WeekReflections.get(weekYear, weekNum).then((rec) => {
        reflectionCache.set(reflectionId, rec);
        if (State.currentView === "garden") {
          eventBus.emit("view:changed", { transition: false });
        }
      });
    }

    // Mobile detection
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

    // ===================================
    // MOBILE: Render Vision Plots View
    // ===================================
    if (isMobile) {
      container.className = "garden-view-container garden-mobile";
      container.innerHTML = renderMobileGardenPlots(
        visions,
        milestonesByVisionId,
        focusesByMilestoneId,
        focusesByVisionId,
        visionTouchedThisWeek,
        escapeHtmlFn,
        weekRangeLabel,
        onAddGoal,
      );

      // Event handlers for mobile plots
      const _rerender = () => {
        eventBus.emit("view:changed", { transition: false });
      };

      container.querySelectorAll<HTMLElement>("[data-action='add-vision']").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onAddGoal?.("vision");
        });
      });

      container.querySelectorAll<HTMLElement>("[data-action='open-goal']").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const goalId = (el as HTMLElement).dataset.goalId;
          if (goalId) onGoalClick(goalId);
        });
      });

      return; // Exit early for mobile
    }

    // ===================================
    // DESKTOP: Original View with Sections
    // ===================================

    const focusedVision = focusedVisionId ? visions.find((v) => v.id === focusedVisionId) ?? null : null;
    container.className = "garden-view-container garden-reflection";
    container.innerHTML = `
      <div class="week-view-header garden-header">
        <h2 class="week-view-title">Garden</h2>
        <p class="week-view-range">${weekRangeLabel}</p>
        <p class="garden-header-subtitle">A calm view of how your week connects to your year.</p>
        ${
          visions.length > 0
            ? `
              <div class="garden-vision-tabs" role="tablist" aria-label="Vision focus">
                <button type="button" class="garden-tab${!focusedVisionId ? " is-active" : ""}" role="tab" aria-selected="${!focusedVisionId ? "true" : "false"}" data-action="tab-all">Overview</button>
                ${visions
                  .slice(0, 4)
                  .map((v) => {
                    const isActive = focusedVisionId === v.id;
                    const icon = v.icon ? escapeHtmlFn(v.icon) : "";
                    return `<button type="button" class="garden-tab${isActive ? " is-active" : ""}" role="tab" aria-selected="${isActive ? "true" : "false"}" data-action="tab-vision" data-vision-id="${escapeHtmlFn(v.id)}">${icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${icon}</span>` : ""}<span class="garden-tab-text">${escapeHtmlFn(v.title)}</span></button>`;
                  })
                  .join("")}
                ${
                  visions.length > 4
                    ? `<button type="button" class="garden-tab" role="tab" aria-selected="false" data-action="tab-more">More…</button>`
                    : ""
                }
              </div>
              <div class="garden-focus-note${focusedVision ? " garden-focus-note--focused" : " garden-focus-note--overview"}" aria-live="polite">
                ${
                  focusedVision
                    ? `<span class="garden-focus-note-label">Focused on:</span> <span class="garden-focus-note-value">${focusedVision.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(focusedVision.icon)}</span>` : ""}<span class="garden-focus-note-text">${escapeHtmlFn(focusedVision.title)}</span></span>`
                    : `<span class="garden-focus-note-label">Overview:</span> <span class="garden-focus-note-value">All visions</span>`
                }
              </div>
            `
            : ""
        }
      </div>

      <section class="garden-section garden-section--visions" aria-label="Visions">
        <div class="garden-section-header">
          <div>
            <h2 class="garden-section-title"><span class="garden-section-icon" aria-hidden="true">✨</span>Visions</h2>
            <p class="garden-section-subtitle">Year anchors. No grading, just direction.</p>
          </div>
          ${
            onAddGoal && visions.length > 0
              ? `<button type="button" class="btn btn-ghost btn-sm garden-section-action" data-action="add-vision">+ Vision</button>`
              : ""
          }
        </div>

        ${
          visions.length === 0
            ? `
              <div class="garden-empty-card">
                <div class="garden-empty-title">Start with one Vision. One sentence is enough.</div>
                ${onAddGoal ? `<button type="button" class="btn btn-primary" data-action="add-vision">Create a Vision</button>` : ""}
              </div>
            `
            : focusedVisionId
              ? (() => {
                  const v = visions.find((x) => x.id === focusedVisionId) ?? null;
                  if (!v) return "";
                  const active = milestonesByVisionId.get(v.id) ?? [];
                  const hasActive = active.length > 0;
                  const focusForVision = focusesByVisionId.get(v.id) ?? [];
                  const anyFocusThisWeek =
                    focusForVision.length > 0 ||
                    active.some((m) => (focusesByMilestoneId.get(m.id) ?? []).length > 0);
                  const linkedMilestonesCount = Goals.getAll().filter(
                    (g) =>
                      g.level === "milestone" &&
                      g.status !== "done" &&
                      g.parentId === v.id &&
                      (g.parentLevel ?? "vision") === "vision",
                  ).length;
                  const selectedClass = selectedVisionId === v.id ? " is-selected" : "";
                  const accentAttrs = buildAccentAttributes(getVisionAccent(v));
                  const icon = v.icon ? escapeHtmlFn(v.icon) : "";
                  return `
	                    <div class="garden-vision-grid garden-vision-grid--focused" role="list">
	                      <div class="garden-vision-card cosmic-card cosmic-card--vision${selectedClass}"${accentAttrs.dataAttr}${accentAttrs.styleAttr} data-action="select-vision" data-vision-id="${escapeHtmlFn(v.id)}" role="button" tabindex="0">
	                        <div class="garden-vision-card-title">${icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${icon}</span>` : ""}<span class="garden-vision-card-title-text">${escapeHtmlFn(v.title)}</span></div>
	                        <div class="garden-vision-card-meta">
                          <div class="garden-vision-card-label">Active chapter${active.length === 1 ? "" : "s"}</div>
                          <div class="garden-vision-card-chips">
                            ${
                              hasActive
                                ? active
                                    .slice(0, 3)
                                    .map(
                                      (m) => `${(() => {
                                        const mi = m.icon ? escapeHtmlFn(m.icon) : "";
                                        return `<button type=\"button\" class=\"garden-pill garden-pill--soft\" data-action=\"select-milestone\" data-vision-id=\"${escapeHtmlFn(v.id)}\" data-milestone-id=\"${escapeHtmlFn(m.id)}\">${mi ? `<span class=\\\"garden-emoji\\\" aria-hidden=\\\"true\\\">${mi}</span>` : ""}<span class=\"garden-pill-text\">${escapeHtmlFn(m.title)}</span></button>`;
                                      })()}`,
                                    )
                                    .join("")
                                : `<span class="garden-pill garden-pill--neutral">${systemState === "VISIONS_ONLY" ? "No milestone yet" : linkedMilestonesCount === 0 ? "No milestone yet" : "No active milestone right now"}</span>`
                            }
                            ${active.length > 3 ? `<span class="garden-pill garden-pill--neutral">+${active.length - 3}</span>` : ""}
                          </div>
                          ${
                            !hasActive && onAddGoalLinked
                              ? `<div class="garden-card-actions">
                                  <button type="button" class="btn btn-primary btn-sm" data-action="add-milestone" data-vision-id="${escapeHtmlFn(v.id)}">Add milestone</button>
                                </div>`
                              : ""
                          }
                          ${
                            hasActive && !anyFocusThisWeek && onAddGoalLinked
                              ? `<div class="garden-card-actions">
                                  <div class="garden-hint garden-hint--inline">No focus set for this week.</div>
                                  <button type="button" class="btn btn-ghost btn-sm" data-action="add-focus" data-vision-id="${escapeHtmlFn(v.id)}" data-milestone-id="${escapeHtmlFn(active[0].id)}">Set weekly focus</button>
                                </div>`
                              : ""
                          }
                        </div>
                      </div>
                    </div>
                  `;
                })()
            : `
              <div class="garden-vision-grid" role="list">
                ${visions
                  .map((v) => {
                    const active = milestonesByVisionId.get(v.id) ?? [];
                    const hasActive = active.length > 0;
                    const selectedClass = selectedVisionId === v.id ? " is-selected" : "";
                    const focusForVision = focusesByVisionId.get(v.id) ?? [];
                    const anyFocusThisWeek =
                      focusForVision.length > 0 ||
                      active.some((m) => (focusesByMilestoneId.get(m.id) ?? []).length > 0);
                    const linkedMilestonesCount = Goals.getAll().filter(
                      (g) =>
                        g.level === "milestone" &&
                        g.status !== "done" &&
                        g.parentId === v.id &&
                        (g.parentLevel ?? "vision") === "vision",
                    ).length;
                  const accentAttrs = buildAccentAttributes(getVisionAccent(v));
                  const icon = v.icon ? escapeHtmlFn(v.icon) : "";
                  return `
                    <div class="garden-vision-card cosmic-card cosmic-card--vision${selectedClass}"${accentAttrs.dataAttr}${accentAttrs.styleAttr} data-action="select-vision" data-vision-id="${escapeHtmlFn(v.id)}" role="button" tabindex="0">
                      <div class="garden-vision-card-title">${icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${icon}</span>` : ""}<span class="garden-vision-card-title-text">${escapeHtmlFn(v.title)}</span></div>
                      <div class="garden-vision-card-meta">
                          <div class="garden-vision-card-label">Active chapter${active.length === 1 ? "" : "s"}</div>
                          <div class="garden-vision-card-chips">
                            ${
                              hasActive
                                ? active
                                    .slice(0, 3)
                                    .map(
                                      (m) => `${(() => {
                                        const mi = m.icon ? escapeHtmlFn(m.icon) : "";
                                        return `<button type=\"button\" class=\"garden-pill garden-pill--soft\" data-action=\"select-milestone\" data-vision-id=\"${escapeHtmlFn(v.id)}\" data-milestone-id=\"${escapeHtmlFn(m.id)}\">${mi ? `<span class=\\\"garden-emoji\\\" aria-hidden=\\\"true\\\">${mi}</span>` : ""}<span class=\"garden-pill-text\">${escapeHtmlFn(m.title)}</span></button>`;
                                      })()}`,
                                    )
                                    .join("")
                                : `<span class="garden-pill garden-pill--neutral">${systemState === "VISIONS_ONLY" ? "No milestone yet" : linkedMilestonesCount === 0 ? "No milestone yet" : "No active milestone right now"}</span>`
                            }
                            ${active.length > 3 ? `<span class="garden-pill garden-pill--neutral">+${active.length - 3}</span>` : ""}
                          </div>
                          ${
                            !hasActive && onAddGoalLinked
                              ? `<div class="garden-card-actions">
                                  <button type="button" class="btn btn-primary btn-sm" data-action="add-milestone" data-vision-id="${escapeHtmlFn(v.id)}">Add milestone</button>
                                </div>`
                              : ""
                          }
                          ${
                            hasActive && !anyFocusThisWeek && onAddGoalLinked
                              ? `<div class="garden-card-actions">
                                  <div class="garden-hint garden-hint--inline">No focus set for this week.</div>
                                  <button type="button" class="btn btn-ghost btn-sm" data-action="add-focus" data-vision-id="${escapeHtmlFn(v.id)}" data-milestone-id="${escapeHtmlFn(active[0].id)}">Set weekly focus</button>
                                </div>`
                              : ""
                          }
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
              ${
                milestonesToday.length === 0
                  ? `<div class="garden-hint">Milestones can add a chapter when you want one. Intentions can also link directly to a Vision.</div>`
                  : ""
              }
            `
        }
      </section>

      <section class="garden-section garden-section--linkage" aria-label="Linkage Explorer">
        <div class="garden-section-header">
          <div>
            <h2 class="garden-section-title"><span class="garden-section-icon" aria-hidden="true">🔗</span>Linkage Explorer</h2>
            <p class="garden-section-subtitle">Tap a Vision to see what supports it this week.</p>
          </div>
          <div class="garden-section-actions">
            ${
              selectedVision || selectedMilestone || selectedFocus
                ? `<button type="button" class="btn btn-ghost" data-action="clear-explorer">Clear selection</button>`
                : ""
            }
            ${
              selectedFocus
                ? `<button type="button" class="btn btn-ghost" data-action="open-goal" data-goal-id="${escapeHtmlFn(selectedFocus.id)}">Open</button>`
                : selectedMilestone
                  ? `<button type="button" class="btn btn-ghost" data-action="open-goal" data-goal-id="${escapeHtmlFn(selectedMilestone.id)}">Open</button>`
                  : selectedVision
                    ? `<button type="button" class="btn btn-ghost" data-action="open-goal" data-goal-id="${escapeHtmlFn(selectedVision.id)}">Open</button>`
                    : ""
            }
          </div>
        </div>

        ${
          systemState === "NO_VISIONS"
            ? `<div class="garden-empty-card"><div class="garden-empty-title">Choose a Vision to see what supports it.</div></div>`
            : !selectedVision
              ? `<div class="garden-empty-card"><div class="garden-empty-title">${
                  systemState === "VISIONS_ONLY"
                    ? "Tap a Vision to notice what could support it."
                    : "Tap a Vision to see what supports it this week."
                }</div></div>`
              : `
                <div class="garden-explorer">
                  <div class="garden-explorer-main">
                    <div class="garden-chain-pill" role="list" aria-label="Selected path">
                      <span class="garden-chain-pill-label">Selected path</span>
                      <div class="garden-chain-pill-items">
                        <span class="garden-pill garden-pill--soft garden-pill--static">${selectedVision.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(selectedVision.icon)}</span>` : ""}<span class="garden-pill-text">${escapeHtmlFn(selectedVision.title)}</span></span>
                        <span class="garden-chain-pill-arrow" aria-hidden="true">→</span>
                        ${
                          selectedMilestone
                            ? `<span class="garden-pill garden-pill--soft garden-pill--static">${selectedMilestone.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(selectedMilestone.icon)}</span>` : ""}<span class="garden-pill-text">${escapeHtmlFn(selectedMilestone.title)}</span></span>`
                            : renderUnlinkedPill("Milestone (optional)")
                        }
                        <span class="garden-chain-pill-arrow" aria-hidden="true">→</span>
                        ${
                          selectedFocus
                            ? `<span class="garden-pill garden-pill--soft garden-pill--static">${selectedFocus.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(selectedFocus.icon)}</span>` : ""}<span class="garden-pill-text">${escapeHtmlFn(selectedFocus.title)}</span></span>`
                            : renderUnlinkedPill("Focus (optional)")
                        }
                      </div>
                    </div>

                    <div class="garden-explorer-block">
                      <div class="garden-related-label">Active milestones</div>
                      <div class="garden-related-list">
                        ${
                          explorerActiveMilestones.length > 0
                            ? explorerActiveMilestones
                                .slice(0, 8)
                                .map(
                                  (m) =>
                                    `<button type="button" class="garden-pill${selectedMilestoneId === m.id ? " is-selected" : ""}" data-action="select-milestone" data-vision-id="${escapeHtmlFn(selectedVision.id)}" data-milestone-id="${escapeHtmlFn(m.id)}">${m.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(m.icon)}</span>` : ""}<span class="garden-pill-text">${escapeHtmlFn(m.title)}</span></button>`,
                                )
                                .join("")
                            : `<span class="garden-pill garden-pill--neutral">${
                                systemState === "VISIONS_ONLY" ? "No milestone yet" : "No active milestones right now"
                              }</span>`
                        }
                        ${
                          explorerActiveMilestones.length === 0 && onAddGoalLinked
                            ? `<button type="button" class="btn btn-primary btn-sm" data-action="add-milestone" data-vision-id="${escapeHtmlFn(selectedVision.id)}">Add milestone</button>`
                            : ""
                        }
                      </div>
                    </div>

                    <div class="garden-explorer-block">
                      <div class="garden-related-label">Focus (this week)</div>
                      <div class="garden-related-list">
                        ${
                          explorerFocuses.length > 0
                            ? explorerFocuses
                                .slice(0, 8)
                                .map(
                                  (f) =>
                                    `<button type="button" class="garden-pill${selectedFocusId === f.id ? " is-selected" : ""}" data-action="select-focus" data-focus-id="${escapeHtmlFn(f.id)}">${f.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(f.icon)}</span>` : ""}<span class="garden-pill-text">${escapeHtmlFn(f.title)}</span></button>`,
                                )
                                .join("")
                            : `<span class="garden-pill garden-pill--neutral">No focus set for this week</span>`
                        }
                        ${
                          explorerFocuses.length === 0 && onAddGoalLinked && (selectedMilestone || explorerActiveMilestones[0])
                            ? `<button type="button" class="btn btn-ghost btn-sm" data-action="add-focus" data-vision-id="${escapeHtmlFn(selectedVision.id)}" data-milestone-id="${escapeHtmlFn((selectedMilestone ?? explorerActiveMilestones[0]).id)}">Set weekly focus</button>`
                            : ""
                        }
                      </div>
                    </div>

                    <div class="garden-explorer-block">
                      <div class="garden-related-label">Intentions (this week)</div>
                      <div class="garden-related-list">
                        ${
                          explorerIntentions.length > 0
                            ? explorerIntentions
                                .slice(0, 12)
                                .map(
                                  (i) =>
                                    `<button type="button" class="garden-pill" data-action="open-goal" data-goal-id="${escapeHtmlFn(i.id)}">${i.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(i.icon)}</span>` : ""}<span class="garden-pill-text">${escapeHtmlFn(i.title)}</span></button>`,
                                )
                                .join("")
                            : `<span class="garden-pill garden-pill--neutral">No linked intentions yet this week</span>`
                        }
                      </div>
                    </div>
                  </div>

                  <aside class="garden-explorer-aside">
                    <div class="garden-related">
                      <div class="garden-related-label">What to try next</div>
                      <div class="garden-related-empty">
                        ${
                          systemState === "VISIONS_ONLY"
                            ? "Milestones help make the path clearer when you want structure."
                            : systemState === "VISIONS_WITH_MILESTONES"
                              ? "A weekly focus can make your intentions feel more intentional."
                              : "You can keep this quiet—use it when you want orientation."
                        }
                      </div>
                    </div>
                  </aside>
                </div>
              `
        }
      </section>

      <section class="garden-section garden-section--primary garden-section--alignment" aria-label="Weekly Alignment">
        <div class="garden-section-header">
          <div>
            <div class="garden-section-title-row">
              <h2 class="garden-section-title"><span class="garden-section-icon" aria-hidden="true">◌</span>Weekly Alignment</h2>
              <span class="garden-section-tag">Optional reflection</span>
            </div>
            <p class="garden-section-subtitle">Week ${weekNum}: what did you touch, and what didn’t you touch?</p>
          </div>
          <button type="button" class="btn btn-ghost" data-action="toggle-alignment-details" aria-pressed="${alignmentDetailsOpen ? "true" : "false"}">
            ${alignmentDetailsOpen ? "Hide details" : "Details"}
          </button>
        </div>

        ${
          visions.length === 0
            ? `<div class="garden-empty-card"><div class="garden-empty-title">Add a Vision to make weekly alignment visible.</div></div>`
            : `
              <div class="garden-alignment-list" role="list">
                ${(focusedVisionId ? visions.filter((v) => v.id === focusedVisionId) : visions)
                  .map((v) => {
                    const touched = (visionTouchedThisWeek.get(v.id) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));
                    const isTouched = touched.length > 0;
                    const indicator = isTouched
                      ? `<span class="garden-presence garden-presence--touched" aria-label="Touched this week">◉</span>`
                      : `<span class="garden-presence garden-presence--not" aria-label="Not touched this week">○</span>`;
                    const addTinyBtn = !isTouched && onQuickAddIntention
                      ? `<button type="button" class="btn btn-primary btn-sm" data-action="add-tiny-intention" data-vision-id="${escapeHtmlFn(v.id)}">Add one tiny intention</button>`
                      : "";
                    const linkExistingBtn =
                      !isTouched && unlinkedIntentionsThisWeek.length > 0
                        ? `<button type="button" class="btn btn-ghost btn-sm" data-action="link-existing-intention" data-vision-id="${escapeHtmlFn(v.id)}">Link an existing intention</button>`
                        : "";

                    return `
                      <div class="garden-alignment-row" role="listitem">
                        <div class="garden-alignment-main">
                          ${indicator}
                          <button type="button" class="garden-alignment-vision" data-action="select-vision" data-vision-id="${escapeHtmlFn(v.id)}">${v.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(v.icon)}</span>` : ""}<span class="garden-alignment-vision-text">${escapeHtmlFn(v.title)}</span></button>
                        </div>
                        <div class="garden-alignment-meta">
                          <div class="garden-alignment-status">${isTouched ? "Touched this week" : "Not touched this week"}</div>
                          ${addTinyBtn}
                          ${linkExistingBtn}
                        </div>
                        ${
                          alignmentDetailsOpen
                            ? `
                              <div class="garden-alignment-details">
                                <div class="garden-alignment-details-label">${touched.length} intention${touched.length === 1 ? "" : "s"} linked this week</div>
                                <div class="garden-alignment-details-list">
                                  ${
                                    touched.length > 0
                                      ? touched
                                          .slice(0, 8)
                                          .map(
                                            (i) => `<button type="button" class="garden-pill" data-action="open-goal" data-goal-id="${escapeHtmlFn(i.id)}">${i.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(i.icon)}</span>` : ""}<span class="garden-pill-text">${escapeHtmlFn(i.title)}</span></button>`,
                                          )
                                          .join("")
                                      : `<span class="garden-pill garden-pill--neutral">None</span>`
                                  }
                                  ${touched.length > 8 ? `<span class="garden-pill garden-pill--neutral">+${touched.length - 8}</span>` : ""}
                                </div>
                              </div>
                            `
                            : ""
                        }
                      </div>
                    `;
                  })
                  .join("")}
              </div>
              ${
                intentionsInWeek.length === 0
                  ? `<div class="garden-hint">No linked intentions yet this week. If you want, you can add one tiny intention for a Vision you care about.</div>`
                  : ""
              }
              ${
                intentionsInWeek.length > 0 && visionTouchedThisWeek.size === 0
                  ? `<div class="garden-hint">No linked intentions yet this week.</div>`
                  : ""
              }
              ${
                systemState === "VISIONS_ONLY"
                  ? `<div class="garden-hint">Intentions can link directly to Visions. Milestones help make the path clearer when you want it.</div>`
                  : ""
              }

              <div class="garden-reflection-block">
                <button type="button" class="garden-reflection-toggle" data-action="toggle-reflection" aria-expanded="${reflectionOpen ? "true" : "false"}">
                  <span class="garden-reflection-toggle-title">Reflection (optional)</span>
                  <span class="garden-reflection-toggle-subtitle">A few gentle prompts — no journaling required.</span>
                </button>
                ${
                  reflectionOpen
                    ? `
                      <div class="garden-reflection-body">
                        <div class="garden-reflection-q">
                          <div class="garden-reflection-q-title">Anything you want to adjust next week?</div>
                          <div class="garden-reflection-chips" data-ref-q="q1">
                            ${["Make it smaller", "More recovery", "Clarify the next step", "Keep it the same"]
                              .map((opt) => {
                                const selected = cachedReflection?.answers?.q1 === opt;
                                return `<button type="button" class="garden-pill${selected ? " is-selected" : ""}" data-action="set-reflection" data-q="q1" data-value="${escapeHtmlFn(opt)}">${escapeHtmlFn(opt)}</button>`;
                              })
                              .join("")}
                          </div>
                        </div>
                        <div class="garden-reflection-q">
                          <div class="garden-reflection-q-title">Anything you avoided because it felt too big?</div>
                          <div class="garden-reflection-chips" data-ref-q="q2">
                            ${["A conversation", "Admin / logistics", "Creative work", "Body care", "Not sure"]
                              .map((opt) => {
                                const selected = cachedReflection?.answers?.q2 === opt;
                                return `<button type="button" class="garden-pill${selected ? " is-selected" : ""}" data-action="set-reflection" data-q="q2" data-value="${escapeHtmlFn(opt)}">${escapeHtmlFn(opt)}</button>`;
                              })
                              .join("")}
                          </div>
                        </div>
                        <div class="garden-reflection-q">
                          <div class="garden-reflection-q-title">What support would help?</div>
                          <div class="garden-reflection-chips" data-ref-q="q3">
                            ${["Time block", "Ask for help", "Change the environment", "Lower the bar", "Rest first"]
                              .map((opt) => {
                                const selected = cachedReflection?.answers?.q3 === opt;
                                return `<button type="button" class="garden-pill${selected ? " is-selected" : ""}" data-action="set-reflection" data-q="q3" data-value="${escapeHtmlFn(opt)}">${escapeHtmlFn(opt)}</button>`;
                              })
                              .join("")}
                          </div>
                        </div>
                        <div class="garden-reflection-actions">
                          <span class="garden-reflection-meta">Saved locally for this week.</span>
                          <button type="button" class="btn btn-ghost btn-sm" data-action="clear-reflection">Clear</button>
                        </div>
                      </div>
                    `
                    : ""
                }
              </div>
            `
        }
      </section>
    `;

    const rerender = () => {
      eventBus.emit("view:changed", { transition: false });
    };

    container.querySelectorAll<HTMLElement>("[data-action='add-vision']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onAddGoal?.("vision");
      });
    });

    container.querySelector<HTMLElement>("[data-action='tab-all']")?.addEventListener("click", (e) => {
      e.preventDefault();
      focusedVisionId = null;
      rerender();
    });

    container.querySelectorAll<HTMLElement>("[data-action='tab-vision']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = (btn as HTMLElement).dataset.visionId;
        if (!id) return;
        focusedVisionId = id;
        selectedVisionId = id; // keep explorer in sync when focusing
        selectedMilestoneId = null;
        selectedFocusId = null;
        rerender();
      });
    });

    const openMoreVisions = () => {
      const rest = visions.slice(4);
      if (rest.length === 0) return;
      const overlay = document.createElement("div");
      overlay.className = "garden-overlay";
      overlay.innerHTML = `
        <div class="garden-overlay-card" role="dialog" aria-modal="true" aria-label="More visions">
          <div class="garden-overlay-header">
            <div class="garden-overlay-title">More visions</div>
            <div class="garden-overlay-subtitle">Pick one to focus this page.</div>
          </div>
          <div class="garden-overlay-list">
            ${rest
              .map(
                (v) => `
                  <button type="button" class="garden-overlay-item" data-action="pick-more-vision" data-vision-id="${escapeHtmlFn(v.id)}">
                    ${v.icon ? `<span class=\"garden-emoji\" aria-hidden=\"true\">${escapeHtmlFn(v.icon)}</span>` : ""}
                    <span class="garden-overlay-item-text">${escapeHtmlFn(v.title)}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
          <div class="garden-overlay-actions">
            <button type="button" class="btn btn-ghost" data-action="close-overlay">Cancel</button>
          </div>
        </div>
      `;
      const close = () => overlay.remove();
      overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) close();
      });
      overlay.querySelector<HTMLElement>("[data-action='close-overlay']")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        close();
      });
      overlay.querySelectorAll<HTMLElement>("[data-action='pick-more-vision']").forEach((el) => {
        el.addEventListener("click", (ev) => {
          ev.preventDefault();
          const id = (el as HTMLElement).dataset.visionId;
          if (!id) return;
          focusedVisionId = id;
          selectedVisionId = id;
          selectedMilestoneId = null;
          selectedFocusId = null;
          close();
          rerender();
        });
      });
      document.body.appendChild(overlay);
    };

    container.querySelector<HTMLElement>("[data-action='tab-more']")?.addEventListener("click", (e) => {
      e.preventDefault();
      openMoreVisions();
    });

    container.querySelectorAll<HTMLElement>("[data-action='add-milestone']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const visionId = (btn as HTMLElement).dataset.visionId;
        if (!visionId || !onAddGoalLinked) return;
        onAddGoalLinked({
          level: "milestone",
          parentId: visionId,
          parentLevel: "vision",
          preselectedMonth: viewDate.getMonth(),
          preselectedYear: viewDate.getFullYear(),
        });
      });
    });

    container.querySelectorAll<HTMLElement>("[data-action='add-focus']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const milestoneId = (btn as HTMLElement).dataset.milestoneId;
        if (!milestoneId || !onAddGoalLinked) return;
        onAddGoalLinked({
          level: "focus",
          parentId: milestoneId,
          parentLevel: "milestone",
          preselectedMonth: null,
          preselectedYear: null,
        });
      });
    });

    container.querySelector<HTMLElement>("[data-action='toggle-alignment-details']")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      alignmentDetailsOpen = !alignmentDetailsOpen;
      rerender();
    });

    container.querySelector<HTMLElement>("[data-action='toggle-reflection']")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      reflectionOpen = !reflectionOpen;
      rerender();
    });

    container.querySelectorAll<HTMLElement>("[data-action='set-reflection']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const q = (btn as HTMLElement).dataset.q as "q1" | "q2" | "q3" | undefined;
        const value = (btn as HTMLElement).dataset.value;
        if (!q || !value) return;
        const nextAnswers: WeekReflection["answers"] = {
          ...(cachedReflection?.answers ?? {}),
          [q]: value,
        };
        reflectionCache.set(
          reflectionId,
          cachedReflection
            ? { ...cachedReflection, answers: nextAnswers }
            : { id: reflectionId, weekYear, weekNum, createdAt: Date.now(), answers: nextAnswers },
        );
        void WeekReflections.upsert(weekYear, weekNum, nextAnswers).then(() => {
          eventBus.emit("ui:toast", { icon: "📝", message: "Saved locally." });
          rerender();
        });
      });
    });

    container.querySelector<HTMLElement>("[data-action='clear-reflection']")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      reflectionCache.set(reflectionId, null);
      void WeekReflections.clear(weekYear, weekNum).then(() => {
        eventBus.emit("ui:toast", { icon: "🧼", message: "Cleared." });
        rerender();
      });
    });

    container.querySelectorAll<HTMLElement>("[data-action='select-vision']").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = (el as HTMLElement).dataset.visionId;
        if (!id) return;
        selectedVisionId = id;
        selectedMilestoneId = null;
        selectedFocusId = null;
        rerender();
      });

      el.addEventListener("keydown", (e) => {
        const ke = e as KeyboardEvent;
        if (ke.key !== "Enter" && ke.key !== " ") return;
        ke.preventDefault();
        (el as HTMLElement).click();
      });
    });

    container.querySelectorAll<HTMLElement>("[data-action='select-milestone']").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const visionId = (el as HTMLElement).dataset.visionId;
        const milestoneId = (el as HTMLElement).dataset.milestoneId;
        if (visionId) selectedVisionId = visionId;
        if (!milestoneId) return;
        selectedMilestoneId = milestoneId;
        selectedFocusId = null;
        rerender();
      });
    });

    container.querySelectorAll<HTMLElement>("[data-action='select-focus']").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const focusId = (el as HTMLElement).dataset.focusId;
        if (!focusId) return;
        selectedFocusId = focusId;
        rerender();
      });
    });

    container.querySelector<HTMLElement>("[data-action='clear-explorer']")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedVisionId = null;
      selectedMilestoneId = null;
      selectedFocusId = null;
      rerender();
    });

    container.querySelectorAll<HTMLElement>("[data-action='open-goal']").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const goalId = (el as HTMLElement).dataset.goalId;
        if (goalId) onGoalClick(goalId);
      });
    });

    container.querySelectorAll<HTMLElement>("[data-action='add-tiny-intention']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const visionId = (btn as HTMLElement).dataset.visionId;
        if (!visionId || !onQuickAddIntention) return;

        onQuickAddIntention({
          level: "intention",
          startDate: getDefaultTinyIntentionDateYmd(),
          parentId: visionId,
          parentLevel: "vision",
          label: "One tiny intention",
          placeholder: "What’s one gentle next step?",
          showTinyField: true,
          tinyLabel: "Tiny version (optional)",
          tinyPlaceholder: "If energy is low, what’s the smallest version you’d still be glad you did?",
        });
      });
    });

    const openLinkExistingOverlay = (vision: Goal) => {
      const candidates = unlinkedIntentionsThisWeek.slice().sort((a, b) => a.title.localeCompare(b.title));
      if (candidates.length === 0) return;

      const overlay = document.createElement("div");
      overlay.className = "garden-overlay";
      overlay.innerHTML = `
        <div class="garden-overlay-card" role="dialog" aria-modal="true" aria-label="Link an existing intention">
          <div class="garden-overlay-header">
            <div class="garden-overlay-title">Link an existing intention</div>
            <div class="garden-overlay-subtitle">This links an intention to <strong>${escapeHtmlFn(vision.title)}</strong>.</div>
          </div>
          <div class="garden-overlay-list">
            ${candidates
              .slice(0, 20)
              .map(
                (i) => `
                  <button type="button" class="garden-overlay-item" data-action="link-one" data-intention-id="${escapeHtmlFn(i.id)}">
                    ${escapeHtmlFn(i.title)}
                  </button>
                `,
              )
              .join("")}
          </div>
          <div class="garden-overlay-actions">
            <button type="button" class="btn btn-ghost" data-action="close-overlay">Cancel</button>
          </div>
        </div>
      `;

      const close = () => overlay.remove();
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      overlay.querySelector<HTMLElement>("[data-action='close-overlay']")?.addEventListener("click", (e) => {
        e.preventDefault();
        close();
      });
      overlay.querySelectorAll<HTMLElement>("[data-action='link-one']").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          const intentionId = (el as HTMLElement).dataset.intentionId;
          if (!intentionId) return;
          Goals.update(intentionId, { parentId: vision.id, parentLevel: "vision" });
          eventBus.emit("ui:toast", { icon: "🔗", message: "Linked." });
          close();
          rerender();
        });
      });

      document.body.appendChild(overlay);
    };

    container.querySelectorAll<HTMLElement>("[data-action='link-existing-intention']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const visionId = (btn as HTMLElement).dataset.visionId;
        const vision = visionId ? Goals.getById(visionId) : null;
        if (!vision) return;
        openLinkExistingOverlay(vision);
      });
    });
  },
};
