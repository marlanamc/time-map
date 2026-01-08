/**
 * ContextStack - Stacked context cards (Vision/Milestone/Focus)
 * @remarks Renders context goals with rotation and depth effects
 */

import type { Goal } from "../../types";
import { CONFIG } from "../../config/constants";

/**
 * Escape HTML to prevent XSS
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get color for a goal level
 * @param level - Goal level (vision/milestone/focus)
 * @returns Color hex string
 */
function getLevelColor(level: 'vision' | 'milestone' | 'focus'): string {
  if (CONFIG.LEVELS[level]) {
    return CONFIG.LEVELS[level].color;
  }
  return '#6b7280';
}

/**
 * Get emoji for a goal level
 * @param level - Goal level (vision/milestone/focus)
 * @returns Emoji string
 */
function getLevelEmoji(level: 'vision' | 'milestone' | 'focus'): string {
  if (CONFIG.LEVELS[level]) {
    return CONFIG.LEVELS[level].emoji;
  }
  return '✨';
}

/**
 * Get label for a goal level
 * @param level - Goal level (vision/milestone/focus)
 * @returns Label string
 */
function getLevelLabel(level: 'vision' | 'milestone' | 'focus'): string {
  if (CONFIG.LEVELS[level]) {
    return CONFIG.LEVELS[level].label;
  }
  return 'Goal';
}

/**
 * Render a single stacked context card
 * @param level - Goal level (vision/milestone/focus)
 * @param goals - Goals for this level
 * @param stackIndex - Position in stack (0 = top, 1 = middle, 2 = bottom)
 * @returns HTML string for the card
 */
export function renderContextCard(
  level: 'vision' | 'milestone' | 'focus',
  goals: Goal[],
  stackIndex: number
): string {
  if (goals.length === 0) return '';

  const emoji = getLevelEmoji(level);
  const label = getLevelLabel(level);
  const color = getLevelColor(level);

  // Take first 2 goals to display
  const shown = goals.slice(0, 2);
  const remaining = Math.max(0, goals.length - shown.length);

  // Calculate rotation and offset for stacking effect
  // Top card (index 0): 2.5deg rotation
  // Middle card (index 1): -1.5deg rotation
  // Bottom card (index 2): 0deg rotation
  const rotations = [2.5, -1.5, 0];
  const rotation = rotations[stackIndex] || 0;

  // Offset each card slightly for depth
  const offsetY = stackIndex * 4; // 4px vertical offset
  const offsetX = stackIndex * 2; // 2px horizontal offset

  return `
    <div
      class="context-stack-card"
      data-level="${level}"
      data-stack-index="${stackIndex}"
      style="
        --card-rotation: ${rotation}deg;
        --card-offset-y: ${offsetY}px;
        --card-offset-x: ${offsetX}px;
        --card-color: ${color};
        z-index: ${10 - stackIndex};
      "
    >
      <div class="context-card-header">
        <span class="context-card-emoji" aria-hidden="true">${emoji}</span>
        <span class="context-card-label">${label}</span>
        ${goals.length > 1 ? `<span class="context-card-count">${goals.length}</span>` : ''}
      </div>

      <div class="context-card-goals">
        ${shown
          .map(
            (g, idx) => `
          <button
            type="button"
            class="context-goal-item ${idx === 0 ? 'primary' : 'secondary'}"
            data-goal-id="${g.id}"
            data-level="${level}"
            title="${escapeHtml(g.title)}"
          >
            <span class="context-goal-title">${escapeHtml(g.title)}</span>
            ${g.progress > 0 ? `<span class="context-goal-progress">${g.progress}%</span>` : ''}
          </button>
        `
          )
          .join('')}

        ${
          remaining > 0
            ? `
          <button
            type="button"
            class="context-goal-more"
            data-level="${level}"
            aria-label="View ${remaining} more ${label.toLowerCase()} goals"
          >
            +${remaining} more
          </button>
        `
            : ''
        }
      </div>

      <div class="context-card-shimmer" aria-hidden="true"></div>
    </div>
  `;
}

/**
 * Render the complete context stack
 * @param contextGoals - Object with vision, milestone, and focus goals
 * @returns HTML string for the stacked cards
 */
export function renderContextStack(contextGoals: {
  vision: Goal[];
  milestone: Goal[];
  focus: Goal[];
}): string {
  const hasAny =
    contextGoals.vision.length > 0 ||
    contextGoals.milestone.length > 0 ||
    contextGoals.focus.length > 0;

  if (!hasAny) {
    return `
      <div class="context-stack-empty">
        <p>No context goals yet</p>
        <p class="context-stack-hint">Set your vision, milestones, and focus areas</p>
      </div>
    `;
  }

  // Render cards in order: vision (top), milestone (middle), focus (bottom)
  const levels: Array<{ level: 'vision' | 'milestone' | 'focus'; goals: Goal[] }> = [
    { level: 'vision', goals: contextGoals.vision },
    { level: 'milestone', goals: contextGoals.milestone },
    { level: 'focus', goals: contextGoals.focus },
  ];

  // Filter out empty levels and assign stack indices
  const cardsHtml = levels
    .filter((item) => item.goals.length > 0)
    .map((item, stackIndex) => renderContextCard(item.level, item.goals, stackIndex))
    .join('');

  return `
    <div class="context-stack">
      ${cardsHtml}
    </div>
  `;
}

/**
 * Set up event listeners for context stack interactions
 * @param container - Container element with context stack
 * @param onGoalClick - Callback when a goal is clicked
 * @param onExpandLevel - Callback when "more" button is clicked
 */
export function setupContextStack(
  container: HTMLElement,
  onGoalClick?: (goalId: string, level: string) => void,
  onExpandLevel?: (level: string) => void
): void {
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle goal item clicks
    const goalItem = target.closest('.context-goal-item') as HTMLElement;
    if (goalItem && onGoalClick) {
      const goalId = goalItem.dataset.goalId;
      const level = goalItem.dataset.level;
      if (goalId && level) {
        onGoalClick(goalId, level);
      }
      return;
    }

    // Handle "more" button clicks
    const moreBtn = target.closest('.context-goal-more') as HTMLElement;
    if (moreBtn && onExpandLevel) {
      const level = moreBtn.dataset.level;
      if (level) {
        onExpandLevel(level);
      }
      return;
    }

    // Handle card click for expand/collapse
    const card = target.closest('.context-stack-card') as HTMLElement;
    if (card && !goalItem && !moreBtn) {
      // Toggle expanded state
      const isExpanded = card.classList.contains('expanded');

      // Collapse all cards first
      container.querySelectorAll('.context-stack-card').forEach((c) => {
        c.classList.remove('expanded');
      });

      // Expand this card if it wasn't expanded
      if (!isExpanded) {
        card.classList.add('expanded');
      }
    }
  });

  // Add hover effects
  container.addEventListener('mouseenter', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest('.context-stack-card') as HTMLElement;

    if (card) {
      // Add hover state to the card
      card.classList.add('hover');
    }
  }, true);

  container.addEventListener('mouseleave', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest('.context-stack-card') as HTMLElement;

    if (card) {
      // Remove hover state from the card
      card.classList.remove('hover');
    }
  }, true);
}
