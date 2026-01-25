/**
 * Map Page
 * A read-only hierarchical view of all goals organized by vision.
 * Shows the Vision → Milestone → Focus → Intention tree structure.
 * Purpose: See patterns and alignment, not for editing.
 */

import { eventBus } from "../../core/EventBus";
import { Goals } from "../../core/Goals";
import { computeGoalState, getStateIndicator, sortByState } from "../../core/GoalStateComputation";
import { checkVisionAlignment, describeGap } from "../../core/AlignmentChecker";
import type { Goal, GoalLevel, GoalState } from "../../types";

const OVERLAY_ID = "map-page-overlay";

let overlayElement: HTMLElement | null = null;

/**
 * Get all children of a goal at a specific level
 */
function getChildren(parentId: string, level: GoalLevel): Goal[] {
  return Goals.getAll().filter(
    (g) => g.parentId === parentId && g.level === level && !g.archivedAt
  );
}

/**
 * Build the goal hierarchy tree under a vision
 */
interface GoalNode {
  goal: Goal;
  state: GoalState;
  children: GoalNode[];
}

function buildGoalTree(vision: Goal): GoalNode {
  const state = computeGoalState(vision);
  const milestones = getChildren(vision.id, "milestone");

  const children: GoalNode[] = milestones.map((milestone) => {
    const milestoneState = computeGoalState(milestone);
    const focuses = getChildren(milestone.id, "focus");

    const focusNodes: GoalNode[] = focuses.map((focus) => {
      const focusState = computeGoalState(focus);
      const intentions = getChildren(focus.id, "intention");

      const intentionNodes: GoalNode[] = intentions.map((intention) => ({
        goal: intention,
        state: computeGoalState(intention),
        children: [],
      }));

      return {
        goal: focus,
        state: focusState,
        children: intentionNodes,
      };
    });

    return {
      goal: milestone,
      state: milestoneState,
      children: focusNodes,
    };
  });

  return {
    goal: vision,
    state,
    children,
  };
}

/**
 * Get level label for display
 */
function getLevelLabel(level: GoalLevel): string {
  switch (level) {
    case "vision":
      return "Vision";
    case "milestone":
      return "Milestone";
    case "focus":
      return "Focus";
    case "intention":
      return "Intention";
  }
}

/**
 * Render a single goal node in the tree
 */
function renderGoalNode(node: GoalNode, depth: number = 0): string {
  const { goal, state, children } = node;
  const indicator = getStateIndicator(state);
  const levelLabel = getLevelLabel(goal.level);
  const icon = goal.icon || "";
  const hasChildren = children.length > 0;

  const childrenHtml = hasChildren
    ? `<div class="map-node-children">${children.map((child) => renderGoalNode(child, depth + 1)).join("")}</div>`
    : "";

  return `
    <div class="map-node map-node-${goal.level} state-${state}" data-goal-id="${goal.id}" data-depth="${depth}">
      <div class="map-node-content">
        <span class="map-node-indicator">${indicator}</span>
        ${icon ? `<span class="map-node-icon">${icon}</span>` : ""}
        <span class="map-node-title">${goal.title}</span>
        <span class="map-node-level">${levelLabel}</span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

/**
 * Render a vision tree with alignment status
 */
function renderVisionTree(vision: Goal): string {
  const tree = buildGoalTree(vision);
  const alignment = checkVisionAlignment(vision);
  const gapDescription = alignment.gapType !== "none" ? describeGap(alignment) : "";

  return `
    <div class="map-vision-tree" data-vision-id="${vision.id}">
      <div class="map-vision-header">
        ${renderGoalNode(tree, 0)}
        ${
          gapDescription
            ? `<p class="map-vision-gap">${gapDescription}</p>`
            : `<p class="map-vision-aligned">Well aligned</p>`
        }
      </div>
    </div>
  `;
}

/**
 * Render the legend
 */
function renderLegend(): string {
  return `
    <div class="map-legend">
      <div class="map-legend-item">
        <span class="map-legend-indicator state-active">●</span>
        <span>Active</span>
      </div>
      <div class="map-legend-item">
        <span class="map-legend-indicator state-resting">◐</span>
        <span>Resting</span>
      </div>
      <div class="map-legend-item">
        <span class="map-legend-indicator state-dormant">○</span>
        <span>Dormant</span>
      </div>
    </div>
  `;
}

/**
 * Render the full map content
 */
function renderMapContent(): string {
  const visions = Goals.getAll().filter((g) => g.level === "vision" && !g.archivedAt);
  const sortedVisions = sortByState(visions);

  if (sortedVisions.length === 0) {
    return `
      <div class="map-empty">
        <p>No visions yet.</p>
        <p>Create a vision to see your goal hierarchy here.</p>
      </div>
    `;
  }

  const visionTrees = sortedVisions.map((vision) => renderVisionTree(vision)).join("");

  return `
    <div class="map-content">
      ${renderLegend()}
      <div class="map-trees">
        ${visionTrees}
      </div>
    </div>
  `;
}

/**
 * Render the full map page
 */
function render(): void {
  if (!overlayElement) return;

  overlayElement.innerHTML = `
    <div class="map-page-panel">
      <header class="map-header">
        <h2>Goal Map</h2>
        <p class="map-subtitle">See your goals organized by vision. Read-only view for patterns.</p>
        <button type="button" class="map-close-btn" aria-label="Close map">×</button>
      </header>
      <div class="map-body">
        ${renderMapContent()}
      </div>
    </div>
  `;

  // Attach close handler
  const closeBtn = overlayElement.querySelector(".map-close-btn");
  closeBtn?.addEventListener("click", close);

  // Handle clicking outside to close
  overlayElement.addEventListener("click", (event) => {
    if (event.target === overlayElement) {
      close();
    }
  });

  // Handle Escape key
  overlayElement.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });
}

/**
 * Open the map page
 */
function open(): void {
  if (!overlayElement) {
    overlayElement = document.createElement("div");
    overlayElement.id = OVERLAY_ID;
    overlayElement.className = "map-page-overlay";
    overlayElement.setAttribute("role", "dialog");
    overlayElement.setAttribute("aria-modal", "true");
    overlayElement.setAttribute("aria-label", "Goal Map");
    document.body.appendChild(overlayElement);
  }

  render();
  overlayElement.classList.add("visible");
  overlayElement.setAttribute("aria-hidden", "false");

  // Focus the close button for accessibility
  const closeBtn = overlayElement.querySelector(".map-close-btn") as HTMLElement | null;
  closeBtn?.focus();
}

/**
 * Close the map page
 */
function close(): void {
  if (!overlayElement) return;
  overlayElement.classList.remove("visible");
  overlayElement.setAttribute("aria-hidden", "true");
}

/**
 * Check if map is currently visible
 */
function isVisible(): boolean {
  return overlayElement?.classList.contains("visible") ?? false;
}

export const MapPage = {
  open,
  close,
  isVisible,
};

// Listen for map requests from the utility rail
eventBus.on("garden:map-requested", () => {
  MapPage.open();
});
