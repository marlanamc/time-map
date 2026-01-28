/**
 * VisionDetailRenderer
 *
 * A calm, dedicated page that shows the "why" behind a Vision. The
 * hierarchy is defined in src/types.ts (Goal / GoalLevel) and this view
 * replaces the previous short vision detail snippet inside
 * src/ui/renderers/GardenSanctuaryRenderer.ts:renderVisionDetail.
 */
import { Goals } from "../../core/Goals";
import { computeGoalState } from "../../core/GoalStateComputation";
import { getVisionAccent } from "../../utils/goalLinkage";
import type { Goal, UIElements } from "../../types";

type VisionDetailCallbacks = {
  onClose?: () => void;
  onAddMilestone?: (visionId: string) => void;
  onMilestoneClick?: (milestoneId: string) => void;
};

function visionAccentStyle(vision: Goal): string {
  const accent = getVisionAccent(vision);
  return accent ? `--garden-accent: ${accent.color};` : "";
}

function getMilestonesForVision(visionId: string): Goal[] {
  const allGoals = Goals.getAll();
  return allGoals
    .filter(
      (goal) =>
        goal.level === "milestone" &&
        !goal.archivedAt &&
        goal.parentId === visionId,
    )
    .sort((a, b) => {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return aTime - bTime;
    });
}

function getMilestoneStatusLabel(milestone: Goal): string {
  switch (milestone.status) {
    case "in-progress":
      return "In progress";
    case "done":
      return "Completed";
    case "blocked":
    case "cancelled":
    case "archived":
      return "Resting";
    case "not-started":
    default:
      return "Not started";
  }
}

