import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { eventBus } from "../../core/EventBus";
import type { UIElements, Goal, GoalLevel } from "../../types";
import { getVisionAccent } from "../../utils/goalLinkage";

/**
 * PlantGardenRenderer
 *
 * Renders the Garden View as a set of organic "Plants".
 * - Vision = Base/Root/Pot
 * - Milestones = Branches (Monthly)
 * - Focuses = Sub-branches (Weekly)
 * - Intentions = Leaves (Daily)
 */

// Internal state for the detail view
let activeGoalId: string | null = null;

// -- Helpers adapted from LivingGardenRenderer --

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

type PlantNode = {
  vision: Goal;
  milestones: Array<{
    goal: Goal;
    focuses: Array<{
      goal: Goal;
      intentions: Goal[];
    }>;
  }>;
};

export const PlantGardenRenderer = {
  render(
    elements: UIElements,
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
    onAddGoal?: (level: GoalLevel) => void,
    onAddGoalLinked?: (opts: any) => void,
  ) {
    if (!State.data) return;
    const container = elements.calendarGrid;
    if (!container) return;

    // Helper: Is Descendant check (used in renderGoalDetail)
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

    // Render Goal Detail View
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

      // Render kanban column
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

      // Render empty state
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

      // Render subtasks for intentions
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

    // --- CHECK ACTIVE GOAL ---
    const currentActiveGoal = activeGoalId ? Goals.getById(activeGoalId) : null;
    if (activeGoalId && currentActiveGoal) {
      // Reuse Living Garden styling for the detail view for consistency
      const year = State.viewingYear;
      container.className = "garden-view-container living-garden";
      container.innerHTML = `
        <div class="garden-view">
          <div class="week-view-header">
            <h2 class="week-view-title">${year} Garden</h2>
          </div>
          <div class="living-garden-container living-garden-container--bare">
            ${renderGoalDetail(currentActiveGoal)}
          </div>
        </div>
      `;

      // Detail View Interactions
      container
        .querySelector('[data-action="goal-back"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation();
          activeGoalId = null;
          eventBus.emit("view:changed", { transition: false });
        });

      // Edit
      container
        .querySelector('[data-action="open-goal-edit"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (activeGoalId) onGoalClick(activeGoalId); // Opens the edit modal
        });

      // Open items from Kanban/Breadcrumb
      container.querySelectorAll('[data-action="open-goal"]').forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = (el as HTMLElement).dataset.goalId;
          if (id) {
            activeGoalId = id;
            eventBus.emit("view:changed", { transition: false });
          }
        });
      });

      // Add Child
      container.querySelectorAll('[data-action="add-child"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const parentId = (btn as HTMLElement).dataset.parentId;
          if (!parentId) return;

          const childLevel = (btn as HTMLElement).dataset.childLevel as
            | "milestone"
            | "focus"
            | "intention";
          if (!childLevel) return;

          // Note: Intention is not in AddGoalLinkedOpts, assuming user wants milestone/focus or update opts
          // For now safely handling known types
          if (childLevel === "intention") {
            onAddGoal?.("intention"); // Use generic add or need specific intention adder
            return;
          }

          const parentLevel = (btn as HTMLElement).dataset
            .parentLevel as GoalLevel;

          if (onAddGoalLinked) {
            onAddGoalLinked({
              level: childLevel,
              parentId,
              parentLevel: parentLevel || "vision", // fallback
              preselectedYear: State.viewingYear,
            });
          }
        });
      });

      return; // Stop rendering plant view
    }

    // 1. Gather Data (The Ecosystem)
    const year = State.viewingYear;
    const visions = Goals.getAll().filter(
      (g) => g.level === "vision" && g.year === year,
    );

    // Sort visions by created or priority
    visions.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

    // Build the Tree Structure
    const plants: PlantNode[] = visions.map((vision) => {
      // Find Milestones linked to this Vision
      const milestones = Goals.getAll()
        .filter((g) => g.level === "milestone" && g.parentId === vision.id)
        .sort((a, b) => (a.month || 0) - (b.month || 0)); // Sort by month

      const milestoneNodes = milestones.map((milestone) => {
        // Find Focuses linked to this Milestone
        const focuses = Goals.getAll()
          .filter((g) => g.level === "focus" && g.parentId === milestone.id)
          .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)); // Sort by created

        const focusNodes = focuses.map((focus) => {
          // Find Intentions linked to this Focus
          const intentions = Goals.getAll().filter(
            (g) => g.level === "intention" && g.parentId === focus.id,
          );

          return { goal: focus, intentions };
        });

        return { goal: milestone, focuses: focusNodes };
      });

      return { vision, milestones: milestoneNodes };
    });

    // 2. Render Functions

    // Renders a single Intention Leaf
    const renderLeaf = (leaf: Goal) => {
      const isDone = leaf.status === "done";
      return `
        <div class="intention-leaf ${isDone ? "is-done" : ""}" 
             data-goal-id="${leaf.id}" role="button" aria-label="Intention: ${escapeHtmlFn(leaf.title)}">
           <span class="intention-leaf-icon">${isDone ? "✨" : "🍃"}</span>
           <span class="intention-leaf-text">${escapeHtmlFn(leaf.title)}</span>
        </div>
      `;
    };

    // Renders a Focus Sub-Branch
    const renderFocus = (focusNode: { goal: Goal; intentions: Goal[] }) => {
      const { goal, intentions } = focusNode;
      const progress = goal.progress || 0;
      return `
        <div class="focus-wrapper" data-focus-id="${goal.id}">
          <div class="focus-card ${progress >= 100 ? "is-done" : ""}" data-action="toggle-focus">
            <span class="focus-icon">${goal.icon || "🔎"}</span>
            <span class="focus-title">${escapeHtmlFn(goal.title)}</span>
            ${progress > 0 ? `<span class="focus-progress">${progress}%</span>` : ""}
          </div>
          <button class="living-garden-btn-ghost btn-tiny add-intention-btn" data-action="add-child" data-parent-id="${goal.id}" data-level="intention">+ Add Intention</button>
          <div class="intention-container">
             ${
               intentions.length > 0
                 ? intentions.map(renderLeaf).join("")
                 : `<div class="intention-leaf is-empty">No intentions yet</div>`
             }
          </div>
        </div>
      `;
    };

    // Renders a Milestone Branch
    const renderMilestone = (milestoneNode: { goal: Goal; focuses: any[] }) => {
      const { goal, focuses } = milestoneNode;
      const isDone = goal.status === "done";
      // Format: "January 2026"
      const date = new Date(year, goal.month || 0);
      const fullDate = date.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      return `
        <div class="plant-node">
          <div class="milestone-line"></div>
          <div class="milestone-branch-wrapper" data-milestone-id="${goal.id}">
            <div class="milestone-card ${isDone ? "is-done" : ""}" data-action="toggle-milestone">
              <span class="milestone-emoji">${goal.icon || "🎯"}</span>
              <div class="milestone-title">${escapeHtmlFn(goal.title)}</div>
              <div class="milestone-month">${escapeHtmlFn(fullDate)}</div>
            </div>
            <div class="focus-container">
              ${
                focuses.length > 0
                  ? focuses.map(renderFocus).join("")
                  : `<div class="focus-card is-empty">No focuses yet</div>`
              }
              <button class="living-garden-btn-ghost btn-small add-focus-btn" data-action="add-child" data-parent-id="${goal.id}" data-level="focus">+ Add Focus</button>
            </div>
          </div>
        </div>
      `;
    };

    // Renders the Vision Plant
    const renderPlant = (plant: PlantNode) => {
      const { vision, milestones } = plant;
      const accent = getVisionAccent(vision);
      const style = `--accent: ${accent?.color || "var(--sage)"};`;

      return `
        <div class="plant-plot" style="${style}" data-vision-id="${vision.id}">
          <div class="plant-stalk" style="height: ${milestones.length * 100}px; min-height: 50px;"></div>
          
          <div class="plant-base" data-action="toggle-plant">
            <span class="plant-base-icon">${vision.icon || "🌱"}</span>
            <div class="plant-base-title">${escapeHtmlFn(vision.title)}</div>
            <div class="plant-base-meta">${year} Vision</div>
          </div>

          <div class="plant-milestone-nodes">
            ${milestones.map(renderMilestone).join("")}
            <div class="plant-node add-node">
               <button class="living-garden-btn-ghost" data-action="add-child" data-parent-id="${vision.id}" data-level="milestone">
                 + Add Milestone
               </button>
            </div>
          </div>
        </div>
      `;
    };

    // 3. Assemble HTML
    const plantsHtml =
      plants.length > 0
        ? plants.map(renderPlant).join("")
        : `<div class="living-garden-empty">
            <h2>Ready to plant your garden?</h2>
            <p>Start a new vision for ${year} to begin.</p>
            <button class="living-garden-btn-primary" data-action="add-vision">Plant a Vision</button>
          </div>`;

    container.className = "garden-view-container plant-garden-view";
    container.innerHTML = `
      <div class="garden-view">
        <div class="week-view-header">
          <h2 class="week-view-title">${year} Garden</h2>
        </div>
        ${plantsHtml}
      </div>
    `;

    // 4. Interaction Handlers

    // Helper to handle goal clicks (opens stats/details)
    // Toggle Plant (Vision) Expansion
    container.querySelectorAll(".plant-base").forEach((base) => {
      // Single Click: Toggle Expansion
      base.addEventListener("click", (e) => {
        e.stopPropagation();
        const plot = base.closest(".plant-plot");
        plot?.classList.toggle("expanded");

        if (plot?.classList.contains("expanded")) {
          container.querySelectorAll(".plant-plot").forEach((p) => {
            if (p !== plot) p.classList.remove("expanded");
          });
        }
      });

      // Double Click: Open Details
      base.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const id = (base.closest(".plant-plot") as HTMLElement).dataset
          .visionId;
        if (id) {
          activeGoalId = id;
          eventBus.emit("view:changed", { transition: false });
        }
      });
    });



    // Milestone Interactions
    container
      .querySelectorAll('[data-action="toggle-milestone"]')
      .forEach((card) => {
        // Single Click: Toggle Expansion
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          const wrapper = card.closest(".milestone-branch-wrapper");
          wrapper?.classList.toggle("expanded");

          if (wrapper?.classList.contains("expanded")) {
            const parentNode = wrapper.closest(".plant-milestone-nodes");
            parentNode
              ?.querySelectorAll(".milestone-branch-wrapper")
              .forEach((w) => {
                if (w !== wrapper) w.classList.remove("expanded");
              });
          }
        });

        // Double Click: Open Details
        card.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          const id = (card.closest(".milestone-branch-wrapper") as HTMLElement)
            .dataset.milestoneId;
          if (id) {
            activeGoalId = id;
            eventBus.emit("view:changed", { transition: false });
          }
        });
      });

    // Focus Interactions
    container
      .querySelectorAll('[data-action="toggle-focus"]')
      .forEach((card) => {
        // Single Click: Toggle Expansion
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          const wrapper = card.closest(".focus-wrapper");
          wrapper?.classList.toggle("expanded");
        });

        // Double Click: Open Details
        card.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          const id = (card.closest(".focus-wrapper") as HTMLElement).dataset
            .focusId;
          if (id) {
            activeGoalId = id;
            eventBus.emit("view:changed", { transition: false });
          }
        });
      });

    // Intention (Leaf) Clicks - Always open details
    container.querySelectorAll(".intention-leaf").forEach((leaf) => {
      leaf.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (leaf as HTMLElement).dataset.goalId;
        if (id) onGoalClick(id);
      });
    });

    // Add Child Handler
    container.querySelectorAll('[data-action="add-child"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const parentId = (btn as HTMLElement).dataset.parentId;
        const level = (btn as HTMLElement).dataset.level as GoalLevel;

        let parentLevel: GoalLevel = "vision";
        if (level === "focus") parentLevel = "milestone";
        if (level === "intention") parentLevel = "focus";

        if (onAddGoalLinked && parentId) {
          onAddGoalLinked({
            level,
            parentId,
            parentLevel,
            preselectedYear: year,
          });
        }
      });
    });

    // Add Vision
    container
      .querySelector('[data-action="add-vision"]')
      ?.addEventListener("click", () => {
        onAddGoal?.("vision");
      });
  },
};
