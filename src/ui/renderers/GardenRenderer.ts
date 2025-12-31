// ===================================
// Garden View Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { CONFIG } from '../../config';
import type { Goal, GoalLevel, UIElements } from '../../types';

type ContextLevel = Extract<GoalLevel, 'vision' | 'milestone' | 'focus' | 'intention'>;

function getContextGoals(viewDate: Date): Record<ContextLevel, Goal[]> {
  const dayGoals = Goals.getForDate(viewDate).filter((g) => g.status !== 'done');

  const weekYear = State.getWeekYear(viewDate);
  const weekNum = State.getWeekNumber(viewDate);
  const weekStart = State.getWeekStart(weekYear, weekNum);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekGoals = Goals.getForRange(weekStart, weekEnd).filter((g) => g.status !== 'done');

  const monthGoals = Goals.getByMonth(viewDate.getMonth(), viewDate.getFullYear()).filter((g) => g.status !== 'done');
  const yearGoals = Goals.getForRange(
    new Date(viewDate.getFullYear(), 0, 1),
    new Date(viewDate.getFullYear(), 11, 31),
  ).filter((g) => g.status !== 'done');

  return {
    intention: dayGoals.filter((g) => g.level === 'intention'),
    focus: weekGoals.filter((g) => g.level === 'focus'),
    milestone: monthGoals.filter((g) => g.level === 'milestone'),
    vision: yearGoals.filter((g) => g.level === 'vision'),
  };
}

function getEmptyStateMessage(level: ContextLevel): string {
  const messages: Record<ContextLevel, string> = {
    intention: "Every great journey starts with a single intention. What will you nurture today? 🌱",
    focus: "This week holds infinite potential. What deserves your focused energy? 🎯",
    milestone: "Celebrate your progress! What milestone will mark your growth? 🏆",
    vision: "Your future self is waiting. What vision will you bring to life? ✨",
  };
  return messages[level];
}

function renderGardenGroupHTML(
  level: ContextLevel,
  goals: Goal[],
  escapeHtmlFn: (t: string) => string,
): string {
  const cfg = CONFIG.LEVELS[level];
  const label = cfg?.label ?? level;
  const emoji = cfg?.emoji ?? '•';

  if (goals.length === 0) {
    return `
      <div class="garden-group garden-group-empty">
        <div class="garden-group-header">
          <span class="garden-group-title">${emoji} ${escapeHtmlFn(label)}</span>
          <span class="garden-count">0</span>
        </div>
        <div class="garden-empty-state">
          <div class="garden-empty-icon">${emoji}</div>
          <div class="garden-empty-message">${getEmptyStateMessage(level)}</div>
          <button class="garden-add-btn" data-level="${level}" aria-label="Add ${escapeHtmlFn(label)}">
            <span class="garden-add-icon">+</span>
            <span>Add ${escapeHtmlFn(label)}</span>
          </button>
        </div>
      </div>
    `;
  }

  const items = goals
    .map((g) => `<div class="garden-goal-item" data-goal-id="${escapeHtmlFn(g.id)}">${escapeHtmlFn(g.title)}</div>`)
    .join('');

  return `
    <div class="garden-group garden-group-has-items">
      <div class="garden-group-header">
        <span class="garden-group-title">${emoji} ${escapeHtmlFn(label)}</span>
        <span class="garden-count">${goals.length}</span>
      </div>
      <div class="garden-goals-list">
        ${items}
      </div>
    </div>
  `;
}

export const GardenRenderer = {
  render(
    elements: UIElements,
    escapeHtmlFn: (text: string) => string,
    onGoalClick: (goalId: string) => void,
    onAddGoal?: (level: GoalLevel) => void,
  ) {
    if (!State.data) return;

    const viewDate = State.viewingDate ?? new Date();
    const context = getContextGoals(viewDate);

    // Use calendarGrid as container (like other views)
    const container = elements.calendarGrid;
    if (!container) return;

    container.className = 'garden-view-container';
    container.innerHTML = `
      <div class="garden-view-header">
        <h1 class="garden-view-title">Your Garden</h1>
        <p class="garden-view-subtitle">Nurture your intentions, focus, milestones, and vision</p>
      </div>
      <div class="garden-content" id="gardenContent" role="list" aria-label="Your garden">
        ${[
          renderGardenGroupHTML('intention', context.intention, escapeHtmlFn),
          renderGardenGroupHTML('focus', context.focus, escapeHtmlFn),
          renderGardenGroupHTML('milestone', context.milestone, escapeHtmlFn),
          renderGardenGroupHTML('vision', context.vision, escapeHtmlFn),
        ].join('')}
      </div>
    `;

    // Attach click handlers for goals
    container
      .querySelectorAll<HTMLElement>('.garden-goal-item[data-goal-id]')
      .forEach((item) => {
        item.addEventListener('click', () => {
          const goalId = item.dataset.goalId;
          if (goalId) onGoalClick(goalId);
        });
      });

    // Attach click handlers for add buttons
    if (onAddGoal) {
      container
        .querySelectorAll<HTMLElement>('.garden-add-btn')
        .forEach((btn) => {
          btn.addEventListener('click', () => {
            const level = btn.dataset.level as GoalLevel;
            onAddGoal(level);
          });
        });
    }
  },
};

