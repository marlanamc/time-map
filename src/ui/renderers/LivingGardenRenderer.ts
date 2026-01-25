// ===================================
// Living Garden Renderer - A Unified Ecosystem
// ===================================
import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { WeekReflections } from "../../core/WeekReflections";
import { eventBus } from "../../core/EventBus";
import type {
  Goal,
  GoalLevel,
  UIElements,
  WeekReflection,
  GardenLevelEmojis,
} from "../../types";
import { getVisionAccent } from "../../utils/goalLinkage";

type AddGoalLinkedOpts = {
  level: Extract<GoalLevel, "milestone" | "focus">;
  parentId: string;
  parentLevel: GoalLevel;
  preselectedMonth?: number | null;
  preselectedYear?: number | null;
};

let reflectionOpen = false;
let activeGoalId: string | null = null;
const microWinPulseId: string | null = null;

const reflectionCache = new Map<string, WeekReflection | null>();

function getWeekRangeFor(date: Date): {
  weekStart: Date;
  weekEnd: Date;
  weekNum: number;
  weekYear: number;
} {
  const weekNum = State.getWeekNumber(date);
  const weekYear = State.getWeekYear(date);
  const weekStart = State.getWeekStart(weekYear, weekNum);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { weekStart, weekEnd, weekNum, weekYear };
}

function getVisionIdForGoal(goal: Goal): string | null {
  let cur: Goal | null = goal;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    if (cur.level === "vision") return cur.id;
    seen.add(cur.id);
    cur = cur.parentId ? (Goals.getById(cur.parentId) ?? null) : null;
  }
  return null;
}

/** Build breadcrumb trail by walking up the parentId chain */
function buildBreadcrumb(goal: Goal): Goal[] {
  const trail: Goal[] = [];
  let current: Goal | null = goal;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    trail.unshift(current);
    seen.add(current.id);
    current = current.parentId
      ? (Goals.getById(current.parentId) ?? null)
      : null;
  }
  return trail;
}