function formatDueDateLabel(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const dueDate = new Date(dateString);
  if (Number.isNaN(dueDate.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return dueDate.toLocaleDateString("en-US", options);
}

function findActiveMilestone(milestones: Goal[]): Goal | null {
  const inProgress =
    milestones.find((m) => m.status === "in-progress") ??
    milestones.find((m) => computeGoalState(m) === "active");
  if (inProgress) return inProgress;
  return null;
}

function isDescendantOf(desc: Goal, ancestorId: string): boolean {
  let current: Goal | undefined = desc;
  const seen = new Set<string>();
  while (current && current.parentId && !seen.has(current.id)) {
    if (current.parentId === ancestorId) return true;
    seen.add(current.id);
    current = Goals.getById(current.parentId);
  }
  return false;
}

function getMilestoneIntentions(milestone: Goal): Goal[] {
  const allGoals = Goals.getAll();
  return allGoals.filter(
    (goal) =>
      goal.level === "intention" &&
      (goal.parentId === milestone.id ||
        isDescendantOf(goal, milestone.id)),
  );
}

function buildMilestoneCard(
  milestone: Goal,
  escapeHtml: (text: string) => string,
  primaryIntentionsDone: string,
): string {
  const status = getMilestoneStatusLabel(milestone);
  const dueLabel = formatDueDateLabel(milestone.dueDate);
  const primaryLine = `${status} • ${milestone.title}`;
  const secondaryParts: string[] = [];
  if (dueLabel) {
    secondaryParts.push(`Due ${dueLabel}`);
  }
  if (primaryIntentionsDone) {
    secondaryParts.push(`${primaryIntentionsDone} intentions done`);
  }
  const secondaryLine = secondaryParts.join(" · ");
  return `
    <button
      type="button"
      class="vision-detail-milestone-card"
      data-action="open-milestone"
      data-goal-id="${escapeHtml(milestone.id)}"
    >
      <p class="vision-detail-milestone-card-primary">${escapeHtml(
        primaryLine,
      )}</p>
      ${
    secondaryLine
      ? `<p class="vision-detail-milestone-card-secondary">${escapeHtml(
        secondaryLine,
      )}</p>`
      : '<p class="vision-detail-milestone-card-secondary subtle-text">Set a timeframe when ready.</p>'
  }
    </button>
  `;
}

function buildVisionDetailMarkup(
  vision: Goal,
  escapeHtml: (text: string) => string,
): string {
  const milestones = getMilestonesForVision(vision.id);
  const activeMilestone = findActiveMilestone(milestones);
  const hasMilestones = milestones.length > 0;

  const rightNowPrimary = activeMilestone
    ? `Current milestone: “${activeMilestone.title}”.`
    : "No active milestone selected.";
  const rightNowSecondary = activeMilestone
    ? "This is the milestone you are working on now."
    : "Pick a milestone when you are ready to commit.";

  const milestoneCards = hasMilestones
    ? milestones
      .map((milestone) => {
        const intentions = getMilestoneIntentions(milestone);
        const percentText =
          intentions.length > 0
            ? `${Math.round(
              (intentions.filter((i) => i.status === "done").length /
                intentions.length) *
                100,
            )}%`
            : "";
        return buildMilestoneCard(milestone, escapeHtml, percentText);
      })
      .join("")
    : "";

  const milestoneEmptyState = hasMilestones
    ? ""
    : `
        <div class="vision-detail-empty">
          <strong>No milestones yet.</strong>
          <p>Add one to break this vision into concrete steps.</p>
        </div>
      `;

  const milestoneHelperText = "Steps that move this vision forward.";

  const tinyStepIntention = activeMilestone
    ? getMilestoneIntentions(activeMilestone).sort((a, b) => {
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDate - bDate;
    })[0]
    : undefined;

  const tinyStepText = tinyStepIntention
    ? `Next step: ${tinyStepIntention.title}`
    : "No next step chosen.";

  return `
    <div class="goal-detail-page vision-detail-page">
      <section class="living-garden-detail vision-detail-layout" style="${visionAccentStyle(vision)}">
        <div class="living-garden-detail-top">
          <button
            class="living-garden-detail-topbar-btn"
            data-action="vision-close"
          >← Back to garden</button>
          <div class="living-garden-detail-topbar-title">
            <h1 class="living-garden-detail-topbar-heading">VISION</h1>
          </div>
          <button
            class="living-garden-detail-topbar-btn living-garden-detail-topbar-action"
            data-action="add-milestone"
            data-vision-id="${escapeHtml(vision.id)}"
          >Add milestone</button>
        </div>

        <div class="living-garden-detail-body">
          <div class="living-garden-detail-header">
            <div class="living-garden-detail-info">
              <h2 class="living-garden-detail-title">${
                vision.icon ? `${escapeHtml(vision.icon)} ` : ""
              }${escapeHtml(vision.title)}</h2>
            <p class="living-garden-detail-description">
              Vision for 2026.
            </p>
            </div>
            <div class="living-garden-detail-progress">
              <div class="living-garden-progress-ring" aria-hidden="true">
                <circle class="living-garden-progress-ring-bg" cx="50" cy="50" r="42" />
                <circle
                  class="living-garden-progress-ring-fill"
                  cx="50"
                  cy="50"
                  r="42"
                  style="--progress: 0;"
                />
              </div>
              <div class="living-garden-progress-ring-label">
                <span class="living-garden-progress-ring-value">–</span>
                <span class="living-garden-progress-ring-text">
                  direction
                </span>
              </div>
            </div>
          </div>

          <div class="vision-right-now-card">
            <p class="vision-right-now-label">RIGHT NOW</p>
            <p class="vision-right-now-primary">${escapeHtml(rightNowPrimary)}</p>
            <p class="vision-right-now-secondary">${escapeHtml(
              rightNowSecondary,
            )}</p>
          </div>

          <div class="vision-milestones-section">
            <div class="vision-milestones-header">
              <p class="vision-milestones-title">Milestones for this vision</p>
              <p class="vision-milestones-helper">${escapeHtml(
                milestoneHelperText,
              )}</p>
            </div>
            <div class="vision-detail-milestone-list">
              ${milestoneCards}
            </div>
            ${milestoneEmptyState}
          </div>

          <div class="vision-tiny-step">
            <p class="vision-tiny-step-label">NEXT TINY STEP</p>
            <p class="vision-tiny-step-body">${escapeHtml(tinyStepText)}</p>
          </div>

          <footer class="vision-detail-summary">
            <p>You can change this vision and its milestones at any time.</p>
          </footer>
        </div>
      </section>
    </div>
  `;
}

function attachVisionDetailInteractions(
  root: HTMLElement,
  callbacks: VisionDetailCallbacks,
): void {
  root
    .querySelector<HTMLElement>("[data-action='vision-close']")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      callbacks.onClose?.();
    });

  root.querySelectorAll<HTMLElement>("[data-action='open-milestone']").forEach(
    (el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const goalId = el.dataset.goalId;
        if (goalId) {
          callbacks.onMilestoneClick?.(goalId);
        }
      });
    },
  );

  root
    .querySelector<HTMLElement>("[data-action='add-milestone']")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const visionId = (
        event.currentTarget as HTMLElement
      ).dataset.visionId;
      if (visionId) {
        callbacks.onAddMilestone?.(visionId);
      }
    });
}

export function renderVisionDetailPage(
  elements: UIElements,
  visionId: string,
  escapeHtml: (text: string) => string,
  callbacks: VisionDetailCallbacks = {},
): void {
  const container = elements.calendarGrid;
  if (!container) return;
  const vision = Goals.getById(visionId);
  if (!vision || vision.level !== "vision") {
    return;
  }

  container.className = "calendar-grid vision-detail-view";
  container.innerHTML = buildVisionDetailMarkup(vision, escapeHtml);

  const detailRoot = container.querySelector(".vision-detail-page");
  if (detailRoot) {
    attachVisionDetailInteractions(detailRoot as HTMLElement, callbacks);
  }
}

export const VisionDetailRenderer = {
  renderPage: renderVisionDetailPage,
};
