/**
 * TaskList - Hybrid compact/expanded task display
 * @remarks Renders tasks in compact mode with expand-on-click functionality
 */

import type { Goal } from '../../../types';
import { CONFIG } from '../../../config/constants';

/**
 * Get emoji for a category
 * @param category - Category ID
 * @returns Emoji string
 */
function getCategoryEmoji(category: string | null | undefined): string {
  if (!category) return '📍';
  if (CONFIG.CATEGORIES[category as keyof typeof CONFIG.CATEGORIES]) {
    return CONFIG.CATEGORIES[category as keyof typeof CONFIG.CATEGORIES].emoji;
  }
  return '📍';
}

/**
 * Get color for a category
 * @param category - Category ID
 * @returns Color hex string
 */
function getCategoryColor(category: string | null | undefined): string {
  if (!category) return '#6b7280';
  if (CONFIG.CATEGORIES[category as keyof typeof CONFIG.CATEGORIES]) {
    return CONFIG.CATEGORIES[category as keyof typeof CONFIG.CATEGORIES].color;
  }
  return '#6b7280';
}

/**
 * Render a single task in compact mode
 * @param goal - Goal/task to render
 * @param showTime - Whether to show time range
 * @returns HTML string for compact task
 */
export function renderCompactTask(goal: Goal, showTime: boolean = false): string {
  const emoji = getCategoryEmoji(goal.category);
  const isDone = goal.status === 'done';
  const doneClass = isDone ? 'task-done' : '';

  const timeHtml = showTime && goal.startTime
    ? `<span class="task-time">${goal.startTime}${goal.endTime ? ' - ' + goal.endTime : ''}</span>`
    : '';

  return `
    <div
      class="task-item compact ${doneClass}"
      data-task-id="${goal.id}"
      data-expanded="false"
    >
      <div class="task-compact-view">
        <button
          type="button"
          class="task-checkbox ${isDone ? 'checked' : ''}"
          data-goal-id="${goal.id}"
          aria-label="${isDone ? 'Mark as incomplete' : 'Mark as complete'}"
          aria-checked="${isDone}"
        >
          ${isDone ? '✓' : ''}
        </button>
        <span class="task-emoji" aria-hidden="true">${emoji}</span>
        <span class="task-title">${escapeHtml(goal.title)}</span>
        ${timeHtml}
        <button
          type="button"
          class="task-expand-btn"
          data-task-id="${goal.id}"
          aria-label="Expand task details"
          aria-expanded="false"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="task-expanded-view" hidden>
        ${renderExpandedContent(goal)}
      </div>
    </div>
  `;
}

/**
 * Render expanded task content
 * @param goal - Goal/task to render
 * @returns HTML string for expanded content
 */