/** Format minutes to "Xh Ym" or "Xm" display string */
function formatTimeLogged(minutes: number): string {
  if (minutes === 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Group goals by status for kanban display */
function groupByStatus(goals: Goal[]): {
  todo: Goal[];
  inProgress: Goal[];
  done: Goal[];
} {
  return {
    todo: goals.filter(
      (g) => g.status === "not-started" || g.status === "blocked",
    ),
    inProgress: goals.filter((g) => g.status === "in-progress"),
    done: goals.filter((g) => g.status === "done"),
  };
}

/** Get level emoji for display */
function getLevelEmoji(level: GoalLevel): string {
  switch (level) {
    case "vision":
      return "✨";
    case "milestone":
      return "🎯";
    case "focus":
      return "🔎";
    case "intention":
      return "🌱";
    default:
      return "📌";
  }
}

export const LivingGardenRenderer = {
  render(
    elements: UIElements,
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
    onAddGoal?: (level: GoalLevel) => void,
    onAddGoalLinked?: (opts: AddGoalLinkedOpts) => void,
  ) {
    if (!State.data) return;

    const container = elements.calendarGrid;
    if (!container) return;

    const viewDate = State.viewingDate ?? new Date();
    const { weekStart, weekEnd, weekNum, weekYear } = getWeekRangeFor(viewDate);

    const visions = Goals.getForRange(
      new Date(weekYear, 0, 1),
      new Date(weekYear, 11, 31),
    ).filter((g) => g.level === "vision" && g.status !== "done");

    const milestonesToday = Goals.getForRange(viewDate, viewDate).filter(
      (g) => g.level === "milestone" && g.status !== "done",
    );
    // Check milestones for the entire year (like visions)
    const _milestonesInYear = Goals.getForRange(
      new Date(weekYear, 0, 1),
      new Date(weekYear, 11, 31),
    ).filter((g) => g.level === "milestone" && g.status !== "done");
    const focusesInWeek = Goals.getForRange(weekStart, weekEnd).filter(
      (g) => g.level === "focus" && g.status !== "done",
    );
    const intentionsInWeek = Goals.getForRange(weekStart, weekEnd).filter(
      (g) => g.level === "intention",
    );

    // Build ecosystem data
    const ecosystem = visions.map((vision) => {
      const accent = getVisionAccent(vision);
      const visionMilestones = milestonesToday.filter(
        (m) =>
          m.parentId === vision.id && (m.parentLevel ?? "vision") === "vision",
      );
      const visionFocuses = focusesInWeek.filter(
        (f) => f.parentId === vision.id && f.parentLevel === "vision",
      );
      const visionIntentions = intentionsInWeek.filter(
        (i) => getVisionIdForGoal(i) === vision.id,
      );

      // Add milestone-linked focuses and intentions
      visionMilestones.forEach((milestone) => {
        const milestoneFocuses = focusesInWeek.filter(
          (f) => f.parentId === milestone.id && f.parentLevel === "milestone",
        );
        visionFocuses.push(...milestoneFocuses);

        const milestoneIntentions = intentionsInWeek.filter((i) => {
          const ancestor = i.parentId ? Goals.getById(i.parentId) : null;
          return (
            ancestor?.parentId === milestone.id &&
            ancestor.parentLevel === "milestone"
          );
        });
        visionIntentions.push(...milestoneIntentions);
      });

      return {
        vision,
        accent,
        milestones: visionMilestones,
        focuses: visionFocuses,
        intentions: visionIntentions,
        isAlive:
          visionMilestones.length > 0 ||
          visionFocuses.length > 0 ||
          visionIntentions.length > 0,
      };
    });

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
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;

    // Get custom emoji preferences with defaults
    const emojiPrefs: GardenLevelEmojis =
      State.data?.preferences?.gardenLevelEmojis ?? {};
    const levelEmojis = {
      milestone: emojiPrefs.milestone ?? "🎯",
      focus: emojiPrefs.focus ?? "🌿",
      intention: emojiPrefs.intention ?? "🌱",
    };

    const getGrowthMeta = (plot: (typeof ecosystem)[number]) => {
      const totalIntentions = plot.intentions.length;
      const doneIntentions = plot.intentions.filter(
        (i) => i.status === "done",
      ).length;
      const completionRate =
        totalIntentions > 0
          ? Math.round((doneIntentions / totalIntentions) * 100)
          : 0;

      const focusCount = plot.focuses.length;
      const _milestoneCount = plot.milestones.length;

      // Dynamic labels based on actual state
      if (!plot.isAlive) {
        return {
          icon: levelEmojis.intention,
          label: "Waiting to bloom",
          sublabel: "Add your first milestone",
          growthState: "dormant",
          completionRate,
        };
      }

      if (completionRate >= 75) {
        return {
          icon: "🌸",
          label: "Flourishing",
          sublabel: `${doneIntentions} intention${doneIntentions !== 1 ? "s" : ""} complete`,
          growthState: "blooming",
          completionRate,
        };
      }

      if (completionRate >= 35) {
        return {
          icon: levelEmojis.focus,
          label: "Taking root",
          sublabel: `${focusCount} focus${focusCount !== 1 ? "es" : ""} active`,
          growthState: "growing",
          completionRate,
        };
      }

      return {
        icon: levelEmojis.intention,
        label: "Just planted",
        sublabel: `${totalIntentions - doneIntentions} to go`,
        growthState: "sprouting",
        completionRate,
      };
    };

    const renderLaneColumn = (
      label: string,
      level: GoalLevel,
      items: Goal[],
      _visionId: string,
    ) => {
      const visible = items.slice(0, 2);
      const chips =
        visible.length > 0
          ? visible
              .map(
                (item) => `
              <div class="living-garden-chip ${item.status === "done" ? "is-complete" : ""} ${microWinPulseId === item.id ? "is-pulsing" : ""}" data-action="open-goal" data-goal-id="${escapeHtmlFn(item.id)}">
                ${item.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(item.icon)}</span>` : ""}
                <div class="living-garden-chip-text">
                  <span class="living-garden-chip-title">${escapeHtmlFn(item.title)}</span>
                  <span class="living-garden-chip-meta">${label}</span>
                </div>
              </div>
            `,
              )
              .join("")
          : `<div class="living-garden-chip living-garden-chip--empty">Ready to plant</div>`;
      return `
        <div class="living-garden-lane-column" data-level="${level}">
          <div class="living-garden-lane-label">${label}</div>
          <div class="living-garden-lane-chips">
            ${chips}
          </div>
        </div>
      `;
    };

    const renderLane = (plot: (typeof ecosystem)[number]) => {
      const growth = getGrowthMeta(plot);
      const accentStyle = plot.accent
        ? `--garden-accent: ${plot.accent.color}; --garden-accent-gradient: linear-gradient(120deg, ${plot.accent.color} 0%, ${plot.accent.color}22 100%);`
        : "";

      // Dynamic sublabel based on actual content
      const laneSublabel = plot.isAlive
        ? `${plot.milestones.length} milestone${plot.milestones.length !== 1 ? "s" : ""}, ${plot.focuses.length} focus${plot.focuses.length !== 1 ? "es" : ""}`
        : "Start your journey";

      return `
        <div class="living-garden-lane" style="${accentStyle}" data-vision-id="${escapeHtmlFn(plot.vision.id)}" data-growth="${growth.growthState}">
          <div class="living-garden-lane-header">
            <button class="living-garden-lane-title" data-action="open-goal" data-goal-id="${escapeHtmlFn(plot.vision.id)}">
              ${plot.vision.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(plot.vision.icon)}</span>` : ""}
              <div>
                <div class="living-garden-lane-name">${escapeHtmlFn(plot.vision.title)}</div>
                <div class="living-garden-lane-sub">${laneSublabel}</div>
              </div>
            </button>
            <div class="living-garden-lane-growth">
              <span class="living-garden-lane-growth-icon">${growth.icon}</span>
              <div class="living-garden-lane-growth-text">
                <span>${growth.label}</span>
                <small>${growth.sublabel}</small>
              </div>
            </div>
          </div>
          <div class="living-garden-lane-body">
            <div class="living-garden-lane-spine"></div>
            <div class="living-garden-lane-columns">
              ${renderLaneColumn("Milestones", "milestone", plot.milestones, plot.vision.id)}
              ${renderLaneColumn("Focuses", "focus", plot.focuses, plot.vision.id)}
              ${renderLaneColumn("Intentions", "intention", plot.intentions, plot.vision.id)}
            </div>
          </div>
          ${
            !plot.isAlive && onAddGoalLinked
              ? `<div class="living-garden-lane-actions">
                  <button class="living-garden-btn-secondary" data-action="add-milestone" data-vision-id="${escapeHtmlFn(plot.vision.id)}">Plant a milestone</button>
                </div>`
              : ""
          }
        </div>
      `;
    };

    const lanesMarkup =
      visions.length === 0
        ? `
        <div class="living-garden-empty">
          <div class="living-garden-empty-icon">🌱</div>
          <h2>Ready to plant a vision?</h2>
          <p>Pick one area to nurture this week. We’ll connect milestones, focuses, and intentions for you.</p>
          ${
            onAddGoal
              ? `<div class="living-garden-empty-actions">
                  <button class="living-garden-btn-primary" data-action="add-vision">Plant your first vision</button>
                  <button class="living-garden-btn-secondary" data-action="add-focus">Start with a focus</button>
                </div>`
              : ""
          }
        </div>
      `
        : `
        <div class="living-garden-lanes ${isMobile ? "living-garden-lanes--mobile" : ""}">
          ${ecosystem.map((plot) => renderLane(plot)).join("")}
        </div>
      `;

    const reflectionSection =
      reflectionOpen && !isMobile
        ? `
        <div class="living-garden-reflection">
          <div class="living-garden-reflection-header">
            <h3>Weekly Garden Reflection</h3>
            <button class="living-garden-reflection-close" data-action="toggle-reflection">×</button>
          </div>
          <div class="living-garden-reflection-body">
            <div class="living-garden-reflection-question">
              <h4>What were your biggest wins this week?</h4>
              <textarea class="living-garden-reflection-input" 
                        data-action="input-reflection" data-q="wins" 
                        placeholder="List your accomplishments...">${escapeHtmlFn(cachedReflection?.answers?.wins || "")}</textarea>
            </div>

            <div class="living-garden-reflection-question">
              <h4>Growth note (What did you learn?)</h4>
              <textarea class="living-garden-reflection-input" 
                        data-action="input-reflection" data-q="growthNote" 
                        placeholder="Reflect on challenges and learnings...">${escapeHtmlFn(cachedReflection?.answers?.growthNote || "")}</textarea>
            </div>

            <div class="living-garden-reflection-question">
              <h4>Priorities for next week</h4>
              <textarea class="living-garden-reflection-input" 
                        data-action="input-reflection" data-q="nextWeekPriorities" 
                        placeholder="What will you focus on next?">${escapeHtmlFn(cachedReflection?.answers?.nextWeekPriorities || "")}</textarea>
            </div>
            <div class="living-garden-reflection-actions">
              <span class="living-garden-reflection-note">Saved locally for this week</span>
              <button class="living-garden-btn-ghost" data-action="clear-reflection">Clear</button>
            </div>
          </div>
        </div>
      `
        : "";

    const activeGoal = activeGoalId
      ? (Goals.getById(activeGoalId) ?? null)
      : null;
    if (activeGoalId && !activeGoal) {
      activeGoalId = null;
    }
    const allGoals = Goals.getAll();
    const isDescendant = (candidateId: string, ancestorId: string): boolean => {
      let cur = Goals.getById(candidateId) ?? null;
      const guard = new Set<string>();
      while (cur && !guard.has(cur.id)) {
        if (cur.parentId === ancestorId) return true;
        guard.add(cur.id);
        cur = cur.parentId ? (Goals.getById(cur.parentId) ?? null) : null;
      }
      return false;
    };

    const renderGoalDetail = (goal: Goal) => {
      const descendants = allGoals.filter((g) => isDescendant(g.id, goal.id));
      const descendantIntentions = descendants.filter(
        (g) => g.level === "intention",
      );
      const doneIntentions = descendantIntentions.filter(
        (g) => g.status === "done",
      ).length;
      const completionRate =
        descendantIntentions.length > 0
          ? Math.round((doneIntentions / descendantIntentions.length) * 100)
          : 0;

      // Use goal.progress for intentions, computed rate for others
      const progress =
        goal.level === "intention" ? goal.progress : completionRate;

      const statusLabel =
        completionRate >= 75
          ? "Blooming"
          : completionRate >= 35
            ? "Growing"
            : "Sprouting";
      const statusIcon =
        completionRate >= 75 ? "🌸" : completionRate >= 35 ? "🌿" : "🌱";

      // Build breadcrumb trail
      const breadcrumb = buildBreadcrumb(goal);

      // Calculate time logged
      const totalMinutes = (goal.timeLog || []).reduce(
        (sum, e) => sum + e.minutes,
        0,
      );
      const timeDisplay = formatTimeLogged(totalMinutes);

      // Subtask stats
      const subtasksDone = (goal.subtasks || []).filter((s) => s.done).length;
      const subtasksTotal = (goal.subtasks || []).length;

      // Get direct children for kanban
      const directChildren = allGoals.filter((g) => g.parentId === goal.id);
      const kanban = groupByStatus(directChildren);
      const hasAnyChildren = directChildren.length > 0;

      // Determine what child level this goal can have
      const childLevel: GoalLevel | null =
        goal.level === "vision"
          ? "milestone"
          : goal.level === "milestone"
            ? "focus"
            : goal.level === "focus"
              ? "intention"
              : null;

      const _childLevelLabel =
        childLevel === "milestone"
          ? "milestones"
          : childLevel === "focus"
            ? "focuses"
            : childLevel === "intention"
              ? "intentions"
              : "";

      // Get vision accent for theming
      const visionId = getVisionIdForGoal(goal);
      const vision = visionId ? Goals.getById(visionId) : null;
      const accent = vision ? getVisionAccent(vision) : null;
      const accentStyle = accent ? `--garden-accent: ${accent.color};` : "";

      // Render breadcrumb
      const renderBreadcrumb = () => {
        if (breadcrumb.length <= 1) return "";
        return `
          <nav class="living-garden-breadcrumb" aria-label="Goal hierarchy">
            ${breadcrumb
              .map((g, i) => {
                const isLast = i === breadcrumb.length - 1;
                const emoji = g.icon || getLevelEmoji(g.level);
                if (isLast) {
                  return `<span class="living-garden-breadcrumb-current">${escapeHtmlFn(emoji)} ${escapeHtmlFn(g.title)}</span>`;
                }
                return `
                  <button class="living-garden-breadcrumb-item" data-action="open-goal" data-goal-id="${escapeHtmlFn(g.id)}">
                    <span>${escapeHtmlFn(emoji)}</span>
                    <span>${escapeHtmlFn(g.title)}</span>
                  </button>
                  <span class="living-garden-breadcrumb-separator">›</span>
                `;
              })
              .join("")}
          </nav>
        `;
      };

      // Render kanban column with contextual empty states
      const renderKanbanColumn = (
        title: string,
        items: Goal[],
        dotClass: string,
        emptyHint: string,
      ) => `
        <div class="living-garden-kanban-column">
          <div class="living-garden-kanban-header">
            <span class="living-garden-kanban-dot ${dotClass}"></span>
            <h4>${title}</h4>
            <span class="living-garden-kanban-count">${items.length}</span>
          </div>
          <div class="living-garden-kanban-items">
            ${
              items.length
                ? items
                    .map(
                      (item) => `
                      <div class="living-garden-chip ${item.status === "done" ? "is-complete" : ""}" data-action="open-goal" data-goal-id="${escapeHtmlFn(item.id)}">
                        ${item.icon ? `<span class="living-garden-emoji">${escapeHtmlFn(item.icon)}</span>` : `<span class="living-garden-emoji">${getLevelEmoji(item.level)}</span>`}
                        <div class="living-garden-chip-text">
                          <span class="living-garden-chip-title">${escapeHtmlFn(item.title)}</span>
                          <span class="living-garden-chip-meta">${item.level}</span>
                        </div>
                      </div>
                    `,
                    )
                    .join("")
                : `<div class="living-garden-kanban-empty">${emptyHint}</div>`
            }
          </div>
        </div>
      `;

      // Render empty state when no children exist
      const renderEmptyKanban = () => `
        <div class="living-garden-empty-state">
          <div class="living-garden-empty-state-icon">${childLevel === "milestone" ? "🎯" : childLevel === "focus" ? "🔎" : "🌱"}</div>
          <h3 class="living-garden-empty-state-title">Ready to break this down?</h3>
          <p class="living-garden-empty-state-text">
            ${
              goal.level === "vision"
                ? "Add milestones to turn this vision into achievable monthly goals."
                : goal.level === "milestone"
                  ? "Add focuses to create weekly action items for this milestone."
                  : "Add intentions to plan your daily actions."
            }
          </p>
          ${
            childLevel && onAddGoalLinked
              ? `
            <button class="living-garden-btn-primary living-garden-empty-state-cta"
                    data-action="add-child"
                    data-parent-id="${escapeHtmlFn(goal.id)}"
                    data-parent-level="${goal.level}"
                    data-child-level="${childLevel}">
              Add ${childLevel === "milestone" ? "a milestone" : childLevel === "focus" ? "a focus" : "an intention"}
            </button>
          `
              : ""
          }
        </div>
      `;

      // Render subtasks for intentions (leaf nodes)
      const renderSubtasks = () => {
        if (!goal.subtasks || goal.subtasks.length === 0) {
          return `<p class="living-garden-detail-empty">No subtasks yet.</p>`;
        }
        return `
          <div class="living-garden-subtasks">
            ${goal.subtasks
              .map(
                (s) => `
                <div class="living-garden-subtask ${s.done ? "is-complete" : ""}">
                  <span class="living-garden-subtask-check">${s.done ? "✓" : "○"}</span>
                  <span class="living-garden-subtask-title">${escapeHtmlFn(s.title)}</span>
                </div>
              `,
              )
              .join("")}
          </div>
        `;
      };

      return `
        <section class="living-garden-detail" style="${accentStyle}">
          <div class="living-garden-detail-top">
            <button class="living-garden-detail-topbar-btn" data-action="goal-back">← Back to garden</button>
            <div class="living-garden-detail-topbar-title">
              <h1 class="living-garden-detail-topbar-heading">${goal.level.toUpperCase()}</h1>
            </div>
            <button class="living-garden-detail-topbar-btn living-garden-detail-topbar-action" data-action="open-goal-edit" data-goal-id="${escapeHtmlFn(goal.id)}">Edit goal</button>
          </div>

          <div class="living-garden-detail-body">
            ${renderBreadcrumb()}

            <div class="living-garden-detail-header">
              <div class="living-garden-detail-info">
                <h2 class="living-garden-detail-title">${goal.icon ? `${escapeHtmlFn(goal.icon)} ` : ""}${escapeHtmlFn(goal.title)}</h2>
                <p class="living-garden-detail-description">${escapeHtmlFn(goal.description || "No description yet.")}</p>
                ${goal.dueDate ? `<span class="living-garden-detail-due">Due: ${new Date(goal.dueDate).toLocaleDateString()}</span>` : ""}
              </div>
              <div class="living-garden-detail-progress">
                <svg class="living-garden-progress-ring" viewBox="0 0 100 100">
                  <circle class="living-garden-progress-ring-bg" cx="50" cy="50" r="42" />
                  <circle class="living-garden-progress-ring-fill" cx="50" cy="50" r="42" style="--progress: ${progress}" />
                </svg>
                <div class="living-garden-progress-ring-label">
                  <span class="living-garden-progress-ring-value">${progress}%</span>
                  <span class="living-garden-progress-ring-text">complete</span>
                </div>
              </div>
            </div>

            <div class="living-garden-detail-stats">
              <div class="living-garden-detail-stat">
                <span class="living-garden-detail-stat-icon">⏱️</span>
                <div class="living-garden-detail-stat-text">
                  <span class="living-garden-detail-stat-value">${timeDisplay}</span>
                  <span class="living-garden-detail-stat-label">Time logged</span>
                </div>
              </div>
              <div class="living-garden-detail-stat">
                <span class="living-garden-detail-stat-icon">${statusIcon}</span>
                <div class="living-garden-detail-stat-text">
                  <span class="living-garden-detail-stat-value">${statusLabel}</span>
                  <span class="living-garden-detail-stat-label">${completionRate}% intentions done</span>
                </div>
              </div>
              ${
                subtasksTotal > 0
                  ? `
                <div class="living-garden-detail-stat">
                  <span class="living-garden-detail-stat-icon">📋</span>
                  <div class="living-garden-detail-stat-text">
                    <span class="living-garden-detail-stat-value">${subtasksDone}/${subtasksTotal}</span>
                    <span class="living-garden-detail-stat-label">Subtasks done</span>
                  </div>
                </div>
              `
                  : ""
              }
            </div>

            ${
              goal.level === "intention"
                ? `
                <div class="living-garden-detail-section">
                  <h3 class="living-garden-detail-section-title">Subtasks</h3>
                  ${renderSubtasks()}
                </div>
              `
                : hasAnyChildren
                  ? `
                <div class="living-garden-kanban">
                  ${renderKanbanColumn("To Do", kanban.todo, "living-garden-kanban-dot--todo", "Waiting to start")}
                  ${renderKanbanColumn("In Progress", kanban.inProgress, "living-garden-kanban-dot--active", "Nothing active")}
                  ${renderKanbanColumn("Done", kanban.done, "living-garden-kanban-dot--done", "Celebrate soon!")}
                </div>
              `
                  : renderEmptyKanban()
            }
          </div>
        </section>
      `;
    };

    const mainContent = activeGoal ? renderGoalDetail(activeGoal) : lanesMarkup;
    const viewingYear = State.viewingYear;

    container.className = `garden-view-container living-garden${isMobile ? " living-garden--mobile" : ""}`;
    container.innerHTML = `
      <div class="garden-view">
        <div class="week-view-header">
          <h2 class="week-view-title">${viewingYear} Garden</h2>
        </div>
        <div class="living-garden-container living-garden-container--bare">
          ${mainContent}
          ${!isMobile ? reflectionSection : ""}
        </div>
      </div>
    `;

    // Common event handlers for both Mobile and Desktop
    container
      .querySelectorAll<HTMLElement>("[data-action='add-vision']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onAddGoal?.("vision");
        });
      });

    container
      .querySelectorAll<HTMLElement>("[data-action='add-focus']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onAddGoal?.("focus");
        });
      });

    container
      .querySelectorAll<HTMLElement>("[data-action='add-milestone']")
      .forEach((btn) => {
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

    // Handle add-child button clicks from empty state
    container
      .querySelectorAll<HTMLElement>("[data-action='add-child']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const parentId = btn.dataset.parentId;
          const parentLevel = btn.dataset.parentLevel as GoalLevel;
          const childLevel = btn.dataset.childLevel as "milestone" | "focus";
          if (!parentId || !childLevel || !onAddGoalLinked) return;
          onAddGoalLinked({
            level: childLevel,
            parentId,
            parentLevel,
            preselectedMonth: viewDate.getMonth(),
            preselectedYear: viewDate.getFullYear(),
          });
        });
      });

    container
      .querySelectorAll<HTMLElement>("[data-action='open-goal']")
      .forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const goalId = (el as HTMLElement).dataset.goalId;
          if (goalId) {
            activeGoalId = goalId;
            eventBus.emit("view:changed", { transition: false });
          }
        });
      });

    container
      .querySelector<HTMLElement>("[data-action='goal-back']")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeGoalId = null;
        eventBus.emit("view:changed", { transition: false });
      });

    container
      .querySelector<HTMLElement>("[data-action='open-goal-edit']")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const goalId = (e.currentTarget as HTMLElement).dataset.goalId;
        if (goalId) onGoalClick(goalId);
      });

    container
      .querySelector<HTMLElement>("[data-action='toggle-reflection']")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        reflectionOpen = !reflectionOpen;
        eventBus.emit("view:changed", { transition: false });
      });

    container
      .querySelectorAll<HTMLElement>("[data-action='set-reflection']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const q = (btn as HTMLElement).dataset.q as "q1" | "q2" | undefined;
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
              : {
                  id: reflectionId,
                  weekYear,
                  weekNum,
                  createdAt: Date.now(),
                  answers: nextAnswers,
                },
          );
          void WeekReflections.upsert(weekYear, weekNum, nextAnswers).then(
            () => {
              // No toast for every click since we save on every selection
              eventBus.emit("view:changed", { transition: false });
            },
          );
        });
      });

    container
      .querySelectorAll<HTMLTextAreaElement>("[data-action='input-reflection']")
      .forEach((input) => {
        let timeout: any;
        input.addEventListener("input", () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            const q = input.dataset.q as string;
            const value = input.value;
            if (!q) return;

            const nextAnswers: WeekReflection["answers"] = {
              ...(cachedReflection?.answers ?? {}),
              [q]: value,
            };
            reflectionCache.set(
              reflectionId,
              cachedReflection
                ? { ...cachedReflection, answers: nextAnswers }
                : {
                    id: reflectionId,
                    weekYear,
                    weekNum,
                    createdAt: Date.now(),
                    answers: nextAnswers,
                  },
            );
            void WeekReflections.upsert(weekYear, weekNum, nextAnswers);
          }, 500);
        });
      });

    container
      .querySelector<HTMLElement>("[data-action='clear-reflection']")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        reflectionCache.set(reflectionId, null);
        void WeekReflections.clear(weekYear, weekNum).then(() => {
          eventBus.emit("ui:toast", {
            icon: "🧹",
            message: "Reflection cleared.",
          });
          eventBus.emit("view:changed", { transition: false });
        });
      });
  },
};
