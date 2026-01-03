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

// Render cosmic card for vision, milestone, focus, intention
function renderCosmicCardHTML(
  level: ContextLevel,
  goals: Goal[],
  escapeHtmlFn: (t: string) => string,
): string {
  const cfg = CONFIG.LEVELS[level];
  const label = cfg?.label ?? level;
  const emoji = cfg?.emoji ?? '•';

  if (goals.length === 0) {
    return `
      <div class="garden-group garden-group-empty" data-level="${level}">
        <div class="cosmic-card cosmic-card--${level} cosmic-card--empty">
          <div class="cosmic-card-header">
            <div class="cosmic-card-label">
              <span class="cosmic-card-emoji">${emoji}</span>
              <span class="cosmic-card-label-text">${escapeHtmlFn(label)}</span>
            </div>
          </div>
          <div class="cosmic-card-content">
            <div class="cosmic-empty-state">
              <div class="cosmic-empty-icon">${emoji}</div>
              <div class="cosmic-empty-message">${getEmptyStateMessage(level)}</div>
              <button class="cosmic-add-btn" data-level="${level}" aria-label="Add ${escapeHtmlFn(label)}">
                <span class="cosmic-add-icon">+</span>
                <span>Add ${escapeHtmlFn(label)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const goalItems = goals
    .map((g) => `
      <button
        type="button"
        class="cosmic-goal-item"
        data-goal-id="${escapeHtmlFn(g.id)}"
      >
        ${escapeHtmlFn(g.title)}
      </button>
    `)
    .join('');

  return `
    <div class="garden-group garden-group-has-items" data-level="${level}">
      <div class="cosmic-card cosmic-card--${level}">
        <div class="cosmic-card-header">
          <div class="cosmic-card-label">
            <span class="cosmic-card-emoji">${emoji}</span>
            <span class="cosmic-card-label-text">${escapeHtmlFn(label)}</span>
          </div>
          <span class="cosmic-card-count">${goals.length}</span>
        </div>
        <div class="cosmic-card-content">
          <div class="cosmic-goal-list">
            ${goalItems}
          </div>
        </div>
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
          renderCosmicCardHTML('vision', context.vision, escapeHtmlFn),
          renderCosmicCardHTML('milestone', context.milestone, escapeHtmlFn),
          renderCosmicCardHTML('focus', context.focus, escapeHtmlFn),
          renderCosmicCardHTML('intention', context.intention, escapeHtmlFn),
        ].join('')}
      </div>
    `;

    // Attach click handlers for goals (both cosmic and simple)
    container
      .querySelectorAll<HTMLElement>('.cosmic-goal-item[data-goal-id]')
      .forEach((item) => {
        item.addEventListener('click', () => {
          const goalId = item.dataset.goalId;
          if (goalId) onGoalClick(goalId);
        });
      });

    // Attach click handlers for add buttons (both cosmic and simple)
    if (onAddGoal) {
      container
        .querySelectorAll<HTMLElement>('.cosmic-add-btn')
        .forEach((btn) => {
          btn.addEventListener('click', () => {
            const level = btn.dataset.level as GoalLevel;
            onAddGoal(level);
          });
        });
    }
  },
};