function renderExpandedContent(goal: Goal): string {
  const categoryColor = getCategoryColor(goal.category);
  const categoryLabel = goal.category
    ? CONFIG.CATEGORIES[goal.category as keyof typeof CONFIG.CATEGORIES]?.label || 'General'
    : 'General';

  const hasTime = goal.startTime && goal.endTime;
  const timeHtml = hasTime
    ? `
      <div class="task-meta-item">
        <span class="meta-icon">⏰</span>
        <span class="meta-label">Time</span>
        <span class="meta-value">${goal.startTime} - ${goal.endTime}</span>
      </div>
    `
    : '';

  const hasDuration = hasTime && goal.startTime && goal.endTime;
  const durationMin = hasDuration ? calculateDuration(goal.startTime, goal.endTime) : 0;
  const durationHtml = hasDuration
    ? `
      <div class="task-meta-item">
        <span class="meta-icon">⏱️</span>
        <span class="meta-label">Duration</span>
        <span class="meta-value">${formatDuration(durationMin)}</span>
      </div>
    `
    : '';

  const hasProgress = goal.progress > 0;
  const progressHtml = hasProgress
    ? `
      <div class="task-meta-item">
        <span class="meta-icon">📊</span>
        <span class="meta-label">Progress</span>
        <div class="task-progress-bar">
          <div class="progress-fill" style="width: ${goal.progress}%"></div>
        </div>
        <span class="meta-value">${goal.progress}%</span>
      </div>
    `
    : '';

  const hasDescription = goal.description && goal.description.trim().length > 0;
  const descriptionHtml = hasDescription
    ? `
      <div class="task-description">
        ${escapeHtml(goal.description)}
      </div>
    `
    : '';

  return `
    <div class="task-metadata">
      <div class="task-meta-item">
        <span class="meta-icon">🏷️</span>
        <span class="meta-label">Category</span>
        <span class="meta-value" style="color: ${categoryColor}">${categoryLabel}</span>
      </div>
      ${timeHtml}
      ${durationHtml}
      ${progressHtml}
    </div>

    ${descriptionHtml}

    <div class="task-actions">
      <button
        type="button"
        class="task-action-btn btn-schedule"
        data-goal-id="${goal.id}"
      >
        <span aria-hidden="true">📅</span>
        Schedule
      </button>
      <button
        type="button"
        class="task-action-btn btn-edit"
        data-goal-id="${goal.id}"
      >
        <span aria-hidden="true">✏️</span>
        Edit
      </button>
    </div>
  `;
}

/**
 * Calculate duration between two times
 * @param startTime - Start time (HH:MM)
 * @param endTime - End time (HH:MM)
 * @returns Duration in minutes
 */
function calculateDuration(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return endMinutes - startMinutes;
}

/**
 * Format duration minutes to human readable
 * @param minutes - Duration in minutes
 * @returns Formatted string (e.g., "1h 30m")
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

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
 * Set up event listeners for task expand/collapse
 * @param container - Container element with tasks
 */
export function setupTaskListToggles(container: HTMLElement): void {
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle expand button click
    const expandBtn = target.closest('.task-expand-btn') as HTMLElement;
    if (expandBtn) {
      e.stopPropagation();
      const taskId = expandBtn.dataset.taskId;
      if (taskId) {
        toggleTaskExpansion(container, taskId);
      }
      return;
    }

    // Handle task item click (anywhere except checkbox and buttons)
    const taskItem = target.closest('.task-item') as HTMLElement;
    if (taskItem && !target.closest('.task-checkbox') && !target.closest('.task-action-btn')) {
      const taskId = taskItem.dataset.taskId;
      if (taskId) {
        toggleTaskExpansion(container, taskId);
      }
    }
  });
}

/**
 * Toggle task expansion state
 * @param container - Container element
 * @param taskId - Task ID to toggle
 */
function toggleTaskExpansion(container: HTMLElement, taskId: string): void {
  const taskItem = container.querySelector(`.task-item[data-task-id="${taskId}"]`) as HTMLElement;
  if (!taskItem) return;

  const isExpanded = taskItem.dataset.expanded === 'true';
  const expandedView = taskItem.querySelector('.task-expanded-view') as HTMLElement;
  const expandBtn = taskItem.querySelector('.task-expand-btn') as HTMLElement;

  if (isExpanded) {
    // Collapse
    taskItem.classList.remove('expanded');
    taskItem.dataset.expanded = 'false';
    expandedView.hidden = true;
    expandBtn?.setAttribute('aria-expanded', 'false');
  } else {
    // Expand
    taskItem.classList.add('expanded');
    taskItem.dataset.expanded = 'true';
    expandedView.hidden = false;
    expandBtn?.setAttribute('aria-expanded', 'true');
  }
}

/**
 * Render a list of tasks
 * @param goals - Array of goals to render
 * @param showTime - Whether to show time for each task
 * @returns HTML string for task list
 */
export function renderTaskList(goals: Goal[], showTime: boolean = false): string {
  if (goals.length === 0) {
    return '<div class="task-list-empty">No tasks</div>';
  }

  return goals.map(goal => renderCompactTask(goal, showTime)).join('');
}
