import { Goals } from "../../core/Goals";
import { getVisionAccent } from "../../utils/goalLinkage";
import type { Goal, GoalLevel, UIElements } from "../../types";

type AddChildGoalOpts = {
  parentId: string;
  parentLevel: GoalLevel;
  childLevel: Extract<GoalLevel, "milestone" | "focus" | "intention">;
};

export type GoalDetailCallbacks = {
  onOpenGoal?: (goalId: string) => void;
  onOpenGoalEdit?: (goalId: string) => void;
  onAddChildGoal?: (opts: AddChildGoalOpts) => void;
  onOpenVision?: (visionId: string) => void;
  onClose?: () => void;
};


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

function formatTimeLogged(minutes: number): string {
  if (minutes === 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function groupByStatus(goals: Goal[]) {
  return {
    todo: goals.filter((g) => g.status === "not-started" || g.status === "blocked"),
    inProgress: goals.filter((g) => g.status === "in-progress"),
    done: goals.filter((g) => g.status === "done"),
  };
}

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

function isDescendant(candidateId: string, ancestorId: string): boolean {
  let cur = Goals.getById(candidateId) ?? null;
  const seen = new Set<string>();

  while (cur && !seen.has(cur.id)) {
    if (cur.parentId === ancestorId) return true;
    seen.add(cur.id);
    cur = cur.parentId ? (Goals.getById(cur.parentId) ?? null) : null;
  }
  return false;
}

function buildGoalDetailMarkup(
  goal: Goal,
  escapeHtmlFn: (text: string) => string,
  options: { showAddChildAction: boolean } = { showAddChildAction: true },
): string {
  const allGoals = Goals.getAll();
  const descendants = allGoals.filter((g) => isDescendant(g.id, goal.id));
  const descendantIntentions = descendants.filter((g) => g.level === "intention");
  const doneIntentions = descendantIntentions.filter((g) => g.status === "done")
    .length;
  const completionRate =
    descendantIntentions.length > 0
      ? Math.round((doneIntentions / descendantIntentions.length) * 100)
      : 0;

  const progress = goal.level === "intention" ? goal.progress || 0 : completionRate;
  const statusLabel =
    completionRate >= 75 ? "Blooming" : completionRate >= 35 ? "Growing" : "Sprouting";
  const statusIcon = completionRate >= 75 ? "🌸" : completionRate >= 35 ? "🌿" : "🌱";

  const breadcrumb = buildBreadcrumb(goal);
  const totalMinutes = (goal.timeLog || []).reduce((sum, entry) => sum + entry.minutes, 0);
  const timeDisplay = formatTimeLogged(totalMinutes);

  const subtasksDone = (goal.subtasks || []).filter((s) => s.done).length;
  const subtasksTotal = (goal.subtasks || []).length;

  const directChildren = allGoals.filter((g) => g.parentId === goal.id);
  const kanban = groupByStatus(directChildren);
  const hasAnyChildren = directChildren.length > 0;

  const childLevel: AddChildGoalOpts["childLevel"] | null =
    goal.level === "vision"
      ? "milestone"
      : goal.level === "milestone"
        ? "focus"
        : goal.level === "focus"
          ? "intention"
          : null;

  const accentGoalId = getVisionIdForGoal(goal);
  const accentGoal = accentGoalId ? Goals.getById(accentGoalId) : null;
  const accent = accentGoal ? getVisionAccent(accentGoal) : null;
  const accentStyle = accent ? `--garden-accent: ${accent.color};` : "";

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
            const action = g.level === "vision" ? "open-vision" : "open-goal";
            return `
              <button class="living-garden-breadcrumb-item" data-action="${action}" data-goal-id="${escapeHtmlFn(g.id)}">
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

  const renderVisionLine = () => {
    if (goal.level !== "milestone") return "";
    const visionId = getVisionIdForGoal(goal);
    if (!visionId) return "";
    const vision = Goals.getById(visionId);
    if (!vision) return "";
    return `
      <p class="living-garden-detail-vision-line">
        This milestone belongs to:
        <button
          type="button"
          class="living-garden-detail-vision-link"
          data-action="open-vision"
          data-goal-id="${escapeHtmlFn(vision.id)}"
        >
          ${escapeHtmlFn(vision.title)}
        </button>
      </p>
    `;
  };

  const renderLinkedParentLine = () => {
    if (goal.level !== "intention" || !goal.parentId) return "";
    const parent = Goals.getById(goal.parentId);
    if (!parent) return "";
    const action = parent.level === "vision" ? "open-vision" : "open-goal";
    return `
      <p class="living-garden-detail-vision-line">
        Linked to:
        <button
          type="button"
          class="living-garden-detail-vision-link"
          data-action="${action}"
          data-goal-id="${escapeHtmlFn(parent.id)}"
        >
          ${escapeHtmlFn(parent.title)}
        </button>
      </p>
    `;
  };

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

  const renderEmptyKanban = () => `
    <div class="living-garden-empty-state">
      <div class="living-garden-empty-state-icon">${childLevel === "milestone" ? "🎯" : childLevel === "focus" ? "🔎" : "🌱"}</div>
      <h3 class="living-garden-empty-state-title">Ready to break this down?</h3>
      ${
        childLevel && options.showAddChildAction
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
    <section class="living-garden-detail" style="${accentStyle}" tabindex="-1">
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
              ${renderVisionLine()}
              ${renderLinkedParentLine()}
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
              <span class="living-garden-detail-stat-value">${statusLabel} ${completionRate}%</span>
              <span class="living-garden-detail-stat-label">Intentions done</span>
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
              ${renderKanbanColumn("To Do", kanban.todo, "living-garden-kanban-dot--todo", "Waiting to be planted")}
              ${renderKanbanColumn("In Progress", kanban.inProgress, "living-garden-kanban-dot--active", "No active growth here yet")}
              ${renderKanbanColumn("Done", kanban.done, "living-garden-kanban-dot--done", "Ready when you are")}
            </div>
          `
        : renderEmptyKanban()
  }
      </div>
    </section>
  `;
}

function attachGoalDetailInteractions(
  root: HTMLElement,
  callbacks: GoalDetailCallbacks,
): void {
  root.querySelectorAll<HTMLElement>("[data-action='open-goal']").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const goalId = el.dataset.goalId;
      if (goalId) {
        callbacks.onOpenGoal?.(goalId);
      }
    });
  });

  root
    .querySelectorAll<HTMLElement>("[data-action='open-vision']")
    .forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const goalId = el.dataset.goalId;
        if (goalId) {
          callbacks.onOpenVision?.(goalId);
        }
      });
    });

  root.querySelectorAll<HTMLElement>("[data-action='add-child']").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const parentId = btn.dataset.parentId;
      const parentLevel = btn.dataset.parentLevel as GoalLevel | undefined;
      const childLevel = btn.dataset.childLevel as AddChildGoalOpts["childLevel"] | undefined;
      if (!parentId || !parentLevel || !childLevel) return;
      callbacks.onAddChildGoal?.({
        parentId,
        parentLevel,
        childLevel,
      });
    });
  });

  root.querySelector<HTMLElement>("[data-action='goal-back']")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    callbacks.onClose?.();
  });

  root
    .querySelector<HTMLElement>("[data-action='open-goal-edit']")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const goalId = (event.currentTarget as HTMLElement).dataset.goalId;
      if (goalId) {
        callbacks.onOpenGoalEdit?.(goalId);
      }
    });
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

