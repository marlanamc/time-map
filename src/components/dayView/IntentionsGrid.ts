/**
 * IntentionsGrid - Customizable common intentions display
 * @remarks Renders common intention templates with edit mode
 */

import type { CustomIntention } from "../../types";
import { IntentionsManager } from "../../core/IntentionsManager";
import { CONFIG } from "../../config/constants";

/**
 * Get emoji for a category, with fallback
 * @param category - Category ID
 * @param customEmoji - Custom emoji override
 * @returns Emoji string
 */
function getIntentionEmoji(category: string | null, customEmoji?: string): string {
  if (customEmoji) return customEmoji;
  if (!category) return '📍';
  if (CONFIG.CATEGORIES[category as keyof typeof CONFIG.CATEGORIES]) {
    return CONFIG.CATEGORIES[category as keyof typeof CONFIG.CATEGORIES].emoji;
  }
  return '📍';
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
 * Render a single intention button
 * @param intention - Custom intention to render
 * @returns HTML string for intention button
 */
export function renderIntentionButton(intention: CustomIntention): string {
  const emoji = getIntentionEmoji(intention.category, intention.emoji);

  return `
    <button
      type="button"
      class="intention-pill"
      draggable="true"
      data-intention-id="${intention.id}"
      data-title="${escapeHtml(intention.title)}"
      data-category="${escapeHtml(intention.category || '')}"
      data-duration="${intention.duration}"
      data-emoji="${escapeHtml(emoji)}"
    >
      <span class="intention-emoji" aria-hidden="true">${emoji}</span>
      <span class="intention-title">${escapeHtml(intention.title)}</span>
      <span class="intention-drag-handle" aria-hidden="true">⠿</span>
    </button>
  `;
}

/**
 * Render the intentions grid
 * @param intentions - Array of custom intentions to display
 * @returns HTML string for the grid
 */
export function renderIntentionsGrid(intentions?: CustomIntention[]): string {
  const items = intentions || IntentionsManager.getSorted();

  if (items.length === 0) {
    return `
      <div class="intentions-grid-empty">
        <p>No common intentions yet</p>
        <button type="button" class="btn-add-intention" data-action="customize">
          + Add your first common intention
        </button>
      </div>
    `;
  }

  const buttonsHtml = items.map(intention => renderIntentionButton(intention)).join('');

  return `
    <div class="intentions-grid">
      ${buttonsHtml}
    </div>
  `;
}

/**
 * Render the edit button for the intentions section
 * @returns HTML string for edit button
 */
export function renderIntentionsEditButton(): string {
  return `
    <button
      type="button"
      class="section-edit-btn"
      data-action="customize"
      aria-label="Customize common intentions"
      title="Customize common intentions"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M11.333 2L14 4.667l-9.334 9.333H2v-2.667L11.333 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Edit
    </button>
  `;
}

/**
 * Set up event listeners for intentions grid
 * @param container - Container element with intentions grid
 * @param onCustomize - Callback when customize button is clicked
 * @param onDragStart - Callback when intention drag starts
 */
export function setupIntentionsGrid(
  container: HTMLElement,
  onCustomize?: () => void,
  onDragStart?: (intention: CustomIntention) => void
): void {
  // Handle customize button clicks
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const customizeBtn = target.closest('[data-action="customize"]') as HTMLElement;

    if (customizeBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (onCustomize) {
        onCustomize();
      }
    }
  });

  // Handle drag start for intentions
  container.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    const intentionBtn = target.closest('.intention-pill') as HTMLElement;

    if (!intentionBtn || !e.dataTransfer) return;

    const intentionId = intentionBtn.dataset.intentionId;
    if (!intentionId) return;

    // Get intention from manager
    const intention = IntentionsManager.getById(intentionId);
    if (!intention) return;

    // Set drag data
    const dragData = {
      title: intention.title,
      category: intention.category || '',
      duration: intention.duration,
      emoji: intention.emoji || getIntentionEmoji(intention.category)
    };

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.setData('text/plain', intention.title);

    // Add dragging class
    intentionBtn.classList.add('is-dragging');

    // Call callback
    if (onDragStart) {
      onDragStart(intention);
    }
  });

  // Handle drag end
  container.addEventListener('dragend', (e) => {
    const target = e.target as HTMLElement;
    const intentionBtn = target.closest('.intention-pill') as HTMLElement;

    if (intentionBtn) {
      intentionBtn.classList.remove('is-dragging');
    }
  });
}

/**
 * Refresh intentions grid from IntentionsManager
 * @param container - Container element to update
 */
export function refreshIntentionsGrid(container: HTMLElement): void {
  // Try to find the intentions grid in the planner sidebar
  const intentionsGrid = container.querySelector('.intentions-grid');

  if (intentionsGrid) {
    // Update the existing grid
    const intentions = IntentionsManager.getSorted();
    intentionsGrid.outerHTML = renderIntentionsGrid(intentions);
    return;
  }

  // Fallback: try the old selector
  const gridContainer = container.querySelector('.section-content');
  if (!gridContainer) return;

  const intentions = IntentionsManager.getSorted();
  gridContainer.innerHTML = renderIntentionsGrid(intentions);
}
