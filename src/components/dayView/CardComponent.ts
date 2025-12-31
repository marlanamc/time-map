import type { Goal } from "../../types";
import type { GoalVariant, RenderCardOptions } from "./types";

// Import CONFIG from app - we'll need to handle this carefully
// For now, we'll pass it as a dependency
interface CardConfig {
  CATEGORIES: Record<string, { emoji: string; label: string; color: string }>;
  LEVELS: Record<string, { emoji: string; label: string; color: string }>;
  PRIORITIES: Record<string, { symbol: string }>;
}

export class CardComponent {
  private config: CardConfig;

  constructor(config: CardConfig) {
    this.config = config;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Render a day goal card
   */
  render(goal: Goal, opts: RenderCardOptions = {}): string {
    const cat = goal.category ? this.config.CATEGORIES[goal.category] : undefined;
    const isCompleted = goal.status === "done";
    const levelInfo = this.config.LEVELS[goal.level] || this.config.LEVELS.intention;
    const variant = opts.variant ?? "seed";

    // Determine parent level color
    const parentLevel = goal.parentLevel ?? goal.level;
    const parentColor = this.config.LEVELS[parentLevel]?.color || this.config.LEVELS.intention.color;

    const variantClass = this.getVariantClass(variant);
    const parentLevelClass = ` parent-level-${parentLevel}`;
    const styleAttr = opts.style
      ? ` style="${opts.style}; --parent-color: ${parentColor};"`
      : ` style="--parent-color: ${parentColor};"`;
    const classAttr = opts.className ? ` ${opts.className}` : "";
    const dragAttrs = this.getDragAttributes(variant, isCompleted);
    const resizeHandles = this.getResizeHandles(variant, isCompleted);

    return `
      <div class="day-goal-card ${variantClass}${classAttr}${parentLevelClass} ${isCompleted ? "completed" : ""}"
           data-goal-id="${goal.id}"
           data-parent-level="${parentLevel}"
           role="button"
           tabindex="0"${styleAttr}${dragAttrs}>
        ${resizeHandles}
        ${goal.parentLevel && goal.parentLevel !== goal.level ? `
          <div class="parent-level-badge" title="Part of ${this.config.LEVELS[goal.parentLevel].label}">
            <span class="parent-level-icon">${this.config.LEVELS[goal.parentLevel].emoji}</span>
          </div>
        ` : ''}
        <div class="day-goal-checkbox ${isCompleted ? "checked" : ""}"></div>
        <div class="day-goal-content">
          <div class="day-goal-level">
            <span class="day-goal-level-emoji">${levelInfo.emoji}</span>
            <span class="day-goal-level-label">${levelInfo.label}</span>
          </div>
          <div class="day-goal-title">${this.escapeHtml(goal.title)}</div>
          ${goal.description ? `<div class="day-goal-desc">${this.escapeHtml(goal.description)}</div>` : ""}
          <div class="day-goal-meta">
            ${this.renderTimeMeta(goal)}
            ${this.renderCategoryMeta(cat)}
            ${this.renderPriorityMeta(goal)}
            ${this.renderFocusButton(goal, variant)}
          </div>
        </div>
        ${this.renderProgressBar(goal)}
      </div>
    `;
  }

  /**
   * Create a DOM element from the rendered card HTML
   */
  createElement(goal: Goal, opts: RenderCardOptions = {}): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = this.render(goal, opts).trim();
    return template.content.firstChild as HTMLElement;
  }