function renderGoalDetailPage(
  elements: UIElements,
  goalId: string,
  escapeHtmlFn: (text: string) => string,
  callbacks: GoalDetailCallbacks = {},
): void {
  const container = elements.calendarGrid;
  if (!container || !goalId) return;

  const goal = Goals.getById(goalId);
  if (!goal) return;

  container.className = "calendar-grid goal-detail-view";
  const detailMarkup = buildGoalDetailMarkup(goal, escapeHtmlFn, {
    showAddChildAction: Boolean(callbacks.onAddChildGoal),
  });

  container.innerHTML = `
    <div class="goal-detail-page">
      ${detailMarkup}
    </div>
  `;

  const detailRoot = container.querySelector(
    ".living-garden-detail",
  ) as HTMLElement | null;
  if (detailRoot) {
    attachGoalDetailInteractions(detailRoot, callbacks);
    detailRoot.focus();
  }
}

export const GoalDetailRenderer = {
  renderPage: renderGoalDetailPage,
  render: renderGoalDetailPage,

  buildMarkup(
    goal: Goal,
    escapeHtmlFn: (text: string) => string,
    options?: { showAddChildAction?: boolean },
  ): string {
    return buildGoalDetailMarkup(goal, escapeHtmlFn, {
      showAddChildAction: options?.showAddChildAction ?? true,
    });
  },

  hydrate(root: HTMLElement, callbacks: GoalDetailCallbacks): void {
    attachGoalDetailInteractions(root, callbacks);
  },
};
