/**
 * SidebarRenderer - Main orchestrator for the liquid productivity sidebar
 * @remarks Coordinates all sidebar sections and rendering
 */

import type { Goal } from "../../types";
import type { ContextGoals } from './types';
import { renderSidebarSection, getSectionState } from './SidebarSection';
import { renderTaskList } from './TaskList';
import { renderIntentionsGrid, renderIntentionsEditButton } from './IntentionsGrid';
import { renderCustomizationPanel } from './CustomizationPanel';
import { renderContextStack } from './ContextStack';

/**
 * Check if a goal belongs to a specific date
 * @param goal - Goal to check
 * @param date - Target date
 * @returns True if goal's due date matches target date
 */
function isGoalForDate(goal: Goal, date: Date): boolean {
  if (goal.dueDate) {
    const dueDate = new Date(goal.dueDate);
    return dueDate.toDateString() === date.toDateString();
  }
  return false;
}

/**
 * Parse time string to minutes
 * @param time - Time string (HH:MM)
 * @returns Minutes from midnight
 */
function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Render context goals section (Vision/Milestone/Focus) with stacked cards
 * @param contextGoals - Context goals to render
 * @returns HTML string for context section
 */
function renderContextGoalsSection(contextGoals?: ContextGoals): string {
  if (!contextGoals) return '';

  const hasAny = contextGoals.vision.length > 0 || contextGoals.milestone.length > 0 || contextGoals.focus.length > 0;
  if (!hasAny) return '';

  const content = renderContextStack({
    vision: contextGoals.vision,
    milestone: contextGoals.milestone,
    focus: contextGoals.focus
  });

  return `
    <div class="planner-sidebar-section">
      ${content}
    </div>
  `;
}

/**
 * Render date navigation header
 * @param date - Current date
 * @returns HTML string for date header
 */
function renderDateHeader(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const ordinal =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
      ? 'nd'
      : day % 10 === 3 && day !== 13
      ? 'rd'
      : 'th';
  const dayName = `${weekday}, ${month} ${day}${ordinal}`;

  return `
    <div class="planner-sidebar-header">
      <h3>${dayName}</h3>
    </div>
    <div class="planner-sidebar-actions">
      <div class="planner-date-nav" role="group" aria-label="Day navigation">
        <button class="btn-icon btn-planner-prev" type="button" aria-label="Previous day" title="Previous day">‹</button>
        <button class="btn-icon btn-planner-next" type="button" aria-label="Next day" title="Next day">›</button>
      </div>
      <button class="btn-icon btn-planner-add" type="button" aria-label="Add task" title="Add task">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  `;
}

/**
 * SidebarRenderer class
 * @remarks Renders the complete sidebar with all sections
 */
export class SidebarRenderer {
  /**
   * Render the sidebar HTML
   * @param date - Current viewing date
   * @param allGoals - All goals for filtering
   * @param contextGoals - Optional context goals (Vision/Milestone/Focus)
   * @returns HTML string for the sidebar
   */
  static render(date: Date, allGoals: Goal[], contextGoals?: ContextGoals): string {
    // Filter goals for this date (intentions only)
    const dayGoals = allGoals
      .filter((g) => isGoalForDate(g, date))
      .filter((g) => g.level === 'intention');

    const todayIntentions = dayGoals.slice().sort((a, b) => {
      const aDone = Number(a.status === "done");
      const bDone = Number(b.status === "done");
      if (aDone !== bDone) return aDone - bDone;

      const aHasTime = Number(Boolean(a.startTime));
      const bHasTime = Number(Boolean(b.startTime));
      if (aHasTime !== bHasTime) return bHasTime - aHasTime;

      const aStart = a.startTime ? parseTimeToMinutes(a.startTime) ?? 9999 : 9999;
      const bStart = b.startTime ? parseTimeToMinutes(b.startTime) ?? 9999 : 9999;
      if (aStart !== bStart) return aStart - bStart;

      return a.title.localeCompare(b.title);
    });

    // Render sections
    const dateHeaderHtml = renderDateHeader(date);
    const contextHtml = renderContextGoalsSection(contextGoals);

    const todayContent =
      todayIntentions.length === 0
        ? '<div class="task-list-empty">No intentions yet</div>'
        : renderTaskList(todayIntentions, true);
    const todayHtml = renderSidebarSection("todayIntentions", "Today’s intentions", todayContent, {
      badge: todayIntentions.length,
      isCollapsed: getSectionState("todayIntentions"),
    });

    const intentionsContent = renderIntentionsGrid();
    const intentionsActions = renderIntentionsEditButton();
    const intentionsHtml = renderSidebarSection('intentions', 'Quick intentions', intentionsContent, {
      isCollapsed: getSectionState('intentions'),
      actions: intentionsActions,
    });

    // Combine all sections
    return `
      <aside class="planner-sidebar">
        ${dateHeaderHtml}
        ${contextHtml}
        ${todayHtml}
        ${intentionsHtml}
      </aside>
      ${renderCustomizationPanel()}
    `;
  }
}
