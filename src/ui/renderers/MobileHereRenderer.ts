// ===================================
// Mobile "Here" (Home tab) Renderer
// ===================================
import { State } from '../../core/State';
import { Goals } from '../../core/Goals';
import { CONFIG } from '../../config';
import type { Goal, GoalLevel, Priority, UIElements } from '../../types';

type ContextLevel = Extract<GoalLevel, 'vision' | 'milestone' | 'focus' | 'intention'>;

const priorityRank: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function pickPrimary(goals: Goal[]): Goal | undefined {
  const active = goals.filter((g) => g.status !== 'done');
  if (active.length === 0) return undefined;
  return [...active].sort((a, b) => {
    const pa = priorityRank[a.priority] ?? 99;
    const pb = priorityRank[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;

    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0];
}

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

function renderContextHTML(level: ContextLevel, goal: Goal | undefined, escapeHtmlFn: (t: string) => string): string {
  const cfg = CONFIG.LEVELS[level];
  const label = cfg?.label ?? level;
  const emoji = cfg?.emoji ?? '•';

  if (!goal) {
    return `
      <div class="mobile-here-context-item">
        <div class="mobile-here-context-label">${emoji} ${escapeHtmlFn(label)}</div>
        <div class="mobile-here-context-empty">No ${escapeHtmlFn(label.toLowerCase())} set</div>
      </div>
    `;
  }

  return `
    <div class="mobile-here-context-item" data-goal-id="${escapeHtmlFn(goal.id)}">
      <div class="mobile-here-context-label">${emoji} ${escapeHtmlFn(label)}</div>
      <div class="mobile-here-context-title">${escapeHtmlFn(goal.title)}</div>
    </div>
  `;
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
      <div class="mobile-here-group">
        <div class="mobile-here-group-header">
          <span class="mobile-here-group-title">${emoji} ${escapeHtmlFn(label)}</span>
          <span>0</span>
        </div>
        <div class="mobile-here-garden-empty">No active ${escapeHtmlFn(label.toLowerCase())}</div>
      </div>
    `;
  }

  const shown = goals.slice(0, 4);
  const remaining = Math.max(0, goals.length - shown.length);

  const items = shown
    .map((g) => `<div class="mobile-here-goal-item" data-goal-id="${escapeHtmlFn(g.id)}">${escapeHtmlFn(g.title)}</div>`)
    .join('');

  const more = remaining > 0
    ? `<div class="mobile-here-garden-empty">+${remaining} more</div>`
    : '';

  return `
    <div class="mobile-here-group">
      <div class="mobile-here-group-header">
        <span class="mobile-here-group-title">${emoji} ${escapeHtmlFn(label)}</span>
        <span>${goals.length}</span>
      </div>
      ${items}
      ${more}
    </div>
  `;
}

export const MobileHereRenderer = {
  render(elements: UIElements, escapeHtmlFn: (text: string) => string, onGoalClick: (goalId: string) => void) {
    if (!State.data) return;

    const viewDate = State.viewingDate ?? new Date();
    const context = getContextGoals(viewDate);

    // Context section
    if (elements.mobileHereContext) {
      const vision = pickPrimary(context.vision);
      const milestone = pickPrimary(context.milestone);
      const focus = pickPrimary(context.focus);
      const intention = pickPrimary(context.intention);

      elements.mobileHereContext.innerHTML = [
        renderContextHTML('vision', vision, escapeHtmlFn),
        renderContextHTML('milestone', milestone, escapeHtmlFn),
        renderContextHTML('focus', focus, escapeHtmlFn),
        renderContextHTML('intention', intention, escapeHtmlFn),
      ].join('');

      elements.mobileHereContext
        .querySelectorAll<HTMLElement>('.mobile-here-context-item[data-goal-id]')
        .forEach((item) => {
          item.addEventListener('click', () => {
            const goalId = item.dataset.goalId;
            if (goalId) onGoalClick(goalId);
          });
        });
    }

    // Garden section
    if (elements.mobileHereGarden) {
      elements.mobileHereGarden.innerHTML = [
        renderGardenGroupHTML('intention', context.intention, escapeHtmlFn),
        renderGardenGroupHTML('focus', context.focus, escapeHtmlFn),
        renderGardenGroupHTML('milestone', context.milestone, escapeHtmlFn),
        renderGardenGroupHTML('vision', context.vision, escapeHtmlFn),
      ].join('');

      elements.mobileHereGarden
        .querySelectorAll<HTMLElement>('.mobile-here-goal-item[data-goal-id]')
        .forEach((item) => {
          item.addEventListener('click', () => {
            const goalId = item.dataset.goalId;
            if (goalId) onGoalClick(goalId);
          });
        });
    }
  },
};