  /**
   * Update an existing card element with new goal data
   */
  updateElement(element: HTMLElement, goal: Goal): void {
    const isCompleted = goal.status === "done";
    const levelInfo = this.config.LEVELS[goal.level] || this.config.LEVELS.intention;
    const cat = goal.category ? this.config.CATEGORIES[goal.category] : undefined;

    // Update completion state
    element.classList.toggle("completed", isCompleted);
    const checkbox = element.querySelector(".day-goal-checkbox");
    checkbox?.classList.toggle("checked", isCompleted);

    // Update level
    const levelEmoji = element.querySelector(".day-goal-level-emoji");
    const levelLabel = element.querySelector(".day-goal-level-label");
    if (levelEmoji) levelEmoji.textContent = levelInfo.emoji;
    if (levelLabel) levelLabel.textContent = levelInfo.label;

    // Update title and description
    const titleEl = element.querySelector(".day-goal-title");
    const descEl = element.querySelector(".day-goal-desc");
    if (titleEl) titleEl.textContent = goal.title;
    if (descEl) {
      if (goal.description) {
        descEl.textContent = goal.description;
      } else {
        descEl.remove();
      }
    }

    // Update time meta
    const timeMeta = element.querySelector(".day-goal-time");
    if (goal.startTime) {
      if (!timeMeta) {
        const meta = element.querySelector(".day-goal-meta");
        if (meta) {
          const timeEl = document.createElement("span");
          timeEl.className = "day-goal-time";
          timeEl.textContent = `🕒 ${goal.startTime}${goal.endTime ? ` - ${goal.endTime}` : ""}`;
          meta.prepend(timeEl);
        }
      } else {
        timeMeta.textContent = `🕒 ${goal.startTime}${goal.endTime ? ` - ${goal.endTime}` : ""}`;
      }
    } else if (timeMeta) {
      timeMeta.remove();
    }

    // Update category
    const catMeta = element.querySelector(".day-goal-cat");
    if (cat && catMeta) {
      (catMeta as HTMLElement).style.color = cat.color;
      catMeta.textContent = `${cat.emoji} ${cat.label}`;
    }

    // Update priority
    const priorityMeta = element.querySelector(".day-goal-priority");
    if (goal.priority !== "medium" && priorityMeta) {
      const symbol = this.config.PRIORITIES[goal.priority]?.symbol || "";
      priorityMeta.textContent = `${symbol} ${goal.priority}`;
      priorityMeta.className = `day-goal-priority priority-${goal.priority}`;
    } else if (goal.priority === "medium" && priorityMeta) {
      priorityMeta.remove();
    }

    // Update progress bar
    const progressContainer = element.querySelector(".day-goal-progress");
    if (goal.progress > 0 && goal.progress < 100) {
      if (progressContainer) {
        const progressFill = progressContainer.querySelector(".progress-fill-lg");
        if (progressFill) {
          (progressFill as HTMLElement).style.width = `${goal.progress}%`;
        }
      } else {
        const content = element.querySelector(".day-goal-content");
        if (content) {
          const progressDiv = document.createElement("div");
          progressDiv.className = "day-goal-progress";
          progressDiv.innerHTML = `
            <div class="progress-bar-lg">
              <div class="progress-fill-lg" style="width: ${goal.progress}%"></div>
            </div>
          `;
          content.after(progressDiv);
        }
      }
    } else if (progressContainer) {
      progressContainer.remove();
    }
  }

  private getVariantClass(variant: GoalVariant): string {
    switch (variant) {
      case "planter":
        return "day-goal-variant-planter";
      case "compost":
        return "day-goal-variant-compost";
      case "seed":
      default:
        return "day-goal-variant-seed";
    }
  }

  private getDragAttributes(variant: GoalVariant, isCompleted: boolean): string {
    if (isCompleted) return "";
    if (variant === "seed" || variant === "planter") {
      return ` draggable="true" aria-grabbed="false"`;
    }
    return "";
  }

  private getResizeHandles(variant: GoalVariant, isCompleted: boolean): string {
    if (variant === "planter" && !isCompleted) {
      return `
        <div class="planter-resize-handle planter-resize-handle-top" data-resize="top"></div>
        <div class="planter-resize-handle planter-resize-handle-bottom" data-resize="bottom"></div>
      `;
    }
    return "";
  }

  private renderTimeMeta(goal: Goal): string {
    if (!goal.startTime) return "";
    return `<span class="day-goal-time">🕒 ${goal.startTime}${goal.endTime ? ` - ${goal.endTime}` : ""}</span>`;
  }

  private renderCategoryMeta(cat: { emoji: string; label: string; color: string } | undefined): string {
    if (!cat) return "";
    return `<span class="day-goal-cat" style="color: ${cat.color}">${cat.emoji} ${cat.label}</span>`;
  }

  private renderPriorityMeta(goal: Goal): string {
    if (goal.priority === "medium") return "";
    const symbol = this.config.PRIORITIES[goal.priority]?.symbol || "";
    return `<span class="day-goal-priority priority-${goal.priority}">${symbol} ${goal.priority}</span>`;
  }

  private renderFocusButton(goal: Goal, variant: GoalVariant): string {
    if (variant === "compost") return "";
    return `<button class="btn-zen-focus" title="Zen Focus Mode" data-goal-id="${goal.id}">👁️ Focus</button>`;
  }

  private renderProgressBar(goal: Goal): string {
    if (goal.progress <= 0 || goal.progress >= 100) return "";
    return `
      <div class="day-goal-progress">
        <div class="progress-bar-lg">
          <div class="progress-fill-lg" style="width: ${goal.progress}%"></div>
        </div>
      </div>
    `;
  }
}
