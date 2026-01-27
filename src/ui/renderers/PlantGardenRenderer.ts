import { State } from "../../core/State";
import { Goals } from "../../core/Goals";
import { eventBus } from "../../core/EventBus";
import type { UIElements, Goal, GoalLevel } from "../../types";
import { getVisionAccent } from "../../utils/goalLinkage";
import { GoalDetailRenderer } from "./GoalDetailRenderer";

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

/** Build breadcrumb trail by walking up the parentId chain */
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

    // --- CHECK ACTIVE GOAL ---
    const currentActiveGoal = activeGoalId ? Goals.getById(activeGoalId) : null;
    if (activeGoalId && !currentActiveGoal) {
      activeGoalId = null;
    }

    if (activeGoalId && currentActiveGoal) {
      const year = State.viewingYear;
      const detailMarkup = GoalDetailRenderer.buildMarkup(currentActiveGoal, escapeHtmlFn, {
        showAddChildAction: Boolean(onAddGoalLinked || onAddGoal),
      });
      container.className = "garden-view-container living-garden";
      container.innerHTML = `
        <div class="garden-view">
          <div class="week-view-header">
            <h2 class="week-view-title">${year} Garden</h2>
          </div>
          <div class="living-garden-container living-garden-container--bare">
            ${detailMarkup}
          </div>
        </div>
      `;

      const detailRoot = container.querySelector(".living-garden-detail") as HTMLElement | null;
      if (detailRoot) {
        GoalDetailRenderer.hydrate(detailRoot, {
          onOpenGoal: (goalId) => {
            activeGoalId = goalId;
            eventBus.emit("view:changed", { transition: false });
          },
          onOpenGoalEdit: (goalId) => {
            onGoalClick(goalId);
          },
          onAddChildGoal: (opts) => {
            if (opts.childLevel === "intention") {
              onAddGoal?.("intention");
              return;
            }
            if (!onAddGoalLinked) {
              onAddGoal?.(opts.childLevel);
              return;
            }
            onAddGoalLinked({
              level: opts.childLevel,
              parentId: opts.parentId,
              parentLevel: opts.parentLevel,
              preselectedYear: State.viewingYear,
            });
          },
          onClose: () => {
            activeGoalId = null;
            eventBus.emit("view:changed", { transition: false });
          },
        });
      }

      return;
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
